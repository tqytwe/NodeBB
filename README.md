# Sub2API NodeBB 论坛

Sub2API 平台论坛系统，基于 NodeBB 4.x，部署在 Zeabur 平台。

## 主平台信息

- **主平台**: sub2api-wortic (Zeabur)
- **主域名**: jisudeng.com
- **主平台 API**: api.jisudeng.com

## 论坛部署

- **平台**: Zeabur
- **论坛域名**: community.jisudeng.com (待绑定)
- **NodeBB 版本**: 4.x
- **数据库**: MongoDB (Zeabur 提供)
- **缓存**: Redis (Zeabur 提供)

## 快速部署

### 1. Zeabur 一键部署 NodeBB 模板

1. 登录 https://zeabur.com
2. 进入主平台项目
3. 点击 "Deploy New Service" → "Template"
4. 搜索 "NodeBB"
5. 选择 https://zeabur.com/templates/OPQZX6
6. 一键部署（自动创建 NodeBB + MongoDB + Redis）

### 2. 绑定域名

在 Zeabur 控制台：
- NodeBB 服务 → Networking → Custom Domain
- 添加 `community.jisudeng.com`
- Zeabur 自动配置 SSL

### 3. 配置环境变量

在 Zeabur 控制台，NodeBB 服务 → Environment Variables：

```bash
SUB2API_PLATFORM_URL=https://jisudeng.com
NODEBB_SSO_CLIENT_ID=sub2api_forum
NODEBB_SSO_CLIENT_SECRET=<32字节hex>
NODEBB_SSO_AUTHORIZE_URL=https://api.jisudeng.com/api/v1/sso/oauth/authorize
NODEBB_SSO_TOKEN_URL=https://api.jisudeng.com/api/v1/sso/oauth/token
NODEBB_SSO_USERINFO_URL=https://api.jisudeng.com/api/v1/sso/oauth/userinfo
NODEBB_SSO_WEBHOOK_SECRET=<32字节hex>
```

### 4. 安装自定义插件

通过 Zeabur 的 Custom Build / Volume 挂载：

1. 把 `plugins/nodebb-plugin-sub2api-sso/` 上传到 GitHub
2. Zeabur 在构建时自动安装
3. 或通过 Zeabur 的 Volume 功能挂载插件目录

### 5. 初始化 NodeBB

访问 https://community.jisudeng.com 完成初始化设置。

## GitHub 自动部署

Zeabur 支持 GitHub 集成：
1. Zeabur 控制台 → Service → Source
2. 连接 GitHub 仓库 `tqytwe/NodeBB`
3. 选择 main 分支
4. 推送代码自动部署

## 架构图

```
浏览器
  │
  ├── https://jisudeng.com/         → 主平台 (Zeabur: sub2api-wortic)
  ├── https://api.jisudeng.com/     → 主平台 API
  └── https://community.jisudeng.com/ → NodeBB 论坛 (Zeabur)

数据库
  ├── PostgreSQL (主平台)
  ├── MongoDB (NodeBB)
  └── Redis (NodeBB)

同步机制
  ├── OAuth2 SSO (账号互通)
  └── Webhook (余额/VIP/角色同步)
```

## 集成到主平台

主平台 ForumView 通过 iframe 嵌入论坛：

```html
<iframe src="https://community.jisudeng.com/?embed=1&lang=zh-CN"></iframe>
```

或独立访问：
```
https://community.jisudeng.com/
```

## 端口说明

Zeabur 自动处理端口映射：
- 平台内部：NodeBB 监听 4567
- 平台外部：通过 443 HTTPS 访问
- 无需手动配置 Nginx

## 与主平台对接

主平台需要新增：
- OAuth2 Provider 端点（`/api/v1/sso/oauth/*`）
- Webhook 推送器
- 论坛订单接收端点
- 前端 ForumView 页面

详细规范：主平台 `sub2api/docs/forum-integration/`

## 目录结构

```
.
├── README.md                       # 本文件
├── .env.example                    # 环境变量示例
├── .gitignore                      # Git 忽略
├── .github/workflows/              # CI 配置
│   └── deploy.yml
└── plugins/
    └── nodebb-plugin-sub2api-sso/  # 自定义 SSO 插件
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
