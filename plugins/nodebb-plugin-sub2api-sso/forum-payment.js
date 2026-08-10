'use strict'

const nconf = require.main.require('nconf')
const winston = require.main.require('winston')
const userSync = require('./user-sync')

const VALID_ITEM_TYPES = ['topic', 'badge', 'vip_upgrade']
const TIMEOUT_MS = 10000

function getConfig() {
  const config = nconf.get('sub2api-sso:config')
  if (!config || !config.enabled) throw new Error('plugin_not_configured')
  return config
}

async function platformFetch(url, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, Object.assign({}, options, { signal: controller.signal }))
  } finally {
    clearTimeout(timer)
  }
}

exports.createOrder = async function (uid, itemId, itemType, amount, description) {
  const config = getConfig()

  if (!itemId) throw new Error('item_id_required')
  if (!VALID_ITEM_TYPES.includes(itemType)) throw new Error('invalid_item_type')

  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('invalid_amount')

  const ssoToken = await userSync.getUserAccessToken(uid)
  if (!ssoToken) throw new Error('no_sso_token')

  // API calls go to apiUrl; only browser-facing links use platformUrl. These
  // are different hosts (api.jisudeng.com vs jisudeng.com), so one variable
  // cannot serve both.
  const response = await platformFetch(`${config.apiUrl}/api/v1/sso/forum/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ssoToken}`,
    },
    body: JSON.stringify({
      item_id: itemId,
      item_type: itemType,
      amount: numericAmount.toFixed(2),
      description: description || `Forum ${itemType} purchase`,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    winston.error(`[sub2api-sso] create order failed ${response.status}: ${errText.slice(0, 200)}`)
    throw new Error(`create_failed: ${response.status}`)
  }

  const orderData = await response.json()
  if (!orderData || !orderData.order_id) {
    throw new Error('platform_returned_no_order_id')
  }

  const returnUrl = encodeURIComponent(nconf.get('url'))
  return {
    order_id: orderData.order_id,
    payment_url: `${config.platformUrl}/payment?order_id=${encodeURIComponent(orderData.order_id)}&source=community&return_url=${returnUrl}`,
  }
}

exports.getWalletBalance = async function (uid) {
  const config = getConfig()

  const ssoToken = await userSync.getUserAccessToken(uid)
  if (!ssoToken) throw new Error('no_sso_token')

  const response = await platformFetch(`${config.apiUrl}/api/v1/sso/wallet/balance`, {
    headers: { Authorization: `Bearer ${ssoToken}` },
  })

  if (!response.ok) {
    throw new Error(`fetch_failed: ${response.status}`)
  }
  return await response.json()
}
