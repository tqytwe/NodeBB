# ============================================
# Sub2API NodeBB 论坛 - Zeabur Dockerfile
# 基于官方 NodeBB 镜像 + 自定义插件
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

# 创建 Zeabur 期望的 config 目录
RUN mkdir -p /opt/config && chown -R nodebb:nodebb /opt/config

# 复制自定义启动脚本
COPY start.sh /usr/src/app/start.sh
RUN chmod +x /usr/src/app/start.sh && chown nodebb:nodebb /usr/src/app/start.sh

# 切回 nodebb 用户
USER nodebb

# Zeabur 通过 PORT 环境变量分配端口
EXPOSE 4567

# 启动脚本
CMD ["/usr/src/app/start.sh"]
