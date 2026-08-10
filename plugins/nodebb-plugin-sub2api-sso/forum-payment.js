'use strict'

const winston = require.main.require('winston')
const userSync = require('./user-sync')

exports.createOrder = async function (uid, itemId, itemType, amount, description) {
  const config = require.main.require('nconf').get('sub2api-sso:config')
  if (!config || !config.enabled) throw new Error('plugin_not_configured')
  if (!['topic', 'badge', 'vip_upgrade'].includes(itemType)) throw new Error('invalid_item_type')
  if (!amount || amount <= 0) throw new Error('invalid_amount')

  const ssoToken = await userSync.getUserAccessToken(uid)
  if (!ssoToken) throw new Error('no_sso_token')

  const response = await fetch(config.platformUrl + '/api/v1/sso/forum/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ssoToken },
    body: JSON.stringify({
      item_id: itemId,
      item_type: itemType,
      amount: amount,
      description: description || ('Forum ' + itemType + ' purchase'),
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    winston.error('[sub2api-sso] Create order failed: ' + errText)
    throw new Error('create_failed: ' + response.status)
  }

  const orderData = await response.json()
  return {
    order_id: orderData.order_id,
    payment_url: config.platformUrl + '/payment?order_id=' + orderData.order_id + '&source=community&return_url=' + encodeURIComponent(require.main.require('nconf').get('url')),
  }
}

exports.getWalletBalance = async function (uid) {
  const config = require.main.require('nconf').get('sub2api-sso:config')
  if (!config || !config.enabled) throw new Error('plugin_not_configured')
  const ssoToken = await userSync.getUserAccessToken(uid)
  if (!ssoToken) throw new Error('no_sso_token')
  const response = await fetch(config.platformUrl + '/api/v1/sso/wallet/balance', {
    headers: { Authorization: 'Bearer ' + ssoToken },
  })
  if (!response.ok) throw new Error('fetch_failed: ' + response.status)
  return await response.json()
}
