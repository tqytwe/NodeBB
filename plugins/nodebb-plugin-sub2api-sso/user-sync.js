'use strict'

const winston = require.main.require('winston')
const crypto = require('crypto')
const db = require.main.require('./src/database')
const user = require.main.require('./src/user')
const groups = require.main.require('./src/groups')

// Single hash mapping platform user id -> forum uid. The previous
// implementation walked the whole `sub2api:user:uid` zset and issued one
// getObjectField per member for every webhook, i.e. O(n) round-trips per call.
const INDEX_KEY = 'sub2api:platform2uid'

exports.upsertUser = async function (userInfo, accessToken) {
  if (!userInfo || !userInfo.id) throw new Error('platform_id_required')
  const email = userInfo.email
  if (!email) throw new Error('email_required')

  // Prefer the explicit binding: a returning SSO user must resolve by platform
  // id, never by email, so changing an email on the platform cannot silently
  // re-target a different forum account.
  let uid = await exports.getUidBySub2APIID(userInfo.id)

  if (!uid) {
    const existing = await user.getUidByEmail(email)
    if (existing) {
      // Linking by email merges an account the SSO user may not control. Only
      // do it when the platform states the address is verified, otherwise an
      // unverified signup on either side becomes an account-takeover path.
      if (userInfo.email_verified === false) {
        throw new Error('email_not_verified_cannot_link')
      }
      uid = existing
      winston.info(`[sub2api-sso] linking platform ${userInfo.id} to existing uid ${uid} by verified email`)
    }
  }

  if (!uid) {
    const randomPass = crypto.randomBytes(32).toString('hex')
    uid = await user.create({
      username: userInfo.username || `sub2_${userInfo.id}`,
      email: email,
      password: randomPass,
    })
    winston.info(`[sub2api-sso] created uid ${uid} for platform user ${userInfo.id}`)
  }

  await user.setUserFields(uid, {
    'sub2api:uid': userInfo.id,
    'sub2api:access_token': accessToken,
    'sub2api:balance': userInfo.balance,
    'sub2api:vip_tier': userInfo.vip_tier,
    'sub2api:vip_label': userInfo.vip_label,
    'sub2api:recharge_bonus_pct': userInfo.recharge_bonus_pct,
  })

  // Forward binding + reverse index + membership zset.
  await db.setObjectField(`sub2api:user:${uid}`, 'sub2api_uid', String(userInfo.id))
  await db.setObjectField(INDEX_KEY, String(userInfo.id), uid)
  await db.sortedSetAdd('sub2api:user:uid', Date.now(), uid)

  await exports.syncGroups(uid, userInfo.groups || ['registered-users'])

  if (userInfo.language) {
    await user.setUserField(uid, 'language', userInfo.language)
  }

  return await user.getUserData(uid)
}

exports.syncGroups = async function (uid, targetGroups) {
  const userGroups = await groups.getUserGroups([uid])
  const currentVipGroups = (userGroups[0] || []).filter(g => g.name && g.name.startsWith('vip-'))

  for (const g of currentVipGroups) {
    if (!targetGroups.includes(g.name)) {
      try {
        await groups.leave(g.name, uid)
      } catch (e) {
        winston.warn(`[sub2api-sso] group leave failed: ${g.name}: ${e.message}`)
      }
    }
  }

  for (const groupName of targetGroups) {
    try {
      await groups.join(groupName, uid)
    } catch (e) {
      winston.warn(`[sub2api-sso] group join failed: ${groupName}: ${e.message}`)
    }
  }
}

exports.getUidBySub2APIID = async function (sub2apiUID) {
  if (sub2apiUID === undefined || sub2apiUID === null) return null

  const indexed = await db.getObjectField(INDEX_KEY, String(sub2apiUID))
  if (indexed) {
    return parseInt(indexed, 10)
  }

  // Fallback for bindings written before the reverse index existed; backfills
  // the index so this path is taken at most once per legacy user.
  const uids = await db.getSortedSetRange('sub2api:user:uid', 0, -1)
  for (const uid of uids) {
    const mapped = await db.getObjectField(`sub2api:user:${uid}`, 'sub2api_uid')
    if (String(mapped) === String(sub2apiUID)) {
      await db.setObjectField(INDEX_KEY, String(sub2apiUID), uid)
      winston.verbose(`[sub2api-sso] backfilled reverse index ${sub2apiUID} -> ${uid}`)
      return parseInt(uid, 10)
    }
  }
  return null
}

exports.getUserAccessToken = async function (uid) {
  return await user.getUserField(uid, 'sub2api:access_token')
}
