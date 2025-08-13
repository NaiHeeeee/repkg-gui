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

![PixPin_2025-08-12_23-23-59](./assets/PixPin_2025-08-12_23-23-59.png)

![PixPin_2025-08-12_23-42-03](./assets/PixPin_2025-08-12_23-42-03.png)

## 🌟 Features

### Core Features
- **Smart Unpacking**: Batch extraction of `.pkg` files with automatic file structure handling
- **Local Wallpaper Management**: Automatically scan and display Steam Workshop wallpapers
- **Manual Unpacking**: Support drag-and-drop or file selection for manual unpacking
- **Preview Function**: Display wallpaper thumbnails and detailed information

### User Experience
- **Modern Interface**: Responsive design using Tailwind CSS
- **Theme Switching**: Support for light/dark/follow system themes
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

## 📁 Project Structure

```
repkg-gui/
├── src/                    # Frontend code
│   ├── index.html         # Main page
│   ├── css/styles.css     # Styles
│   └── js/                # JavaScript modules
├── src-tauri/             # Tauri backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Main functionality
│   │   └── repkg.rs       # RePKG core functionality
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── bin/                   # RePKG executable
└── README.md
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