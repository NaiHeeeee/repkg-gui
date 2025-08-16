# RePKG-GUI

<div align="center">

  <img src="./assets/icon.png" alt="RePKG-GUI" width="128" height="128"/>

  **基于 Tauri 的现代化 RePKG 图形界面工具**

  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
  [![Tauri](https://img.shields.io/badge/Tauri-2.6.0-orange.svg)](https://tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-2024-red.svg)](https://www.rust-lang.org/)

  [English](./README_en.md) | [中文](./README.md)
</div>

## 👀 预览

*现代化界面设计，支持亮色/暗色主题*

![主界面预览-亮色](./assets/preview-home-light-cn.png)

![主界面预览-暗色](./assets/preview-home-dark-cn.png)



## 🌟 功能特性

### 核心功能
- **智能解包**：支持批量提取 `.pkg` 文件，自动处理文件结构
- **本地壁纸管理**：自动扫描并展示 Steam 创意工坊壁纸
- **手动解包**：支持拖拽或选择文件进行手动解包
- **预览功能**：显示壁纸缩略图和详细信息

### 用户体验
- **现代化界面**：采用 Tailwind CSS 设计的响应式界面
- **主题切换**：支持亮色/暗色/跟随系统主题
- **语言切换**：支持英文/中文语言切换
- **自定义背景**：支持设置网络图片URL作为应用背景，可调节透明度
- **自定义路径**：可自定义 Steam 创意工坊路径和提取目录
- **批量操作**：支持批量解包和文件管理

## 🚀 快速开始

### 环境要求
- **Rust**: 最新稳定版
- **Node.js**: 18.0 或更高版本
- **pnpm**: 包管理器 (推荐)

### 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装 Rust 依赖
cd src-tauri
cargo build --release
```

### 开发模式运行

```bash
# 同时启动前端和后端开发服务器
pnpm tauri dev
```

### 构建生产版本

```bash
# 构建生产版本
pnpm tauri build

# 构建结果将在 src-tauri/target/release/bundle/ 目录下
```

### 使用RePKG GUI开发命令管理器

```bash
# 根目录运行
npm run cmd
```

```
╔══════════════════════════════════════╗
║       RePKG GUI 开发命令管理器       ║
╚══════════════════════════════════════╝
当前版本: vx.x.x

可用命令:

  1  开发模式      启动开发服务器                 [npm run tauri dev]
  2  构建应用      使用版本管理构建应用           [npm run tauri:build:version]
  3  快速构建      直接构建应用(跳过版本管理)     [npm run tauri:build]
  4  版本管理      管理项目版本号                 [npm run version:manage]
  5  Cargo检查     检查src-tauri的代码语法        [cargo check]
  6  Cargo清理     清理src-tauri的构建缓存        [cargo clean]
  7  清理控制台    注释console                    [npm run remove-console]
  8  检查未用i18n  查找未使用的国际化文本         [npm run find-unused-i18n]
  0  退出          退出命令管理器

请选择要执行的命令 (输入序号):
```

## 📁 项目结构

```
repkg-gui/
├── .gitattributes               # Git 属性配置文件
├── .gitignore                   # Git 忽略文件配置
├── LICENSE                      # MIT 许可证文件
├── README.md                    # 中文说明文档
├── README_en.md                 # 英文说明文档
├── assets/                      # 项目资源文件
├── package.json                 # Node.js 项目配置文件
├── scripts/                     # 构建脚本
├── src/                         # 前端代码
│   ├── assets/                  # 前端资源文件
│   ├── css/                     # 样式文件
│   │   └── styles.css           # 主样式文件
│   ├── i18n/                    # 国际化配置
│   │   ├── i18n.js              # 国际化主文件
│   │   └── locales/             # 语言包目录
│   ├── index.html               # 主页面文件
│   └── js/                      # JavaScript 文件
│       ├── background.js        # 背景
│       ├── main.js              # 主文件
│       ├── settings.js          # 设置
│       ├── tailwindcss.js       # Tailwind CSS
│       └── wallpaper-editor.js  # 壁纸编辑器脚本
├── src-tauri/                   # Tauri 后端
│   ├── .gitignore               # Rust 项目忽略文件配置
│   ├── Cargo.toml               # Rust 项目配置文件
│   ├── build.rs                 # 构建脚本
│   ├── capabilities/            # Tauri 能力配置
│   ├── gen/                     # Tauri 生成文件
│   ├── icons/                   # 应用图标
│   ├── src/                     # Rust 源代码
│   │   ├── lib.rs               # 库文件
│   │   ├── main.rs              # 主入口文件
│   │   ├── repkg.rs             # RePKG 相关功能
│   │   └── wallpaper_editor.rs  # 壁纸编辑器功能
│   ├── bin/                     # 可执行文件
│   │   └── RePKG.exe            # RePKG 可执行文件
│   └── tauri.conf.json          # Tauri 配置文件
```

## 🛠️ 技术栈

### 前端
- **HTML5** + **CSS3** + **JavaScript (ES6+)**
- **Tailwind CSS** - 实用优先的 CSS 框架
- **原生 DOM API** - 无框架依赖，轻量高效

### 后端
- **Tauri 2.0** - 构建跨平台桌面应用
- **Rust** - 系统级编程语言
- **Tokio** - 异步运行时

### 核心依赖
- **RePKG** - 壁纸引擎 `.pkg` 文件解包工具

## 🙏 致谢

- [RePKG](https://github.com/NotAdam/RePKG) - 核心解包工具
- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Steam Workshop](https://steamcommunity.com/workshop/) - 壁纸资源平台

## 📄 许可证

本项目采用 MIT 许可证。
