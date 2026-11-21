// 设置管理模块 - 使用JSON文件存储设置
class SettingsManager {
  constructor() {
    this.settingsPath = 'settings.json';
    this.defaultSettings = {
      // 界面设置
      'language': 'zh-CN',
      'glass-effect': false,
      
      // 系统设置 - 自动打开文件夹
      'auto-open-extract-folder': false,
      'auto-open-import-folder': false,
      'create-folder-per-wallpaper': false,
      
      // 解包设置 - 提取选项
      'only-images': false,
      'no-tex-convert': false,
      'ignore-dir-structure': false,
      'overwrite-files': false,
      
      // 路径设置
      'extract-path': '',
      'extract-path-manual': '',
      'workshop-path': ''
    };
    this.settings = { ...this.defaultSettings };
    this.initialization = null;
    this.pendingSave = Promise.resolve();
  }

  // 初始化设置管理器
  init() {
    this.initialization ??= this.loadSettings().catch(error => {
      const message = window.i18n?.t('messages.settings_load_failed') ?? '读取设置失败，已使用默认设置。';
      return showNotification(`${message}\n${error}`);
    });
    return this.initialization;
  }

  // 加载设置
  async loadSettings() {
    let loadedSettings = {};
    if (window.__TAURI__) {
      const { invoke } = window.__TAURI__.core;
      if (await invoke('file_exists', { path: this.settingsPath })) {
        const content = await invoke('read_text_file', { path: this.settingsPath });
        loadedSettings = JSON.parse(content);
        if (!loadedSettings || typeof loadedSettings !== 'object' || Array.isArray(loadedSettings)) {
          throw new Error('Invalid settings.json');
        }
      }
    } else {
      for (const key of Object.keys(this.defaultSettings)) {
        const value = localStorage.getItem(`repkg-${key}`);
        if (value !== null) loadedSettings[key] = value;
      }
    }

    for (const [key, defaultValue] of Object.entries(this.defaultSettings)) {
      if (typeof defaultValue === 'boolean' && typeof loadedSettings[key] === 'string') {
        loadedSettings[key] = loadedSettings[key] === 'true';
      }
    }
    this.settings = { ...this.defaultSettings, ...loadedSettings };
  }

  // 保存设置到文件
  saveSettings() {
    this.pendingSave = this.pendingSave.then(async () => {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core;
        const content = JSON.stringify(this.settings, null, 2);
        await invoke('write_text_file', { path: this.settingsPath, contents: content });
      } else {
        for (const [key, value] of Object.entries(this.settings)) {
          localStorage.setItem(`repkg-${key}`, value);
        }
      }
    }).catch(error => {
      const message = window.i18n?.t('messages.settings_save_failed') ?? '无法保存设置，重启后可能恢复为旧值。';
      return showNotification(`${message}\n${error}`);
    });
    return this.pendingSave;
  }

  // 获取设置值
  get(key) {
    return this.settings[key];
  }

  // 设置值并保存
  async set(key, value) {
    await this.init();
    this.settings[key] = value;
    await this.saveSettings();
  }

  // 获取所有设置
  getAll() {
    return { ...this.settings };
  }

  // 重置为默认值
  async resetToDefaults() {
    await this.init();
    this.settings = { ...this.defaultSettings };
    await this.saveSettings();
  }

  // 更新多个设置
  async updateSettings(newSettings) {
    await this.init();
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }
}

// 创建全局实例
const settingsManager = new SettingsManager();

// 导出供其他模块使用
window.settingsManager = settingsManager;
