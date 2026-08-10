FROM ghcr.io/nodebb/nodebb:latest
LABEL "language"="nodejs"

USER root

COPY plugins/nodebb-plugin-sub2api-sso/ /usr/src/app/node_modules/nodebb-plugin-sub2api-sso/

RUN cd /usr/src/app/node_modules/nodebb-plugin-sub2api-sso && \
    npm install --production --no-audit --no-fund --unsafe-perm && \
    chown -R nodebb:nodebb /usr/src/app/node_modules/nodebb-plugin-sub2api-sso

COPY init-config.sh /usr/local/bin/init-config.sh
RUN chmod +x /usr/local/bin/init-config.sh && chown nodebb:nodebb /usr/local/bin/init-config.sh

USER nodebb

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/tini", "--", "/usr/local/bin/init-config.sh"]
