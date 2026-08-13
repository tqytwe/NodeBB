'use strict'

const nconf = require.main.require('nconf')
const winston = require.main.require('winston')
const user = require.main.require('./src/user')
const passport = require.main.require('passport')
const authenticationController = require.main.require('./src/controllers/authentication')
const routeHelpers = require.main.require('./src/routes/helpers')
const OAuth2Strategy = require('passport-oauth2').Strategy

const webhookHandlers = require('./webhook-handlers')
const userSync = require('./user-sync')
const forumPayment = require('./forum-payment')
const controllers = require('./controllers')

const plugin = {}

// Route prefixes, kept here so the main platform contract lives in one place.
//
//   webhooks    -> mounted on the ROOT router by static:app.load
//   user API    -> mounted under /api/v3/plugins by static:api.routes
//
// The distinction matters: everything under /api/v3 gets CSRF enforced
// automatically (src/middleware/user.js applies applyCSRF whenever
// res.locals.isAPI is set and the request has no Authorization header), which a
// server-to-server webhook cannot satisfy. Root-mounted routes skip that.
plugin.WEBHOOK_PREFIX = '/sub2api'
plugin.API_PREFIX = '/sub2api'

function buildConfig() {
  const platformUrl = (process.env.SUB2API_PLATFORM_URL || 'https://jisudeng.com').replace(/\/+$/, '')
  // The user-facing site and the API live on different hosts, so they cannot
  // share one variable: platformUrl is for browser redirects, apiUrl for
  // server-to-server calls.
  const apiUrl = (process.env.SUB2API_API_URL || 'https://api.jisudeng.com').replace(/\/+$/, '')

  return {
    platformUrl,
    apiUrl,
    clientId: process.env.NODEBB_SSO_CLIENT_ID,
    clientSecret: process.env.NODEBB_SSO_CLIENT_SECRET,
    authorizeUrl: process.env.NODEBB_SSO_AUTHORIZE_URL,
    tokenUrl: process.env.NODEBB_SSO_TOKEN_URL,
    userInfoUrl: process.env.NODEBB_SSO_USERINFO_URL,
    webhookSecret: process.env.NODEBB_SSO_WEBHOOK_SECRET,
    // Who may embed this forum in a frame, e.g. "'self' https://jisudeng.com".
    // src/middleware/headers.js turns this into the Content-Security-Policy
    // frame-ancestors directive and, crucially, stops emitting the legacy
    // X-Frame-Options: SAMEORIGIN header once it is set to anything but 'none'.
    frameAncestors: (process.env.SUB2API_FRAME_ANCESTORS || '').trim(),
    enabled: !!(process.env.NODEBB_SSO_CLIENT_ID && process.env.NODEBB_SSO_CLIENT_SECRET),
  }
}

function getConfig() {
  let config = nconf.get('sub2api-sso:config')
  if (!config) {
    config = buildConfig()
    nconf.set('sub2api-sso:config', config)
  }
  return config
}

plugin.init = async function (params) {
  const config = buildConfig()
  nconf.set('sub2api-sso:config', config)

  if (!config.enabled) {
    winston.warn('[sub2api-sso] NODEBB_SSO_CLIENT_ID/SECRET not set, SSO disabled')
  } else {
    const missing = ['authorizeUrl', 'tokenUrl', 'userInfoUrl'].filter(k => !config[k])
    if (missing.length) {
      winston.error(`[sub2api-sso] SSO enabled but missing: ${missing.join(', ')}`)
    } else {
      winston.info(`[sub2api-sso] initialised (platform=${config.platformUrl}, api=${config.apiUrl})`)
    }
  }
  if (!config.webhookSecret) {
    winston.warn('[sub2api-sso] NODEBB_SSO_WEBHOOK_SECRET not set, webhooks will be rejected')
  }

  await plugin.applyFrameAncestors(config)

  plugin.addWebhookRoutes(params)
  plugin.addPageRoutes(params)
}

plugin.addPageRoutes = function (params) {
  const { router, middleware } = params
  const accountMiddlewares = [
    middleware.exposeUid,
    middleware.ensureLoggedIn,
    middleware.canViewUsers,
    middleware.checkAccountPermissions,
    middleware.buildAccountData,
  ]

  routeHelpers.setupPageRoute(
    router,
    '/user/:userslug/sub2api-wallet',
    accountMiddlewares,
    controllers.renderWallet
  )
}

// `csp-frame-ancestors` is an ACP/database setting, not an nconf value, so it
// cannot be set from config.json. Applying it here on every boot keeps the
// deployed environment authoritative: the value lives in the Zeabur service
// config next to everything else instead of only in a database row somebody
// once clicked. Deliberately a no-op when the env var is unset, so an operator
// can still manage it from the ACP if they prefer.
plugin.applyFrameAncestors = async function (config) {
  if (!config.frameAncestors) return

  try {
    const meta = require.main.require('./src/meta')
    const current = await meta.configs.get('csp-frame-ancestors')
    if (current === config.frameAncestors) {
      winston.verbose(`[sub2api-sso] csp-frame-ancestors already "${config.frameAncestors}"`)
      return
    }
    await meta.configs.set('csp-frame-ancestors', config.frameAncestors)
    winston.info(`[sub2api-sso] csp-frame-ancestors set to "${config.frameAncestors}"`)
  } catch (err) {
    // Never take the forum down over a header setting.
    winston.error(`[sub2api-sso] failed to set csp-frame-ancestors: ${err.message}`)
  }
}

// ---------------------------------------------------------------------------
// Inbound webhooks from the main platform.
//
// Mounted on the root router so they are reachable at
//   <forum>/sub2api/webhook
//   <forum>/sub2api/forum-payment-callback
// and are not subject to the write API's CSRF enforcement.
// ---------------------------------------------------------------------------
plugin.addWebhookRoutes = function (params) {
  const router = params.router

  async function guard(req, res, handler, label) {
    const config = getConfig()
    if (!config.webhookSecret) {
      return res.status(503).json({ error: 'plugin_not_configured' })
    }

    const verdict = await webhookHandlers.verifyRequest(req, config.webhookSecret)
    if (!verdict.ok) {
      winston.warn(`[sub2api-sso] ${label} rejected: ${verdict.reason}`)
      return res.status(401).json({ error: verdict.reason })
    }

    try {
      const result = await handler(req.body)
      res.json(Object.assign({ ok: true }, result || {}))
    } catch (err) {
      winston.error(`[sub2api-sso] ${label} error: ${err.message}`)
      res.status(500).json({ error: 'internal_error', message: err.message })
    }
  }

  router.post(`${plugin.WEBHOOK_PREFIX}/webhook`, (req, res) =>
    guard(req, res, webhookHandlers.handleSync, 'webhook'))

  router.post(`${plugin.WEBHOOK_PREFIX}/forum-payment-callback`, (req, res) =>
    guard(req, res, webhookHandlers.handlePaymentCallback, 'payment-callback'))

  winston.verbose(`[sub2api-sso] webhook routes mounted at ${plugin.WEBHOOK_PREFIX}`)
}

// ---------------------------------------------------------------------------
// User-facing API. The router handed to static:api.routes is mounted at
// /api/v3/plugins, so these become /api/v3/plugins/sub2api/*.
// ---------------------------------------------------------------------------
plugin.addAPIRoutes = async function ({ router, middleware }) {
  // middleware.authenticate does not exist in NodeBB v4; the session guard is
  // ensureLoggedIn. Passing undefined here throws at plugin load time.
  const loggedIn = middleware.ensureLoggedIn

  router.get(`${plugin.API_PREFIX}/health`, (req, res) => {
    const config = getConfig()
    res.json({
      status: 'ok',
      plugin: 'sub2api-sso',
      version: '1.0.0',
      enabled: !!config.enabled,
      webhookConfigured: !!config.webhookSecret,
    })
  })

  // Per-user header data. Replaces the old filter:header.build + template
  // override, which targeted a template path that does not exist in NodeBB v4.
  router.get(`${plugin.API_PREFIX}/me`, loggedIn, async (req, res) => {
    try {
      const fields = await user.getUserFields(req.uid, [
        'sub2api:vip_tier', 'sub2api:vip_label', 'sub2api:balance',
      ])
      let liveWallet = null
      try {
        liveWallet = await forumPayment.getWalletBalance(req.uid)
      } catch (err) {
        // Keep the header usable during a short platform/API outage, but mark
        // the response as stale instead of presenting cached values as live.
        winston.warn(`[sub2api-sso] live /me wallet fetch failed: ${err.message}`)
      }

      res.json({
        vipTier: liveWallet ? Number(liveWallet.vip_tier) || 0 : parseInt(fields['sub2api:vip_tier'], 10) || 0,
        vipLabel: liveWallet ? (liveWallet.vip_label || 'V0') : (fields['sub2api:vip_label'] || 'V0'),
        balance: liveWallet ? (liveWallet.balance || '0.00') : (fields['sub2api:balance'] || '0.00'),
        frozenBalance: liveWallet ? (liveWallet.frozen_balance || '0.00') : null,
        rechargeBonusPct: liveWallet ? Number(liveWallet.recharge_bonus_pct) || 0 : null,
        currency: liveWallet ? (liveWallet.currency || 'CNY') : null,
        live: !!liveWallet,
        bound: !!(liveWallet || fields['sub2api:vip_label']),
      })
    } catch (err) {
      winston.error(`[sub2api-sso] /me error: ${err.message}`)
      res.status(500).json({ error: 'fetch_failed' })
    }
  })

  router.post(`${plugin.API_PREFIX}/create-order`, loggedIn, async (req, res) => {
    try {
      const { item_id, item_type, amount, description } = req.body
      const result = await forumPayment.createOrder(req.uid, item_id, item_type, amount, description)
      res.json(result)
    } catch (err) {
      winston.error(`[sub2api-sso] create order error: ${err.message}`)
      res.status(400).json({ error: 'create_failed', message: err.message })
    }
  })

  router.get(`${plugin.API_PREFIX}/wallet`, loggedIn, async (req, res) => {
    try {
      res.json(await forumPayment.getWalletBalance(req.uid))
    } catch (err) {
      winston.error(`[sub2api-sso] get wallet error: ${err.message}`)
      res.status(502).json({ error: 'fetch_failed', message: err.message })
    }
  })

  // Silent login for the iframe embed: the parent frame posts a platform access
  // token, we validate it against the platform's userinfo endpoint and open a
  // forum session. Deliberately mounted under /api/v3 so NodeBB's automatic
  // CSRF check applies -- without it this would be a login-CSRF vector.
  router.post(`${plugin.API_PREFIX}/auto-login`, async (req, res) => {
    const config = getConfig()
    if (!config.enabled || !config.userInfoUrl) {
      return res.status(503).json({ error: 'plugin_not_configured' })
    }

    const token = req.body && req.body.access_token
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'access_token_required' })
    }

    try {
      const userInfo = await fetchUserInfo(config.userInfoUrl, token)
      const userData = await userSync.upsertUser(userInfo, token)
      await authenticationController.doLogin(req, userData.uid)
      res.json({ ok: true, uid: userData.uid })
    } catch (err) {
      winston.warn(`[sub2api-sso] auto-login failed: ${err.message}`)
      res.status(401).json({ error: 'auto_login_failed' })
    }
  })
}

plugin.getStrategy = async function (strategies) {
  const config = getConfig()
  if (!config.enabled) return strategies

  if (!config.authorizeUrl || !config.tokenUrl || !config.userInfoUrl) {
    winston.error('[sub2api-sso] cannot register strategy, OAuth URLs incomplete')
    return strategies
  }

  passport.use('sub2api', new OAuth2Strategy({
    authorizationURL: config.authorizeUrl,
    tokenURL: config.tokenUrl,
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: `${nconf.get('url')}/auth/sub2api/callback`,
    scope: ['profile'],
    // NodeBB v4 owns OAuth state at the route layer: it persists
    // req.session.ssoState before starting the redirect and verifies it before
    // Passport handles the callback. Enabling passport-oauth2's separate state
    // store here makes the callback require a second state record that NodeBB
    // never creates when it passes its state string to passport.authenticate.
    // Keep the core CSRF check and use passport's no-op state store.
    state: false,
    passReqToCallback: false,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const userInfo = await fetchUserInfo(config.userInfoUrl, accessToken)
      const userData = await userSync.upsertUser(userInfo, accessToken)
      done(null, userData)
    } catch (err) {
      winston.error(`[sub2api-sso] OAuth callback error: ${err.message}`)
      done(err)
    }
  }))

  // Field shape is dictated by templates/login.tpl: it reads ./icons.normal (or
  // ./icons.svg), ./color and ./labels.login. A flat `icon` renders nothing.
  strategies.push({
    name: 'sub2api',
    url: '/auth/sub2api',
    callbackURL: '/auth/sub2api/callback',
    icons: { normal: 'fa fa-plug' },
    color: '#10b981',
    labels: { login: '[[sub2api-sso:sso-login-with-sub2api]]' },
    scope: ['profile'],
  })

  return strategies
}

async function fetchUserInfo(url, accessToken) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`UserInfo fetch failed: ${response.status} ${text.slice(0, 200)}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

// Expose only global, non-user-specific values to the client. The config object
// handed to filter:config.get carries no uid, so nothing per-user can safely go
// here -- per-user data comes from the authenticated /me endpoint instead.
plugin.appendConfig = async function (config) {
  const cfg = getConfig()
  let platformOrigin = null
  try {
    platformOrigin = new URL(cfg.platformUrl).origin
  } catch (e) {
    platformOrigin = null
  }
  config.sub2api = {
    platformOrigin,
    enabled: !!cfg.enabled,
  }
  return config
}

plugin.addProfileMenu = async function (data) {
  // NodeBB v4 passes { uid, callerUID, links } to filter:user.profileMenu.
  // Older NodeBB versions passed the links array directly.
  const links = Array.isArray(data) ? data : data && data.links
  if (!Array.isArray(links)) return data

  links.push({
    id: 'sub2api-wallet',
    route: 'sub2api-wallet',
    icon: 'fa-wallet',
    name: '[[sub2api-sso:sso-wallet]]',
    visibility: { self: true, other: false, moderator: false, globalMod: false, admin: false },
  })

  return Array.isArray(data) ? links : data
}

plugin.addAdminNav = async function (header) {
  header.plugins.push({
    route: '/plugins/sub2api-sso',
    icon: 'fa-link',
    name: 'Sub2API SSO',
  })
  return header
}

module.exports = plugin
