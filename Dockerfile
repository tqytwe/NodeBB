# ============================================
# Sub2API NodeBB 论坛 - Zeabur Dockerfile (修复版)
# 基于官方 NodeBB 镜像 + 我们的插件
# ============================================
FROM ghcr.io/nodebb/nodebb:latest

USER root

# 设置工作目录
WORKDIR /usr/src/app

# 复制自定义插件到 NodeBB 模块目录
COPY plugins/nodebb-plugin-sub2api-sso/ /usr/src/app/node_modules/nodebb-plugin-sub2api-sso/

# 安装插件依赖
RUN cd /usr/src/app/node_modules/nodebb-plugin-sub2api-sso && \
    npm install --production --no-audit --no-fund --unsafe-perm && \
    chown -R nodebb:nodebb /usr/src/app/node_modules/nodebb-plugin-sub2api-sso

# 切回 nodebb 用户
USER nodebb

# Zeabur 通过 PORT 环境变量分配端口
EXPOSE 4567

# 启动 NodeBB
CMD ["node", "loader.js"]
