// 设置管理模块 - 使用JSON文件存储设置
class SettingsManager {
  constructor() {
    this.settingsPath = 'settings.json';
    this.defaultSettings = {
      'only-images': false,
      'no-tex-convert': false,
      'ignore-dir-structure': false,
      'overwrite-files': false,
      'auto-open-extract-folder': false,
      'extract-path': '',
      'extract-path-manual': '',
      'workshop-path': ''
    };
    this.settings = { ...this.defaultSettings };
    this.initialized = false;
  }

  // 初始化设置管理器
  async init() {
    if (this.initialized) return;
    
    try {
      await this.loadSettings();
      this.initialized = true;
    } catch (error) {
      // console.error('初始化设置失败:', error);
      this.settings = { ...this.defaultSettings };
    }
  }

  // 加载设置
  async loadSettings() {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core;
        const exists = await invoke('file_exists', { path: this.settingsPath });
        
        if (exists) {
          const content = await invoke('read_text_file', { path: this.settingsPath });
          const loadedSettings = JSON.parse(content);
          this.settings = { ...this.defaultSettings, ...loadedSettings };
        } else {
          // 文件不存在，创建默认设置文件
          await this.saveSettings();
        }
      } else {
        // 非Tauri环境，使用localStorage作为后备
        const loadedSettings = {};
        Object.keys(this.defaultSettings).forEach(key => {
          const value = localStorage.getItem(`repkg-${key}`);
          if (value !== null) {
            if (value === 'true') {
              loadedSettings[key] = true;
            } else if (value === 'false') {
              loadedSettings[key] = false;
            } else {
              loadedSettings[key] = value;
            }
          }
        });
        this.settings = { ...this.defaultSettings, ...loadedSettings };
      }
    } catch (error) {
      // console.error('加载设置失败:', error);
    }
  }

  // 保存设置到文件
  async saveSettings() {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core;
        const content = JSON.stringify(this.settings, null, 2);
        await invoke('write_text_file', { path: this.settingsPath, contents: content });
      } else {
        // 非Tauri环境，保存到localStorage
        Object.keys(this.settings).forEach(key => {
          localStorage.setItem(`repkg-${key}`, this.settings[key]);
        });
      }
    } catch (error) {
      // console.error('保存设置失败:', error);
    }
  }

  // 获取设置值
  get(key) {
    return this.settings[key];
  }

  // 设置值并保存
  async set(key, value) {
    this.settings[key] = value;
    await this.saveSettings();
  }

  // 获取所有设置
  getAll() {
    return { ...this.settings };
  }

  // 重置为默认值
  async resetToDefaults() {
    this.settings = { ...this.defaultSettings };
    await this.saveSettings();
  }

  // 更新多个设置
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }
}

// 创建全局实例
const settingsManager = new SettingsManager();

// 导出供其他模块使用
window.settingsManager = settingsManager;