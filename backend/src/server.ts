import express, { NextFunction, Request, Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import type { Prisma, User } from "@prisma/client";
import { aiDetector } from "./ai-detector";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..");
const mobileDir = join(rootDir, "mobile");
const mobileDistDir = join(mobileDir, "dist");
const staticRoot = existsSync(mobileDistDir) ? mobileDistDir : mobileDir;
const port = Number(process.env.PORT || 3000);
const prisma = new PrismaClient();

const defaultAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#fff4de"/><circle cx="80" cy="64" r="34" fill="#f59f00"/><path d="M31 142c10-32 29-48 49-48s39 16 49 48" fill="#2f6f73"/></svg>`
  );

const demoImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650"><rect width="900" height="650" fill="#f6efe3"/><circle cx="305" cy="315" r="185" fill="#f9c74f"/><circle cx="545" cy="330" r="170" fill="#43aa8b"/><rect x="185" y="415" width="530" height="80" rx="22" fill="#2f3437"/><text x="450" y="470" text-anchor="middle" font-size="44" font-family="Arial" fill="#fff">今日食证</text></svg>`
  );

function demoFoodImage(label: string, base: string, plate: string, accent: string) {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650"><rect width="900" height="650" fill="${base}"/><circle cx="450" cy="325" r="215" fill="#fff8ec"/><circle cx="450" cy="325" r="168" fill="${plate}"/><path d="M270 418c116 70 244 70 360 0" fill="none" stroke="${accent}" stroke-width="34" stroke-linecap="round"/><circle cx="372" cy="280" r="38" fill="${accent}"/><circle cx="505" cy="246" r="28" fill="#f7fff4"/><circle cx="548" cy="340" r="48" fill="#f7fff4"/><rect x="215" y="486" width="470" height="78" rx="20" fill="#243231"/><text x="450" y="537" text-anchor="middle" font-size="42" font-family="Arial" fill="#fff">${label}</text></svg>`
    )
  );
}

const demoHotpotImage = demoFoodImage("鸳鸯火锅实拍", "#fff1e6", "#e76f51", "#2f7d72");
const demoBrunchImage = demoFoodImage("早午餐套餐", "#eef6f4", "#f4a261", "#457b9d");

type ApiError = Error & { status?: number; code?: string };
type PostWithAuthor = Awaited<ReturnType<typeof findPostWithAuthor>>;
type CommentWithAuthor = Prisma.CommentGetPayload<{ include: { author: true } }>;
type CommentWithPost = Prisma.CommentGetPayload<{ include: { author: true; post: { include: { author: true } } } }>;
type BountyWithUsers = Prisma.BountyGetPayload<{ include: { publisher: true; acceptor: true } }>;
type DbClient = PrismaClient | Prisma.TransactionClient;

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

function apiError(status: number, message: string, code = "BAD_REQUEST") {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  return error;
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, stored] = passwordHash.split(":");
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return expected.length === hash.length && timingSafeEqual(hash, expected);
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function publicUser(user: User | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    status: user.status,
    level: user.level,
    creditCoin: user.creditCoin,
    isMerchant: user.isMerchant,
    merchantStatus: user.merchantStatus,
    idCardVerified: user.idCardVerified,
    warningCount: user.warningCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function requireString(body: Record<string, unknown>, field: string, min = 1) {
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  if (value.length < min) throw apiError(400, `${field} 不能为空`);
  return value;
}

function routeParam(req: Request, field: string) {
  const value = req.params[field];
  if (typeof value !== "string") throw apiError(400, "路径参数无效");
  return value;
}

function normalizeMerchantMention(value: string) {
  return value.trim().replace(/^[@＠]\s*/, "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findMentionedMerchant(rawName: string, db: DbClient = prisma) {
  const merchantName = normalizeMerchantMention(rawName);
  if (!merchantName) return null;

  return db.merchant.findFirst({
    where: { businessName: merchantName },
    orderBy: { createdAt: "asc" }
  });
}

async function findMerchantMentionInText(text: string, db: DbClient = prisma) {
  if (!text.trim()) return null;

  const merchants = await db.merchant.findMany({ orderBy: { createdAt: "asc" } });
  return merchants.find((merchant) => {
    const pattern = new RegExp(`[@＠]\\s*${escapeRegExp(merchant.businessName)}`);
    return pattern.test(text);
  }) ?? null;
}

function getToken(req: Request) {
  const auth = req.header("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

async function currentUser(req: Request) {
  const token = getToken(req);
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  return session?.user ?? null;
}

async function requireUser(req: Request) {
  const user = await currentUser(req);
  if (!user) throw apiError(401, "请先登录", "UNAUTHORIZED");
  return user;
}

function serializePost(post: NonNullable<PostWithAuthor>, likedByMe = false) {
  return {
    id: post.id,
    authorId: post.authorId,
    title: post.title,
    content: post.content,
    coverImageUrl: post.coverImageUrl,
    imageUrls: parseJsonList(post.imageUrlsJson),
    merchantId: post.merchantId,
    merchantName: post.merchantName,
    tags: parseJsonList(post.tagsJson),
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    status: post.status,
    aiVerified: post.aiVerified,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: publicUser(post.author),
    likedByMe
  };
}

function serializeComment(comment: CommentWithAuthor | CommentWithPost) {
  const post = "post" in comment ? comment.post : null;

  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    content: comment.content,
    status: comment.status,
    aiVerified: comment.aiVerified,
    credibilityScore: comment.credibilityScore,
    credibilityLabel: comment.credibilityLabel,
    credibilityReason: comment.credibilityReason,
    credibilityModel: comment.credibilityModel,
    consumedCoins: comment.consumedCoins,
    receiptImageUrl: comment.receiptImageUrl,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: publicUser(comment.author),
    ...(post ? { post: serializePost(post) } : {})
  };
}

function serializeBounty(bounty: BountyWithUsers) {
  return {
    id: bounty.id,
    publisherId: bounty.publisherId,
    acceptorId: bounty.acceptorId,
    merchantId: bounty.merchantId,
    merchantName: bounty.merchantName,
    merchantAddress: bounty.merchantAddress,
    description: bounty.description,
    imageUrls: parseJsonList(bounty.imageUrlsJson),
    rewardCoins: bounty.rewardCoins,
    status: bounty.status,
    aiVerified: bounty.aiVerified,
    deadline: bounty.deadline,
    createdAt: bounty.createdAt,
    updatedAt: bounty.updatedAt,
    publisher: publicUser(bounty.publisher),
    acceptor: publicUser(bounty.acceptor)
  };
}

function findPostWithAuthor(id: string) {
  return prisma.post.findFirst({
    where: { id, status: "published" },
    include: { author: true }
  });
}

function findCommentsWithAuthor(postId: string) {
  return prisma.comment.findMany({
    where: { postId, status: "published" },
    include: { author: true },
    orderBy: { createdAt: "asc" }
  });
}

function getLevelByCoins(coins: number): string {
  if (coins >= 200) return "L100";
  if (coins >= 100) return "L10";
  if (coins >= 50) return "L1";
  return "L0";
}

function getCommentCost(level: string): number {
  switch (level) {
    case "L1": return 10;
    case "L10": return 5;
    case "L100": return 0;
    default: return 0;
  }
}

async function createTransaction(userId: string, type: string, amount: number, reason: string, relatedId?: string, db: DbClient = prisma) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw apiError(404, "用户不存在");
  
  const balanceBefore = user.creditCoin;
  const balanceAfter = balanceBefore + amount;
  const newLevel = getLevelByCoins(balanceAfter);
  
  await db.creditTransaction.create({
    data: {
      id: id("tx"),
      userId,
      type,
      amount,
      reason,
      relatedId,
      balanceBefore,
      balanceAfter
    }
  });
  
  await db.user.update({
    where: { id: userId },
    data: { creditCoin: balanceAfter, level: newLevel }
  });
  
  return { balanceAfter, newLevel };
}

async function verifyContent(content: string): Promise<string> {
  const result = await aiDetector.analyzeComment(content);
  return result.result;
}

async function verifyImage(imageDataUrl: string): Promise<string> {
  const result = await aiDetector.detectImageAuthenticity(imageDataUrl);
  return result.result;
}

async function ensureDemoShowcase(user: User, merchantId?: string | null) {
  const demoPosts = [
    {
      id: "p_demo",
      title: "街角面馆的牛肉面",
      content: "汤底清亮，牛肉分量比菜单图更扎实。午饭高峰要排队，整体值得再来。",
      image: demoImage,
      merchantName: "老巷牛肉面",
      tags: ["牛肉面", "午餐", "实拍"],
      likeCount: 18,
      commentCount: 1,
      commentId: "c_demo",
      comment: "默认账号：13800000000 / 123456，也可以直接注册新账号。"
    },
    {
      id: "p_demo_hotpot",
      title: "火锅店毛肚分量复核",
      content: "悬赏后补拍了现场图，毛肚盘子没有菜单图那么满，但锅底和蘸料稳定，适合四人拼单。",
      image: demoHotpotImage,
      merchantName: "红汤巷子火锅",
      tags: ["火锅", "悬赏验证", "分量"],
      likeCount: 42,
      commentCount: 1,
      commentId: "c_demo_hotpot",
      comment: "有现场照片和消费截图，评价可信度比普通探店高。"
    },
    {
      id: "p_demo_brunch",
      title: "社区咖啡店早午餐",
      content: "班尼迪克蛋现做，沙拉叶新鲜。套餐价格偏高，但出品和图片基本一致。",
      image: demoBrunchImage,
      merchantName: "晨光咖啡",
      tags: ["早午餐", "咖啡", "消费截图"],
      likeCount: 27,
      commentCount: 0,
      commentId: "",
      comment: ""
    }
  ];

  for (const item of demoPosts) {
    await prisma.post.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        content: item.content,
        coverImageUrl: item.image,
        imageUrlsJson: JSON.stringify([item.image]),
        merchantId: item.merchantName === "老巷牛肉面" ? merchantId ?? null : null,
        merchantName: item.merchantName,
        tagsJson: JSON.stringify(item.tags),
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        aiVerified: "verified"
      },
      create: {
        id: item.id,
        authorId: user.id,
        title: item.title,
        content: item.content,
        coverImageUrl: item.image,
        imageUrlsJson: JSON.stringify([item.image]),
        merchantId: item.merchantName === "老巷牛肉面" ? merchantId ?? null : null,
        merchantName: item.merchantName,
        tagsJson: JSON.stringify(item.tags),
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        aiVerified: "verified"
      }
    });

    if (item.commentId) {
      await prisma.comment.upsert({
        where: { id: item.commentId },
        update: {
          content: item.comment,
          aiVerified: "verified",
          credibilityScore: 88,
          credibilityLabel: "high",
          credibilityReason: "种子评论包含具体消费语境",
          credibilityModel: "seed",
          consumedCoins: 5
        },
        create: {
          id: item.commentId,
          postId: item.id,
          authorId: user.id,
          content: item.comment,
          aiVerified: "verified",
          credibilityScore: 88,
          credibilityLabel: "high",
          credibilityReason: "种子评论包含具体消费语境",
          credibilityModel: "seed",
          consumedCoins: 5
        }
      });
    }
  }

  await prisma.postLike.upsert({
    where: { postId_userId: { postId: "p_demo", userId: user.id } },
    update: {},
    create: { id: "l_demo", postId: "p_demo", userId: user.id }
  });

  await prisma.creditTransaction.upsert({
    where: { id: "tx_demo" },
    update: {},
    create: {
      id: "tx_demo",
      userId: user.id,
      type: "login",
      amount: 5,
      reason: "每日登录奖励",
      balanceBefore: 145,
      balanceAfter: 150
    }
  });

  await prisma.creditTransaction.upsert({
    where: { id: "tx_demo_task" },
    update: {},
    create: {
      id: "tx_demo_task",
      userId: user.id,
      type: "bounty_reward",
      amount: 50,
      reason: "完成悬赏任务奖励",
      balanceBefore: 100,
      balanceAfter: 150
    }
  });

  await prisma.bounty.upsert({
    where: { id: "b_demo" },
    update: {
      acceptorId: null,
      merchantId: merchantId ?? null,
      merchantName: "老巷牛肉面",
      merchantAddress: "北京市朝阳区某某街道123号",
      description: "请验证店内招牌牛肉面实物图是否与菜单一致，需上传现场图片。",
      rewardCoins: 50,
      status: "active",
      aiVerified: "pending",
      imageUrlsJson: "[]",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    create: {
      id: "b_demo",
      publisherId: user.id,
      merchantId: merchantId ?? null,
      merchantName: "老巷牛肉面",
      merchantAddress: "北京市朝阳区某某街道123号",
      description: "请验证店内招牌牛肉面实物图是否与菜单一致，需上传现场图片。",
      rewardCoins: 50,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
}

async function linkExistingMerchantContent() {
  const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: "asc" } });

  for (const merchant of merchants) {
    const names = [merchant.businessName, `@${merchant.businessName}`, `＠${merchant.businessName}`];

    await prisma.post.updateMany({
      where: { merchantId: null, merchantName: { in: names } },
      data: {
        merchantId: merchant.id,
        merchantName: merchant.businessName
      }
    });

    await prisma.bounty.updateMany({
      where: { merchantId: null, merchantName: { in: names } },
      data: {
        merchantId: merchant.id,
        merchantName: merchant.businessName,
        merchantAddress: merchant.businessAddress
      }
    });
  }
}

async function ensureSeedData() {
  const existingUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existingUser) {
    const merchant = await prisma.merchant.findFirst({ where: { userId: existingUser.id } });
    await ensureDemoShowcase(existingUser, merchant?.id);
    await linkExistingMerchantContent();
    return;
  }
  
  const user = await prisma.user.create({
    data: {
      id: "u_demo",
      phone: "13800000000",
      passwordHash: hashPassword("123456"),
      nickname: "食证体验官",
      avatarUrl: defaultAvatar,
      bio: "用真实图片和评论记录身边餐饮体验。",
      level: "L10",
      creditCoin: 150
    }
  });
  
  const merchant = await prisma.merchant.create({
    data: {
      id: "m_demo",
      userId: user.id,
      businessName: "老巷牛肉面",
      businessAddress: "北京市朝阳区某某街道123号",
      status: "approved"
    }
  });
  
  await prisma.user.update({
    where: { id: user.id },
    data: { isMerchant: true, merchantStatus: "approved" }
  });
  
  await ensureDemoShowcase(user, merchant.id);
  await linkExistingMerchantContent();
}

const app = express();
const api = express.Router();

app.use(express.json({ limit: "20mb" }));
app.use((req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

api.get("/health", (_req, res) => {
  res.json({ ok: true, service: "eattruth-demo" });
});

api.post(
  "/auth/register",
  asyncRoute(async (req, res) => {
    const phone = requireString(req.body, "phone", 6);
    const password = requireString(req.body, "password", 6);
    const nickname = requireString(req.body, "nickname");
    const fingerprintHash = typeof req.body.fingerprintHash === "string" ? req.body.fingerprintHash : "";
    
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) throw apiError(409, "手机号已注册", "PHONE_EXISTS");
    
    if (fingerprintHash) {
      const fingerprintExists = await prisma.user.findFirst({ where: { fingerprintHash } });
      if (fingerprintExists) throw apiError(409, "该指纹已绑定其他账号", "FINGERPRINT_EXISTS");
    }
    
    const user = await prisma.user.create({
      data: {
        id: id("u"),
        phone,
        passwordHash: hashPassword(password),
        nickname,
        avatarUrl: defaultAvatar,
        fingerprintHash: fingerprintHash || null,
        level: "L0",
        creditCoin: 0
      }
    });
    
    const token = id("token");
    await prisma.session.create({ data: { token, userId: user.id } });
    
    res.status(201).json({ token, user: publicUser(user) });
  })
);

api.post(
  "/auth/login",
  asyncRoute(async (req, res) => {
    const phone = requireString(req.body, "phone", 6);
    const password = requireString(req.body, "password");
    
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw apiError(401, "手机号或密码错误", "BAD_CREDENTIALS");
    }
    
    const token = id("token");
    await prisma.session.create({ data: { token, userId: user.id } });
    
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    const today = new Date().toDateString();
    const lastRewardDate = await prisma.creditTransaction.findFirst({
      where: { userId: user.id, type: "login", createdAt: { gte: new Date(today) } }
    });
    
    if (!lastRewardDate) {
      await createTransaction(user.id, "login", 5, "每日登录奖励");
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      res.json({ token, user: publicUser(updatedUser), loginReward: true });
    } else {
      res.json({ token, user: publicUser(user), loginReward: false });
    }
  })
);

api.post(
  "/auth/logout",
  asyncRoute(async (req, res) => {
    const token = getToken(req);
    if (token) await prisma.session.deleteMany({ where: { token } });
    res.json({ ok: true });
  })
);

api.get(
  "/users/me/bounties",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const bounties = await prisma.bounty.findMany({
      where: {
        OR: [
          { publisherId: user.id },
          { acceptorId: user.id }
        ]
      },
      include: { publisher: true, acceptor: true },
      orderBy: { createdAt: "desc" }
    });
    
    res.json({ bounties: bounties.map(serializeBounty) });
  })
);

api.get(
  "/users/me",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    res.json({ user: publicUser(user) });
  })
);

api.patch(
  "/users/me",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const nextUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        nickname: typeof req.body.nickname === "string" && req.body.nickname.trim() ? req.body.nickname.trim() : user.nickname,
        avatarUrl: typeof req.body.avatarUrl === "string" ? req.body.avatarUrl : user.avatarUrl,
        bio: typeof req.body.bio === "string" ? req.body.bio.trim() : user.bio,
        idCardVerified: typeof req.body.idCardVerified === "boolean" ? req.body.idCardVerified : user.idCardVerified
      }
    });
    res.json({ user: publicUser(nextUser) });
  })
);

api.post(
  ["/files/avatar", "/files/post-image", "/files/receipt", "/files/kitchen"],
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const dataUrl = requireString(req.body, "dataUrl", 12);
    if (!dataUrl.startsWith("data:image/")) throw apiError(400, "只支持图片 data URL", "BAD_FILE");
    
    const purpose = req.path.endsWith("avatar") ? "avatar" : 
                    req.path.endsWith("receipt") ? "receipt" :
                    req.path.endsWith("kitchen") ? "kitchen" : "post-image";
    
    const file = await prisma.file.create({
      data: {
        id: id("f"),
        ownerId: user.id,
        url: dataUrl,
        mimeType: dataUrl.slice(5, dataUrl.indexOf(";")) || "image/*",
        size: Math.round((dataUrl.length * 3) / 4),
        purpose
      }
    });
    res.status(201).json({ file });
  })
);

api.get(
  "/users/me/transactions",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json({ transactions });
  })
);

api.post(
  "/users/me/merchant-apply",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    
    if (user.isMerchant) throw apiError(400, "您已经是商家用户", "ALREADY_MERCHANT");
    
    const businessName = requireString(req.body, "businessName");
    const businessAddress = requireString(req.body, "businessAddress");
    const businessLicense = typeof req.body.businessLicense === "string" ? req.body.businessLicense : "";
    const licenseImageUrl = typeof req.body.licenseImageUrl === "string" ? req.body.licenseImageUrl : "";
    
    await prisma.merchant.create({
      data: {
        id: id("m"),
        userId: user.id,
        businessName,
        businessAddress,
        businessLicense,
        licenseImageUrl,
        status: "pending"
      }
    });
    
    await prisma.user.update({
      where: { id: user.id },
      data: { isMerchant: true, merchantStatus: "pending" }
    });
    
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    res.json({ user: publicUser(updatedUser), message: "商家认证申请已提交，等待审核" });
  })
);

api.get(
  "/users/me/merchant",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
    if (!merchant) {
      res.json({ merchant: null, posts: [], bounties: [] });
      return;
    }

    const [posts, bounties] = await Promise.all([
      prisma.post.findMany({
        where: { merchantId: merchant.id, status: "published" },
        include: { author: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.bounty.findMany({
        where: { merchantId: merchant.id },
        include: { publisher: true, acceptor: true },
        orderBy: { createdAt: "desc" }
      })
    ]);

    res.json({
      merchant,
      posts: posts.map((post) => serializePost(post)),
      bounties: bounties.map(serializeBounty)
    });
  })
);

api.get(
  "/posts",
  asyncRoute(async (req, res) => {
    const viewer = await currentUser(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    
    const posts = await prisma.post.findMany({
      where: {
        status: "published",
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
                { merchantName: { contains: q } },
                { tagsJson: { contains: q } }
              ]
            }
          : {})
      },
      include: { author: true },
      orderBy: { createdAt: "desc" }
    });
    
    const likedIds = viewer
      ? new Set(
          (
            await prisma.postLike.findMany({
              where: { userId: viewer.id, postId: { in: posts.map((post) => post.id) } },
              select: { postId: true }
            })
          ).map((like) => like.postId)
        )
      : new Set<string>();
    
    res.json({ posts: posts.map((post) => serializePost(post, likedIds.has(post.id))) });
  })
);

api.post(
  "/posts",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const title = requireString(req.body, "title");
    const content = requireString(req.body, "content");
    const imageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls.map(String).filter(Boolean) : [];
    
    if (imageUrls.length === 0) throw apiError(400, "至少上传一张图片", "IMAGE_REQUIRED");
    
    const tags = Array.isArray(req.body.tags) ? req.body.tags.map(String).map((tag: string) => tag.trim()).filter(Boolean) : [];
    const aiVerified = await verifyContent(content);
    const rawMerchantName = typeof req.body.merchantName === "string" ? req.body.merchantName : "";
    const mentionedMerchant =
      await findMentionedMerchant(rawMerchantName) ?? await findMerchantMentionInText(`${title} ${content}`);
    const merchantName = mentionedMerchant?.businessName ?? normalizeMerchantMention(rawMerchantName);
    
    const post = await prisma.post.create({
      data: {
        id: id("p"),
        authorId: user.id,
        title,
        content,
        coverImageUrl: imageUrls[0],
        imageUrlsJson: JSON.stringify(imageUrls),
        merchantId: mentionedMerchant?.id ?? null,
        merchantName,
        tagsJson: JSON.stringify(tags),
        aiVerified
      },
      include: { author: true }
    });
    
    if (aiVerified === "verified" && content.length > 50) {
      await createTransaction(user.id, "post_reward", 10, "优质帖子奖励", post.id);
    }
    
    res.status(201).json({ post: serializePost(post) });
  })
);

api.get(
  "/posts/:id",
  asyncRoute(async (req, res) => {
    const viewer = await currentUser(req);
    const post = await findPostWithAuthor(routeParam(req, "id"));
    if (!post) throw apiError(404, "资源不存在", "NOT_FOUND");
    
    const likedByMe = viewer ? Boolean(await prisma.postLike.findUnique({ where: { postId_userId: { postId: post.id, userId: viewer.id } } })) : false;
    res.json({ post: serializePost(post, likedByMe) });
  })
);

api.patch(
  "/posts/:id",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const post = await prisma.post.findFirst({ where: { id: routeParam(req, "id"), status: "published" } });
    if (!post) throw apiError(404, "资源不存在", "NOT_FOUND");
    if (post.authorId !== user.id) throw apiError(403, "只能编辑自己的帖子", "FORBIDDEN");
    
    const rawMerchantName = typeof req.body.merchantName === "string" ? req.body.merchantName : undefined;
    const mentionedMerchant =
      rawMerchantName === undefined
        ? await findMerchantMentionInText(`${typeof req.body.title === "string" ? req.body.title : post.title} ${typeof req.body.content === "string" ? req.body.content : post.content}`)
        : await findMentionedMerchant(rawMerchantName) ?? await findMerchantMentionInText(`${typeof req.body.title === "string" ? req.body.title : post.title} ${typeof req.body.content === "string" ? req.body.content : post.content}`);

    const nextPost = await prisma.post.update({
      where: { id: post.id },
      data: {
        title: typeof req.body.title === "string" ? req.body.title.trim() : post.title,
        content: typeof req.body.content === "string" ? req.body.content.trim() : post.content,
        merchantId: rawMerchantName === undefined ? mentionedMerchant?.id ?? post.merchantId : mentionedMerchant?.id ?? null,
        merchantName: rawMerchantName === undefined ? mentionedMerchant?.businessName ?? post.merchantName : mentionedMerchant?.businessName ?? normalizeMerchantMention(rawMerchantName),
        tagsJson: Array.isArray(req.body.tags) ? JSON.stringify(req.body.tags.map(String).filter(Boolean)) : post.tagsJson
      },
      include: { author: true }
    });
    res.json({ post: serializePost(nextPost) });
  })
);

api.delete(
  "/posts/:id",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const post = await prisma.post.findFirst({ where: { id: routeParam(req, "id"), status: "published" } });
    if (!post) throw apiError(404, "资源不存在", "NOT_FOUND");
    if (post.authorId !== user.id) throw apiError(403, "只能删除自己的帖子", "FORBIDDEN");
    
    await prisma.post.update({ where: { id: post.id }, data: { status: "deleted" } });
    res.json({ ok: true });
  })
);

api.get(
  "/posts/:id/comments",
  asyncRoute(async (req, res) => {
    const comments = await findCommentsWithAuthor(routeParam(req, "id"));
    res.json({ comments: comments.map(serializeComment) });
  })
);

api.post(
  "/posts/:id/comments",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const post = await prisma.post.findFirst({ where: { id: routeParam(req, "id"), status: "published" } });
    if (!post) throw apiError(404, "资源不存在", "NOT_FOUND");
    
    if (user.level === "L0") throw apiError(403, "L0用户不可发表评论，请先获取信用币升级", "LEVEL_LOW");
    
    const content = requireString(req.body, "content");
    const receiptImageUrl = typeof req.body.receiptImageUrl === "string" ? req.body.receiptImageUrl : undefined;
    
    if (user.level === "L1" && !receiptImageUrl) {
      throw apiError(400, "L1用户发表评论必须附带消费截图", "RECEIPT_REQUIRED");
    }
    
    const cost = getCommentCost(user.level);
    if (cost > 0 && user.creditCoin < cost) {
      throw apiError(400, "信用币不足", "INSUFFICIENT_COINS");
    }
    
    const aiResult = await aiDetector.analyzeComment(content);
    const aiVerified = aiResult.result;
    const credibility = aiResult.credibility ?? await aiDetector.assessCommentCredibility(content, aiResult);
    
    const comment = await prisma.$transaction(async (tx) => {
      if (cost > 0) {
        await tx.user.update({ where: { id: user.id }, data: { creditCoin: { decrement: cost } } });
        await tx.creditTransaction.create({
          data: {
            id: id("tx"),
            userId: user.id,
            type: "comment_cost",
            amount: -cost,
            reason: "发表评论消耗",
            relatedId: post.id,
            balanceBefore: user.creditCoin,
            balanceAfter: user.creditCoin - cost
          }
        });
      }
      
      const created = await tx.comment.create({
        data: {
          id: id("c"),
          postId: post.id,
          authorId: user.id,
          content,
          receiptImageUrl,
          consumedCoins: cost,
          aiVerified,
          credibilityScore: credibility.score,
          credibilityLabel: credibility.label,
          credibilityReason: credibility.reason,
          credibilityModel: credibility.model
        },
        include: { author: true }
      });
      
      await tx.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
      
      if (aiVerified === "fake") {
        await tx.user.update({ where: { id: user.id }, data: { warningCount: { increment: 1 } } });
        await createTransaction(user.id, "penalty", -20, "AI检测为水军发言", created.id, tx);
        
        const updatedUser = await tx.user.findUnique({ where: { id: user.id } });
        if (updatedUser!.warningCount >= 4) {
          await tx.user.update({ where: { id: user.id }, data: { status: "banned" } });
        }
      }
      
      return created;
    });
    
    res.status(201).json({ comment: serializeComment(comment), cost });
  })
);

api.delete(
  "/comments/:id",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const comment = await prisma.comment.findFirst({ where: { id: routeParam(req, "id"), status: "published" } });
    if (!comment) throw apiError(404, "资源不存在", "NOT_FOUND");
    if (comment.authorId !== user.id) throw apiError(403, "只能删除自己的评论", "FORBIDDEN");
    
    await prisma.$transaction([
      prisma.comment.update({ where: { id: comment.id }, data: { status: "deleted" } }),
      prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } })
    ]);
    
    res.json({ ok: true });
  })
);

api.post(
  "/posts/:id/like",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const post = await findPostWithAuthor(routeParam(req, "id"));
    if (!post) throw apiError(404, "资源不存在", "NOT_FOUND");
    
    const exists = await prisma.postLike.findUnique({ where: { postId_userId: { postId: post.id, userId: user.id } } });
    if (!exists) {
      await prisma.$transaction([
        prisma.postLike.create({ data: { id: id("l"), postId: post.id, userId: user.id } }),
        prisma.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } })
      ]);
    }
    
    const nextPost = await findPostWithAuthor(post.id);
    res.json({ post: serializePost(nextPost!, true) });
  })
);

api.delete(
  "/posts/:id/like",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const post = await findPostWithAuthor(routeParam(req, "id"));
    if (!post) throw apiError(404, "资源不存在", "NOT_FOUND");
    
    const deleted = await prisma.postLike.deleteMany({ where: { postId: post.id, userId: user.id } });
    if (deleted.count > 0) {
      await prisma.post.update({ where: { id: post.id }, data: { likeCount: { decrement: 1 } } });
    }
    
    const nextPost = await findPostWithAuthor(post.id);
    res.json({ post: serializePost(nextPost!, false) });
  })
);

api.get(
  "/users/me/posts",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const posts = await prisma.post.findMany({
      where: { authorId: user.id, status: "published" },
      include: { author: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ posts: posts.map((post) => serializePost(post)) });
  })
);

api.get(
  "/users/me/comments",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const comments = await prisma.comment.findMany({
      where: {
        authorId: user.id,
        status: "published",
        post: { status: "published" }
      },
      include: { author: true, post: { include: { author: true } } },
      orderBy: { createdAt: "desc" }
    });
    res.json({ comments: comments.map(serializeComment) });
  })
);

api.get(
  "/bounties/:id",
  asyncRoute(async (req, res) => {
    const user = await currentUser(req);
    const bounty = await prisma.bounty.findFirst({
      where: { id: routeParam(req, "id") },
      include: { publisher: true, acceptor: true }
    });
    
    if (!bounty) throw apiError(404, "悬赏任务不存在", "NOT_FOUND");
    
    res.json({ bounty: serializeBounty(bounty) });
  })
);

api.get(
  "/bounties",
  asyncRoute(async (req, res) => {
    const viewer = await currentUser(req);
    const bounties = await prisma.bounty.findMany({
      where: { status: "active" },
      include: { publisher: true, acceptor: true },
      orderBy: { createdAt: "desc" }
    });
    
    res.json({ bounties: bounties.map(serializeBounty) });
  })
);

api.post(
  "/bounties",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    
    const rawMerchantName = requireString(req.body, "merchantName");
    const rawMerchantAddress = requireString(req.body, "merchantAddress");
    const description = requireString(req.body, "description");
    const rewardCoins = typeof req.body.rewardCoins === "number" ? req.body.rewardCoins : 50;
    const deadlineDays = typeof req.body.deadlineDays === "number" ? req.body.deadlineDays : 7;
    const mentionedMerchant =
      await findMentionedMerchant(rawMerchantName) ?? await findMerchantMentionInText(description);
    const merchantName = mentionedMerchant?.businessName ?? normalizeMerchantMention(rawMerchantName);
    const merchantAddress = mentionedMerchant?.businessAddress ?? rawMerchantAddress;
    
    const deadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
    
    const bounty = await prisma.bounty.create({
      data: {
        id: id("b"),
        publisherId: user.id,
        merchantId: mentionedMerchant?.id ?? null,
        merchantName,
        merchantAddress,
        description,
        rewardCoins,
        deadline,
        aiVerified: "verified"
      },
      include: { publisher: true, acceptor: true }
    });
    
    res.status(201).json({ bounty: serializeBounty(bounty), aiVerified: "verified" });
  })
);

api.post(
  "/bounties/:id/accept",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const bounty = await prisma.bounty.findFirst({ where: { id: routeParam(req, "id"), status: "active" } });
    
    if (!bounty) throw apiError(404, "悬赏任务不存在或已结束", "NOT_FOUND");
    if (bounty.acceptorId) throw apiError(400, "该任务已被接取", "ALREADY_ACCEPTED");
    
    const updatedBounty = await prisma.bounty.update({
      where: { id: bounty.id },
      data: { acceptorId: user.id, status: "accepted" },
      include: { publisher: true, acceptor: true }
    });
    
    res.json({ bounty: serializeBounty(updatedBounty) });
  })
);

api.post(
  "/bounties/:id/submit",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const bounty = await prisma.bounty.findFirst({ where: { id: routeParam(req, "id") } });
    
    if (!bounty) throw apiError(404, "悬赏任务不存在", "NOT_FOUND");
    if (bounty.acceptorId !== user.id) throw apiError(403, "只能提交自己接取的任务", "NOT_ACCEPTOR");
    if (bounty.status !== "accepted") throw apiError(400, "任务状态不允许提交", "INVALID_STATUS");
    
    const imageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls.map(String).filter(Boolean) : [];
    if (imageUrls.length === 0) throw apiError(400, "至少上传一张图片", "IMAGE_REQUIRED");
    
    const aiVerified = await verifyImage(imageUrls[0]);
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedBounty = await tx.bounty.update({
        where: { id: bounty.id },
        data: {
          status: aiVerified === "verified" ? "completed" : "failed",
          aiVerified,
          imageUrlsJson: JSON.stringify(imageUrls)
        },
        include: { publisher: true, acceptor: true }
      });
      
      if (aiVerified === "verified") {
        await createTransaction(user.id, "bounty_reward", bounty.rewardCoins, "完成悬赏任务奖励", bounty.id, tx);
        return { bounty: serializeBounty(updatedBounty), success: true, reward: bounty.rewardCoins };
      } else {
        return { bounty: serializeBounty(updatedBounty), success: false, reward: 0 };
      }
    });
    
    res.json(result);
  })
);

api.post(
  "/merchant/kitchen-upload",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    
    if (!user.isMerchant) throw apiError(403, "只有商家用户可以上传后厨图片", "NOT_MERCHANT");
    
    const imageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls.map(String).filter(Boolean) : [];
    if (imageUrls.length === 0) throw apiError(400, "至少上传一张图片", "IMAGE_REQUIRED");
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const existingUpload = await prisma.creditTransaction.findFirst({
      where: {
        userId: user.id,
        type: "kitchen_reward",
        createdAt: { gte: startOfMonth, lte: endOfMonth }
      }
    });
    
    if (existingUpload) throw apiError(400, "本月已上传过后厨图片", "ALREADY_UPLOADED");
    
    const aiVerified = await verifyImage(imageUrls[0]);
    
    if (aiVerified === "verified") {
      await createTransaction(user.id, "kitchen_reward", 50, "后厨图片上传奖励");
    }
    
    res.json({ success: aiVerified === "verified", message: aiVerified === "verified" ? "上传成功，奖励50信用币" : "图片检测未通过" });
  })
);

api.get(
  "/merchants",
  asyncRoute(async (req, res) => {
    const merchants = await prisma.merchant.findMany({
      where: { status: "approved" },
      include: { user: true }
    });
    res.json({ merchants });
  })
);

api.get(
  "/merchants/:id/bounties",
  asyncRoute(async (req, res) => {
    const bounties = await prisma.bounty.findMany({
      where: { merchantId: routeParam(req, "id") },
      include: { publisher: true, acceptor: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ bounties });
  })
);

app.use("/api", api);
app.use(express.static(staticRoot));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.type("html");
  createReadStream(join(staticRoot, "index.html")).pipe(res);
});

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "资源不存在" });
});

app.use((error: ApiError, _req: Request, res: Response, _next: NextFunction) => {
  res.status(error.status || 500).json({
    error: error.code || (error.status ? "BAD_REQUEST" : "SERVER_ERROR"),
    message: error.message || "服务异常"
  });
});

ensureSeedData()
  .then(() => {
    app.listen(port, () => {
      console.log(`Eattruth API is running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
