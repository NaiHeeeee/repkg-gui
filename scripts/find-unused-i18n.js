#!/usr/bin/env node

/**
 * 检查未使用的i18n键值脚本
 * 扫描src/i18n/locales中的所有键值，检查是否在src目录中被使用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  i18nDir: path.join(__dirname, '..', 'src', 'i18n', 'locales'),
  srcDir: path.join(__dirname, '..', 'src'),
  supportedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.html', '.vue'],
  ignorePatterns: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.next/,
    /coverage/
  ]
};

/**
 * 读取JSON文件
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取JSON文件失败: ${filePath}`, error.message);
    return {};
  }
}

/**
 * 获取所有嵌套键值
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

/**
 * 检查是否应该忽略该路径
 */
function shouldIgnore(filePath) {
  return CONFIG.ignorePatterns.some(pattern => pattern.test(filePath));
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir, callback) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    
    if (shouldIgnore(fullPath)) {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath, callback);
    } else if (stat.isFile() && CONFIG.supportedExtensions.includes(path.extname(item))) {
      callback(fullPath);
    }
  }
}

/**
 * 搜索文件中的i18n键值使用，并分类统计使用方式
 */
/**
 * 搜索文件中的i18n键值使用
 */
function findUsedKeysInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const usedKeys = new Set();
  const usagePatterns = {
    i18n_t: [],
    this_t: [],
    t_function: [],
    window_i18n_t: [],
    window_i18n_optional: [],
    window_i18n_conditional: [],
    data_attributes: [],
    dynamic_usage: []
  };
  
  // 定义所有匹配模式
  const patternDefinitions = [
    {
      name: 'i18n_t',
      pattern: /i18n\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      description: '直接i18n.t调用'
    },
    {
      name: 'this_t',
      pattern: /this\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      description: 'this.t调用'
    },
    {
      name: 't_function',
      pattern: /[^\w\.]t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      description: '独立t函数调用'
    },
    {
      name: 'window_i18n_t',
      pattern: /window\.i18n\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      description: 'window.i18n.t直接调用'
    },
    {
      name: 'window_i18n_optional',
      pattern: /window\.i18n\?\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      description: '可选链window.i18n?.t调用'
    },
    {
      name: 'window_i18n_conditional',
      pattern: /window\.i18n\s*&&\s*window\.i18n\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      description: '条件window.i18n && window.i18n.t调用'
    },
    {
      name: 'data_attributes',
      pattern: /data-i18n(?:-(?:placeholder|title|document-title))?\s*=\s*['"`]([^'"`]+)['"`]/g,
      description: 'HTML data属性'
    },
    {
      name: 'dynamic_usage',
      pattern: /['"`]([a-zA-Z0-9_.-]+)['"`]\s*:\s*[^,]*i18n/g,
      description: '动态键值使用'
    }
  ];
  
  // 执行所有模式匹配
  for (const { name, pattern } of patternDefinitions) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1];
      usedKeys.add(key);
      usagePatterns[name].push({
        key,
        file: filePath,
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }
  
  return { keys: usedKeys, patterns: usagePatterns };
}

/**
 * 查找所有使用的i18n键值，并收集使用方式统计
 */
function findAllUsedKeys() {
  const usedKeys = new Set();
  const allPatterns = {
    i18n_t: [],
    this_t: [],
    t_function: [],
    window_i18n_t: [],
    window_i18n_optional: [],
    window_i18n_conditional: [],
    data_attributes: [],
    dynamic_usage: []
  };
  
  scanDirectory(CONFIG.srcDir, (filePath) => {
    const { keys, patterns } = findUsedKeysInFile(filePath);
    keys.forEach(key => usedKeys.add(key));
    
    // 合并各个模式的使用情况
    Object.keys(allPatterns).forEach(patternName => {
      allPatterns[patternName].push(...patterns[patternName]);
    });
  });
  
  return { keys: usedKeys, patterns: allPatterns };
}

/**
 * 查找所有i18n键值
 */
function findAllI18nKeys() {
  const allKeys = {};
  
  if (!fs.existsSync(CONFIG.i18nDir)) {
    console.error(`i18n目录不存在: ${CONFIG.i18nDir}`);
    return allKeys;
  }
  
  const files = fs.readdirSync(CONFIG.i18nDir);
  
  for (const file of files) {
    if (path.extname(file) === '.json') {
      const filePath = path.join(CONFIG.i18nDir, file);
      const locale = path.basename(file, '.json');
      const translations = readJsonFile(filePath);
      allKeys[locale] = getAllKeys(translations);
    }
  }
  
  return allKeys;
}

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
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

/**
 * 主函数
 */
function main() {
  console.log(`${colors.cyan}🔍 开始检查未使用的i18n键值...${colors.reset}\n`);
  
  // 获取所有i18n键值
  const allI18nKeys = findAllI18nKeys();
  
  if (Object.keys(allI18nKeys).length === 0) {
    console.error(`${colors.red}❌ 没有找到任何i18n键值${colors.reset}`);
    return;
  }
  
  console.log(`${colors.blue}📁 找到的语言文件:${colors.reset}`);
  Object.keys(allI18nKeys).forEach(locale => {
    console.log(`   ${colors.green}${locale}${colors.reset}: ${colors.yellow}${allI18nKeys[locale].length}${colors.reset} 个键值`);
  });
  
  // 获取所有使用的i18n键值和使用模式
  console.log(`\n${colors.blue}🔍 扫描源码中的i18n使用...${colors.reset}`);
  const { keys: usedKeys, patterns: usagePatterns } = findAllUsedKeys();
  console.log(`   ${colors.green}✅ 找到 ${colors.yellow}${usedKeys.size}${colors.reset} 个被使用的键值`);
  
  // 显示使用方式分类统计
  console.log(`\n${colors.magenta}📊 i18n使用方式分类:${colors.reset}`);
  console.log(`${colors.gray}${'='.repeat(50)}${colors.reset}`);
  
  const patternStats = [
    { name: 'i18n_t', label: '直接i18n.t调用', count: usagePatterns.i18n_t.length },
    { name: 'this_t', label: 'this.t调用', count: usagePatterns.this_t.length },
    { name: 't_function', label: '独立t函数调用', count: usagePatterns.t_function.length },
    { name: 'window_i18n_t', label: 'window.i18n.t直接调用', count: usagePatterns.window_i18n_t.length },
    { name: 'window_i18n_optional', label: '可选链window.i18n?.t', count: usagePatterns.window_i18n_optional.length },
    { name: 'window_i18n_conditional', label: '条件window.i18n && window.i18n.t', count: usagePatterns.window_i18n_conditional.length },
    { name: 'data_attributes', label: 'HTML data属性', count: usagePatterns.data_attributes.length },
    { name: 'dynamic_usage', label: '动态键值使用', count: usagePatterns.dynamic_usage.length }
  ];
  
  let totalUsages = 0;
  patternStats.forEach(stat => {
    if (stat.count > 0) {
      console.log(`   ${colors.cyan}${stat.label}${colors.reset}: ${colors.yellow}${stat.count}${colors.reset} 次`);
      totalUsages += stat.count;
    }
  });
  console.log(`   ${colors.blue}总计使用次数${colors.reset}: ${colors.yellow}${totalUsages}${colors.reset}`);
  
  // 分析每个语言文件
  const results = {};
  
  for (const [locale, keys] of Object.entries(allI18nKeys)) {
    const unusedKeys = keys.filter(key => !usedKeys.has(key));
    const usedKeysInLocale = keys.filter(key => usedKeys.has(key));
    
    results[locale] = {
      total: keys.length,
      used: usedKeysInLocale.length,
      unused: unusedKeys.length,
      usedPercentage: ((usedKeysInLocale.length/keys.length)*100).toFixed(1),
      unusedPercentage: ((unusedKeys.length/keys.length)*100).toFixed(1)
    };
  }
  
  // 显示简洁的统计结果
  console.log(`\n${colors.magenta}📊 检查结果摘要:${colors.reset}`);
  console.log(`${colors.gray}${'='.repeat(60)}${colors.reset}`);
  
  for (const [locale, result] of Object.entries(results)) {
    const color = result.unused > 0 ? colors.red : colors.green;
    console.log(`${color}🌍 ${locale}${colors.reset}: ${colors.yellow}${result.total}${colors.reset} 个键值, ${colors.green}${result.used} 已使用${colors.reset}, ${result.unused > 0 ? colors.red : colors.gray}${result.unused} 未使用${colors.reset}`);
  }
  
  // 生成详细报告（包含具体键值）
  const reportPath = path.join(__dirname, 'i18n-detailed-report.json');
  const detailedReport = {
    timestamp: new Date().toISOString(),
    summary: results,
    usagePatterns: usagePatterns,
    patternStats: patternStats.filter(stat => stat.count > 0),
    allUsedKeys: Array.from(usedKeys).sort(),
    unusedByLocale: Object.fromEntries(
      Object.entries(results).map(([locale, result]) => [locale, {
        count: result.unused,
        keys: allI18nKeys[locale].filter(key => !usedKeys.has(key))
      }])
    ),
    usedByLocale: Object.fromEntries(
      Object.entries(results).map(([locale, result]) => [locale, {
        count: result.used,
        keys: allI18nKeys[locale].filter(key => usedKeys.has(key))
      }])
    )
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
  console.log(`\n${colors.green}📄 详细报告已保存到:${colors.reset} ${colors.cyan}${reportPath}${colors.reset}`);
  
  // 生成简洁报告（仅统计）
  // const summaryReportPath = path.join(__dirname, 'i18n-summary-report.json');
  // const summaryReport = {
  //   timestamp: new Date().toISOString(),
  //   summary: results,
  //   totalKeys: Object.values(results).reduce((sum, r) => sum + r.total, 0),
  //   totalUsed: Object.values(results).reduce((sum, r) => sum + r.used, 0),
  //   totalUnused: Object.values(results).reduce((sum, r) => sum + r.unused, 0),
  //   unusedRate: ((Object.values(results).reduce((sum, r) => sum + r.unused, 0) / 
  //               Object.values(results).reduce((sum, r) => sum + r.total, 0)) * 100).toFixed(1)
  // };
  // fs.writeFileSync(summaryReportPath, JSON.stringify(summaryReport, null, 2));
  
  // 总结
  const totalUnused = Object.values(results).reduce((sum, r) => sum + r.unused, 0);
  const totalKeys = Object.values(results).reduce((sum, r) => sum + r.total, 0);
  
  console.log(`\n${colors.cyan}📈 总结:${colors.reset}`);
  console.log(`   ${colors.blue}总键值数${colors.reset}: ${colors.yellow}${totalKeys}${colors.reset}`);
  console.log(`   ${colors.blue}已使用键值${colors.reset}: ${colors.green}${totalKeys - totalUnused}${colors.reset}`);
  console.log(`   ${colors.blue}未使用键值${colors.reset}: ${totalUnused > 0 ? colors.red : colors.green}${totalUnused}${colors.reset} ${colors.gray}(${((totalUnused/totalKeys)*100).toFixed(1)}%)${colors.reset}`);
  
  if (totalUnused === 0) {
    console.log(`\n${colors.green}${colors.bgGreen}${colors.white} 🎉 所有i18n键值都被使用了！ ${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}💡 建议清理未使用的键值以减少翻译文件大小${colors.reset}`);
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 运行主函数
main();
