#!/usr/bin/env node

/**
 * 构建包装脚本
 * 在运行 tauri build 前检查版本号
 */

import { spawn } from 'child_process';
import path from 'path';

// 颜色工具
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

console.log(`${colors.cyan}🚀 启动构建流程...${colors.reset}\n`);

// 先运行版本管理器
const versionManager = spawn(process.platform === 'win32' ? 'node' : 'node', ['scripts/version-manager.js', '--build'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: process.platform === 'win32'
});

versionManager.on('close', (code) => {
  if (code === 0) {
    console.log(`\n${colors.green}✅ 版本检查完成，开始构建...${colors.reset}\n`);
    
    // 运行 remove-console 和 tauri build
    const buildProcess = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'tauri:build'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: process.platform === 'win32'
    });
    
    buildProcess.on('close', (buildCode) => {
      if (buildCode === 0) {
        console.log(`\n${colors.green}🎉 构建成功完成！${colors.reset}`);
      } else {
        console.log(`\n${colors.red}❌ 构建失败，错误码: ${buildCode}${colors.reset}`);
        process.exit(buildCode);
      }
    });
  } else {
    console.log(`\n${colors.yellow}⚠️  版本管理被中断，取消构建${colors.reset}`);
    process.exit(code);
  }
});