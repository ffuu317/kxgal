# Eattruth Demo

这是一个可本地运行的餐饮真实评价 demo，包含 React + Vite 前端、Express 后端 API、Prisma 和本地 SQLite 数据库。所有命令默认在仓库根目录执行。

## 依赖环境

- Node.js `>=22.12.0`，建议直接使用仓库里的 `.nvmrc`。
- npm `>=10.9.0`。
- 本地 SQLite 数据库由 Prisma 使用文件 `backend/data/dev.db`，不需要单独安装数据库服务。
- 可选：Hugging Face API token。未配置时，评论可信度检测会自动使用本地规则兜底。

主要 npm 依赖：

- 前端：`react`、`react-dom`、`vite`、`@vitejs/plugin-react`、`typescript`
- 后端：`express`、`@prisma/client`、`axios`
- 开发工具：`prisma`、`tsx`、`@types/node`、`@types/express`

## 安装依赖

如果使用 nvm：

```bash
nvm install
nvm use
```

首次拉取项目后安装 npm 依赖：

```bash
npm ci
```

如果需要在已有依赖基础上增量安装，也可以使用：

```bash
npm install
```

## 初始化数据库

首次运行前同步 Prisma schema，并生成 Prisma Client：

```bash
npm run db:push
```

数据库文件会创建在：

```text
backend/data/dev.db
```

后端首次启动时，如果用户表为空，会自动写入 demo 数据和默认体验账号：

```text
手机号：13800000000
密码：123456
```

## 启动开发环境

同时启动后端 API 和 Vite 前端：

```bash
npm run dev
```

启动后访问：

```text
前端：http://127.0.0.1:5173
后端：http://localhost:3000
健康检查：http://localhost:3000/api/health
```

Vite 已经配置 `/api` 代理到 `http://127.0.0.1:3000`，前端开发时直接请求 `/api/...` 即可。

局域网内其他设备访问时，把 `127.0.0.1` 替换为当前机器的局域网 IP，也可以直接使用启动日志里 Vite 打印的 `Network` 地址。

## 单独启动

只启动后端 API：

```bash
npm run dev:api
```

只启动前端：

```bash
npm run dev:web
```

## 构建和生产运行

构建前端静态资源：

```bash
npm run build
```

构建后启动后端：

```bash
npm start
```

后端会托管 `mobile/dist` 下的前端静态资源，并继续提供 `/api` 接口。默认端口是 `3000`，可以通过 `PORT` 修改：

```bash
PORT=4000 npm start
```

## 可选环境变量

```bash
export HUGGINGFACE_API_KEY="你的 Hugging Face token"
```

可用环境变量：

- `PORT`：后端监听端口，默认 `3000`。
- `HUGGINGFACE_API_KEY`：启用 Hugging Face 远程模型。
- `HUGGINGFACE_API_URL`：Hugging Face 推理地址，默认 `https://router.huggingface.co/hf-inference/models`。
- `SENTIMENT_MODEL`：文本检测模型，默认 `nlptown/bert-base-multilingual-uncased-sentiment`。
- `COMMENT_TRUST_MODEL`：评论可信度模型，默认复用 `SENTIMENT_MODEL`。

## 常用命令

```bash
npm run dev          # 同时启动前端和后端
npm run dev:api      # 只启动后端 API
npm run dev:web      # 只启动 Vite 前端
npm run db:push      # 同步数据库 schema
npm run db:generate  # 重新生成 Prisma Client
npm run typecheck    # TypeScript 类型检查
npm run build        # 构建前端
npm start            # 启动后端并托管已构建的前端
```

## 项目结构

```text
.
├── backend/
│   └── src/
│       ├── server.ts       # Express API、静态资源托管、种子数据
│       └── ai-detector.ts  # 评论/内容可信度检测
├── mobile/
│   ├── index.html
│   ├── public/             # 静态图片资源
│   └── src/                # React 前端代码
├── prisma/
│   └── schema.prisma       # Prisma schema，SQLite 数据库配置
├── scripts/
│   └── dev.js              # 同时拉起前后端开发服务
├── package.json            # 根项目依赖和 npm scripts
├── tsconfig.json
└── vite.config.ts
```

当前 demo 覆盖注册、登录、首页浏览、搜索、帖子详情、图片上传、发帖、点赞、评论、删除自己的评论、个人资料编辑、商家相关页面和评论可信度展示等核心流程。
