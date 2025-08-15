#!/usr/bin/env node

/**
 * 版本管理脚本
 * 在运行 tauri build 时管理版本号更新
 */

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
  gray: '\x1b[90m'
};

// 需要更新的文件
const VERSION_FILES = [
  {
    path: 'package.json',
    pattern: /"version":\s*"([0-9]+\.[0-9]+\.[0-9]+)"/,
    type: 'json'
  },
  {
    path: 'src-tauri/tauri.conf.json',
    pattern: /"version":\s*"([0-9]+\.[0-9]+\.[0-9]+)"/,
    type: 'json'
  },
  {
    path: 'src-tauri/Cargo.toml',
    pattern: /version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/,
    type: 'toml'
  },
  {
    path: 'src/index.html',
    pattern: /<span[^>]*id="app-version"[^>]*>v([0-9]+\.[0-9]+\.[0-9]+)<\/span>/,
    type: 'html'
  }
];

/**
 * 读取当前版本号
 */
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error(`${colors.red}❌ 无法读取当前版本号:${colors.reset}`, error.message);
    process.exit(1);
  }
}

/**
 * 验证版本号格式
 */
function isValidVersion(version) {
  const regex = /^\d+\.\d+\.\d+$/;
  return regex.test(version);
}

/**
 * 比较版本号
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

/**
 * 更新文件中的版本号
 */
function updateVersionInFile(fileConfig, newVersion) {
  const filePath = fileConfig.path;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(fileConfig.pattern);
    
    if (!match) {
      console.warn(`${colors.yellow}⚠️  在 ${filePath} 中未找到版本号${colors.reset}`);
      return false;
    }
    
    const oldVersion = match[1];
    const newContent = content.replace(fileConfig.pattern, match[0].replace(oldVersion, newVersion));
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`${colors.green}✅ ${filePath}${colors.reset}: ${colors.cyan}${oldVersion}${colors.reset} → ${colors.green}${newVersion}${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ 更新 ${filePath} 失败:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * 交互式获取新版本号
 */
async function getNewVersion(currentVersion) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    function ask() {
      rl.question(`${colors.cyan}请输入新版本号${colors.reset} (当前: ${colors.yellow}v${currentVersion}${colors.reset}, 直接回车取消): `, (input) => {
        // 清理输入，移除重复字符和空格
        const cleanInput = input.replace(/[^\d.]/g, '').replace(/\.{2,}/g, '.');
        const newVersion = cleanInput.trim();
        
        if (newVersion === '') {
          console.log(`${colors.gray}❌ 已取消版本更新${colors.reset}`);
          rl.close();
          resolve(null); // 返回null表示取消
          return;
        }
        
        if (!isValidVersion(newVersion)) {
          console.log(`${colors.red}❌ 无效的版本号格式！${colors.reset}`);
          console.log(`${colors.yellow}💡 提示：请使用 x.y.z 格式（如 1.2.3），只能包含数字和点${colors.reset}`);
          ask();
          return;
        }
        
        if (compareVersions(newVersion, currentVersion) <= 0) {
          console.log(`${colors.red}❌ 新版本号必须大于当前版本 ${currentVersion}${colors.reset}`);
          ask();
          return;
        }
        
        // 二次确认
        rl.question(`${colors.yellow}⚠️  确认将版本从 ${colors.cyan}v${currentVersion}${colors.reset} ${colors.yellow}更新为 ${colors.green}v${newVersion}${colors.reset} ${colors.yellow}？(Y/n): ${colors.reset}`, (confirm) => {
          if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes' || confirm === '') {
            rl.close();
            resolve(newVersion);
          } else {
            console.log(`${colors.gray}❌ 已取消版本更新${colors.reset}`);
            rl.close();
            resolve(null); // 返回null表示取消
          }
        });
      });
    }
    
    ask();
  });
}

/**
 * 显示当前版本信息
 */
function showCurrentVersion() {
  const currentVersion = getCurrentVersion();
  
  console.log(`${colors.cyan}📋 当前项目版本: ${colors.yellow}v${currentVersion}${colors.reset}\n`);
  
  // 检查版本一致性（但不显示具体文件）
  const versions = [];
  
  VERSION_FILES.forEach(fileConfig => {
    try {
      const content = fs.readFileSync(fileConfig.path, 'utf8');
      const match = content.match(fileConfig.pattern);
      const version = match ? match[1] : null;
      if (version) versions.push(version);
    } catch (error) {
      // 静默处理读取错误
    }
  });
  
  // 检查所有文件版本是否一致
  const uniqueVersions = [...new Set(versions)];
  if (uniqueVersions.length > 1) {
    console.log(`${colors.yellow}⚠️  检测到版本不一致，建议统一版本${colors.reset}\n`);
  }
  
  return currentVersion;
}

/**
 * 更新所有文件的版本号
 */
async function updateAllVersions(newVersion) {
  console.log(`${colors.cyan}🔄 正在更新版本号...${colors.reset}\n`);
  
  let successCount = 0;
  
  VERSION_FILES.forEach(fileConfig => {
    if (updateVersionInFile(fileConfig, newVersion)) {
      successCount++;
    }
  });
  
  console.log(`\n${colors.green}✅ 版本号更新完成！${colors.reset} ${successCount}/${VERSION_FILES.length} 个文件已更新`);
}

/**
 * 主函数
 */
async function main() {
  console.log(`${colors.magenta}🔧 版本管理工具${colors.reset}\n`);
  
  // 显示当前版本
  const currentVersion = showCurrentVersion();
  
  // 获取新版本号
  const newVersion = await getNewVersion(currentVersion);
  
  if (newVersion === null) {
    // 用户取消了操作
    return;
  }
  
  // 更新所有文件的版本号
  await updateAllVersions(newVersion);
  console.log(`\n${colors.green}🎉 版本号已成功更新为 v${newVersion}${colors.reset}`);
}

/**
 * 检查是否在 build 命令中调用
 */
function checkBuildCommand() {
  const args = process.argv.slice(2);
  
  if (args.includes('--build')) {
    console.log(`${colors.cyan}🔨 构建模式检测${colors.reset}\n`);
    
    const currentVersion = showCurrentVersion();
    
    // 在构建模式下直接提示版本更新
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`${colors.cyan}💡 构建模式下版本更新${colors.reset}`);
    console.log(`${colors.gray}  直接输入新版本号即可更新${colors.reset}`);
    console.log(`${colors.gray}  直接回车保持当前版本${colors.reset}\n`);
    
    rl.question(`${colors.cyan}请输入新版本号${colors.reset} (当前: ${colors.yellow}v${currentVersion}${colors.reset}, 直接回车跳过): `, async (input) => {
      const cleanInput = input.replace(/[^\d.]/g, '').replace(/\.{2,}/g, '.').trim();
      
      if (cleanInput === '') {
        console.log(`${colors.green}✅ 保持当前版本，继续执行构建命令${colors.reset}`);
      } else if (!isValidVersion(cleanInput)) {
        console.log(`${colors.red}❌ 无效的版本号格式，保持当前版本${colors.reset}`);
      } else if (compareVersions(cleanInput, currentVersion) <= 0) {
        console.log(`${colors.red}❌ 新版本号必须大于当前版本，保持当前版本${colors.reset}`);
      } else {
        await updateAllVersions(cleanInput);
        console.log(`\n${colors.green}🎉 版本号已更新为 v${cleanInput}${colors.reset}`);
        console.log(`${colors.green}✅ 可以继续执行构建命令${colors.reset}`);
      }
      
      rl.close();
    });
  } else {
    main();
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error(`${colors.red}❌ 未捕获的错误:${colors.reset}`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}❌ 未处理的Promise拒绝:${colors.reset}`, reason);
  process.exit(1);
});

// 启动脚本
checkBuildCommand();