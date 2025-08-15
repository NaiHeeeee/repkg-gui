#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * 自动注释console相关代码的脚本
 * 在构建生产版本时执行，用于移除或注释掉调试用的console语句
 */

// 颜色工具
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

const TARGET_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.vue'];
const SKIP_FILES = [
  'src/js/tailwindcss.js'
];
const CONSOLE_PATTERNS = [
  /console\.log\s*\(/g,
  /console\.debug\s*\(/g,
  /console\.info\s*\(/g,
  /console\.warn\s*\(/g,
  /console\.error\s*\(/g,
  /console\.table\s*\(/g,
  /console\.trace\s*\(/g
];

/**
 * 检查文件是否应该被处理
 */
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // 检查文件扩展名
  if (!TARGET_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // 检查是否在跳过列表中
  const relativePath = path.relative(process.cwd(), filePath);
  const normalizedPath = relativePath.replace(/\\/g, '/');
  
  for (const skipFile of SKIP_FILES) {
    if (normalizedPath === skipFile || relativePath === skipFile) {
      console.log(`${colors.dim}⏭️  跳过文件:${colors.reset} ${colors.gray}${relativePath}${colors.reset}`);
      return false;
    }
  }
  
  return true;
}

/**
 * 注释console语句
 */
function commentConsoleStatements(content, filePath) {
  let modified = false;
  let lines = content.split('\n');
  let consoleCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过已经注释的行
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
      continue;
    }
    
    let hasConsole = false;
    let modifiedLine = line;
    
    // 检查是否包含console语句
    for (const pattern of CONSOLE_PATTERNS) {
      if (pattern.test(line)) {
        hasConsole = true;
        break;
      }
    }
    
    if (hasConsole) {
      // 注释整行
      modifiedLine = '// ' + line;
      modified = true;
      consoleCount++;
    }
    
    lines[i] = modifiedLine;
  }
  
  return {
    content: lines.join('\n'),
    modified,
    consoleCount
  };
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = commentConsoleStatements(content, filePath);
    
    if (result.modified) {
      fs.writeFileSync(filePath, result.content, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      console.log(`${colors.green}✅ 已处理:${colors.reset} ${colors.cyan}${relativePath}${colors.reset} ${colors.yellow}(${result.consoleCount}个console)${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ 处理文件失败:${colors.reset} ${colors.red}${filePath}${colors.reset}`, error.message);
  }
}

/**
 * 递归处理目录
 */
function processDirectory(dirPath) {
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 跳过node_modules和.git等目录
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target'];
        if (!skipDirs.includes(item)) {
          processDirectory(fullPath);
        }
      } else if (stat.isFile() && shouldProcessFile(fullPath)) {
        processFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`${colors.red}❌ 处理目录失败:${colors.reset} ${colors.red}${dirPath}${colors.reset}`, error.message);
  }
}

/**
 * 主函数
 */
function main() {
  console.log(`${colors.cyan}🚀 开始自动注释console语句...${colors.reset}`);
  
  const startTime = Date.now();
  let processedFiles = 0;
  let totalConsoles = 0;
  
  // 处理src目录
  const srcPath = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcPath)) {
    console.log(`${colors.blue}📁 处理目录:${colors.reset} ${colors.green}${srcPath}${colors.reset}`);
    processDirectory(srcPath);
  }
  
  // 处理src-tauri目录中的前端文件
  const tauriSrcPath = path.join(process.cwd(), 'src-tauri');
  if (fs.existsSync(tauriSrcPath)) {
    console.log(`${colors.blue}📁 处理目录:${colors.reset} ${colors.green}${tauriSrcPath}${colors.reset}`);
    processDirectory(tauriSrcPath);
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`\n${colors.green}✨ 处理完成！${colors.reset}`);
  console.log(`${colors.magenta}⏱️  耗时:${colors.reset} ${colors.yellow}${duration}ms${colors.reset}`);
  console.log(`${colors.green}🎉 所有console语句已自动注释！${colors.reset}`);
}

// 执行主函数
main();