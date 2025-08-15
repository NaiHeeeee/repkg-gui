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
  reset: '\x1b[0m'
};

console.log(`${colors.cyan}🚀 启动构建流程...${colors.reset}\n`);

// 先运行版本管理器
const versionManager = spawn('node', [path.join('scripts', 'version-manager.js'), '--build'], {
  stdio: 'inherit',
  shell: true
});

versionManager.on('close', (code) => {
  if (code === 0) {
    console.log(`\n${colors.green}✅ 版本检查完成，开始构建...${colors.reset}\n`);
    
    // 运行 remove-console 和 tauri build
    const buildProcess = spawn('npm', ['run', 'tauri:build'], {
      stdio: 'inherit',
      shell: true
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