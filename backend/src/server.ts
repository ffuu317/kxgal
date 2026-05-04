import express, { NextFunction, Request, Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient, User } from "@prisma/client";

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

function serializePost(post: NonNullable<PostWithAuthor>, likedByMe = false) {
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
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: publicUser(comment.author)
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
      bio: "用真实图片和评论记录身边餐饮体验。"
    }
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
      tagsJson: JSON.stringify(["牛肉面", "午餐", "实拍"]),
      likeCount: 1,
      commentCount: 1
    }
  });
  await prisma.comment.create({
    data: {
      id: "c_demo",
      postId: post.id,
      authorId: user.id,
      content: "默认账号：13800000000 / 123456，也可以直接注册新账号。"
    }
  });
  await prisma.postLike.create({
    data: { id: "l_demo", postId: post.id, userId: user.id }
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
        avatarUrl: defaultAvatar
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
    res.json({ token, user: publicUser(user) });
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
        bio: typeof req.body.bio === "string" ? req.body.bio.trim() : user.bio
      }
    });
    res.json({ user: publicUser(nextUser) });
  })
);

api.post(
  ["/files/avatar", "/files/post-image"],
  asyncRoute(async (req, res) => {
    const user = await requireUser(req);
    const dataUrl = requireString(req.body, "dataUrl", 12);
    if (!dataUrl.startsWith("data:image/")) throw apiError(400, "只支持图片 data URL", "BAD_FILE");
    const file = await prisma.file.create({
      data: {
        id: id("f"),
        ownerId: user.id,
        url: dataUrl,
        mimeType: dataUrl.slice(5, dataUrl.indexOf(";")) || "image/*",
        size: Math.round((dataUrl.length * 3) / 4),
        purpose: req.path.endsWith("avatar") ? "avatar" : "post-image"
      }
    });
    res.status(201).json({ file });
  })
);

api.get(
  ["/posts", "/posts/search"],
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
    const post = await prisma.post.create({
      data: {
        id: id("p"),
        authorId: user.id,
        title,
        content,
        coverImageUrl: imageUrls[0],
        imageUrlsJson: JSON.stringify(imageUrls),
        merchantName: typeof req.body.merchantName === "string" ? req.body.merchantName.trim() : "",
        tagsJson: JSON.stringify(tags)
      },
      include: { author: true }
    });
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
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          id: id("c"),
          postId: post.id,
          authorId: user.id,
          content: requireString(req.body, "content")
        },
        include: { author: true }
      });
      await tx.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
      return created;
    });
    res.status(201).json({ comment: serializeComment(comment) });
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
