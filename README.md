# Sub2API NodeBB 论坛

Sub2API 平台论坛系统，基于 NodeBB 4.x，部署到 Zeabur。

## 主平台信息

- **Zeabur 项目**: gmssh (sub2api-wortic)
- **主域名**: jisudeng.com
- **论坛域名**: community.jisudeng.com

## 数据库（已在 Zeabur 部署）

- **MongoDB**: 47.85.37.23:32460 (Zeabur)
- **Redis**: 47.85.37.23:31145 (Zeabur)

## 部署步骤

### 1. 在 Zeabur 添加 NodeBB 服务

1. 项目 gmssh → **+ Add Service** → **GitHub**
2. 选择仓库：`tqytwe/NodeBB`
3. 选择分支：`main`
4. Zeabur 自动构建（使用 Dockerfile）

### 2. 配置环境变量

在 NodeBB 服务 → **Variables** 添加：

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

### 3. 绑定域名

NodeBB 服务 → **Networking** → **Custom Domain** → `community.jisudeng.com`

### 4. 初始化

访问 `https://community.jisudeng.com` 完成初始化：
- Admin username: `admin`
- Admin email: `admin@jisudeng.com`
- Admin password: `<强密码>`

## 自动部署

push 到 main → Zeabur 自动 rebuild。

## 文件结构

```
.
├── Dockerfile              # Zeabur 构建
├── package.json            # Node.js 项目元数据
├── config.json             # NodeBB 配置
├── loader.js               # 自定义启动器（处理环境变量）
├── README.md               # 本文件
├── .env.example            # 环境变量示例
├── .gitignore
└── plugins/
    └── nodebb-plugin-sub2api-sso/
        ├── plugin.json
        ├── library.js
        ├── webhook-handlers.js
        ├── user-sync.js
        ├── forum-payment.js
        ├── static/lib/main.js
        ├── static/styles.less
        ├── templates/client/header.tpl
        └── languages/{zh-CN,en-GB}.json
```

## License

MIT
