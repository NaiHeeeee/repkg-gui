// 背景管理模块
class BackgroundManager {
    constructor() {
        this.isEnabled = false;
        this.currentUrl = null;
        this.currentType = null; // 'image' or 'video'
        this.opacity = 0.3;
        this.previewUrl = null; // 预览URL，未应用前不设置背景
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedSettings();
    }

    bindEvents() {
        const toggle = document.getElementById('custom-bg-toggle');
        const urlInput = document.getElementById('bg-url-input');
        const applyBtn = document.getElementById('apply-bg-url');
        const clearBtn = document.getElementById('clear-bg-btn');
        const opacitySlider = document.getElementById('bg-opacity');
        const controls = document.getElementById('custom-bg-controls');

        // 切换开关
        toggle.addEventListener('change', async (e) => {
            this.isEnabled = e.target.checked;
            this.toggleControls();
            await this.saveSettings();
        });

        // 应用背景
        applyBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            if (url) {
                this.setBackground(url);
            }
        });

        // 回车键应用
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = urlInput.value.trim();
                if (url) {
                    this.setBackground(url);
                }
            }
        });

        // 自动预览功能 - 使用防抖处理输入
        let previewTimeout;
        urlInput.addEventListener('input', (e) => {
            clearTimeout(previewTimeout);
            const url = e.target.value.trim();
            
            if (url && this.isValidUrl(url)) {
                // 延迟500ms后显示预览，避免频繁请求
                previewTimeout = setTimeout(() => {
                    this.showPreview(url);
                }, 500);
            } else if (url === '') {
                // 清空时立即隐藏预览
                this.hidePreview();
            } else {
                // 无效URL时隐藏预览
                this.hidePreview();
            }
        });

        // 监听URL输入框获得焦点事件
        urlInput.addEventListener('focus', (e) => {
            const url = e.target.value.trim();
            if (url && this.isValidUrl(url)) {
                this.showPreview(url);
            } else {
                this.hidePreview();
            }
        });

        // 监听URL输入框失去焦点事件
        urlInput.addEventListener('blur', () => {
            // 延迟隐藏，给用户时间点击应用按钮
            setTimeout(() => {
                this.hidePreview();
            }, 200);
        });

        // 清除背景
        clearBtn.addEventListener('click', () => {
            this.clearBackground();
            urlInput.value = '';
        });

        // 透明度调节
        opacitySlider.addEventListener('input', async (e) => {
            this.opacity = parseFloat(e.target.value);
            this.updateOpacityDisplay();
            this.applyOpacity();
            await this.saveSettings();
        });

        // 监听语言变化
        window.addEventListener('languageChanged', () => {
            this.updateOpacityDisplay();
        });
    }

    toggleControls() {
        const controls = document.getElementById('custom-bg-controls');
        const toggle = document.getElementById('custom-bg-toggle');

        if (this.isEnabled) {
            controls.classList.remove('hidden');
            if (this.currentUrl) {
                this.applyBackground();
            }
        } else {
            controls.classList.add('hidden');
            this.removeBackground();
        }
    }

    setBackground(url) {
        // 验证URL格式
        if (!this.isValidUrl(url)) {
            const message = window.i18n && window.i18n.t ? window.i18n.t('background.invalid_url') : '请输入有效的图片或视频地址';
            alert(message);
            return;
        }

        this.currentUrl = url;
        this.currentType = this.getUrlType(url);
        this.previewUrl = null; // 清除预览状态

        // 预加载并验证资源
        this.preloadResource(url, this.currentType)
            .then(async () => {
                this.applyBackground();
                await this.saveSettings();
            })
            .catch((error) => {
//                 console.error('背景加载失败:', error);
                const message = window.i18n && window.i18n.t ? window.i18n.t('background.load_failed') : '背景加载失败，请检查地址是否正确';
                alert(message);
            });
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi)$/i) !== null;
        } catch {
            return false;
        }
    }

    getUrlType(url) {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const videoExtensions = ['mp4', 'webm', 'mov', 'avi'];
        const extension = url.split('.').pop().toLowerCase();

        if (imageExtensions.includes(extension)) return 'image';
        if (videoExtensions.includes(extension)) return 'video';
        return 'image'; // 默认
    }

    preloadResource(url, type) {
        return new Promise((resolve, reject) => {
            if (type === 'image') {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            } else if (type === 'video') {
                const video = document.createElement('video');
                video.onloadeddata = resolve;
                video.onerror = reject;
                video.src = url;
                video.load();
            }
        });
    }

    applyBackground() {
        if (!this.currentUrl || !this.isEnabled) return;

        // 移除现有背景
        this.removeBackground();

        // 创建新的背景元素
        const bgElement = document.createElement('div');
        bgElement.id = 'custom-background';
        bgElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            opacity: ${this.opacity};
            pointer-events: none;
        `;

        if (this.currentType === 'image') {
            bgElement.style.backgroundImage = `url('${this.currentUrl}')`;
            bgElement.style.backgroundSize = 'cover';
            bgElement.style.backgroundPosition = 'center';
            bgElement.style.backgroundRepeat = 'no-repeat';
        } else if (this.currentType === 'video') {
            const video = document.createElement('video');
            video.src = this.currentUrl;
            video.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                min-width: 100%;
                min-height: 100%;
                width: auto;
                height: auto;
                object-fit: cover;
            `;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            bgElement.appendChild(video);
        }

        document.body.appendChild(bgElement);
    }

    removeBackground() {
        const existingBg = document.getElementById('custom-background');
        if (existingBg) {
            existingBg.remove();
        }
    }

    async clearBackground() {
        this.currentUrl = null;
        this.currentType = null;
        this.previewUrl = null;
        this.removeBackground();
        this.hidePreview();
        await this.saveSettings();
    }

    applyOpacity() {
        const bgElement = document.getElementById('custom-background');
        if (bgElement) {
            bgElement.style.opacity = this.opacity;
        }
    }

    showPreview(url = null) {
        const previewContainer = document.getElementById('bg-preview-container');
        const imgPreview = document.getElementById('bg-image-preview');
        const videoPreview = document.getElementById('bg-video-preview');

        const displayUrl = url || this.currentUrl;
        if (!displayUrl || !this.isValidUrl(displayUrl)) {
            this.hidePreview();
            return;
        }

        const displayType = url ? this.getUrlType(url) : this.currentType;
        this.previewUrl = displayUrl;

        // 显示加载状态
        previewContainer.classList.remove('hidden');
        previewContainer.classList.add('show');

        // 预加载资源以避免显示破损图片
        this.preloadResource(displayUrl, displayType)
            .then(() => {
                // 强制重排以确保动画效果
                previewContainer.offsetHeight;
                
                if (displayType === 'image') {
                    imgPreview.src = displayUrl;
                    imgPreview.style.display = 'block';
                    imgPreview.classList.add('fade-in');
                    imgPreview.classList.remove('fade-out');
                    videoPreview.style.display = 'none';
                    videoPreview.classList.remove('fade-in');
                    videoPreview.classList.add('fade-out');
                } else if (displayType === 'video') {
                    videoPreview.src = displayUrl;
                    videoPreview.style.display = 'block';
                    videoPreview.classList.add('fade-in');
                    videoPreview.classList.remove('fade-out');
                    imgPreview.style.display = 'none';
                    imgPreview.classList.remove('fade-in');
                    imgPreview.classList.add('fade-out');
                }
            })
            .catch((error) => {
                // console.warn('预览加载失败:', error);
                // 加载失败时不显示预览，但保持容器可见
                imgPreview.style.display = 'none';
                videoPreview.style.display = 'none';
            });
    }

    hidePreview() {
        const previewContainer = document.getElementById('bg-preview-container');
        
        // 添加淡出动画
        previewContainer.classList.remove('show');
        
        // 动画结束后隐藏
            setTimeout(() => {
                previewContainer.classList.add('hidden');
                
                // 重置图片和视频状态
                const imgPreview = document.getElementById('bg-image-preview');
                const videoPreview = document.getElementById('bg-video-preview');
                imgPreview.classList.remove('fade-in', 'fade-out');
                videoPreview.classList.remove('fade-in', 'fade-out');
            }, 200);
    }

    async saveSettings() {
        const settings = {
            enabled: this.isEnabled,
            url: this.currentUrl,
            type: this.currentType,
            opacity: this.opacity
        };
        await settingsManager.init();
        settingsManager.set('custom-background', settings);
    }

    updateOpacityDisplay() {
        const opacityValue = Math.round(this.opacity * 100);
        const opacityElement = document.getElementById('opacity-value');

        if (window.i18n && window.i18n.t) {
            opacityElement.textContent = window.i18n.t('background.opacity_value', { value: opacityValue });
        } else {
            opacityElement.textContent = opacityValue + '%';
        }
    }

    async loadSavedSettings() {
        try {
            await settingsManager.init();
            const settings = settingsManager.get('custom-background');
            if (settings) {
                this.isEnabled = settings.enabled || false;
                this.currentUrl = settings.url || null;
                this.currentType = settings.type || null;
                this.opacity = settings.opacity || 0.3;

                // 恢复UI状态
                const toggle = document.getElementById('custom-bg-toggle');
                const urlInput = document.getElementById('bg-url-input');
                const opacitySlider = document.getElementById('bg-opacity');

                toggle.checked = this.isEnabled;
                urlInput.value = this.currentUrl || '';
                opacitySlider.value = this.opacity;
                this.updateOpacityDisplay();

                this.toggleControls();

                // 不再自动显示预览，只在用户交互时显示
                this.hidePreview();
            } else {
                // 默认关闭自定义背景
                const toggle = document.getElementById('custom-bg-toggle');
                toggle.checked = false;
                this.isEnabled = false;
                this.toggleControls();
            }
        } catch (error) {
            // console.error('加载背景设置失败:', error);
            // 默认关闭自定义背景
            const toggle = document.getElementById('custom-bg-toggle');
            toggle.checked = false;
            this.isEnabled = false;
            this.toggleControls();
        }
    }
}

// 初始化背景管理器
document.addEventListener('DOMContentLoaded', async () => {
    window.backgroundManager = new BackgroundManager();
    await window.backgroundManager.loadSavedSettings();
});



// 页面加载完成后初始化毛玻璃效果设置
document.addEventListener('DOMContentLoaded', async () => {
  await settingsManager.init();
  const glassEffectEnabled = settingsManager.get('glass-effect');
  const glassEffectToggle = document.getElementById('glass-effect-toggle');
  
  if (glassEffectToggle) {
    glassEffectToggle.checked = glassEffectEnabled;
    
    glassEffectToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await settingsManager.set('glass-effect', enabled);
      applyGlassEffect(enabled);
    });
  }
  
  // 应用初始毛玻璃效果设置
  applyGlassEffect(glassEffectEnabled);
});

// 应用毛玻璃效果的函数
function applyGlassEffect(enabled) {
  const glassElements = document.querySelectorAll('.glass-effect, .settings-glass');
  
  if (enabled) {
    // 启用毛玻璃效果
    glassElements.forEach(element => {
      element.classList.remove('glass-disabled');
    });
  } else {
    // 禁用毛玻璃效果
    glassElements.forEach(element => {
      element.classList.add('glass-disabled');
    });
  }
}

// 导出供其他模块使用
window.BackgroundManager = BackgroundManager;