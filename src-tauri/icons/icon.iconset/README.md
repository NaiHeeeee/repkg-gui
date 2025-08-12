# ICNS 图标生成说明

此目录包含生成 macOS ICNS 图标所需的所有 PNG 文件。

## 在 macOS 上生成 ICNS 文件

1. 将此目录复制到 macOS 系统
2. 运行以下命令：
   ```bash
   iconutil -c icns icon.iconset
   ```
3. 生成的 `icon.icns` 文件将用于 macOS 应用图标

## 文件说明

- `icon_16x16.png` - 16x16 图标
- `icon_16x16@2x.png` - 32x32 高DPI图标
- `icon_32x32.png` - 32x32 图标
- `icon_32x32@2x.png` - 64x64 高DPI图标
- ...以此类推

## 手动生成 ICNS

如果需要手动创建 ICNS 文件：
1. 在 macOS 上安装 Xcode Command Line Tools
2. 使用 iconutil 工具
