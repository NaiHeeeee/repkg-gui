class I18n {
  constructor() {
    this.currentLanguage = this.getStoredLanguage() || this.getBrowserLanguage();
    this.translations = {};
    this.loadTranslations();
  }

  async loadTranslations() {
    try {
      const response = await fetch(`./i18n/locales/${this.currentLanguage}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${this.currentLanguage}`);
      }
      this.translations = await response.json();
      this.updateDOM();
    } catch (error) {
      // console.error('Failed to load translations:', error);
      // Fallback to English
      if (this.currentLanguage !== 'en-US') {
        this.currentLanguage = 'en-US';
        await this.loadTranslations();
      }
    }
  }

  getBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;

    // Map browser language to our supported languages
    const languageMap = {
      'zh': 'zh-CN',
      'zh-CN': 'zh-CN',
      'zh-TW': 'zh-CN', // Fallback to zh-CN for now
      'en': 'en-US',
      'en-US': 'en-US',
      'en-GB': 'en-US' // Fallback to en-US
    };

    return languageMap[browserLang] || 'en-US';
  }

  getStoredLanguage() {
    // 使用settingsManager获取语言设置
    if (typeof window.settingsManager !== 'undefined') {
      return window.settingsManager.get('language');
    }
    // 如果settingsManager不可用，回退到localStorage
    return localStorage.getItem('repkg-language');
  }

  setLanguage(language) {
    if (this.currentLanguage === language) return;

    this.currentLanguage = language;
    // 使用settingsManager保存语言设置
    if (typeof window.settingsManager !== 'undefined') {
      window.settingsManager.set('language', language);
    } else {
      // 如果settingsManager不可用，回退到localStorage
      localStorage.setItem('repkg-language', language);
    }
    this.loadTranslations();
  }

  getSupportedLanguages() {
    return [
      { code: 'zh-CN', name: '简体中文' },
      { code: 'en-US', name: 'English' }
    ];
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // console.warn(`Translation key not found: ${key}`);
        return key; // Return key if translation not found
      }
    }

    if (typeof value === 'string') {
      // Replace placeholders like {name}
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] !== undefined ? params[param] : match;
      });
    }

    return value;
  }

  updateDOM() {
    // Update all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const text = this.t(key);

      if (element.tagName === 'INPUT' && element.type === 'placeholder') {
        element.placeholder = text;
      } else {
        element.textContent = text;
      }
    });

    // Update elements with data-i18n-placeholder attribute
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });

    // Update elements with data-i18n-title attribute
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });

    // Update document title
    const titleKey = document.body.getAttribute('data-i18n-document-title');
    if (titleKey) {
      document.title = this.t(titleKey);
    }

    // Trigger custom event for other components
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: this.currentLanguage }
    }));
  }

  // Helper method to create language selector
  createLanguageSelector() {
    const select = document.createElement('select');
    select.className = 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm';
    select.id = 'language-selector';

    this.getSupportedLanguages().forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      option.selected = lang.code === this.currentLanguage;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      this.setLanguage(e.target.value);
    });

    return select;
  }
}

// 延迟初始化函数
window.initI18n = async function() {
  // 确保settingsManager已初始化
  if (typeof window.settingsManager !== 'undefined') {
    await window.settingsManager.init();
  }
  
  // 创建全局实例
  window.i18n = new I18n();
  return window.i18n;
};

// Export for module usage
export default window.initI18n;