# Sub2API NodeBB 论坛

Sub2API 平台论坛系统，基于 NodeBB 4.x，部署到 Zeabur。

## 主平台信息

- **Zeabur 项目**: gmssh (sub2api-wortic)
- **主域名**: jisudeng.com
- **论坛域名**: community.jisudeng.com

## 数据库

**使用现有 MongoDB 和 Redis 服务器！**（不创建新数据库）

- MongoDB: 服务器现有
- Redis: 服务器现有

## 部署步骤

### 1. 在 Zeabur 添加 NodeBB 服务

1. 项目 gmssh → **+ Add Service** → **GitHub**
2. 选择仓库：`tqytwe/NodeBB`
3. 选择分支：`main`
4. Zeabur 自动识别 Node.js + 使用我们的 Dockerfile 构建

### 2. 配置环境变量

在 NodeBB 服务 → **Variables** 中添加：

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

# MongoDB - 直接使用现有服务器
# 方式 1: 完整 URI (推荐)
MONGO_URI=mongodb://nodebb:password@your-mongo-host:27017/sub2api_forum

# 方式 2: 单独字段 (loader.js 会自动构造 URI)
# MONGO_HOST=your-mongo-host
# MONGO_PORT=27017
# MONGO_USERNAME=nodebb
# MONGO_PASSWORD=password
# MONGO_DATABASE=sub2api_forum

# Redis - 直接使用现有服务器
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

### 3. 绑定域名

NodeBB 服务 → **Networking** → **Custom Domain** → `community.jisudeng.com`

DNS 添加 CNAME 记录指向 Zeabur。

### 4. 初始化

访问 `https://community.jisudeng.com` 完成初始化：
- Admin username: `admin`
- Admin email: `admin@jisudeng.com`
- Admin password: `<强密码>`

## 自动部署

push 到 main → Zeabur 自动 rebuild。

## 文件说明

```
.
├── Dockerfile              # Zeabur 构建（基于官方 NodeBB + 我们的插件）
├── package.json            # Node.js 项目元数据
├── config.json             # NodeBB 配置
├── loader.js               # 自定义启动器（环境变量处理）
├── README.md               # 本文件
├── .env.example            # 环境变量示例
├── .gitignore
├── .github/workflows/      # GitHub Actions
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
