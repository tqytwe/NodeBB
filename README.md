# Sub2API NodeBB 论坛

## Zeabur 部署

### 1. NodeBB 服务

在 Zeabur 项目 gmssh：
- **+ Add Service** → **GitHub**
- 仓库：`tqytwe/NodeBB`
- 分支：`main`

### 2. 环境变量配置

在 NodeBB 服务 → **Variables** 添加：

```
SUB2API_PLATFORM_URL=https://jisudeng.com

NODEBB_SSO_CLIENT_ID=sub2api_forum
NODEBB_SSO_CLIENT_SECRET=32字节hex密钥1
NODEBB_SSO_AUTHORIZE_URL=https://api.jisudeng.com/api/v1/sso/oauth/authorize
NODEBB_SSO_TOKEN_URL=https://api.jisudeng.com/api/v1/sso/oauth/token
NODEBB_SSO_USERINFO_URL=https://api.jisudeng.com/api/v1/sso/oauth/userinfo
NODEBB_SSO_WEBHOOK_SECRET=32字节hex密钥2

MONGO_HOST=mongodb.zeabur.internal
MONGO_PORT=32460
MONGO_USERNAME=mongo
MONGO_PASSWORD=MongoDB密码
MONGO_DATABASE=sub2api_forum

REDIS_HOST=redis.zeabur.internal
REDIS_PORT=31145
REDIS_PASSWORD=Redis密码
```

### 3. 绑定域名

NodeBB 服务 → **Networking** → **添加路由**：
- 域名：`community.jisudeng.com`
- 服务：`nodebb`
- 端口：`HTTP :8080`

### 4. 初始化

访问 `https://community.jisudeng.com` 完成初始化。

## 自动部署

push 到 main → Zeabur 自动 rebuild。

## License

MIT
