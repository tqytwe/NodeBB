#!/usr/bin/env node
'use strict'

/**
 * Sub2API NodeBB 启动器
 * 在启动前处理环境变量注入,然后启动 NodeBB
 */

console.log('[sub2api-loader] =========================================')
console.log('[sub2api-loader] Starting Sub2API NodeBB...')
console.log('[sub2api-loader] =========================================')

// ============================================
// 1. 处理 MongoDB URI
// ============================================
if (!process.env.MONGO_URI && process.env.MONGO_HOST) {
  const user = process.env.MONGO_USERNAME || ''
  const pass = process.env.MONGO_PASSWORD || ''
  const host = process.env.MONGO_HOST
  const port = process.env.MONGO_PORT || '27017'
  const db = process.env.MONGO_DATABASE || 'sub2api_forum'
  
  let uri = 'mongodb://'
  if (user && pass) {
    uri += encodeURIComponent(user) + ':' + encodeURIComponent(pass) + '@'
  }
  uri += host + ':' + port + '/' + db
  
  process.env.MONGO_URI = uri
  console.log('[sub2api-loader] Constructed MONGO_URI from individual fields')
}

if (process.env.MONGO_URI) {
  // 将 MongoDB URI 注入到 NodeBB 期望的环境变量
  process.env.MONGO_CONNECTION_STRING = process.env.MONGO_URI
  console.log('[sub2api-loader] MONGO_URI: mongodb://***@' + 
    (process.env.MONGO_URI.match(/@([^/]+)/)?.[1] || 'unknown'))
}

// ============================================
// 2. 处理 Redis
// ============================================
if (process.env.REDIS_HOST) {
  console.log('[sub2api-loader] REDIS_HOST:', process.env.REDIS_HOST)
  console.log('[sub2api-loader] REDIS_PORT:', process.env.REDIS_PORT || '6379')
  if (process.env.REDIS_PASSWORD) {
    console.log('[sub2api-loader] REDIS_PASSWORD: ***')
  }
  
  // 构造 Redis URL（NodeBB 支持）
  const redisUrl = 'redis://' + 
    (process.env.REDIS_PASSWORD ? ':' + encodeURIComponent(process.env.REDIS_PASSWORD) + '@' : '') +
    process.env.REDIS_HOST + ':' + (process.env.REDIS_PORT || '6379')
  process.env.REDIS_URL = redisUrl
}

// ============================================
// 3. 验证必需环境变量
// ============================================
const required = ['MONGO_URI']
const missing = required.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error('[sub2api-loader] FATAL: Missing required environment variables:')
  missing.forEach(k => console.error('  - ' + k))
  console.error('[sub2api-loader] Please set MONGO_URI in Zeabur Variables')
  process.exit(1)
}

// ============================================
// 4. 输出配置摘要
// ============================================
console.log('[sub2api-loader] Configuration summary:')
console.log('  PORT:', process.env.PORT || '4567')
console.log('  SUB2API_PLATFORM_URL:', process.env.SUB2API_PLATFORM_URL || '(not set)')
console.log('  NODEBB_SSO_CLIENT_ID:', process.env.NODEBB_SSO_CLIENT_ID || '(not set)')
console.log('  NODEBB_SSO_ENABLED:', !!(process.env.NODEBB_SSO_CLIENT_ID && process.env.NODEBB_SSO_CLIENT_SECRET))
console.log('  REDIS_HOST:', process.env.REDIS_HOST || '(not set - may fail)')

// ============================================
// 5. 启动 NodeBB
// ============================================
console.log('[sub2api-loader] Handing over to NodeBB...')
console.log('[sub2api-loader] =========================================')

// 切换到 NodeBB 工作目录
process.chdir('/usr/src/app')

// 启动 NodeBB
require('/usr/src/app/loader.js')
