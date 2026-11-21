// 背景管理模块
class BackgroundManager {
    constructor() {
        this.isEnabled = false;
        this.currentUrl = null;
        this.currentType = null; // 'image' or 'video'
        this.opacity = 0.3;
        this.previewUrl = null; // 预览URL，未应用前不设置背景
        this.currentFile = null; // 已应用的浏览器文件
        this.pendingLocalFile = null;
        this.selectionVersion = 0;
        this.currentFilePath = null; // 当前本地文件路径，用于重启后恢复
        this.savedLocalFileName = null;
        this.savedLocalFileSize = null;
        this.savedLocalFileType = null;
        this.objectUrl = null; // 临时URL对象，用于本地文件
        this.init();
    }

    isVideoExtension(extension) {
        return ['mp4', 'webm', 'mov', 'avi'].includes(extension);
    }

    isImageExtension(extension) {
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);
    }

    getMimeTypeFromExtension(extension) {
        const normalizedExtension = (extension || '').toLowerCase();
        const mimeTypes = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo'
        };

        return mimeTypes[normalizedExtension] || 'application/octet-stream';
    }

    getLocalAssetUrl(filePath) {
        const convertFileSrc = window.__TAURI__?.core?.convertFileSrc;
        if (typeof convertFileSrc === 'function') {
            return convertFileSrc(filePath);
        }

        return filePath;
    }

    async init() {
        await this.loadSavedSettings();
        this.bindEvents();
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
                this.discardFileSelection();
                fileInput.value = '';
                this.clearFileInfo();
                
                if (this.isValidUrl(url)) {
                    // 延迟500ms后显示预览，避免频繁请求
                    previewTimeout = setTimeout(() => {
                        if (!this.pendingLocalFile && urlInput.value.trim() === url) {
                            this.showPreview(url);
                        }
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
            } else if (!this.pendingLocalFile) {
                this.hidePreview();
            }
        });

        // 监听URL输入框失去焦点事件
        urlInput.addEventListener('blur', (e) => {
            const url = e.target.value.trim();
            // 延迟隐藏，给用户时间点击应用按钮
            setTimeout(() => {
                if (this.previewUrl === url && !this.pendingLocalFile) {
                    this.hidePreview();
                }
            }, 200);
        });

        // 本地文件选择
        fileBtn.addEventListener('click', async () => {
            if (window.__TAURI__?.core?.invoke) {
                await this.selectLocalBackgroundFile();
                return;
            }

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
        });

        const resumeBackground = () => this.resumeBackgroundVideo();
        document.addEventListener('visibilitychange', resumeBackground);
        window.addEventListener('focus', resumeBackground);
    }

    async selectLocalBackgroundFile() {
        try {
            const selectedPath = await window.__TAURI__.dialog.open({
                filters: [{ name: 'Background Media', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi'] }]
            });
            if (!selectedPath) {
                return;
            }

            this.handleLocalFilePath(selectedPath);
        } catch (error) {
            const message = window.i18n && window.i18n.t
                ? window.i18n.t('messages.select_file_error')
                : '选择文件失败: ';
            alert(message + error);
        }
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

    async setBackground(url) {
        // 验证URL格式
        if (!this.isValidUrl(url)) {
            const message = window.i18n && window.i18n.t ? window.i18n.t('background.invalid_url') : '请输入图片或视频的完整链接，末尾须为支持的扩展名，例如 .jpg 或 .mp4。';
            alert(message);
            return;
        }

        this.discardFileSelection();
        const version = this.selectionVersion;
        const type = this.getUrlType(url);
        try {
            await this.preloadResource(url, type);
        } catch {
            if (version === this.selectionVersion) {
                const message = window.i18n?.t('background.load_failed') ?? '无法加载背景。请确认链接可以直接打开图片或视频。';
                alert(message);
            }
            return;
        }
        if (version !== this.selectionVersion) return;

        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
        this.currentUrl = url;
        this.currentType = type;
        this.previewUrl = null;
        this.currentFile = null;
        this.currentFilePath = null;
        this.savedLocalFileName = null;
        this.savedLocalFileSize = null;
        this.savedLocalFileType = null;
        this.clearFileInfo();
        this.applyBackground();
        await this.saveSettings();
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
                'This file type is not supported. Choose one of the image or video formats listed below.';
            alert(message);
            return;
        }

        // 限制文件大小 (1GB)
        const maxSize = 1024 * 1024 * 1024;
        if (file.size > maxSize) {
            const message = window.i18n && window.i18n.t ? 
                window.i18n.t('background.file_too_large') : 
                'Choose a file no larger than 1 GiB.';
            alert(message);
            return;
        }

        this.discardFileSelection();
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        this.pendingLocalFile = {
            file, path: file.path || null, name: file.name, size: file.size, mimeType: file.type, url, type
        };
        this.updateFileInfo(file);
        this.showPreview(url, type);
    }

    handleLocalFilePath(filePath) {
        const extension = filePath.split('.').pop()?.toLowerCase() || '';
        const isImage = this.isImageExtension(extension);
        const isVideo = this.isVideoExtension(extension);

        if (!isImage && !isVideo) {
            const message = window.i18n && window.i18n.t
                ? window.i18n.t('background.invalid_file_type')
                : 'This file type is not supported. Choose one of the image or video formats listed below.';
            alert(message);
            return;
        }

        this.discardFileSelection();
        this.hidePreview();
        const selected = {
            file: null,
            sourcePath: filePath,
            name: filePath.split(/[\\/]/).pop(),
            mimeType: this.getMimeTypeFromExtension(extension),
            url: this.getLocalAssetUrl(filePath),
            type: isVideo ? 'video' : 'image'
        };
        this.pendingLocalFile = selected;
        this.updateFileInfo(selected);
        this.showPreview(selected.url, selected.type);
    }

    discardFileSelection() {
        this.selectionVersion++;
        const selected = this.pendingLocalFile;
        if (selected?.file && selected.url !== this.objectUrl) {
            URL.revokeObjectURL(selected.url);
        }
        this.pendingLocalFile = null;
    }

    // 应用本地文件作为背景
    async applyLocalFile() {
        const selected = this.pendingLocalFile;
        if (!selected || selected.applying) return;
        selected.applying = true;
        const button = document.getElementById('apply-local-bg');
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try {
            if (selected.sourcePath && !selected.path) {
                const copiedFile = await window.__TAURI__.core.invoke('copy_background_file', {
                    sourcePath: selected.sourcePath
                });
                selected.path = copiedFile.filePath;
                selected.size = copiedFile.fileSize;
            }
            if (this.pendingLocalFile !== selected) return;

            this.hidePreview();
            if (this.objectUrl && this.objectUrl !== selected.url) {
                URL.revokeObjectURL(this.objectUrl);
            }
            this.objectUrl = selected.file ? selected.url : null;
            this.currentFile = selected.file;
            this.currentFilePath = selected.path || null;
            this.savedLocalFileName = selected.name;
            this.savedLocalFileSize = selected.size;
            this.savedLocalFileType = selected.mimeType;
            this.currentType = selected.type;
            this.currentUrl = selected.sourcePath ? this.getLocalAssetUrl(selected.path) : selected.url;
            this.isEnabled = true;
            document.getElementById('custom-bg-toggle').checked = true;
            this.toggleControls();
            await this.saveSettings();
        } catch (error) {
            if (this.pendingLocalFile === selected) alert(String(error));
        } finally {
            selected.applying = false;
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    }

    // 更新文件信息显示
    updateFileInfo({ name, size }) {
        const fileInfoElement = document.getElementById('selected-file-info');
        const sizeLabel = Number.isFinite(size) ? (size / (1024 * 1024)).toFixed(1) + ' MB' : '';
        const fileName = name.length > 30 ? name.substring(0, 30) + '...' : name;
        
        // 大文件性能警告
        const isLargeFile = size > 200 * 1024 * 1024;
        const warningText = isLargeFile ? 
            `<span class="text-yellow-500 text-xs ml-2" data-i18n-title="background.large_file_warning" title="${window.i18n ? window.i18n.t('background.large_file_warning') : 'Large file warning'}">⚠</span>` : '';
        
        // 使用当前语言获取按钮文本
        const applyButtonText = window.i18n ? window.i18n.t('background.apply') : 'Apply';
        const applyingText = window.i18n ? window.i18n.t('background.applying') : 'Applying…';
        
        fileInfoElement.innerHTML = `
            <span class="truncate"></span>
            ${sizeLabel ? '<span class="ml-2 shrink-0 text-[var(--text-secondary)]">(' + sizeLabel + ')</span>' : ''}
            ${warningText}
            <button type="button" id="apply-local-bg" class="background-apply-button ml-2 shrink-0 glass-effect${settingsManager.get('glass-effect') ? '' : ' glass-disabled'} text-[var(--accent-color)] hover:bg-[var(--bg-tertiary)] transition-colors rounded-md">
                <span class="background-apply-idle" data-i18n="background.apply">${applyButtonText}</span>
                <span class="background-apply-progress">
                    <span class="background-apply-spinner" aria-hidden="true"></span>
                    <span data-i18n="background.applying">${applyingText}</span>
                </span>
            </button>
        `;

        fileInfoElement.querySelector('span').textContent = fileName;
        // 绑定应用按钮事件
        const applyBtn = document.getElementById('apply-local-bg');
        applyBtn.addEventListener('click', async () => {
            await this.applyLocalFile();
        });
    }

    // 清除文件信息显示
    clearFileInfo() {
        const fileInfoElement = document.getElementById('selected-file-info');
        const noFileText = window.i18n ? window.i18n.t('background.no_file_selected') : 'No file selected';
        fileInfoElement.innerHTML = `<span data-i18n="background.no_file_selected">${noFileText}</span>`;
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
                const finish = callback => {
                    video.onloadedmetadata = null;
                    video.onerror = null;
                    video.removeAttribute('src');
                    video.load();
                    callback();
                };
                video.onloadedmetadata = () => finish(resolve);
                video.onerror = () => finish(reject);
                video.preload = 'metadata';
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
        let video;
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
            video = document.createElement('video');
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
            video.defaultMuted = true;
            video.muted = true;
            video.playsInline = true;
            video.src = this.currentUrl;
            const resume = () => this.resumeBackgroundVideo(video);
            video.addEventListener('pause', resume);
            video.addEventListener('ended', resume);
            bgElement.appendChild(video);
        }

        document.body.appendChild(bgElement);
        if (video) this.playVideo(video);
    }

    resumeBackgroundVideo(video = document.querySelector('#custom-background > video')) {
        if (!this.isEnabled || document.hidden || !video?.isConnected || video.error) return;

        if (video.ended) {
            video.loop = true;
            video.currentTime = 0;
        }
        if (video.paused) this.playVideo(video);
    }

    playVideo(video) {
        video.play().catch(error => {
            if (error.name === 'NotAllowedError' && video.isConnected) {
                document.addEventListener('pointerdown', () => {
                    if (video.isConnected && video.hasAttribute('src')) this.playVideo(video);
                }, { once: true });
            }
        });
    }

    removeBackground() {
        const existingBg = document.getElementById('custom-background');
        if (existingBg) {
            const video = existingBg.querySelector('video');
            existingBg.remove();
            if (video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
            }
        }
    }

    async clearBackground() {
        this.discardFileSelection();
        this.currentUrl = null;
        this.currentType = null;
        this.previewUrl = null;
        this.currentFile = null;
        this.currentFilePath = null;
        this.savedLocalFileName = null;
        this.savedLocalFileSize = null;
        this.savedLocalFileType = null;
        
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

        if (displayType === 'video') {
            imgPreview.style.display = 'none';
            videoPreview.style.display = 'block';
            videoPreview.classList.remove('fade-out');
            videoPreview.classList.add('fade-in');
            videoPreview.muted = true;
            videoPreview.playsInline = true;
            videoPreview.src = displayUrl;
            this.playVideo(videoPreview);
            return;
        }

        // 预加载资源以避免显示破损图片
        this.preloadResource(displayUrl, displayType)
            .then(() => {
                if (this.previewUrl !== displayUrl) return;
                // 强制重排以确保动画效果
                previewContainer.offsetHeight;
                
                imgPreview.src = displayUrl;
                imgPreview.style.display = 'block';
                imgPreview.classList.add('fade-in');
                imgPreview.classList.remove('fade-out');
                videoPreview.style.display = 'none';
                this.releaseVideoPreview();
            })
            .catch((error) => {
                if (this.previewUrl !== displayUrl) return;
                // console.warn('预览加载失败:', error);
                // 加载失败时不显示预览，但保持容器可见
                imgPreview.style.display = 'none';
                videoPreview.style.display = 'none';
            });
    }

    hidePreview() {
        this.previewUrl = null;
        const previewContainer = document.getElementById('bg-preview-container');
        this.releaseVideoPreview();
        // 添加淡出动画
        previewContainer.classList.remove('show');
        
        // 动画结束后隐藏
            setTimeout(() => {
                if (this.previewUrl) return;
                previewContainer.classList.add('hidden');
                
                // 重置图片和视频状态
                const imgPreview = document.getElementById('bg-image-preview');
                const videoPreview = document.getElementById('bg-video-preview');
                
                imgPreview.classList.remove('fade-in', 'fade-out');
                videoPreview.classList.remove('fade-in', 'fade-out');
            }, 200);
    }

    releaseVideoPreview() {
        const video = document.getElementById('bg-video-preview');
        if (video.hasAttribute('src')) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
    }

    async saveSettings() {
        const savedFilePath = this.currentFile ? (this.currentFile.path || this.currentFilePath) : this.currentFilePath;
        const isPersistentLocalFile = !!savedFilePath;
        const settings = {
            enabled: this.isEnabled,
            // 对于本地文件，不保存临时的object URL，只保存文件信息
            url: isPersistentLocalFile ? null : (this.currentFile ? null : this.currentUrl),
            type: this.currentType,
            opacity: this.opacity,
            isLocalFile: isPersistentLocalFile,
            fileName: this.currentFile ? this.currentFile.name : this.savedLocalFileName,
            fileSize: this.currentFile ? this.currentFile.size : this.savedLocalFileSize,
            fileType: this.currentFile ? this.currentFile.type : this.savedLocalFileType,
            filePath: savedFilePath
        };
        await settingsManager.init();
        await settingsManager.set('custom-background', settings);
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
                this.opacity = settings.opacity ?? 0.3;
                this.currentFilePath = settings.filePath || null;
                this.savedLocalFileName = settings.fileName || null;
                this.savedLocalFileSize = settings.fileSize || null;
                this.savedLocalFileType = settings.fileType || null;

                // 恢复UI状态
                const toggle = document.getElementById('custom-bg-toggle');
                const urlInput = document.getElementById('bg-url-input');
                const opacitySlider = document.getElementById('bg-opacity');

                toggle.checked = this.isEnabled;
                urlInput.value = this.currentUrl || '';
                opacitySlider.value = this.opacity;
                
                this.updateOpacityDisplay();

                // 如果是本地文件，优先尝试恢复
                if (settings.isLocalFile && settings.fileName) {
                    const restored = await this.restoreLocalBackground(settings);
                    if (!restored) {
                        await this.showLocalFileStatus(settings.fileName, 'background.file_missing', '找不到已保存的背景，请重新选择文件。');
                    }
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
    async showLocalFileStatus(fileName, detailKey, fallbackDetail) {
        const fileInfoElement = document.getElementById('selected-file-info');
        const warningText1 = window.i18n?.translations?.background?.previous_file ?? '上次选择的文件：';
        const warningText2 = window.i18n?.translations?.background?.[detailKey.split('.').pop()] ?? fallbackDetail;
        
        fileInfoElement.innerHTML = `
            <div class="flex flex-col">
                <span class="text-[var(--text-secondary)]"><span data-i18n="background.previous_file">${warningText1}</span> <span class="background-status-file"></span></span>
                <span class="text-xs text-[var(--text-secondary)]" data-i18n="${detailKey}">${warningText2}</span>
            </div>
        `;
        fileInfoElement.querySelector('.background-status-file').textContent = fileName;
    }

    async restoreLocalBackground(settings) {
        if (!settings.filePath || !settings.type) {
            return false;
        }

        try {
            const { invoke } = window.__TAURI__.core;
            const filePath = await invoke('resolve_background_file', {
                filePath: settings.filePath,
                fileName: settings.fileName,
                fileSize: settings.fileSize ?? null
            });
            if (!filePath) {
                return false;
            }

            this.currentFile = null;
            this.currentFilePath = filePath;
            this.savedLocalFileName = settings.fileName || null;
            this.savedLocalFileSize = settings.fileSize || null;
            this.savedLocalFileType = settings.fileType || null;
            this.currentType = settings.type;
            this.currentUrl = this.getLocalAssetUrl(filePath);
            if (filePath !== settings.filePath) {
                await this.saveSettings();
            }

            await this.showLocalFileStatus(
                settings.fileName,
                'background.auto_restored',
                '已恢复上次使用的背景。'
            );

            return true;
        } catch (error) {
            return false;
        }
    }

}

// 初始化背景管理器
document.addEventListener('DOMContentLoaded', () => {
    window.backgroundManager = new BackgroundManager();
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
