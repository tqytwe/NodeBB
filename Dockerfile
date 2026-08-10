FROM ghcr.io/nodebb/nodebb:latest
LABEL "language"="nodejs"

USER root

COPY plugins/nodebb-plugin-sub2api-sso/ /usr/src/app/custom-plugins/nodebb-plugin-sub2api-sso/

RUN cd /usr/src/app/custom-plugins/nodebb-plugin-sub2api-sso && \
    npm install --production --no-audit --no-fund --unsafe-perm && \
    chown -R nodebb:nodebb /usr/src/app/custom-plugins

# Core patch: make the session cookie SameSite configurable so the forum can be
# embedded cross-site by the main platform. Runs at BUILD time and exits non-zero
# if the upstream source no longer matches, so a NodeBB upgrade that moves this
# code fails the build instead of silently shipping a broken iframe login.
COPY patches/ /usr/src/app/patches/
RUN node /usr/src/app/patches/configurable-cookie-samesite.js /usr/src/app/src/meta/configs.js
# Companion patch: helmet sets X-Frame-Options: SAMEORIGIN by default and
# middleware/headers.js only *omits* that header when csp-frame-ancestors is
# configured, never clears it. Without this the forum answers with both a
# permissive frame-ancestors and a restrictive X-Frame-Options.
RUN node /usr/src/app/patches/disable-helmet-xframeoptions.js /usr/src/app/src/webserver.js

COPY init-config.sh /usr/local/bin/init-config.sh
RUN chmod +x /usr/local/bin/init-config.sh && chown nodebb:nodebb /usr/local/bin/init-config.sh

USER nodebb

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/tini", "--", "/usr/local/bin/init-config.sh"]
