# RePKG-GUI

<div align="center">

  <img src="./assets/icon.png" alt="RePKG-GUI" width="128" height="128"/>

  **Modern RePKG GUI tool built with Tauri**

  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
  [![Tauri](https://img.shields.io/badge/Tauri-2.6.0-orange.svg)](https://tauri.app/)
  [![Rust](https://img.shields.io/badge/Rust-2024-red.svg)](https://www.rust-lang.org/)

  [English](./README_en.md) | [中文](./README.md)
</div>

## 👀 Preview

*Modern interface design with light/dark theme support*

![Main Interface Preview - Light](./assets/preview-home-light-en.png)

![Main Interface Preview - Dark](./assets/preview-home-dark-en.png)

## 🌟 Features

### Core Features
- **Smart Unpacking**: Batch extraction of `.pkg` files with automatic file structure handling
- **Local Wallpaper Management**: Automatically scan and display Steam Workshop wallpapers
- **Manual Unpacking**: Support drag-and-drop or file selection for manual unpacking
- **Preview Function**: Display wallpaper thumbnails and detailed information

### User Experience
- **Modern Interface**: Responsive design using Tailwind CSS
- **Theme Switching**: Support for light/dark/follow system themes
- **Language Switching**: Support for English/Chinese language switching
- **Custom Background**: Support for setting network images as app background with adjustable opacity
- **Custom Paths**: Customizable Steam Workshop path and extraction directory
- **Batch Operations**: Support for batch unpacking and file management

## 🚀 Quick Start

### Environment Requirements
- **Rust**: Latest stable version
- **Node.js**: 18.0 or higher
- **pnpm**: Package manager (recommended)

### Install Dependencies

```bash
# Install frontend dependencies
pnpm install

# Install Rust dependencies
cd src-tauri
cargo build --release
```

### Run in Development Mode

```bash
# Start both frontend and backend development servers
pnpm tauri dev
```

### Build Production Version

```bash
# Build production version
pnpm tauri build

# Build results will be in src-tauri/target/release/bundle/ directory
```

### Using RePKG GUI Development Command Manager

```bash
# Run from root directory
npm run cmd
```

```
╔══════════════════════════════════════╗
║      RePKG GUI Development Command Manager     ║
╚══════════════════════════════════════╝
Current Version: vx.x.x

Available Commands:

  1  Development Mode   Start development server          [npm run tauri dev]
  2  Build App          Build app with version management [npm run tauri:build:version]
  3  Quick Build        Build app directly (skip version) [npm run tauri:build]
  4  Version Manager    Manage project version numbers    [npm run version:manage]
  5  Cargo Check        Check src-tauri code syntax       [cargo check]
  6  Cargo Clean        Clean src-tauri build cache       [cargo clean]
  7  Clean Console      Comment out console statements    [npm run remove-console]
  8  Find Unused i18n   Find unused i18n text             [npm run find-unused-i18n]
  0  Exit               Exit command manager

Please select command to execute (enter number):
```

## 📁 Project Structure

```
repkg-gui/
├── .gitattributes               # Git attributes configuration file
├── .gitignore                   # Git ignore file configuration
├── LICENSE                      # MIT license file
├── README.md                    # Chinese documentation
├── README_en.md                 # English documentation
├── assets/                      # Project resource files
├── package.json                 # Node.js project configuration file
├── scripts/                     # Build scripts
├── src/                         # Frontend code
│   ├── assets/                  # Frontend resource files
│   ├── css/                     # Style files
│   │   └── styles.css           # Main style file
│   ├── i18n/                    # Internationalization configuration
│   │   ├── i18n.js              # Internationalization main file
│   │   └── locales/             # Language pack directory
│   ├── index.html               # Main page file
│   └── js/                      # JavaScript files
│       ├── background.js        # Background
│       ├── main.js              # Main file
│       ├── settings.js          # Settings
│       ├── tailwindcss.js       # Tailwind CSS
│       └── wallpaper-editor.js  # Wallpaper editor script
├── src-tauri/                   # Tauri backend
│   ├── .gitignore               # Rust project ignore file configuration
│   ├── Cargo.toml               # Rust project configuration file
│   ├── build.rs                 # Build script
│   ├── capabilities/            # Tauri capabilities configuration
│   ├── gen/                     # Tauri generated files
│   ├── icons/                   # Application icons
│   ├── src/                     # Rust source code
│   │   ├── lib.rs               # Library file
│   │   ├── main.rs              # Main entry file
│   │   ├── repkg.rs             # RePKG related functionality
│   │   └── wallpaper_editor.rs  # Wallpaper editor functionality
│   ├── bin/                     # Executable files
│   │   └── RePKG.exe            # RePKG executable file
│   └── tauri.conf.json          # Tauri configuration file
```

## 🛠️ Tech Stack

### Frontend
- **HTML5** + **CSS3** + **JavaScript (ES6+)**
- **Tailwind CSS** - Utility-first CSS framework
- **Native DOM API** - No framework dependency, lightweight and efficient

### Backend
- **Tauri 2.0** - Build cross-platform desktop applications
- **Rust** - Systems programming language
- **Tokio** - Async runtime

### Core Dependencies
- **RePKG** - Wallpaper engine `.pkg` file unpacking tool

## 🙏 Acknowledgments

- [RePKG](https://github.com/NotAdam/RePKG) - Core unpacking tool
- [Tauri](https://tauri.app/) - Cross-platform desktop app framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Steam Workshop](https://steamcommunity.com/workshop/) - Wallpaper resource platform

## 📄 License

This project is licensed under the MIT License.