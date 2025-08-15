// 壁纸编辑器导入功能
class WallpaperEditorImporter {
    constructor() {
        this.steamappsPath = null;
        this.initialize();
    }

    async initialize() {
        try {
            // 获取Steamapps路径
            const paths = await window.__TAURI__.core.invoke('get_steamapps_paths');
            this.steamappsPath = paths.myprojects_path;
        } catch (error) {
            // console.warn('无法自动获取Steam路径:', error);
        }
    }

    async importToEditor(workshopId, scenePkgPath) {
        try {
            let steamappsBasePath = null;
            
            // 首先检查用户设置的自定义路径
            await settingsManager.init();
            const customPath = settingsManager.get('workshop-path');
            if (customPath) {
                try {
                    // 从自定义创意工坊路径推断Steamapps基础路径
                    // 自定义路径可能是完整的workshop路径，需要提取到steamapps级别
                    const workshopPath = customPath;
                    if (workshopPath.includes('steamapps')) {
                        // 从workshop路径提取steamapps基础路径
                        const steamappsMatch = workshopPath.match(/^(.*steamapps)/);
                        if (steamappsMatch) {
                            steamappsBasePath = steamappsMatch[1];
                        }
                    }
                } catch (error) {
                    // console.warn('自定义路径无效:', error);
                }
            }

            // 如果没有自定义路径或自定义路径无效，使用自动检测的路径
            if (!steamappsBasePath) {
                if (!this.steamappsPath) {
                    // 如果无法自动获取，尝试从当前提取路径推断
                    const extractPathInput = document.getElementById('extract-path');
                    const extractPath = extractPathInput.value;
                    if (extractPath) {
                        try {
                            this.steamappsPath = await window.__TAURI__.core.invoke('find_workshop_path_from_extract_path', { extractPath });
                        } catch (error) {
                            // console.warn('无法推断Steam路径:', error);
                        }
                    }
                }

                if (!this.steamappsPath) {
                    alert(window.i18n?.t('messages.steam_not_found') || '无法找到Steam或Wallpaper Engine安装路径，请确保已安装Wallpaper Engine');
                    return;
                }

                // 获取Steamapps基础路径
                steamappsBasePath = this.steamappsPath.replace('\\steamapps\\common\\wallpaper_engine\\projects\\myprojects', '\\steamapps');
            }

            // 显示导入进度
            this.showImportProgress();

            // 先检查是否已存在，如果存在则删除原有导入
            try {
                const exists = await window.__TAURI__.core.invoke('check_wallpaper_exists_in_editor', {
                    options: {
                        workshop_id: workshopId.toString(),
                        steamapps_path: steamappsBasePath,
                        scene_pkg_path: scenePkgPath,
                        overwrite: true
                    }
                });

                if (exists) {
                    // 删除原有导入
                    await window.__TAURI__.core.invoke('remove_wallpaper_from_editor', {
                        options: {
                            workshop_id: workshopId.toString(),
                            steamapps_path: steamappsBasePath,
                            scene_pkg_path: scenePkgPath,
                            overwrite: true
                        }
                    });
                }
            } catch (checkError) {
                // 如果检查功能不存在或出错，继续导入流程
                // console.warn('检查壁纸存在状态失败:', checkError);
            }

            // 执行新的导入
            const result = await window.__TAURI__.core.invoke('import_to_wallpaper_editor', {
                options: {
                    workshop_id: workshopId.toString(),
                    steamapps_path: steamappsBasePath,
                    scene_pkg_path: scenePkgPath,
                    overwrite: true // 始终覆盖现有文件
                }
            });

            this.hideImportProgress();
            const successTitle = window.i18n?.t('messages.import_success') || '导入成功';
            alert(`${successTitle}\n${result}`);

        } catch (error) {
            this.hideImportProgress();
            // console.error('导入壁纸编辑器失败:', error);
            const failedTitle = window.i18n?.t('messages.import_failed') || '导入失败';
            alert(`${failedTitle}\n${error}`);
        }
    }

    showImportProgress() {
        // 获取导入按钮并显示进度
        const importBtn = document.getElementById('import-wallpaper-editor-btn');
        
        if (importBtn) {
            importBtn.dataset.originalText = importBtn.textContent;
            importBtn.innerHTML = `
                <div class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    ${window.i18n?.t('messages.importing') || '导入中...'}
                </div>
            `;
            importBtn.disabled = true;
        }
    }

    hideImportProgress() {
        const importBtn = document.getElementById('import-wallpaper-editor-btn');
        
        if (importBtn) {
            importBtn.textContent = importBtn.dataset.originalText || 
                                   (window.i18n?.t('buttons.import_wallpaper_editor') || '导入壁纸编辑器');
            importBtn.disabled = false;
        }
    }

    // 从详情页获取当前选中的壁纸信息
    getSelectedWallpaperInfo() {
        const selectedItem = document.querySelector('.workshop-item.selected');
        if (selectedItem) {
            return {
                workshopId: selectedItem.dataset.id,
                scenePkgPath: selectedItem.dataset.scenePkgPath || selectedItem.dataset.path
            };
        }
        
        // 从详情页获取
        const currentWallpaper = window.currentlySelectedWallpaper;
        if (currentWallpaper) {
            return {
                workshopId: currentWallpaper.id,
                scenePkgPath: currentWallpaper.scenePkgPath || `${currentWallpaper.path}/scene.pkg`
            };
        }
        
        alert(window.i18n?.t('messages.no_wallpaper_selected') || '请先选择一个壁纸');
        return null;
    }


}

// 初始化壁纸编辑器导入器
let wallpaperEditorImporter = null;

// 确保在Tauri环境就绪后初始化
document.addEventListener('DOMContentLoaded', () => {
    if (window.__TAURI__) {
        wallpaperEditorImporter = new WallpaperEditorImporter();
    }
});

// 导出全局函数供HTML调用
window.importToWallpaperEditor = async function(type = 'detail') {
    if (!window.__TAURI__) {
        alert(window.i18n?.t('messages.desktop_only') || '此功能仅在桌面应用中可用');
        return;
    }

    if (!wallpaperEditorImporter) {
        wallpaperEditorImporter = new WallpaperEditorImporter();
        await wallpaperEditorImporter.initialize();
    }

    let wallpaperInfo = null;

    if (type === 'detail') {
        wallpaperInfo = wallpaperEditorImporter.getSelectedWallpaperInfo();
    }

    if (wallpaperInfo) {
        await wallpaperEditorImporter.importToEditor(
            wallpaperInfo.workshopId,
            wallpaperInfo.scenePkgPath
        );
    }
};