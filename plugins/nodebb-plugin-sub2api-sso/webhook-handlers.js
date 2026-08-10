'use strict'

const crypto = require('crypto')
const winston = require.main.require('winston')
const user = require.main.require('./src/user')
const groups = require.main.require('./src/groups')
const db = require.main.require('./src/database')
const userSync = require('./user-sync')

exports.verifySignature = function (body, signature, secret) {
  if (!signature || !secret) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch (e) {
    return false
  }
}

exports.handleSync = async function (payload) {
  const { event, data } = payload
  if (!event || !data) throw new Error('invalid_payload')
  const uid = await userSync.getUidBySub2APIID(data.user_id)
  if (!uid) {
    winston.warn('[sub2api-sso] No binding for user ' + data.user_id)
    return
  }
  switch (event) {
    case 'balance.changed':
      await user.setUserField(uid, 'sub2api:balance', data.balance)
      notifyUser(uid, 'event:sub2api-balance-updated', {
        balance: data.balance, change: data.change, reason: data.reason,
      })
      break
    case 'vip.changed':
      await user.setUserFields(uid, {
        'sub2api:vip_tier': data.tier,
        'sub2api:vip_label': data.label,
        'sub2api:recharge_bonus_pct': data.recharge_bonus_pct,
      })
      const targetGroups = ['registered-users']
      if (data.tier >= 0 && data.tier <= 6) targetGroups.push('vip-' + data.tier)
      if (data.role === 'admin') targetGroups.push('administrators')
      await userSync.syncGroups(uid, targetGroups)
      notifyUser(uid, 'event:sub2api-vip-updated', { tier: data.tier, label: data.label })
      break
    case 'role.changed':
      if (data.new_role === 'admin') await groups.join('administrators', uid)
      else await groups.leave('administrators', uid)
      break
  }
  winston.info('[sub2api-sso] ' + event + ' for uid ' + uid)
}

exports.handlePaymentCallback = async function (payload) {
  const { order_id, user_id, item_id, item_type, amount } = payload
  const uid = await userSync.getUidBySub2APIID(user_id)
  if (!uid) throw new Error('user_not_bound: ' + user_id)

  const processedKey = 'forum:order:' + order_id + ':processed'
  if (await db.isSetMember(processedKey, '1')) {
    return { ok: true, message: 'already_processed' }
  }
  await db.setAdd(processedKey, '1')

  switch (item_type) {
    case 'vip_upgrade':
      await groups.join('vip-' + item_id, uid)
      break
    case 'topic':
      await db.setAdd('topic:' + item_id + ':paid_users', uid)
      break
    case 'badge':
      try {
        const badges = require.main.require('./src/badges')
        await badges.give(item_id, uid)
      } catch (e) {
        winston.warn('[sub2api-sso] Badge give failed: ' + e.message)
      }
      break
  }

  notifyUser(uid, 'event:forum-purchase-success', { item_id, item_type, order_id, amount })
  winston.info('[sub2api-sso] Payment order ' + order_id + ' processed')
  return { ok: true }
}

function notifyUser(uid, event, data) {
  try {
    const io = require.main.require('./src/socket.io')
    io.in('uid_' + uid).emit(event, data)
  } catch (e) {}
}
