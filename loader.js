#!/usr/bin/env node
'use strict'

/**
 * Sub2API NodeBB 启动器
 * 在官方 NodeBB 之上加载我们的自定义插件
 */

console.log('[sub2api-loader] Starting Sub2API NodeBB...')
console.log('[sub2api-loader] Plugin: nodebb-plugin-sub2api-sso')

// 输出环境变量信息(不包含密钥)
console.log('[sub2api-loader] Environment:')
console.log('  SUB2API_PLATFORM_URL:', process.env.SUB2API_PLATFORM_URL || '(not set)')
console.log('  NODEBB_SSO_CLIENT_ID:', process.env.NODEBB_SSO_CLIENT_ID || '(not set)')
console.log('  NODE_SSO_ENABLED:', !!(process.env.NODEBB_SSO_CLIENT_ID && process.env.NODEBB_SSO_CLIENT_SECRET))
console.log('  PORT:', process.env.PORT || 4567)

// 启动 NodeBB（通过 npm start 或 node loader.js）
const { spawn } = require('child_process')
const path = require('path')

// 直接 require NodeBB 的 loader
process.chdir('/usr/src/app')
require('/usr/src/app/loader.js')
