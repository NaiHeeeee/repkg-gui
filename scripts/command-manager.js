#!/usr/bin/env node

/**
 * 统一命令管理脚本
 * 通过序号选择执行不同命令
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// 颜色工具
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bright: '\x1b[1m'
};

// 获取当前版本
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.version;
  } catch (error) {
    return '0.0.0';
  }
}

// 命令列表
const commands = [
  {
    id: 1,
    name: '开发模式',
    description: '启动开发服务器',
    command: 'pnpm run tauri dev --config src-tauri/tauri-dev.conf.json',
    color: colors.blue
  },
  {
    id: 2,
    name: '构建应用',
    description: '使用版本管理构建应用',
    command: 'pnpm run tauri:build:version',
    color: colors.green
  },
  {
    id: 3,
    name: '快速构建',
    description: '直接构建应用(跳过版本管理)',
    command: 'pnpm run tauri:build',
    color: colors.yellow
  },
  {
    id: 4,
    name: '版本管理',
    description: '管理项目版本号',
    command: 'pnpm run version:manage',
    color: colors.magenta
  },
  {
    id: 5,
    name: 'Cargo检查',
    description: '检查src-tauri的代码语法',
    command: 'cargo check',
    cwd: 'src-tauri',
    color: colors.cyan
  },
  {
    id: 6,
    name: 'Cargo清理',
    description: '清理src-tauri的构建缓存',
    command: 'cargo clean',
    cwd: 'src-tauri',
    color: colors.red
  },
  {
    id: 7,
    name: '清理控制台',
    description: '注释console',
    command: 'pnpm run remove-console',
    color: colors.white
  },
  {
    id: 8,
    name: '检查未用i18n',
    description: '查找未使用的国际化文本',
    command: 'pnpm run find-unused-i18n',
    color: colors.gray
  },
  {
    id: 0,
    name: '退出',
    description: '退出命令管理器',
    command: null,
    color: colors.red
  }
];

/**
 * 显示欢迎信息
 */
function showWelcome() {
  const version = getCurrentVersion();
  console.clear();
  console.log(`${colors.bright}${colors.magenta}╔══════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║       RePKG GUI 开发命令管理器       ║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚══════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.cyan}当前版本: ${colors.yellow}v${version}${colors.reset}\n`);
}

/**
 * 显示命令菜单
 */

function showMenu() {
  console.log(`${colors.bright}${colors.white}可用命令:${colors.reset}\n`);
  
  // 使用固定宽度的列布局，确保对齐
  const maxNameWidth = 13; // 名称列最大宽度
  const maxDescWidth = 30; // 描述列最大宽度
  
  commands.forEach(cmd => {
    const id = cmd.id.toString().padEnd(2);
    
    // 计算中文字符宽度，中文占2个字符宽度
    const nameLength = [...cmd.name].reduce((len, char) => len + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1), 0);
    const namePadding = ' '.repeat(Math.max(0, maxNameWidth - nameLength));
    
    if (cmd.id === 0) {
      console.log(`${colors.red}  ${id} ${cmd.name}${namePadding} ${cmd.description}${colors.reset}`);
    } else {
      const descLength = [...cmd.description].reduce((len, char) => len + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1), 0);
      const descPadding = ' '.repeat(Math.max(0, maxDescWidth - descLength));
      const commandText = cmd.command ? `${descPadding} ${colors.gray}[${cmd.command}]${colors.reset}` : '';
      console.log(`  ${cmd.color}${id} ${cmd.name}${namePadding} ${colors.gray}${cmd.description}${commandText}${colors.reset}`);
    }
  });
  
  console.log('');
}

/**
 * 执行命令
 */
function executeCommand(command, cwd = null) {
  if (!command) {
    console.log(`${colors.green}👋 再见！${colors.reset}`);
    process.exit(0);
  }

  console.log(`${colors.cyan}🚀 正在执行: ${colors.yellow}${command}${colors.reset}${cwd ? ` (目录: ${cwd})` : ''}\n`);
  
  // 使用更可靠的方式执行命令
  const isWindows = process.platform === 'win32';
  
  // 在Windows上使用shell执行整个命令，避免EINVAL错误
  const child = spawn(command, {
    stdio: 'inherit',
    shell: isWindows,
    cwd: cwd ? path.join(process.cwd(), cwd) : process.cwd()
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(`\n${colors.green}✅ 命令执行完成！${colors.reset}\n`);
    } else {
      console.log(`\n${colors.red}❌ 命令执行失败，错误码: ${code}${colors.reset}\n`);
    }
    
    // 执行完命令后询问是否继续
    setTimeout(() => {
      askContinue();
    }, 1000);
  });

  child.on('error', (error) => {
    console.error(`${colors.red}❌ 执行命令时出错: ${error.message}${colors.reset}`);
    askContinue();
  });
}

/**
 * 询问是否执行cargo clean
 */
function askCargoClean() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}是否执行 [cargo clean] 清理构建缓存？(Y/n): ${colors.reset}`, (answer) => {
      rl.close();
      const response = answer.trim().toLowerCase();
      resolve(response === '' || response === 'y' || response === 'yes');
    });
  });
}

/**
 * 询问是否继续
 */
function askContinue() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`${colors.cyan}是否继续？(Y/n): ${colors.reset}`, (answer) => {
    rl.close();
    const response = answer.trim().toLowerCase();
    if (response === '' || response === 'y' || response === 'yes') {
      start();
    } else {
      console.log(`${colors.green}👋 再见！${colors.reset}`);
      process.exit(0);
    }
  });
}

/**
 * 获取用户选择
 */
function getUserChoice() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}请选择要执行的命令 (输入序号): ${colors.reset}`, (input) => {
      rl.close();
      const choice = parseInt(input.trim());
      
      if (isNaN(choice)) {
        console.log(`${colors.red}❌ 请输入有效的数字！${colors.reset}`);
        resolve(null);
      } else {
        resolve(choice);
      }
    });
  });
}

/**
 * 启动命令管理器
 */
async function start() {
  showWelcome();
  showMenu();
  
  let choice = null;
  while (choice === null) {
    choice = await getUserChoice();
    
    if (choice !== null) {
      const selected = commands.find(cmd => cmd.id === choice);
      
      if (selected) {
        if (selected.id === 0) {
          console.log(`${colors.green}👋 再见！${colors.reset}`);
          process.exit(0);
        } else if (selected.id === 2 || selected.id === 3) {
          // 构建应用和快速构建命令，先询问是否执行cargo clean
          const shouldClean = await askCargoClean();
          if (shouldClean) {
            console.log(`${colors.cyan}🚀 正在执行: ${colors.yellow}cargo clean${colors.reset} (目录: src-tauri)\n`);
            const cleanChild = spawn('cargo clean', {
              stdio: 'inherit',
              shell: true,
              cwd: path.join(process.cwd(), 'src-tauri')
            });
            
            cleanChild.on('close', (code) => {
              if (code === 0) {
                console.log(`${colors.green}✅ cargo clean 完成！${colors.reset}\n`);
                executeCommand(selected.command, selected.cwd);
              } else {
                console.log(`${colors.red}❌ cargo clean 失败，错误码: ${code}${colors.reset}\n`);
                askContinue();
              }
            });
            return;
          } else {
            executeCommand(selected.command, selected.cwd);
            return;
          }
        } else {
          executeCommand(selected.command, selected.cwd);
          return; // 执行命令后退出循环，由执行完成后的回调处理后续
        }
      } else {
        console.log(`${colors.red}❌ 无效的选择！${colors.reset}`);
        choice = null;
      }
    }
  }
}

/**
 * 错误处理
 */
process.on('uncaughtException', (error) => {
  console.error(`${colors.red}❌ 未捕获的错误:${colors.reset}`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}❌ 未处理的Promise拒绝:${colors.reset}`, reason);
  process.exit(1);
});

// 启动
start();