# Sub2API NodeBB 论坛

Sub2API 平台论坛系统，基于 NodeBB 4.x，部署到 Zeabur + Gateway 路径反代。

## 架构

```
浏览器
   │
   ▼ https://jisudeng.com/
   │
   Zeabur Gateway (PROXY_ROUTES)
   │
   ├── /community/*  → NodeBB 服务 (4567)
   ├── /api/*       → 主平台 API
   └── /*           → 主平台前端
```

**零新域名！复用 jisudeng.com！**

## Zeabur 部署

### 1. 添加 NodeBB 服务（已完成）

1. 项目 gmssh → **+ Add Service** → **GitHub**
2. 选择仓库：`tqytwe/NodeBB`
3. 选择分支：`main`

### 2. 配置 NodeBB 环境变量

在 NodeBB 服务 → **Variables**：

```bash
# 主平台地址
SUB2API_PLATFORM_URL=https://jisudeng.com

# OAuth2 SSO
NODEBB_SSO_CLIENT_ID=sub2api_forum
NODEBB_SSO_CLIENT_SECRET=<生成32字节hex>
NODEBB_SSO_AUTHORIZE_URL=https://api.jisudeng.com/api/v1/sso/oauth/authorize
NODEBB_SSO_TOKEN_URL=https://api.jisudeng.com/api/v1/sso/oauth/token
NODEBB_SSO_USERINFO_URL=https://api.jisudeng.com/api/v1/sso/oauth/userinfo
NODEBB_SSO_WEBHOOK_SECRET=<生成32字节hex>

# MongoDB (Zeabur 部署)
MONGO_URI=mongodb://mongo:hSanAM0dHRb2UowLYVe867X9m1E53tv4@47.85.37.23:32460/sub2api_forum

# Redis (Zeabur 部署)
REDIS_HOST=47.85.37.23
REDIS_PORT=31145
REDIS_PASSWORD=D1462n5ombxqXY3AEGiT79a8hes0CpQZ
```

### 3. 部署 Gateway 服务（新增）

1. 项目 gmssh → **+ Add Service** → **Docker 镜像**
2. 镜像：`ghcr.io/zeabur/gateway:latest`（或自建）
3. 配置环境变量：

```bash
PROXY_ROUTES=[
  {"prefix":"/community","target":"http://nodebb:4567"},
  {"prefix":"/api","target":"http://sub2api-wortic:8080"},
  {"prefix":"/","target":"http://sub2api-wortic:8080"}
]
PORT=3000
```

4. Gateway 服务 → **Networking** → 绑定域名 `jisudeng.com`

### 4. 验证

- 访问 https://jisudeng.com → 主平台
- 访问 https://jisudeng.com/community → NodeBB 论坛
- 访问 https://api.jisudeng.com/xxx → 主平台 API

## 自动部署

push 到 main → Zeabur 自动 rebuild。

## 文件结构

```
.
├── Dockerfile              # Zeabur 构建
├── package.json            # Node.js 项目元数据
├── config.json             # NodeBB 配置 (subpath 模式)
├── loader.js               # 自定义启动器
├── README.md               # 本文件
├── .env.example            # 环境变量示例
└── plugins/
    └── nodebb-plugin-sub2api-sso/
```

## License

MIT
