// 背景管理模块
class BackgroundManager {
    constructor() {
        this.isEnabled = false;
        this.currentUrl = null;
        this.currentType = null; // 'image' or 'video'
        this.opacity = 0.3;
        this.previewUrl = null; // 预览URL，未应用前不设置背景
        this.currentFile = null; // 当前选择的本地文件
        this.objectUrl = null; // 临时URL对象，用于本地文件
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
        const fileInput = document.getElementById('bg-file-input');
        const fileBtn = document.getElementById('select-bg-file');

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
            
            if (url) {
                // 用户正在输入URL，清除本地文件选择
                this.currentFile = null;
                fileInput.value = '';
                this.clearFileInfo();
                
                if (this.isValidUrl(url)) {
                    // 延迟500ms后显示预览，避免频繁请求
                    previewTimeout = setTimeout(() => {
                        this.showPreview(url);
                    }, 500);
                } else {
                    // 无效URL时隐藏预览
                    this.hidePreview();
                }
            } else if (url === '') {
                // 清空时立即隐藏预览
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

        // 本地文件选择
        fileBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleLocalFile(file);
            }
        });

        // 清除背景
        clearBtn.addEventListener('click', () => {
            this.clearBackground();
            urlInput.value = '';
            fileInput.value = ''; // 清空文件选择
            this.clearFileInfo(); // 清除文件信息显示
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
            // 如果有选中的文件，重新更新文件信息显示
            if (this.currentFile) {
                this.updateFileInfo(this.currentFile);
            }
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
            // 处理blob: URLs（本地文件）
            if (url.startsWith('blob:')) {
                return true;
            }
            
            // 处理常规URL
            new URL(url);
            return url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi)$/i) !== null;
        } catch {
            return false;
        }
    }

    getUrlType(url) {
        // 处理blob: URLs（本地文件）
        if (url.startsWith('blob:')) {
            // 对于blob URLs，使用当前类型或默认为image
            return this.currentType || 'image';
        }
        
        // 处理常规URL
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const videoExtensions = ['mp4', 'webm', 'mov', 'avi'];
        const extension = url.split('.').pop().toLowerCase();

        if (imageExtensions.includes(extension)) return 'image';
        if (videoExtensions.includes(extension)) return 'video';
        return 'image'; // 默认
    }

    // 处理本地文件选择
    handleLocalFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 
                             'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
        
        if (!allowedTypes.includes(file.type)) {
            const message = window.i18n && window.i18n.t ? 
                window.i18n.t('background.invalid_file_type') : 
                'Unsupported file type, please select image or video file';
            alert(message);
            return;
        }

        // 限制文件大小 (1GB)
        const maxSize = 1024 * 1024 * 1024;
        if (file.size > maxSize) {
            const message = window.i18n && window.i18n.t ? 
                window.i18n.t('background.file_too_large') : 
                'File size exceeds limit, maximum 1GB supported';
            alert(message);
            return;
        }

        this.currentFile = file;
        
        // 创建临时URL对象
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
        }
        this.objectUrl = URL.createObjectURL(file);
        
        // 确定文件类型
        this.currentType = file.type.startsWith('image/') ? 'image' : 'video';
        this.currentUrl = this.objectUrl;
        
        // 更新文件信息显示
        this.updateFileInfo(file);
        
        // 显示预览 - 修复：确保使用正确的URL和类型
        this.showPreview(this.objectUrl, this.currentType);
    }

    // 应用本地文件作为背景
    applyLocalFile() {
        if (!this.currentFile || !this.isEnabled) {
            const message = window.i18n && window.i18n.t ? 
                window.i18n.t('background.no_file_selected') : 
                'Please select a file first';
            alert(message);
            return;
        }

        // 应用背景（逻辑与setBackground类似，但不需要预加载）
        this.applyBackground();
        
        // 保存设置（注意：本地文件的URL是临时的，重启后会失效）
        this.saveSettings();
    }

    // 更新文件信息显示
    updateFileInfo(file) {
        const fileInfoElement = document.getElementById('selected-file-info');
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
        const fileName = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;
        
        // 大文件性能警告
        const isLargeFile = file.size > 200 * 1024 * 1024; // 大于200MB
        const warningText = isLargeFile ? 
            `<span class="text-yellow-500 text-xs ml-2" title="${window.i18n ? window.i18n.t('background.large_file_warning') : 'Large file warning'}">⚠</span>` : '';
        
        // 使用当前语言获取按钮文本
        const applyButtonText = window.i18n ? window.i18n.t('background.apply') : 'Apply';
        
        fileInfoElement.innerHTML = `
            <span class="truncate">${fileName}</span>
            <span class="ml-2 text-[var(--text-secondary)]">(${sizeInMB} MB)</span>
            ${warningText}
            <button id="apply-local-bg" class="ml-2 px-2 py-1 text-xs btn-blue rounded">${applyButtonText}</button>
        `;

        // 绑定应用按钮事件
        const applyBtn = document.getElementById('apply-local-bg');
        applyBtn.addEventListener('click', () => {
            this.applyLocalFile();
        });
    }

    // 清除文件信息显示
    clearFileInfo() {
        const fileInfoElement = document.getElementById('selected-file-info');
        const noFileText = window.i18n ? window.i18n.t('background.no_file_selected') : 'No file selected';
        fileInfoElement.innerHTML = `<span>${noFileText}</span>`;
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
        this.currentFile = null;
        
        // 清理临时URL对象
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
        
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

    showPreview(url = null, type = null) {
        const previewContainer = document.getElementById('bg-preview-container');
        const imgPreview = document.getElementById('bg-image-preview');
        const videoPreview = document.getElementById('bg-video-preview');

        const displayUrl = url || this.currentUrl;
        if (!displayUrl || !this.isValidUrl(displayUrl)) {
            this.hidePreview();
            return;
        }

        // 使用传入的类型参数或自动检测类型
        const displayType = type || this.getUrlType(displayUrl);
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
                    
                    // 播放视频
                    videoPreview.play().catch(error => {
                        // 静默处理播放失败，可能是由于浏览器策略限制
                        // console.warn('视频自动播放失败:', error);
                    });
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
                
                // 暂停视频播放
                if (videoPreview && !videoPreview.paused) {
                    videoPreview.pause();
                }
                
                imgPreview.classList.remove('fade-in', 'fade-out');
                videoPreview.classList.remove('fade-in', 'fade-out');
            }, 200);
    }

    async saveSettings() {
        const settings = {
            enabled: this.isEnabled,
            // 对于本地文件，不保存临时的object URL，只保存文件信息
            url: this.currentFile ? null : this.currentUrl,
            type: this.currentType,
            opacity: this.opacity,
            isLocalFile: !!this.currentFile,
            fileName: this.currentFile ? this.currentFile.name : null,
            fileSize: this.currentFile ? this.currentFile.size : null,
            fileType: this.currentFile ? this.currentFile.type : null
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
                
                // 确保在更新显示前i18n已经初始化
                await this.waitForI18n();
                this.updateOpacityDisplay();

                // 如果是本地文件，显示提示信息
                if (settings.isLocalFile && settings.fileName) {
                    await this.showLocalFileWarning(settings.fileName);
                }

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

    // 显示本地文件警告信息
    async showLocalFileWarning(fileName) {
        // 更健壮的i18n等待机制
        await this.waitForI18n();

        const fileInfoElement = document.getElementById('selected-file-info');
        const warningText1 = window.i18n && window.i18n.t ? 
            window.i18n.t('background.previous_file') : 
            'Previously selected file: ';
        const warningText2 = window.i18n && window.i18n.t ? 
            window.i18n.t('background.restart_reload') : 
            'Due to security restrictions, files need to be re-selected after app restart';
        
        fileInfoElement.innerHTML = `
            <div class="flex flex-col">
                <span class="text-[var(--text-secondary)]">${warningText1} ${fileName}</span>
                <span class="text-xs text-[var(--text-secondary)]">${warningText2}</span>
            </div>
        `;
    }

    // 等待i18n初始化完成的通用方法
    async waitForI18n() {
        // 等待i18n可用
        if (!window.i18n) {
            await new Promise((resolve) => {
                const checkI18n = () => {
                    if (window.i18n) {
                        resolve();
                    } else {
                        setTimeout(checkI18n, 50);
                    }
                };
                checkI18n();
            });
        }

        // 等待翻译加载完成
        if (!window.i18n.translations) {
            await new Promise((resolve) => {
                const checkTranslations = () => {
                    if (window.i18n && window.i18n.translations && Object.keys(window.i18n.translations).length > 0) {
                        resolve();
                    } else {
                        setTimeout(checkTranslations, 50);
                    }
                };
                checkTranslations();
            });
        }

        // 额外等待一小段时间确保DOM更新完成
        await new Promise(resolve => setTimeout(resolve, 100));
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