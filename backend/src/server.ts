import express, { NextFunction, Request, Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient, User } from "@prisma/client";
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

type ApiError = Error & { status?: number; code?: string };
type PostWithAuthor = Awaited<ReturnType<typeof findPostWithAuthor>>;
type CommentWithAuthor = Awaited<ReturnType<typeof findCommentsWithAuthor>>[number];

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

function serializePost(post: any, likedByMe = false) {
  return {
    id: post.id,
    authorId: post.authorId,
    title: post.title,
    content: post.content,
    coverImageUrl: post.coverImageUrl,
    imageUrls: parseJsonList(post.imageUrlsJson),
    merchantName: post.merchantName,
    tags: parseJsonList(post.tagsJson),
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    status: post.status,
    aiVerified: post.aiVerified,
    postType: post.postType || "recommend",
    isBountyRecord: post.isBountyRecord || false,
    merchantId: post.merchantId || null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: publicUser(post.author),
    likedByMe
  };
}

function serializeComment(comment: CommentWithAuthor) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    content: comment.content,
    status: comment.status,
    aiVerified: comment.aiVerified,
    consumedCoins: comment.consumedCoins,
    receiptImageUrl: comment.receiptImageUrl,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: publicUser(comment.author)
  };
}

function serializeMerchant(merchant: any) {
  return {
    id: merchant.id,
    userId: merchant.userId,
    businessName: merchant.businessName,
    businessAddress: merchant.businessAddress,
    status: merchant.status,
    latitude: merchant.latitude,
    longitude: merchant.longitude,
    mapIcon: merchant.mapIcon || "🏠",
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
    user: publicUser(merchant.user)
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

async function updateUserLevel(userId: string, coins: number) {
  const newLevel = getLevelByCoins(coins);
  await prisma.user.update({ where: { id: userId }, data: { level: newLevel } });
  return newLevel;
}

async function createTransaction(userId: string, type: string, amount: number, reason: string, relatedId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw apiError(404, "用户不存在");
  
  const balanceBefore = user.creditCoin;
  const balanceAfter = balanceBefore + amount;
  
  await prisma.creditTransaction.create({
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
  
  const newLevel = await updateUserLevel(userId, balanceAfter);
  
  await prisma.user.update({
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

async function ensureSeedData() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) return;
  
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
  
  const user2 = await prisma.user.create({
    data: {
      id: "u_demo2",
      phone: "13900000000",
      passwordHash: hashPassword("123456"),
      nickname: "美食探索者",
      avatarUrl: defaultAvatar,
      bio: "探店达人，分享真实评价。",
      level: "L1",
      creditCoin: 60
    }
  });
  
  const merchant = await prisma.merchant.create({
    data: {
      id: "m_demo",
      userId: user.id,
      businessName: "老巷牛肉面",
      businessAddress: "北京市朝阳区某某街道123号",
      latitude: 39.9042,
      longitude: 116.4074,
      mapIcon: "🍜",
      status: "approved"
    }
  });
  
  const merchant2 = await prisma.merchant.create({
    data: {
      id: "m_demo2",
      userId: user2.id,
      businessName: "京城火锅店",
      businessAddress: "北京市海淀区某某街道456号",
      latitude: 39.9042,
      longitude: 116.5074,
      mapIcon: "🔥",
      status: "approved"
    }
  });
  
  await prisma.user.update({
    where: { id: user.id },
    data: { isMerchant: true, merchantStatus: "approved" }
  });
  
  const post = await prisma.post.create({
    data: {
      id: "p_demo",
      authorId: user.id,
      title: "街角面馆的牛肉面",
      content: "汤底清亮，牛肉分量比菜单图更扎实。午饭高峰要排队，整体值得再来。",
      coverImageUrl: demoImage,
      imageUrlsJson: JSON.stringify([demoImage]),
      merchantName: "老巷牛肉面",
      merchantId: merchant.id,
      postType: "recommend",
      tagsJson: JSON.stringify(["牛肉面", "午餐", "实拍"]),
      likeCount: 1,
      commentCount: 1,
      aiVerified: "verified"
    }
  });
  
  const post2 = await prisma.post.create({
    data: {
      id: "p_demo2",
      authorId: user.id,
      title: "这家火锅店需要避雷",
      content: "价格贵，分量少，服务态度差。不推荐去。",
      coverImageUrl: demoImage,
      imageUrlsJson: JSON.stringify([demoImage]),
      merchantName: "京城火锅店",
      merchantId: merchant2.id,
      postType: "avoid",
      tagsJson: JSON.stringify(["火锅", "避雷", "差评"]),
      likeCount: 0,
      commentCount: 0,
      aiVerified: "verified"
    }
  });
  
  await prisma.comment.create({
    data: {
      id: "c_demo",
      postId: post.id,
      authorId: user.id,
      content: "默认账号：13800000000 / 123456，也可以直接注册新账号。",
      aiVerified: "verified",
      consumedCoins: 5
    }
  });
  
  await prisma.postLike.create({
    data: { id: "l_demo", postId: post.id, userId: user.id }
  });
  
  await prisma.creditTransaction.create({
    data: {
      id: "tx_demo",
      userId: user.id,
      type: "login",
      amount: 5,
      reason: "每日登录奖励",
      balanceBefore: 145,
      balanceAfter: 150
    }
  });
  
  await prisma.bounty.create({
    data: {
      id: "b_demo",
      publisherId: user.id,
      merchantId: merchant.id,
      merchantName: "老巷牛肉面",
      merchantAddress: "北京市朝阳区某某街道123号",
      description: "验证店内招牌菜实物图是否与菜单一致",
      rewardCoins: 50,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  
  await prisma.merchantPhoto.create({
    data: {
      id: "mp_demo",
      merchantId: merchant.id,
      photoType: "kitchen",
      url: demoImage,
      aiVerified: "verified"
    }
  });
  
  const now = new Date();
  const weekNumber = Math.ceil((now.getDate() - 1) / 7);
  await prisma.weeklyRanking.create({
    data: {
      id: "wr_demo",
      weekNumber: weekNumber,
      year: now.getFullYear(),
      rankType: "popularity",
      merchantId: merchant.id,
      rank: 1,
      score: 100
    }
  });
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
    
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) throw apiError(409, "手机号已注册", "PHONE_EXISTS");
    
    const user = await prisma.user.create({
      data: {
        id: id("u"),
        phone,
        passwordHash: hashPassword(password),
        nickname,
        avatarUrl: defaultAvatar,
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
    
    res.json({ bounties });
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
    const merchant = await prisma.merchant.findUnique({ where: { userId: user.id }, include: { user: true } });
    res.json({ merchant: merchant ? serializeMerchant(merchant) : null });
  })
);

api.get(
  "/posts",
  asyncRoute(async (req, res) => {
    const viewer = await currentUser(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const postType = typeof req.query.postType === "string" ? req.query.postType : "all";
    
    const posts = await prisma.post.findMany({
      where: {
        status: "published",
        ...(postType !== "all" ? { postType: postType } : {}),
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
    const postType = typeof req.body.postType === "string" ? req.body.postType : "recommend";
    const merchantId = typeof req.body.merchantId === "string" ? req.body.merchantId : null;
    
    if (imageUrls.length === 0) throw apiError(400, "至少上传一张图片", "IMAGE_REQUIRED");
    
    const tags = Array.isArray(req.body.tags) ? req.body.tags.map(String).map((tag: string) => tag.trim()).filter(Boolean) : [];
    const aiVerified = await verifyContent(content);
    
    const post = await prisma.post.create({
      data: {
        id: id("p"),
        authorId: user.id,
        title,
        content,
        coverImageUrl: imageUrls[0],
        imageUrlsJson: JSON.stringify(imageUrls),
        merchantName: typeof req.body.merchantName === "string" ? req.body.merchantName.trim() : "",
        merchantId,
        postType,
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
    
    const nextPost = await prisma.post.update({
      where: { id: post.id },
      data: {
        title: typeof req.body.title === "string" ? req.body.title.trim() : post.title,
        content: typeof req.body.content === "string" ? req.body.content.trim() : post.content,
        merchantName: typeof req.body.merchantName === "string" ? req.body.merchantName.trim() : post.merchantName,
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
    
    const aiVerified = await verifyContent(content);
    
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
          aiVerified
        },
        include: { author: true }
      });
      
      await tx.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
      
      if (aiVerified === "fake") {
        await tx.user.update({ where: { id: user.id }, data: { warningCount: { increment: 1 } } });
        await createTransaction(user.id, "penalty", -20, "AI检测为水军发言", created.id);
        
        const updatedUser = await tx.user.findUnique({ where: { id: user.id } });
        if (updatedUser && updatedUser.warningCount >= 4) {
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
      where: { authorId: user.id, status: "published" },
      include: { author: true },
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
    
    res.json({ bounty });
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
    
    res.json({ bounties });
  })
);

api.post(
  "/bounties",
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    
    const merchantName = requireString(req.body, "merchantName");
    const merchantAddress = requireString(req.body, "merchantAddress");
    const description = requireString(req.body, "description");
    const rewardCoins = typeof req.body.rewardCoins === "number" ? req.body.rewardCoins : 50;
    const deadlineDays = typeof req.body.deadlineDays === "number" ? req.body.deadlineDays : 7;
    const merchantId = typeof req.body.merchantId === "string" ? req.body.merchantId : null;
    
    const deadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
    
    const bounty = await prisma.bounty.create({
      data: {
        id: id("b"),
        publisherId: user.id,
        merchantName,
        merchantAddress,
        description,
        rewardCoins,
        deadline,
        merchantId,
        aiVerified: "verified"
      },
      include: { publisher: true }
    });
    
    res.status(201).json({ bounty, aiVerified: "verified" });
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
    
    res.json({ bounty: updatedBounty });
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
        }
      });
      
      if (aiVerified === "verified") {
        await createTransaction(user.id, "bounty_reward", bounty.rewardCoins, "完成悬赏任务奖励", bounty.id);
        
        if (bounty.merchantId) {
          await tx.post.create({
            data: {
              id: id("p"),
              authorId: user.id,
              title: "悬赏探店: " + bounty.description.substring(0, 30),
              content: bounty.description,
              coverImageUrl: imageUrls[0],
              imageUrlsJson: JSON.stringify(imageUrls),
              merchantName: bounty.merchantName,
              merchantId: bounty.merchantId,
              isBountyRecord: true,
              tagsJson: JSON.stringify(["悬赏", "探店"]),
              aiVerified
            }
          });
        }
        
        return { bounty: updatedBounty, success: true, reward: bounty.rewardCoins };
      } else {
        return { bounty: updatedBounty, success: false, reward: 0 };
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
    
    const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
    if (!merchant) throw apiError(404, "商家信息不存在", "NOT_FOUND");
    
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
    
    await prisma.merchantPhoto.create({
      data: {
        id: id("mp"),
        merchantId: merchant.id,
        photoType: "kitchen",
        url: imageUrls[0],
        aiVerified
      }
    });
    
    if (aiVerified === "verified") {
      await createTransaction(user.id, "kitchen_reward", 50, "后厨图片上传奖励");
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { lastKitchenUpload: now }
      });
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
    res.json({ merchants: merchants.map(serializeMerchant) });
  })
);

api.get(
  "/merchants/:id",
  asyncRoute(async (req, res) => {
    const merchant = await prisma.merchant.findFirst({
      where: { id: routeParam(req, "id") },
      include: { user: true }
    });
    
    if (!merchant) throw apiError(404, "商家不存在", "NOT_FOUND");
    
    res.json({ merchant: serializeMerchant(merchant) });
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

api.get(
  "/merchants/:id/posts",
  asyncRoute(async (req, res) => {
    const merchantId = routeParam(req, "id");
    const viewer = await currentUser(req);
    
    const posts = await prisma.post.findMany({
      where: { merchantId: merchantId, status: "published" },
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

api.get(
  "/merchants/:id/photos",
  asyncRoute(async (req, res) => {
    const photos = await prisma.merchantPhoto.findMany({
      where: { merchantId: routeParam(req, "id") },
      orderBy: { uploadedAt: "desc" }
    });
    res.json({ photos });
  })
);

api.get(
  "/map/merchants",
  asyncRoute(async (req, res) => {
    const merchants = await prisma.merchant.findMany({
      where: {
        status: "approved",
        latitude: { not: null },
        longitude: { not: null }
      },
      include: { user: true }
    });
    res.json({ merchants: merchants.map(serializeMerchant) });
  })
);

api.get(
  "/rankings/weekly",
  asyncRoute(async (req, res) => {
    const now = new Date();
    const weekNumber = Math.ceil((now.getDate() - 1) / 7);
    const targetWeek = typeof req.query.week === "string" ? parseInt(req.query.week, 10) : weekNumber;
    const targetYear = typeof req.query.year === "string" ? parseInt(req.query.year, 10) : now.getFullYear();
    
    const rankings = await prisma.weeklyRanking.findMany({
      where: { weekNumber: targetWeek, year: targetYear },
      include: { merchant: { include: { user: true } }, user: true },
      orderBy: { rank: "asc" }
    });
    
    res.json({
      rankings: rankings.map(r => ({
        id: r.id,
        rank: r.rank,
        rankType: r.rankType,
        score: r.score,
        merchant: r.merchant ? serializeMerchant(r.merchant) : null,
        user: r.user ? publicUser(r.user) : null
      })),
      week: targetWeek,
      year: targetYear
    });
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
