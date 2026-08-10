'use strict'

const nconf = require.main.require('nconf')
const winston = require.main.require('winston')
const db = require.main.require('./src/database')
const user = require.main.require('./src/user')
const groups = require.main.require('./src/groups')
const meta = require.main.require('./src/meta')
const passport = require.main.require('passport')
const OAuth2Strategy = require('passport-oauth2').Strategy

const webhookHandlers = require('./webhook-handlers')
const userSync = require('./user-sync')
const forumPayment = require('./forum-payment')

const plugin = {}

plugin.init = async function (params) {
  const config = {
    platformUrl: process.env.SUB2API_PLATFORM_URL || 'https://yourdomain.com',
    clientId: process.env.NODEBB_SSO_CLIENT_ID,
    clientSecret: process.env.NODEBB_SSO_CLIENT_SECRET,
    authorizeUrl: process.env.NODEBB_SSO_AUTHORIZE_URL,
    tokenUrl: process.env.NODEBB_SSO_TOKEN_URL,
    userInfoUrl: process.env.NODEBB_SSO_USERINFO_URL,
    webhookSecret: process.env.NODEBB_SSO_WEBHOOK_SECRET,
    enabled: !!(process.env.NODEBB_SSO_CLIENT_ID && process.env.NODEBB_SSO_CLIENT_SECRET),
  }
  nconf.set('sub2api-sso:config', config)
  if (!config.enabled) {
    winston.warn('[sub2api-sso] SSO not configured, plugin in mock mode')
  } else {
    winston.info('[sub2api-sso] plugin initialized for ' + config.platformUrl)
  }
}

plugin.addAPIRoutes = async function ({ router, middleware }) {
  const config = nconf.get('sub2api-sso:config')

  router.post('/api/sub2api/webhook', async (req, res) => {
    if (!config || !config.webhookSecret) {
      return res.status(503).json({ error: 'plugin_not_configured' })
    }
    const body = JSON.stringify(req.body)
    if (!webhookHandlers.verifySignature(body, req.headers['x-sub2api-signature'], config.webhookSecret)) {
      return res.status(401).json({ error: 'bad_signature' })
    }
    try {
      await webhookHandlers.handleSync(req.body)
      res.json({ ok: true })
    } catch (err) {
      winston.error('[sub2api-sso] webhook error:', err)
      res.status(500).json({ error: 'internal_error', message: err.message })
    }
  })

  router.post('/api/sub2api/forum-payment-callback', async (req, res) => {
    if (!config || !config.webhookSecret) {
      return res.status(503).json({ error: 'plugin_not_configured' })
    }
    const body = JSON.stringify(req.body)
    if (!webhookHandlers.verifySignature(body, req.headers['x-sub2api-signature'], config.webhookSecret)) {
      return res.status(401).json({ error: 'bad_signature' })
    }
    try {
      await webhookHandlers.handlePaymentCallback(req.body)
      res.json({ ok: true })
    } catch (err) {
      winston.error('[sub2api-sso] payment callback error:', err)
      res.status(500).json({ error: 'internal_error', message: err.message })
    }
  })

  router.post('/api/sub2api/create-order', middleware.authenticate, async (req, res) => {
    try {
      const { item_id, item_type, amount, description } = req.body
      const result = await forumPayment.createOrder(
        req.user.uid, item_id, item_type, amount, description
      )
      res.json(result)
    } catch (err) {
      winston.error('[sub2api-sso] create order error:', err)
      res.status(500).json({ error: 'create_failed', message: err.message })
    }
  })

  router.get('/api/sub2api/wallet', middleware.authenticate, async (req, res) => {
    try {
      const balance = await forumPayment.getWalletBalance(req.user.uid)
      res.json(balance)
    } catch (err) {
      winston.error('[sub2api-sso] get wallet error:', err)
      res.status(500).json({ error: 'fetch_failed', message: err.message })
    }
  })

  router.get('/api/sub2api/health', (req, res) => {
    res.json({
      status: 'ok',
      plugin: 'sub2api-sso',
      version: '1.0.0',
      enabled: !!(config && config.enabled),
    })
  })
}

plugin.getStrategy = async function (strategies, callback) {
  const config = nconf.get('sub2api-sso:config')
  if (!config || !config.enabled) return callback(null, strategies)

  passport.use('sub2api', new OAuth2Strategy({
    authorizationURL: config.authorizeUrl,
    tokenURL: config.tokenUrl,
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: nconf.get('url') + '/auth/sub2api/callback',
    scope: ['profile'],
    state: true,
  }, async function (accessToken, refreshToken, profile, done) {
    try {
      const userInfo = await fetchUserInfo(config.userInfoUrl, accessToken)
      const userData = await userSync.upsertUser(userInfo, accessToken)
      done(null, userData)
    } catch (err) {
      winston.error('[sub2api-sso] OAuth callback error:', err)
      done(err)
    }
  }))

  strategies.push({
    name: 'sub2api',
    label: 'Sub2API 账号',
    icon: 'fa-plug',
    url: '/auth/sub2api',
  })
  callback(null, strategies)
}

async function fetchUserInfo(url, accessToken) {
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error('UserInfo fetch failed: ' + response.status + ' ' + text)
  }
  return response.json()
}

plugin.addHeaderSub2APIInfo = async function (data) {
  if (data.templateData && data.templateData.loggedIn) {
    const uid = data.templateData.uid
    try {
      const vipTier = (await user.getUserField(uid, 'sub2api:vip_tier')) || 0
      const vipLabel = (await user.getUserField(uid, 'sub2api:vip_label')) || 'V0'
      const balance = (await user.getUserField(uid, 'sub2api:balance')) || '0.00'
      data.templateData.sub2api = { vipTier, vipLabel, balance }
    } catch (e) {}
  }
  return data
}

plugin.addProfileMenu = async function (menu) {
  menu.push({
    route: '/sub2api-wallet',
    icon: 'fa-wallet',
    name: 'Sub2API 钱包',
    visibility: { self: true, other: false, moderator: false, globalMod: false, admin: false },
  })
  return menu
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
