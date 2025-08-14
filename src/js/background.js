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
        toggle.addEventListener('change', (e) => {
            this.isEnabled = e.target.checked;
            this.toggleControls();
            this.saveSettings();
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

        // 输入框变化时预览
        urlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url && this.isValidUrl(url)) {
                this.showPreview(url);
            } else {
                this.hidePreview();
            }
        });

        // 清除背景
        clearBtn.addEventListener('click', () => {
            this.clearBackground();
            urlInput.value = '';
        });

        // 透明度调节
        opacitySlider.addEventListener('input', (e) => {
            this.opacity = parseFloat(e.target.value);
            this.updateOpacityDisplay();
            this.applyOpacity();
            this.saveSettings();
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
            .then(() => {
                this.applyBackground();
                this.saveSettings();
            })
            .catch((error) => {
                // console.error('背景加载失败:', error);
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

    clearBackground() {
        this.currentUrl = null;
        this.currentType = null;
        this.previewUrl = null;
        this.removeBackground();
        this.hidePreview();
        this.saveSettings();
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
        if (!displayUrl) {
            this.hidePreview();
            return;
        }

        const displayType = url ? this.getUrlType(url) : this.currentType;
        this.previewUrl = displayUrl;

        previewContainer.classList.remove('hidden');

        if (displayType === 'image') {
            imgPreview.src = displayUrl;
            imgPreview.style.display = 'block';
            videoPreview.style.display = 'none';
        } else if (displayType === 'video') {
            videoPreview.src = displayUrl;
            videoPreview.style.display = 'block';
            imgPreview.style.display = 'none';
        }
    }

    hidePreview() {
        const previewContainer = document.getElementById('bg-preview-container');
        previewContainer.classList.add('hidden');
    }

    saveSettings() {
        const settings = {
            enabled: this.isEnabled,
            url: this.currentUrl,
            type: this.currentType,
            opacity: this.opacity
        };
        localStorage.setItem('customBackground', JSON.stringify(settings));
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

    loadSavedSettings() {
        try {
            const saved = localStorage.getItem('customBackground');
            if (saved) {
                const settings = JSON.parse(saved);
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

                if (this.currentUrl) {
                    this.showPreview();
                }
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
document.addEventListener('DOMContentLoaded', () => {
    window.backgroundManager = new BackgroundManager();
});

// 导出供其他模块使用
window.BackgroundManager = BackgroundManager;