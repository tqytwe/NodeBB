# Sub2API NodeBB 论坛

Sub2API 平台论坛系统，基于 NodeBB 4.x，部署到 Zeabur。

## 主平台信息

- **平台**: Zeabur
- **项目名**: sub2api-wortic
- **主域名**: jisudeng.com / www.jisudeng.com
- **主平台 API**: api.jisudeng.com
- **论坛域名**: community.jisudeng.com (待绑定)

## 论坛部署（Zeabur Git 集成）

### 1. 在 Zeabur 添加 NodeBB 服务（Git 仓库方式）

1. 登录 https://zeabur.com
2. 进入项目 `sub2api-wortic`
3. 点击 **+ Add Service** → **Git 仓库** (不是模板)
4. 选择 GitHub 仓库：`tqytwe/NodeBB`
5. 选择分支：`main`
6. Zeabur 自动识别为 Node.js 项目（基于 `package.json`）

### 2. Zeabur 自动配置

- ✅ 端口：使用 `process.env.PORT`（Zeabur 分配）
- ✅ MongoDB：通过 Zeabur Marketplace 添加
- ✅ Redis：通过 Zeabur Marketplace 添加
- ✅ HTTPS：Zeabur 自动配置

### 3. 添加 MongoDB 和 Redis 服务

在同一项目内：

1. 点击 **+ Add Service** → **数据库** → **MongoDB**
2. 点击 **+ Add Service** → **数据库** → **Redis**

### 4. 配置 NodeBB 环境变量

在 NodeBB 服务 → **Variables**：

#### 必需配置（用户手动设置）

```bash
# 主平台地址
SUB2API_PLATFORM_URL=https://jisudeng.com

# NodeBB OAuth2 客户端配置
NODEBB_SSO_CLIENT_ID=sub2api_forum
NODEBB_SSO_CLIENT_SECRET=<生成32字节hex>
NODEBB_SSO_AUTHORIZE_URL=https://api.jisudeng.com/api/v1/sso/oauth/authorize
NODEBB_SSO_TOKEN_URL=https://api.jisudeng.com/api/v1/sso/oauth/token
NODEBB_SSO_USERINFO_URL=https://api.jisudeng.com/api/v1/sso/oauth/userinfo
NODEBB_SSO_WEBHOOK_SECRET=<生成32字节hex>
```

#### MongoDB 配置（Zeabur 自动注入到引用服务）

在 NodeBB 服务 → **Variables** → **Connect to MongoDB**:

```
MONGO_HOST, MONGO_PORT, MONGO_USERNAME, MONGO_PASSWORD, MONGO_DATABASE
```

Zeabur 会自动注入。

### 5. 绑定自定义域名

NodeBB 服务 → **Networking** → **Custom Domain**:

- 添加 `community.jisudeng.com`
- 在 DNS 添加 CNAME 指向 Zeabur

### 6. 初始化 NodeBB

首次访问 `https://community.jisudeng.com` 完成初始化：

- Admin username: `admin`
- Admin email: `admin@jisudeng.com`
- Admin password: `<强密码>`

## 自动部署

每次 push 到 main 分支，Zeabur 自动重新部署。

## 文件说明

```
.
├── Dockerfile              # Zeabur 构建镜像
├── package.json            # Node.js 项目元数据
├── config.json             # NodeBB 运行时配置
├── zbpack.json             # Zeabur 构建配置（可选）
├── README.md               # 本文件
├── .env.example            # 环境变量示例
├── .gitignore              # Git 忽略
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

## 端口说明

- **NodeBB 内部**: 4567
- **Zeabur 分配**: 通过 `process.env.PORT`
- **外部访问**: 443 HTTPS（Zeabur 自动）

## License

MIT
