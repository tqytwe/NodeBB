#!/usr/bin/env node
'use strict'

/**
 * Sub2API NodeBB 启动器
 * 处理环境变量注入,然后启动 NodeBB
 */

const fs = require('fs')
const path = require('path')

console.log('[sub2api-loader] Starting Sub2API NodeBB...')

// ============================================
// 处理 MongoDB URI - 从分立字段构造
// ============================================
if (!process.env.MONGO_URI && process.env.MONGO_HOST) {
  const user = process.env.MONGO_USERNAME || ''
  const pass = process.env.MONGO_PASSWORD || ''
  const host = process.env.MONGO_HOST
  const port = process.env.MONGO_PORT || '27017'
  const db = process.env.MONGO_DATABASE || 'sub2api_forum'
  
  let uri = 'mongodb://'
  if (user && pass) {
    uri += `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`
  }
  uri += `${host}:${port}/${db}`
  
  process.env.MONGO_URI = uri
  console.log('[sub2api-loader] Constructed MONGO_URI from individual fields')
}

// ============================================
// 验证必需的环境变量
// ============================================
const required = ['MONGO_URI']
const missing = required.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error('[sub2api-loader] FATAL: Missing environment variables:')
  missing.forEach(k => console.error('  - ' + k))
  process.exit(1)
}

// ============================================
// 输出环境变量摘要（不包含密钥）
// ============================================
console.log('[sub2api-loader] Configuration:')
console.log('  MONGO_URI: mongodb://***@' + 
  (process.env.MONGO_URI.match(/@([^/]+)/)?.[1] || 'unknown'))
console.log('  REDIS_HOST:', process.env.REDIS_HOST || '(not set)')
console.log('  REDIS_PORT:', process.env.REDIS_PORT || '6379')
console.log('  PORT:', process.env.PORT || '4567')
console.log('  SUB2API_PLATFORM_URL:', process.env.SUB2API_PLATFORM_URL || '(not set)')
console.log('  NODEBB_SSO_CLIENT_ID:', process.env.NODEBB_SSO_CLIENT_ID || '(not set)')
console.log('  NODEBB_SSO_ENABLED:', !!(process.env.NODEBB_SSO_CLIENT_ID && process.env.NODEBB_SSO_CLIENT_SECRET))

// ============================================
// 启动 NodeBB
// ============================================
console.log('[sub2api-loader] Handing over to NodeBB...')

// NodeBB 启动入口
process.chdir('/usr/src/app')
require('/usr/src/app/loader.js')
