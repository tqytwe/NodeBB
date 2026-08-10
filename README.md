# Sub2API NodeBB 论坛

Sub2API 平台论坛系统，基于 NodeBB 4.x，部署到 Zeabur。

## 架构（独立子域名方案）

```
浏览器
   │
   ├── https://jisudeng.com/          → 主平台 (sub2api-wortic)
   ├── https://www.jisudeng.com/      → 主平台
   ├── https://api.jisudeng.com/      → 主平台 API
   └── https://community.jisudeng.com/ → NodeBB 论坛 (独立域名)
```

**简单直接！Zeabur 直接支持独立域名绑定！**

## 域名绑定

| 域名 | 服务 | Zeabur 配置 |
|------|------|------------|
| jisudeng.com | sub2api-wortic | 已绑定 |
| www.jisudeng.com | sub2api-wortic | 已绑定 |
| api.jisudeng.com | sub2api-wortic | 已绑定 |
| **community.jisudeng.com** | **nodebb** | **新增** |

## 部署步骤

### 1. NodeBB 服务

1. 项目 gmssh → **+ Add Service** → **GitHub**
2. 仓库：`tqytwe/NodeBB`
3. 分支：`main`

### 2. NodeBB 配置环境变量

NodeBB 服务 → **Variables**：

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

### 3. NodeBB 绑定子域名

NodeBB 服务 → **Networking** → **添加路由**：

```
域名: community.jisudeng.com
服务: nodebb
端口: HTTP :4567
```

### 4. DNS 配置

在域名管理后台添加：
```
community.jisudeng.com  CNAME  <zeabur-nodebb-domain>.zeabur.app
```

或使用 Zeabur 提供的 IP 白名单（IPv4）。

### 5. 初始化

访问 `https://community.jisudeng.com`：
- Admin username: `admin`
- Admin email: `admin@jisudeng.com`
- Admin password: `<强密码>`

## 集成到主平台（iframe 嵌入）

主平台 ForumView 嵌入论坛：

```html
<iframe 
  src="https://community.jisudeng.com/?lang=zh-CN&embed=1" 
  width="100%" 
  height="800px">
</iframe>
```

**注意**：跨域 iframe，需要 postMessage 通信。

## 自动部署

push 到 main → Zeabur 自动 rebuild。

## License

MIT
