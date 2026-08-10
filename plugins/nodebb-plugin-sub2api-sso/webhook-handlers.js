'use strict'

const crypto = require('crypto')
const winston = require.main.require('winston')
const user = require.main.require('./src/user')
const groups = require.main.require('./src/groups')
const db = require.main.require('./src/database')
const userSync = require('./user-sync')

// Signature freshness window and replay-cache retention, in seconds.
const MAX_SKEW = 300
const NONCE_TTL = 900

/**
 * Canonical string that both sides sign.
 *
 * NodeBB mounts body-parser in setupExpressApp() *before* any plugin hook
 * fires, so the raw request bytes are gone by the time this code runs and
 * re-serialising with JSON.stringify() is not byte-identical to what the
 * platform signed (`10.00` becomes `10`, key order and unicode escaping can
 * differ). Signing an explicit canonical form removes that whole class of
 * mismatch: flatten to sorted `path=value` pairs, values stringified.
 *
 * Contract (must match the platform implementation exactly):
 *   canonical = timestamp + "\n" + nonce + "\n" + sorted_pairs.join("&")
 *   signature = hex(hmac_sha256(secret, canonical))
 *   headers   = x-sub2api-timestamp, x-sub2api-nonce, x-sub2api-signature
 */
function flatten(value, prefix, out) {
  if (value === null || value === undefined) {
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out))
    return out
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(key => flatten(value[key], prefix ? `${prefix}.${key}` : key, out))
    return out
  }
  out.push(`${prefix}=${String(value)}`)
  return out
}

function canonicalize(payload, timestamp, nonce) {
  const pairs = flatten(payload, '', []).sort()
  return `${timestamp}\n${nonce}\n${pairs.join('&')}`
}

exports.canonicalize = canonicalize

exports.sign = function (payload, timestamp, nonce, secret) {
  return crypto.createHmac('sha256', secret)
    .update(canonicalize(payload, timestamp, nonce), 'utf8')
    .digest('hex')
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch (e) {
    return false
  }
}

/**
 * Verify signature, timestamp freshness and nonce uniqueness.
 * Returns { ok: true } or { ok: false, reason }.
 */
exports.verifyRequest = async function (req, secret) {
  const signature = req.headers['x-sub2api-signature']
  const timestamp = req.headers['x-sub2api-timestamp']
  const nonce = req.headers['x-sub2api-nonce']

  if (!signature || !timestamp || !nonce) {
    return { ok: false, reason: 'missing_signature_headers' }
  }

  const ts = parseInt(timestamp, 10)
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'bad_timestamp' }
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts)
  if (skew > MAX_SKEW) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  const expected = exports.sign(req.body, timestamp, nonce, secret)
  if (!safeEqualHex(String(signature), expected)) {
    return { ok: false, reason: 'bad_signature' }
  }

  // Replay protection. sortedSetAdd is idempotent on member, so check first.
  const key = 'sub2api:webhook:nonces'
  const seen = await db.isSortedSetMember(key, String(nonce))
  if (seen) {
    return { ok: false, reason: 'replayed_nonce' }
  }
  await db.sortedSetAdd(key, Date.now(), String(nonce))
  await db.sortedSetsRemoveRangeByScore([key], '-inf', Date.now() - (NONCE_TTL * 1000))

  return { ok: true }
}

exports.handleSync = async function (payload) {
  const { event, data } = payload || {}
  if (!event || !data) throw new Error('invalid_payload')

  const uid = await userSync.getUidBySub2APIID(data.user_id)
  if (!uid) {
    winston.warn(`[sub2api-sso] no binding for platform user ${data.user_id}`)
    return { skipped: 'user_not_bound' }
  }

  switch (event) {
    case 'balance.changed': {
      await user.setUserField(uid, 'sub2api:balance', data.balance)
      notifyUser(uid, 'event:sub2api-balance-updated', {
        balance: data.balance, change: data.change, reason: data.reason,
      })
      break
    }
    case 'vip.changed': {
      await user.setUserFields(uid, {
        'sub2api:vip_tier': data.tier,
        'sub2api:vip_label': data.label,
        'sub2api:recharge_bonus_pct': data.recharge_bonus_pct,
      })
      const targetGroups = ['registered-users']
      const tier = parseInt(data.tier, 10)
      if (Number.isFinite(tier) && tier >= 0 && tier <= 6) {
        targetGroups.push(`vip-${tier}`)
      }
      if (data.role === 'admin') targetGroups.push('administrators')
      await userSync.syncGroups(uid, targetGroups)
      notifyUser(uid, 'event:sub2api-vip-updated', { tier: data.tier, label: data.label })
      break
    }
    case 'role.changed': {
      if (data.new_role === 'admin') await groups.join('administrators', uid)
      else await groups.leave('administrators', uid)
      break
    }
    default:
      winston.warn(`[sub2api-sso] unknown event ${event}`)
      return { skipped: 'unknown_event' }
  }

  winston.info(`[sub2api-sso] ${event} applied to uid ${uid}`)
  return { uid }
}

exports.handlePaymentCallback = async function (payload) {
  const { order_id, user_id, item_id, item_type, amount } = payload || {}
  if (!order_id || !item_type) throw new Error('invalid_payload')

  const uid = await userSync.getUidBySub2APIID(user_id)
  if (!uid) throw new Error(`user_not_bound: ${user_id}`)

  // Atomic idempotency: the first increment returns 1, replays return >1, so a
  // duplicate callback can never apply the grant twice.
  const seq = await db.incrObjectField('sub2api:orders:processed', String(order_id))
  if (seq > 1) {
    return { message: 'already_processed' }
  }

  switch (item_type) {
    case 'vip_upgrade':
      await groups.join(`vip-${item_id}`, uid)
      break
    case 'topic':
      await db.setAdd(`topic:${item_id}:paid_users`, uid)
      break
    case 'badge':
      try {
        const badges = require.main.require('./src/badges')
        await badges.give(item_id, uid)
      } catch (e) {
        winston.warn(`[sub2api-sso] badge give failed: ${e.message}`)
      }
      break
    default:
      throw new Error(`invalid_item_type: ${item_type}`)
  }

  notifyUser(uid, 'event:forum-purchase-success', { item_id, item_type, order_id, amount })
  winston.info(`[sub2api-sso] payment order ${order_id} processed for uid ${uid}`)
  return { uid }
}

function notifyUser(uid, event, data) {
  try {
    const io = require.main.require('./src/socket.io')
    io.in(`uid_${uid}`).emit(event, data)
  } catch (e) {
    winston.warn(`[sub2api-sso] socket emit failed: ${e.message}`)
  }
}
