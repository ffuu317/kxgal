# Eattruth 项目架构

## 快速启动

当前仓库已经包含一个 TS + React + Express + Prisma 可运行 demo。

### 1. 加载项目内 nvm

首次进入项目目录，先加载当前目录里的 nvm：

```bash
export NVM_DIR="$PWD/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use
```

### 2. 初始化数据库

首次启动前创建本地 SQLite 数据库，并生成 Prisma Client：

```bash
npm run db:push
```

### 3. 启动开发环境

开发模式会同时启动 Express 后端 API 和 Vite 前端：

```bash
npm run dev
```

启动后访问前端：

```text
http://127.0.0.1:5173
```

后端 API 地址：

```text
http://localhost:3000
```

默认体验账号：

```text
手机号：13800000000
密码：123456
```

## 常用命令

只启动后端 API：

```bash
npm run dev:api
```

只启动 Vite 前端：

```bash
npm run dev:web
```

类型检查：

```bash
npm run typecheck
```

构建前端静态资源：

```bash
npm run build
```

构建后只启动后端，托管 `mobile/dist`：

```bash
npm start
```

## 数据库

后端使用 Prisma，schema 在 `prisma/schema.prisma`，本地 SQLite 数据库在 `backend/data/dev.db`。首次启动时如果用户表为空，会自动创建默认体验账号和一条种子帖子。

修改 Prisma schema 后，重新同步数据库：

```bash
npm run db:push
```

只重新生成 Prisma Client：

```bash
npm run db:generate
```

Demo 覆盖第一版核心闭环：注册、登录、首页浏览、搜索、帖子详情、图片上传、发帖、点赞、评论、删除自己的评论、查看和编辑个人资料、退出登录。后端接口挂在 `/api` 下，数据保存在本地 SQLite 数据库中。

```bash
eattruth
├── backend/                 # Node.js 后端
│   ├── src/
│   │   ├── config/          # 环境变量、数据库配置
│   │   ├── controllers/     # 业务控制器
│   │   ├── services/        # 核心业务逻辑（信用币、等级、悬赏）
│   │   ├── models/          # Prisma/TypeORM 实体
│   │   ├── middleware/      # 指纹认证、权限、限流
│   │   ├── routes/          # API 路由
│   │   ├── utils/           # 工具函数（AI调用、JWT、指纹hash）
│   │   └── app.ts
│   ├── prisma/              # 数据库 schema
│   └── package.json
├── mobile/                  # React Native 客户端
│   ├── src/
│   │   ├── screens/         # 登录、主页、我的、悬赏、商家圈
│   │   ├── components/      # 帖子卡片、评论区、等级条
│   │   ├── services/        # API 请求封装
│   │   └── hooks/           # 指纹认证、信用币变化
│   └── App.tsx
├── ai-service/              # Python AI 微服务 (FastAPI)
│   ├── app/
│   │   ├── fingerprint/     # 指纹去重算法
│   │   ├── image_check/     # 图片真伪检测
│   │   ├── spam_detection/  # 水军评论检测
│   │   └── main.py
│   └── requirements.txt
└── docker-compose.yml       # 一键启动全部服务
