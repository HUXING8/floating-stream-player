#!/usr/bin/env node
'use strict'

// 启动器：用已安装的 Electron 运行本包（package.json 的 main 指向 out/main/index.js）。
const { spawn } = require('node:child_process')
const path = require('node:path')

let electronPath
try {
  // electron 作为依赖安装时，require('electron') 返回可执行文件路径
  electronPath = require('electron')
} catch {
  console.error('未找到 Electron。请确认依赖已正确安装（npm install）。')
  process.exit(1)
}

const appDir = path.join(__dirname, '..')
const child = spawn(electronPath, [appDir, ...process.argv.slice(2)], { stdio: 'inherit' })
child.on('close', (code) => process.exit(code == null ? 0 : code))
