/**
 * 壁纸卡片右键菜单功能
 */

class WallpaperContextMenu {
    constructor() {
        this.menu = null;
        this.currentWallpaper = null;
        this.init();
    }

    init() {
        this.createContextMenu();
        this.addEventListeners();
    }

    createContextMenu() {
        // 创建右键菜单元素
        this.menu = document.createElement('div');
        this.menu.id = 'wallpaper-context-menu';
        this.menu.className = 'fixed z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg py-2 min-w-[200px] hidden';
        
        // 添加菜单项
        this.menu.innerHTML = `
        `;
        
        document.body.appendChild(this.menu);
    }

    addEventListeners() {
        // 为壁纸卡片添加右键事件
        document.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.wallpaper-card');
            if (card) {
                e.preventDefault();
                this.showMenu(e, card);
            }
        });

        // 点击其他地方隐藏菜单
        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target)) {
                this.hideMenu();
            }
        });

        // 按ESC键隐藏菜单
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideMenu();
            }
        });
    }

    showMenu(event, card) {
        // 获取壁纸数据
        const wallpaperId = card.dataset.wallpaperId;
        const index = parseInt(card.dataset.index);
        const scenePkgPath = card.dataset.scenePkgPath;
        
        this.currentWallpaper = {
            id: wallpaperId,
            index: index,
            scenePkgPath: scenePkgPath,
            card: card
        };

        // 计算菜单位置
        const x = event.clientX;
        const y = event.clientY;
        
        // 确保菜单不超出视口
        const menuWidth = 200; // 预估菜单宽度
        const menuHeight = 100; // 预估菜单高度
        
        let left = x;
        let top = y;
        
        if (x + menuWidth > window.innerWidth) {
            left = x - menuWidth;
        }
        
        if (y + menuHeight > window.innerHeight) {
            top = y - menuHeight;
        }
        
        // 显示菜单
        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
        this.menu.classList.remove('hidden');
    }

    hideMenu() {
        this.menu.classList.add('hidden');
        this.currentWallpaper = null;
    }

    // 获取当前选中的壁纸数据
    getCurrentWallpaper() {
        return this.currentWallpaper;
    }

    // 添加菜单项的方法（供后续扩展使用）
    addMenuItem(text, callback, icon = '') {
        const menuItem = document.createElement('div');
        menuItem.className = 'px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer flex items-center gap-2';
        
        let iconHtml = '';
        if (icon) {
            iconHtml = `<span class="w-4 h-4">${icon}</span>`;
        }
        
        menuItem.innerHTML = `${iconHtml}<span>${text}</span>`;
        
        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (callback) {
                callback(this.currentWallpaper);
            }
            this.hideMenu();
        });
        
        // 插入到占位文本之前
        const placeholder = this.menu.querySelector('.text-center');
        if (placeholder) {
            this.menu.insertBefore(menuItem, placeholder);
        } else {
            this.menu.appendChild(menuItem);
        }
    }

    // 添加分隔线的方法（供后续扩展使用）
    addSeparator() {
        const separator = document.createElement('div');
        separator.className = 'border-t border-[var(--border-color)] my-1';
        
        // 插入到占位文本之前
        const placeholder = this.menu.querySelector('.text-center');
        if (placeholder) {
            this.menu.insertBefore(separator, placeholder);
        } else {
            this.menu.appendChild(separator);
        }
    }
}

// 创建全局openFolder函数
window.openFolder = async function(path) {
    if (!path) {
        alert(window.i18n?.t('messages.empty_path') || '路径不能为空');
        return;
    }
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__.core;
            // 确保路径格式正确（使用反斜杠）
            const normalizedPath = path.replace(/\//g, '\\');
            await invoke('open_folder', { path: normalizedPath });
        } else {
            alert(window.i18n?.t('messages.desktop_only') || '此功能仅在桌面应用中可用');
        }
    } catch (error) {
//         console.error('打开文件夹失败:', error);
        alert((window.i18n?.t('messages.open_folder_error') || '打开文件夹失败：') + error);
    }
};

// 创建全局extractWallpaper函数
window.extractWallpaper = async function(wallpaper) {
    if (!wallpaper || (!wallpaper.scenePkgPath && !wallpaper.path)) {
        alert(window.i18n?.t('messages.no_wallpaper_selected') || '请先选择一个壁纸');
        return;
    }
    
    // 从scenePkgPath中提取壁纸文件夹路径
    let wallpaperPath;
    if (wallpaper.scenePkgPath) {
        // 移除末尾的/scene.pkg，得到壁纸文件夹路径
        wallpaperPath = wallpaper.scenePkgPath.replace(/\/scene\.pkg$/, '');
    } else if (wallpaper.path) {
        wallpaperPath = wallpaper.path;
    } else {
        alert(window.i18n?.t('messages.no_wallpaper_selected') || '请先选择一个壁纸');
        return;
    }
    
    const extractPathInput = document.getElementById('extract-path');
    const extractPath = extractPathInput ? extractPathInput.value : '';
    
    if (!extractPath) {
        alert(window.i18n?.t('messages.set_extract_path_first') || '请先设置提取路径');
        return;
    }
    
    try {
        // 调用main.js中的extractWallpaper函数
        if (typeof extractWallpaperFromMain === 'function') {
            await extractWallpaperFromMain(wallpaperPath, extractPath);
        } else {
            alert(window.i18n?.t('messages.extract_failed') || '提取功能未加载');
        }
    } catch (error) {
        alert((window.i18n?.t('messages.extract_failed') || '提取失败：') + error);
    }
};

// 创建全局openWorkshop函数
window.openWorkshop = async function(wallpaper) {
    if (!wallpaper || (!wallpaper.scenePkgPath && !wallpaper.path)) {
        alert(window.i18n?.t('messages.no_wallpaper_selected') || '请先选择一个壁纸');
        return;
    }
    
    // 获取壁纸文件夹路径
    let wallpaperPath;
    if (wallpaper.scenePkgPath) {
        wallpaperPath = wallpaper.scenePkgPath.replace(/\/scene\.pkg$/, '');
    } else if (wallpaper.path) {
        wallpaperPath = wallpaper.path;
    } else {
        alert(window.i18n?.t('messages.no_wallpaper_selected') || '请先选择一个壁纸');
        return;
    }
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__.core;
            const projectJsonPath = `${wallpaperPath}/project.json`;
            
            // 读取project.json文件
            const projectData = await invoke('read_json_file', { path: projectJsonPath });
            
            if (projectData && projectData.workshopurl) {
                // 打开Steam创意工坊链接
                const { invoke } = window.__TAURI__.core;
                await invoke('open_shell', { path: projectData.workshopurl });
            } else {
                alert(window.i18n?.t('messages.no_workshop_url') || '该壁纸没有创意工坊链接');
            }
        } else {
            alert(window.i18n?.t('messages.desktop_only') || '此功能仅在桌面应用中可用');
        }
    } catch (error) {
//         console.error('读取project.json失败:', error);
        alert((window.i18n?.t('messages.read_project_failed') || '读取项目信息失败：') + error);
    }
};

// 初始化右键菜单
document.addEventListener('DOMContentLoaded', () => {
    window.wallpaperContextMenu = new WallpaperContextMenu();
    
    // 添加壁纸卡片右键菜单项 - 在创意工坊中打开
    window.wallpaperContextMenu.addMenuItem(
        '在创意工坊中打开',
        (wallpaper) => {
            if (wallpaper) {
                window.openWorkshop(wallpaper);
            }
        },
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 65 65" fill="#fff"><use xlink:href="#B" x=".5" y=".5"/><defs><linearGradient id="A" x2="50%" x1="50%" y2="100%" y1="0%"><stop stop-color="#111d2e" offset="0%"/><stop stop-color="#051839" offset="21.2%"/><stop stop-color="#0a1b48" offset="40.7%"/><stop stop-color="#132e62" offset="58.1%"/><stop stop-color="#144b7e" offset="73.8%"/><stop stop-color="#136497" offset="87.3%"/><stop stop-color="#1387b8" offset="100%"/></linearGradient></defs><symbol id="B"><g><path d="M1.305 41.202C5.259 54.386 17.488 64 31.959 64c17.673 0 32-14.327 32-32s-14.327-32-32-32C15.001 0 1.124 13.193.028 29.874c2.074 3.477 2.879 5.628 1.275 11.328z" fill="url(#A)"/><path d="M30.31 23.985l.003.158-7.83 11.375c-1.268-.058-2.54.165-3.748.662a8.14 8.14 0 0 0-1.498.8L.042 29.893s-.398 6.546 1.26 11.424l12.156 5.016c.6 2.728 2.48 5.12 5.242 6.27a8.88 8.88 0 0 0 11.603-4.782 8.89 8.89 0 0 0 .684-3.656L42.18 36.16l.275.005c6.705 0 12.155-5.466 12.155-12.18s-5.44-12.16-12.155-12.174c-6.702 0-12.155 5.46-12.155 12.174zm-1.88 23.05c-1.454 3.5-5.466 5.147-8.953 3.694a6.84 6.84 0 0 1-3.524-3.362l3.957 1.64a5.04 5.04 0 0 0 6.591-2.719 5.05 5.05 0 0 0-2.715-6.601l-4.1-1.695c1.578-.6 3.372-.62 5.05.077 1.7.703 3 2.027 3.696 3.72s.692 3.56-.01 5.246M42.466 32.1a8.12 8.12 0 0 1-8.098-8.113 8.12 8.12 0 0 1 8.098-8.111 8.12 8.12 0 0 1 8.1 8.111 8.12 8.12 0 0 1-8.1 8.113m-6.068-8.126a6.09 6.09 0 0 1 6.08-6.095c3.355 0 6.084 2.73 6.084 6.095a6.09 6.09 0 0 1-6.084 6.093 6.09 6.09 0 0 1-6.081-6.093z"/></g></symbol></svg>'
    );
    
    // 添加分隔线
    window.wallpaperContextMenu.addSeparator();
    
    // 添加壁纸卡片右键菜单项
    window.wallpaperContextMenu.addMenuItem(
        '打开壁纸所在文件夹',
        (wallpaper) => {
            if (wallpaper && wallpaper.scenePkgPath) {
                // 获取壁纸所在文件夹路径（scene.pkg所在的文件夹）
                const folderPath = wallpaper.scenePkgPath.replace(/\/scene\.pkg$/, '');
                window.openFolder(folderPath);
            } else if (wallpaper && wallpaper.path) {
                window.openFolder(wallpaper.path);
            }
        },
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="transparent" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-closed"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M2 10h20"></path></svg>'
    );

    window.wallpaperContextMenu.addMenuItem(
        '开始提取',
        (wallpaper) => {
            if (wallpaper) {
                window.extractWallpaper(wallpaper);
            }
        },
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="transparent" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-up"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 12v6"></path><path d="m15 15-3-3-3 3"></path></svg>'
    );

    window.wallpaperContextMenu.addMenuItem(
        '打开提取文件夹',
        () => {
            const extractPathInput = document.getElementById('extract-path');
            const extractPath = extractPathInput ? extractPathInput.value : '';
            if (extractPath) {
                window.openFolder(extractPath);
            }
        },
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="transparent" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-closed"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M2 10h20"></path></svg>'
    );

    window.wallpaperContextMenu.addMenuItem(
        '导入壁纸编辑器',
        (wallpaper) => {
            if (wallpaper) {
                // 设置当前选中的壁纸信息
                window.currentlySelectedWallpaper = wallpaper;
                
                // 调用importToWallpaperEditor函数
                if (typeof importToWallpaperEditor === 'function') {
                    importToWallpaperEditor('context-menu');
                } else {
                    alert(window.i18n?.t('messages.wallpaper_editor_not_loaded') || '壁纸编辑器功能未加载');
                }
            }
        },
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="transparent" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>'
    );
});