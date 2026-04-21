# Eattruth 项目架构

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