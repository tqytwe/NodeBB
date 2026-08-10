'use strict'

const winston = require.main.require('winston')
const crypto = require('crypto')
const db = require.main.require('./src/database')
const user = require.main.require('./src/user')
const groups = require.main.require('./src/groups')

exports.upsertUser = async function (userInfo, accessToken) {
  const email = userInfo.email
  if (!email) throw new Error('email_required')

  let uid = await user.getUidByEmail(email)
  if (!uid) {
    const randomPass = crypto.randomBytes(32).toString('hex')
    uid = await user.create({
      username: userInfo.username || ('sub2_' + userInfo.id),
      email: email,
      password: randomPass,
    })
    winston.info('[sub2api-sso] Created user: ' + email + ' -> uid ' + uid)
  }

  await user.setUserFields(uid, {
    'sub2api:uid': userInfo.id,
    'sub2api:access_token': accessToken,
    'sub2api:balance': userInfo.balance,
    'sub2api:vip_tier': userInfo.vip_tier,
    'sub2api:vip_label': userInfo.vip_label,
    'sub2api:recharge_bonus_pct': userInfo.recharge_bonus_pct,
  })

  await db.setObjectField('sub2api:user:' + uid, 'sub2api_uid', String(userInfo.id))
  await db.sortedSetAdd('sub2api:user:uid', Date.now(), uid)

  const targetGroups = userInfo.groups || ['registered-users']
  await this.syncGroups(uid, targetGroups)

  if (userInfo.language) {
    await user.setUserField(uid, 'language', userInfo.language)
  }

  return await user.getUserData(uid)
}

exports.syncGroups = async function (uid, targetGroups) {
  const userGroups = await groups.getUserGroups([uid])
  const currentVipGroups = userGroups[0].filter(g => g.name && g.name.startsWith('vip-'))

  for (const g of currentVipGroups) {
    if (!targetGroups.includes(g.name)) {
      try { await groups.leave(g.name, uid) } catch (e) {}
    }
  }

  for (const groupName of targetGroups) {
    try {
      await groups.join(groupName, uid)
    } catch (e) {
      winston.warn('[sub2api-sso] Group join failed: ' + groupName)
    }
  }
}

exports.getUidBySub2APIID = async function (sub2apiUID) {
  const uids = await db.getSortedSetRange('sub2api:user:uid', 0, -1)
  for (const uid of uids) {
    const mapped = await db.getObjectField('sub2api:user:' + uid, 'sub2api_uid')
    if (String(mapped) === String(sub2apiUID)) {
      return parseInt(uid, 10)
    }
  }
  return null
}

exports.getUserAccessToken = async function (uid) {
  return await user.getUserField(uid, 'sub2api:access_token')
}
