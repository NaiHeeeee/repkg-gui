window.addEventListener("contextmenu", (e) => {
  e.preventDefault(); // 阻止浏览器默认右键菜单
});

document.addEventListener('dragstart', (event) => {
  if (event.target.tagName === 'IMG') {
    event.preventDefault();
  }
});


// 全局变量声明
let wallpapers = [];
let currentSortMethod = 'date'; // 默认按时间排序
let sortOrders = {
  name: 'desc', // 'asc' 表示正序，'desc' 表示倒序
  date: 'desc'
};



// 设置默认提取路径函数（移到全局作用域）
async function setDefaultExtractPath() {
  const extractPathInput = document.getElementById('extract-path');
  if (extractPathInput) {
    try {
      if (typeof window.__TAURI__ !== 'undefined') {
        const { invoke } = window.__TAURI__.core;
        const homeDir = await invoke('get_home_dir');
        // 确保homeDir末尾没有反斜杠，然后拼接路径
        const normalizedHomeDir = homeDir.replace(/\\$/, '');
        const desktopPath = `${normalizedHomeDir}\\Desktop\\RePKG-GUI`;
        extractPathInput.value = desktopPath;
        await settingsManager.init();
        settingsManager.set('extract-path', desktopPath);
      } else {
        // Fallback for non-Tauri environment
        extractPathInput.value = 'C:\\RePKG-GUI';
        await settingsManager.init();
        settingsManager.set('extract-path', 'C:\\RePKG-GUI');
      }
    } catch (error) {
      // console.error('无法获取用户桌面路径:', error);
      extractPathInput.value = 'C:\\RePKG-GUI';
      await settingsManager.init();
      settingsManager.set('extract-path', 'C:\\RePKG-GUI');
    }
  }
}

// 防止FOUC的核心逻辑
(function preventFOUC() {
  // 检测样式是否加载完成
  function checkStylesLoaded() {
    const body = document.body;
    const loadingOverlay = document.getElementById('loading-overlay');

    // 标记样式已加载
    body.classList.add('styles-loaded');

    // 隐藏加载动画
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add('hidden');
        // 可选：完全移除加载动画元素
        setTimeout(() => {
          loadingOverlay.remove();
        }, 300);
      }, 100);
    }
  }

  // 页面加载完成后检查样式
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkStylesLoaded);
  } else {
    // 如果已经加载完成，直接执行
    checkStylesLoaded();
  }

  // 作为备用方案，在window.onload时也执行
  window.addEventListener('load', checkStylesLoaded);
})();

let extractionResultQueue = Promise.resolve();

function showExtractionResult(message) {
  extractionResultQueue = extractionResultQueue.then(() => new Promise(resolve => {
    const dialog = document.getElementById('extraction-result');
    document.getElementById('extraction-result-message').textContent = message;
    dialog.showModal();
    const closeTimer = window.setTimeout(() => dialog.close(), 3000);
    dialog.addEventListener('close', () => {
      window.clearTimeout(closeTimer);
      resolve();
    }, { once: true });
  }));
  return extractionResultQueue;
}

async function readExtractionSettings() {
  await settingsManager.init();
  return {
    only_images: settingsManager.get('only-images') === true,
    no_tex_convert: settingsManager.get('no-tex-convert') === true,
    single_dir: settingsManager.get('ignore-dir-structure') === true,
    overwrite: settingsManager.get('overwrite-files') === true
  };
}

async function openExtractionFolder(path) {
  if (!path || settingsManager.get('auto-open-extract-folder') !== true) return;

  try {
    await window.__TAURI__.core.invoke('open_folder', { path });
  } catch (error) {
    await showExtractionResult(window.i18n.t('messages.open_folder_error') + error);
  }
}

// 存储手动提取的文件列表
let manualFiles = [];

// 窗口控制功能
function setupWindowControls() {
  const minimizeBtn = document.getElementById('minimize-btn');
  const maximizeBtn = document.getElementById('maximize-btn');
  const closeBtn = document.getElementById('close-btn');

  if (!minimizeBtn || !maximizeBtn || !closeBtn) {
    // console.warn('窗口控制按钮未找到');
    return;
  }

  // 检查Tauri API是否可用
  if (!window.__TAURI__) {
    // console.warn('Tauri API 不可用');
    return;
  }

  // 最小化按钮
  minimizeBtn.addEventListener('click', async () => {
    try {
      await window.__TAURI__.core.invoke('minimize_window');
    } catch (error) {
      // console.error('最小化窗口失败:', error);
    }
  });

  // 最大化/还原按钮
  maximizeBtn.addEventListener('click', async () => {
    try {
      const isMaximized = await window.__TAURI__.core.invoke('is_window_maximized');
      if (isMaximized) {
        await window.__TAURI__.core.invoke('unmaximize_window');
      } else {
        await window.__TAURI__.core.invoke('maximize_window');
      }
      updateMaximizeButton();
    } catch (error) {
      // console.error('最大化/还原窗口失败:', error);
    }
  });

  // 关闭按钮
  closeBtn.addEventListener('click', async () => {
    try {
      await window.__TAURI__.core.invoke('close_window');
    } catch (error) {
      // console.error('关闭窗口失败:', error);
    }
  });

  // 初始化最大化按钮状态
  updateMaximizeButton();
}

// 更新最大化按钮图标
async function updateMaximizeButton() {
  const maximizeBtn = document.getElementById('maximize-btn');
  if (!maximizeBtn || !window.__TAURI__) return;

  try {
    const isMaximized = await window.__TAURI__.core.invoke('is_window_maximized');
    maximizeBtn.innerHTML = isMaximized ?
      '<svg class="w-3 h-3" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M597.333333 395.861333V192a21.333333 21.333333 0 0 0-42.666666 0v256a21.333333 21.333333 0 0 0 21.333333 21.333333h256a21.333333 21.333333 0 0 0 0-42.666666h-205.12L890.24 163.306667a21.333333 21.333333 0 0 0-30.165333-30.165334L597.333333 395.861333z m-170.666666 232.277334V832a21.333333 21.333333 0 0 0 42.666666 0V576a21.333333 21.333333 0 0 0-21.333333-21.333333H192a21.333333 21.333333 0 0 0 0 42.666666h205.12L133.76 860.693333a21.333333 21.333333 0 0 0 30.165333 30.165334L426.666667 628.138667z" fill="currentColor"></path></svg>' :
      '<svg class="w-3 h-3" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M170.666667 822.528V618.666667a21.333333 21.333333 0 0 0-42.666667 0v256a21.333333 21.333333 0 0 0 21.333333 21.333333h256a21.333333 21.333333 0 0 0 0-42.666667H200.213333L463.573333 589.973333a21.333333 21.333333 0 0 0-30.165333-30.165333L170.666667 822.528zM853.333333 201.472L590.592 464.192a21.333333 21.333333 0 1 1-30.165333-30.165333L823.786667 170.666667H618.666667a21.333333 21.333333 0 0 1 0-42.666667h256a21.333333 21.333333 0 0 1 21.333333 21.333333v256a21.333333 21.333333 0 0 1-42.666667 0V201.472z" fill="currentColor"></path></svg>';
  } catch (error) {
    // console.error('更新最大化按钮失败:', error);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // 等待i18n和settingsManager加载完成
  function waitForI18n() {
    return new Promise(async (resolve) => {
      // 等待settingsManager初始化完成
      if (typeof settingsManager !== 'undefined') {
        await settingsManager.init();
      }

      // 初始化i18n
      if (typeof window.initI18n !== 'undefined' && (!window.i18n || !window.i18n.translations)) {
        await window.initI18n();
      }

      // 等待i18n加载完成
      if (window.i18n && window.i18n.translations) {
        resolve();
      } else {
        window.addEventListener('languageChanged', resolve, { once: true });
      }
    });
  }

  // 初始化语言选择器
  function initLanguageSelector() {
    const languageToggleBtn = document.getElementById('language-toggle-btn');
    const languageOptions = document.getElementById('language-options');
    const languageButtons = document.querySelectorAll('.language-option');

    if (window.i18n) {
      // 更新按钮文本显示当前语言
      function updateLanguageButtonText() {
        const currentLang = window.i18n.currentLanguage;
        const langMap = {
          'zh-CN': '简体中文',
          'zh-TW': '繁體中文',
          'en-US': 'English',
          'ja-JP': '日本語'
        };
        if (languageToggleBtn) {
          languageToggleBtn.textContent = langMap[currentLang] ||
            window.i18n.t('settings.select_language');
        }
      }

      // 初始化按钮文本
      updateLanguageButtonText();

      // 更新语言选项的选中状态
      function updateLanguageSelection() {
        const currentLang = window.i18n.currentLanguage;
        languageButtons.forEach(button => {
          button.setAttribute('aria-pressed', String(button.dataset.lang === currentLang));
        });
      }

      // 初始化语言选择状态
      updateLanguageSelection();

      // 切换语言选项区域的显示/隐藏
      if (languageToggleBtn) {
        languageToggleBtn.addEventListener('click', () => {
          languageOptions.classList.toggle('hidden');
        });
      }

      // 为语言选项按钮添加点击事件
      languageButtons.forEach(button => {
        button.addEventListener('click', () => {
          const lang = button.dataset.lang;
          window.i18n.setLanguage(lang);
          languageOptions.classList.add('hidden'); // 选择后隐藏选项区域
          updateLanguageButtonText();
          updateLanguageSelection(); // 更新选中状态
        });
      });

      window.addEventListener('languageChanged', () => {
        updateLanguageButtonText();
        updateLanguageSelection();
      });

      // 点击其他地方关闭语言选项
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#language-toggle-btn') && !e.target.closest('#language-options')) {
          languageOptions.classList.add('hidden');
        }
      });
    }
  }

  // 初始化翻译
  async function initTranslations() {
    await waitForI18n();
    initLanguageSelector();
  }

  initTranslations();
  // 使用Tauri的API读取本地文件系统
  let wallpaperLoadVersion = 0;
  let wallpaperLoadStatus = 'loading';

  async function loadSteamWorkshopWallpapers() {
    const loadVersion = ++wallpaperLoadVersion;
    wallpaperLoadStatus = 'loading';
    showLoadingAnimation();

    try {
      // console.log('开始加载Steam创意工坊壁纸...');

      // 检查是否在Tauri环境中运行
      if (typeof window.__TAURI__ !== 'undefined') {
        const { invoke } = window.__TAURI__.core;

        // 首先检查用户设置的自定义路径
        let workshopPath = '';
        let wallpaperFolders = [];

        // 检查用户设置的自定义路径
        await settingsManager.init();
        const customPath = settingsManager.get('workshop-path');
        if (customPath) {
          try {
            // 使用自动补全功能
            const completedPath = await autoCompleteWorkshopPath(customPath);
            if (loadVersion !== wallpaperLoadVersion) return;
            if (completedPath !== customPath) {
              // 如果路径被补全，更新存储的路径
              await settingsManager.init();
              settingsManager.set('workshop-path', completedPath);
              const workshopPathInput = document.getElementById('workshop-path');
              if (workshopPathInput) {
                workshopPathInput.value = completedPath;
              }
            }

            const exists = await invoke('check_file_exists', { path: completedPath });
            if (exists) {
              workshopPath = completedPath;
              wallpaperFolders = await invoke('read_workshop_directory', { path: completedPath });
              // console.log('使用用户设置的自定义路径:', workshopPath);
            }
          } catch (e) {
            // console.log('用户设置的路径无效:', customPath);
          }
        }

        // 如果没有有效的自定义路径，则尝试预定义路径
        if (!workshopPath) {
          // 定义可能的Steam Workshop路径
          const possiblePaths = [
            'C:/Program Files (x86)/Steam/steamapps/workshop/content/431960',
            'D:/Steam/steamapps/workshop/content/431960',
            'D:/SteamLibrary/steamapps/workshop/content/431960',
            'E:/Steam/steamapps/workshop/content/431960',
            'E:/SteamLibrary/steamapps/workshop/content/431960',
            'F:/Steam/steamapps/workshop/content/431960',
            'F:/SteamLibrary/steamapps/workshop/content/431960'
          ];

          // 尝试找到有效的路径
          for (const path of possiblePaths) {
            try {
              const exists = await invoke('check_file_exists', { path });
              if (exists) {
                workshopPath = path;
                wallpaperFolders = await invoke('read_workshop_directory', { path });
                // console.log('找到有效的壁纸目录:', workshopPath);
                break;
              }
            } catch (e) {
              // 继续尝试下一个路径
              // console.log(`路径 ${path} 不存在或无法访问`);
            }
          }
        }

        if (loadVersion !== wallpaperLoadVersion) return;

        // 如果没有找到有效的路径
        if (!workshopPath) {
          // console.warn('未找到有效的Steam Workshop路径');
          loadMockData();
          return;
        }

        try {
          // console.log('正在读取目录...');
          // console.log('找到的文件夹:', wallpaperFolders);

          if (wallpaperFolders.length === 0) {
            // console.warn('未找到任何壁纸文件夹');
            loadMockData();
            return;
          }

          const loadedWallpapers = [];

          for (const folder of wallpaperFolders) {
            if (loadVersion !== wallpaperLoadVersion) return;
            const folderId = folder.name;
            let workshopId = /^\d+$/.test(folderId) ? folderId : null;
            const folderPath = `${workshopPath}/${folderId}`;

            // console.log(`处理文件夹: ${folderId}`);

            try {
              // 读取project.json获取标题
              const projectJsonPath = `${folderPath}/project.json`;
              let name = `壁纸 ${folderId}`;
              let contentRating = '';

              try {
                const projectData = await invoke('read_json_file', { path: projectJsonPath });
                // console.log(`Project.json内容:`, projectData);
                if (typeof projectData?.title === 'string' && projectData.title) name = projectData.title;
                contentRating = typeof projectData?.contentrating === 'string' ? projectData.contentrating : '';

                if (!workshopId) {
                  const steamUrlId = /^steam:\/\/url\/CommunityFilePage\/(\d+)\/?$/i.exec(projectData?.workshopurl);
                  const webUrlId = /^https?:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/?\?(?:[^#]*&)?id=(\d+)(?:[&#]|$)/i.exec(projectData?.workshopurl);
                  workshopId = steamUrlId?.[1] || webUrlId?.[1] || null;
                }
              } catch (e) {
                // console.warn(`无法读取project.json: ${projectJsonPath}`, e);
              }

              // 查找预览图片/视频文件
              const previewExtensions = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm'];
              let imagePath = null;
              let foundPreviewType = 'none';

              // console.log(`在 ${folderPath} 中查找预览文件...`);

              // 方法1: 查找标准preview文件
              for (const ext of previewExtensions) {
                const previewPath = `${folderPath}/preview.${ext}`;
                const fileExists = await invoke('check_file_exists', { path: previewPath });
                // console.log(`检查文件: ${previewPath}, 存在: ${fileExists}`);
                if (fileExists) {
                  imagePath = previewPath;
                  foundPreviewType = `preview.${ext}`;
                  break;
                }
              }

              // 方法2: 如果没有找到标准preview，查找其他图片/视频文件
              if (!imagePath) {
                // console.log('未找到标准preview文件，查找其他媒体文件...');
                const files = await invoke('read_directory_files', { path: folderPath });
                // console.log(`目录中的文件:`, files);

                const previewFile = files.find(file =>
                  previewExtensions.some(ext => file.name.toLowerCase().endsWith(`.${ext}`))
                );

                if (previewFile) {
                  imagePath = `${folderPath}/${previewFile.name}`;
                  foundPreviewType = previewFile.name;
                  // console.log(`找到媒体文件: ${previewFile.name}`);
                }
              }

              // 方法3: 查找assets目录中的文件
              if (!imagePath) {
                const assetsPath = `${folderPath}/assets`;
                const assetsExists = await invoke('check_file_exists', { path: assetsPath });
                if (assetsExists) {
                  // console.log('检查assets目录...');
                  const assetFiles = await invoke('read_directory_files', { path: assetsPath });
                  const assetPreview = assetFiles.find(file =>
                    previewExtensions.some(ext => file.name.toLowerCase().endsWith(`.${ext}`))
                  );
                  if (assetPreview) {
                    imagePath = `${assetsPath}/${assetPreview.name}`;
                    foundPreviewType = `assets/${assetPreview.name}`;
                  }
                }
              }

              // 检查是否包含scene.pkg文件
              const scenePkgPath = `${folderPath}/scene.pkg`;
              const hasScenePkg = await invoke('check_file_exists', { path: scenePkgPath });

              if (!hasScenePkg) {
                // console.log(`跳过文件夹 ${folderId}: 缺少scene.pkg文件`);
                continue; // 跳过不包含scene.pkg的文件夹
              }

              // console.log(`文件夹 ${folderId} 包含scene.pkg文件，将被添加`);

              // 生成图片URL
              let imageUrl = 'https://placehold.co/600x400/6B7280/FFFFFF?text=No+Preview';
              if (imagePath) {
                // console.log(`找到预览文件: ${imagePath} (类型: ${foundPreviewType})`);

                try {
                  // 直接使用Base64编码的图片数据
                  const { invoke } = window.__TAURI__.core;
                  const imageData = await invoke('read_image_as_base64', { path: imagePath });

                  // 根据文件扩展名确定MIME类型
                  const extension = foundPreviewType.split('.').pop().toLowerCase();
                  let mimeType = 'image/jpeg';
                  switch (extension) {
                    case 'png': mimeType = 'image/png'; break;
                    case 'gif': mimeType = 'image/gif'; break;
                    case 'webp': mimeType = 'image/webp'; break;
                    case 'jpg': case 'jpeg': mimeType = 'image/jpeg'; break;
                    default: mimeType = 'image/jpeg';
                  }

                  imageUrl = `data:${mimeType};base64,${imageData}`;
                  // console.log(`使用Base64编码图片 (${mimeType})`);
                } catch (error) {
                  // console.error('Base64编码失败:', error);
                  // 回退到占位符
                  imageUrl = 'https://placehold.co/600x400/6B7280/FFFFFF?text=加载失败';
                }
              } else {
                // console.warn(`未在 ${folderId} 中找到任何预览文件`);
              }

              // 获取文件夹的修改日期
              let modifiedDate = null;
              try {
                const folderInfo = await invoke('get_file_info', { path: folderPath });
                modifiedDate = folderInfo.modified;
              } catch (error) {
                //                 console.warn(`无法获取文件夹信息: ${folderPath}`, error);
              }

              loadedWallpapers.push({
                id: folderId,
                workshopId,
                contentRating,
                name: name,
                image: imageUrl,
                path: folderPath,
                scenePkgPath: scenePkgPath,
                previewFound: !!imagePath,
                previewType: foundPreviewType,
                modifiedDate: modifiedDate
              });

            } catch (error) {
              // console.error(`处理文件夹 ${folderId} 时出错:`, error);
              // 即使没有预览文件也添加基本信息
              loadedWallpapers.push({
                id: folderId,
                workshopId,
                name: `壁纸 ${folderId}`,
                image: 'https://placehold.co/600x400/6B7280/FFFFFF?text=No+Preview',
                path: folderPath,
                previewFound: false,
                previewType: 'error'
              });
            }
          }

          // console.log(`成功加载 ${loadedWallpapers.length} 个壁纸（已筛选包含scene.pkg的文件）`, loadedWallpapers);

          if (loadVersion !== wallpaperLoadVersion) return;
          wallpapers = loadedWallpapers;
        } catch (error) {
          if (loadVersion !== wallpaperLoadVersion) return;
          wallpaperLoadStatus = 'error';
          document.getElementById('wallpaper-grid').innerHTML =
            `<div class="col-span-full flex flex-col items-center justify-center py-16">
              <svg class="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 class="text-lg font-semibold text-red-600 mb-2" data-i18n="extract.load_failed">加载失败</h3>
              <p class="text-sm text-gray-500 mb-4"></p>
              <button id="retry-wallpapers" type="button" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" data-i18n="buttons.reload">
                重新加载
              </button>
            </div>`;
          document.querySelector('#wallpaper-grid p').textContent = error?.message ?? String(error);
          document.getElementById('retry-wallpapers').addEventListener('click', loadSteamWorkshopWallpapers);
        }
      } else {
        // 如果不是在Tauri环境中，显示提示
        // console.warn('未在Tauri环境中运行，使用模拟数据');
        loadMockData();
      }
    } catch (error) {
      if (loadVersion === wallpaperLoadVersion) loadMockData();
    } finally {
      if (loadVersion === wallpaperLoadVersion && wallpaperLoadStatus !== 'error') {
        wallpaperLoadStatus = 'ready';
        applyCurrentSort();
        updateSortArrows();
        resetWallpaperPage();
      }
    }
  }

  function loadMockData() {
    // 保留一些模拟数据作为后备
    const mockWallpapers = [
      { id: 1, name: 'Cyberpunk Cityscape', image: 'https://placehold.co/600x400/000000/FFFFFF?text=Cyberpunk' },
      { id: 2, name: 'Peaceful Lake', image: 'https://placehold.co/600x400/3B82F6/FFFFFF?text=Lake' },
      { id: 3, name: 'Anime Girl Reading', image: 'https://placehold.co/600x400/EC4899/FFFFFF?text=Anime' },
    ];
    wallpapers = mockWallpapers;
  }

  // --- 页面导航逻辑 ---
  const navLinks = document.querySelectorAll('.nav-link');
  const pages = document.querySelectorAll('.page');

  // 页面滚动位置管理
  const pageScrollPositions = new Map();

  function saveCurrentPageScrollPosition() {
    const activePage = document.querySelector('.page.active');
    if (activePage) {
      pageScrollPositions.set(activePage.id, activePage.scrollTop);
    }
  }

  function restorePageScrollPosition(pageId) {
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      const savedPosition = pageScrollPositions.get(pageId) || 0;
      targetPage.scrollTop = savedPosition;
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.dataset.page;

      // 保存当前页面滚动位置
      saveCurrentPageScrollPosition();

      pages.forEach(page => page.classList.remove('active'));
      document.getElementById(pageId).classList.add('active');

      navLinks.forEach(nav => {
        nav.classList.remove('active');
        nav.removeAttribute('aria-current');
      });
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');

      // 恢复目标页面滚动位置
      setTimeout(() => {
        restorePageScrollPosition(pageId);
      }, 50);
    });
  });
  // 初始化首页高亮
  document.querySelector('.nav-link[data-page="home"]').click();


  // --- 首页逻辑 ---
  const wallpapersPerPage = 24;
  let wallpaperPage = 1;
  let wallpaperPageCount = 0;
  const homePage = document.getElementById('home');
  const wallpaperGrid = document.getElementById('wallpaper-grid');
  const wallpaperPagination = document.getElementById('wallpaper-pagination');
  const firstPage = document.getElementById('wallpaper-first-page');
  const previousPage = document.getElementById('wallpaper-prev-page');
  const nextPage = document.getElementById('wallpaper-next-page');
  const lastPage = document.getElementById('wallpaper-last-page');
  const pageIndicator = document.getElementById('wallpaper-page-indicator');
  const pageStatus = document.getElementById('wallpaper-page-status');
  const searchWallpapers = document.getElementById('search-wallpapers');
  const ratingCheckboxes = [...document.querySelectorAll('.content-rating-checkbox')];

  const wallpaperPreviewObserver = new IntersectionObserver((entries, observer) => {
    for (const { isIntersecting, target } of entries) {
      if (isIntersecting && target.isConnected) {
        observer.unobserve(target);
        loadWallpaperMedia(target);
      }
    }
  }, { rootMargin: '100px 0px', threshold: 0.1 });

  function updateWallpaperPageStatus() {
    const params = { page: wallpaperPage, pages: wallpaperPageCount };
    const text = window.i18n?.t('wallpapers.page', params);
    const pageNumber = `${wallpaperPage} / ${wallpaperPageCount}`;
    pageIndicator.textContent = pageNumber;
    pageStatus.textContent = text && text !== 'wallpapers.page' ? text : pageNumber;
  }

  function resetWallpaperPage() {
    wallpaperPage = 1;
    renderWallpaperGrid();
    homePage.scrollTop = 0;
  }

  searchWallpapers.addEventListener('input', resetWallpaperPage);
  document.getElementById('content-rating-dropdown').addEventListener('change', resetWallpaperPage);
  window.addEventListener('languageChanged', updateWallpaperPageStatus);

  for (const [button, destination] of [
    [firstPage, () => 1],
    [previousPage, () => wallpaperPage - 1],
    [nextPage, () => wallpaperPage + 1],
    [lastPage, () => wallpaperPageCount]
  ]) {
    button.addEventListener('click', () => {
      wallpaperPage = destination();
      renderWallpaperGrid();
      homePage.scrollTop = 0;
    });
  }

  function showLoadingAnimation() {
    wallpaperPreviewObserver.disconnect();
    wallpaperPagination.hidden = true;

    // 计算视口高度减去头部区域
    const viewportHeight = window.innerHeight;
    const headerHeight = 120; // 估算的头部高度 (h2 + padding)
    const availableHeight = viewportHeight - headerHeight;

    wallpaperGrid.innerHTML = `
      <div class="col-span-full flex items-center justify-center" style="min-height: ${availableHeight}px;">
        <div class="flex flex-col items-center text-center">
          <div class="relative">
            <!-- 主旋转图标 -->
            <svg class="w-20 h-20 animate-spin text-[var(--accent-color)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <!-- 装饰性圆环 -->
            <div class="absolute inset-0 rounded-full border-2 border-[var(--accent-color)] animate-ping opacity-20"></div>
            <!-- 额外装饰 -->
            <div class="absolute inset-0 rounded-full border-2 border-[var(--accent-color)] animate-ping opacity-10" style="animation-delay: 1s"></div>
          </div>
          <div class="mt-8">
            <br>
          </div>
        </div>
      </div>
    `;
  }

  function renderWallpaperGrid() {
    if (wallpaperLoadStatus !== 'ready') return;

    const searchTerm = searchWallpapers.value.trim().toLowerCase();
    const selectedRatings = ratingCheckboxes.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
    const filterByRating = selectedRatings.length > 0 && selectedRatings.length < ratingCheckboxes.length;
    const matchingIndexes = [];
    wallpapers.forEach((wallpaper, index) => {
      const matchesSearch = wallpaper.name.toLowerCase().includes(searchTerm) ||
        String(wallpaper.id).toLowerCase().includes(searchTerm) || wallpaper.workshopId?.includes(searchTerm);
      const matchesRating = !filterByRating || selectedRatings.includes(wallpaper.contentRating?.toLowerCase());
      if (matchesSearch && matchesRating) matchingIndexes.push(index);
    });

    wallpaperPreviewObserver.disconnect();
    wallpaperGrid.replaceChildren();
    wallpaperPageCount = Math.ceil(matchingIndexes.length / wallpapersPerPage);
    wallpaperPage = Math.max(1, Math.min(wallpaperPage, wallpaperPageCount));
    wallpaperPagination.hidden = wallpaperPageCount < 2;
    firstPage.disabled = previousPage.disabled = wallpaperPage === 1;
    lastPage.disabled = nextPage.disabled = wallpaperPage >= wallpaperPageCount;
    updateWallpaperPageStatus();

    if (matchingIndexes.length === 0) {
      const key = wallpapers.length ? 'wallpapers.no_matches' : 'extract.no_wallpapers';
      const text = window.i18n?.t(key);
      wallpaperGrid.innerHTML = `
        <div class="col-span-full text-center py-12">
          <svg class="mx-auto h-12 w-12 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-[var(--text-primary)]" data-i18n="${key}">${text && text !== key ? text : '未找到壁纸'}</h3>
          ${wallpapers.length ? '' : '<p class="mt-1 text-sm text-[var(--text-secondary)]" data-i18n="extract.ensure_path">请确保Steam创意工坊路径存在且包含壁纸文件</p>'}
        </div>
      `;
      return;
    }

    const start = (wallpaperPage - 1) * wallpapersPerPage;
    for (const index of matchingIndexes.slice(start, start + wallpapersPerPage)) {
      const wallpaper = wallpapers[index];
      const card = document.createElement('div');
      card.className = 'wallpaper-card group cursor-pointer';
      card.dataset.wallpaperId = wallpaper.id;
      card.dataset.index = index;
      card.dataset.scenePkgPath = wallpaper.scenePkgPath || '';
      card.dataset.wallpaperPath = wallpaper.path || '';

      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'aspect-square bg-[var(--bg-tertiary)] rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-105 relative';
      mediaContainer.innerHTML = `
        <div class="w-full h-full flex items-center justify-center text-[var(--text-secondary)]">
          <svg class="w-12 h-12 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-13 bg-gradient-to-t from-black/80 via-black/50 to-transparent flex items-start justify-center p-2">
          <p class="text-white text-sm font-medium text-center line-clamp-2 break-words w-full px-1 mt-2"></p>
        </div>
      `;

      mediaContainer.querySelector('p').textContent = wallpaper.name;
      card.appendChild(mediaContainer);
      card.addEventListener('click', () => openDrawer(wallpaper));
      wallpaperGrid.appendChild(card);
      wallpaperPreviewObserver.observe(card);
    }
  }

  function loadWallpaperMedia(card) {
    const wallpaper = wallpapers[Number(card.dataset.index)];
    const container = card.querySelector('.aspect-square');

    try {
      const isVideo = wallpaper.image.endsWith('.mp4') || wallpaper.image.endsWith('.webm');

      // 保留名称显示区域，只替换加载动画
      const loadingDiv = container.querySelector('.w-full.h-full.flex.items-center.justify-center');
      const nameOverlay = container.querySelector('.absolute.bottom-0');

      if (isVideo) {
        const video = document.createElement('video');
        video.src = wallpaper.image;
        video.className = 'w-full h-full object-cover';
        video.muted = true;
        video.loop = true;
        video.loading = 'lazy';

        card.addEventListener('mouseenter', () => video.play());
        card.addEventListener('mouseleave', () => video.pause());

        if (loadingDiv) loadingDiv.remove();
        container.insertBefore(video, nameOverlay);
      } else {
        const img = document.createElement('img');
        img.src = wallpaper.image;
        img.alt = wallpaper.name;
        img.className = 'w-full h-full object-cover';
        img.loading = 'lazy';
        img.onerror = () => {
          if (loadingDiv) loadingDiv.remove();
          const errorDiv = document.createElement('div');
          errorDiv.className = 'w-full h-full flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
          errorDiv.innerHTML = `
            <svg class="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          `;
          container.insertBefore(errorDiv, nameOverlay);
        };

        if (loadingDiv) loadingDiv.remove();
        container.insertBefore(img, nameOverlay);
      }
    } catch (error) {
      // console.error(`加载壁纸媒体失败: ${wallpaper.name}`, error);
    }
  }

  loadSteamWorkshopWallpapers();

  // --- 排序功能 ---

  function sortWallpapers(method) {
    // 如果切换了排序方法，重置新方法的排序顺序为升序
    if (currentSortMethod !== method) {
      sortOrders[method] = 'asc';
    } else {
      // 如果点击的是当前排序方法，切换排序方向
      sortOrders[method] = sortOrders[method] === 'asc' ? 'desc' : 'asc';
    }

    currentSortMethod = method;

    applyCurrentSort();
    updateSortArrows();
    resetWallpaperPage();
  }

  function applyCurrentSort() {
    // 根据当前排序方法应用排序
    if (currentSortMethod === 'name') {
      if (sortOrders.name === 'asc') {
        wallpapers.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        wallpapers.sort((a, b) => b.name.localeCompare(a.name));
      }
    } else if (currentSortMethod === 'date') {
      if (sortOrders.date === 'asc') {
        // 按文件夹修改日期正序排序（最旧的在前）
        wallpapers.sort((a, b) => {
          if (!a.modifiedDate || !b.modifiedDate) return 0;
          return new Date(a.modifiedDate) - new Date(b.modifiedDate);
        });
      } else {
        // 按文件夹修改日期倒序排序（最新的在前）
        wallpapers.sort((a, b) => {
          if (!a.modifiedDate || !b.modifiedDate) return 0;
          return new Date(b.modifiedDate) - new Date(a.modifiedDate);
        });
      }
    }
  }

  function updateSortArrows() {
    // 首先隐藏所有箭头
    const arrows = document.querySelectorAll('.sort-arrow');
    arrows.forEach(arrow => {
      arrow.classList.add('opacity-0');
    });

    // 根据当前排序方法和顺序显示相应的箭头
    if (currentSortMethod === 'name') {
      const arrow = document.getElementById('name-sort-arrow');
      if (arrow) {
        arrow.classList.remove('opacity-0');
        // 根据排序顺序设置箭头方向
        if (sortOrders.name === 'asc') {
          arrow.innerHTML = '↑';
        } else {
          arrow.innerHTML = '↓';
        }
      }
    } else if (currentSortMethod === 'date') {
      const arrow = document.getElementById('date-sort-arrow');
      if (arrow) {
        arrow.classList.remove('opacity-0');
        // 根据排序顺序设置箭头方向
        if (sortOrders.date === 'asc') {
          arrow.innerHTML = '↑';
        } else {
          arrow.innerHTML = '↓';
        }
      }
    }
  }

  // 为排序按钮添加事件监听器
  document.getElementById('sort-by-name').addEventListener('click', () => sortWallpapers('name'));

  document.getElementById('sort-by-date').addEventListener('click', () => sortWallpapers('date'));

  // --- 详情弹窗逻辑 ---
  const detailsDrawer = document.getElementById('details-drawer');
  const detailsBackdrop = document.getElementById('details-backdrop');
  const detailsImg = document.getElementById('details-img');
  const detailsName = document.getElementById('details-name');

  window.openDrawer = (wallpaper) => {
    // 存储当前选中的壁纸信息，供提取功能使用
    window.currentlySelectedWallpaper = wallpaper;

    detailsImg.src = wallpaper.image;
    detailsName.textContent = wallpaper.name;

    document.getElementById('details-workshop-id').textContent = wallpaper.workshopId || '—';
    const contentRating = document.getElementById('details-contentrating');
    const ratingKey = `content_rating.${wallpaper.contentRating?.toLowerCase()}`;
    const ratingText = window.i18n?.t(ratingKey);
    contentRating.textContent = ratingText && ratingText !== ratingKey ? ratingText : (wallpaper.contentRating || '');
    contentRating.hidden = !contentRating.textContent;
    detailsDrawer.scrollTop = 0;

    detailsDrawer.classList.add('open');
    detailsBackdrop.classList.remove('opacity-0', 'pointer-events-none');

    // 设置壁纸文件夹路径
    const folderPath = wallpaper.path;

    // 为打开文件夹按钮添加事件
    const openFolderBtn = document.getElementById('open-folder-btn');
    if (openFolderBtn) {
      openFolderBtn.onclick = async () => {
        try {
          const { invoke } = window.__TAURI__.core;
          // console.log('正在打开文件夹:', folderPath);

          // 确保路径格式正确（使用反斜杠）
          const normalizedPath = folderPath.replace(/\//g, '\\');
          // console.log('标准化路径:', normalizedPath);

          await invoke('open_folder', { path: normalizedPath });
        } catch (error) {
          // console.error('打开文件夹失败:', error);
          alert(window.i18n.t('messages.open_folder_error') + error);
        }
      };
    }
  }

  window.closeDrawer = () => {
    detailsDrawer.classList.remove('open');
    detailsBackdrop.classList.add('opacity-0', 'pointer-events-none');
  }

  // --- 提取功能 ---
  async function extractWallpaper(wallpaperPath, extractPath) {
    const extractBtn = document.getElementById('extract-btn');
    if (extractBtn.disabled) return;

    extractBtn.textContent = window.i18n.t('messages.extracting');
    extractBtn.disabled = true;
    try {
      const { invoke } = window.__TAURI__.core;
      const settings = await readExtractionSettings();
      const folderName = settingsManager.get('create-folder-per-wallpaper') === true
        ? wallpaperPath.split(/[/\\]/).filter(Boolean).pop()
        : null;
      const output = await invoke('extract_pkg', {
        input: wallpaperPath + '/scene.pkg',
        options: { ...settings, output: extractPath, folder_name: folderName }
      });
      await showExtractionResult(window.i18n.t('messages.extract_success'));
      await openExtractionFolder(output);
    } catch (error) {
      await showExtractionResult(window.i18n.t('messages.extract_failed') + error);
    } finally {
      extractBtn.textContent = window.i18n.t('buttons.extract_start');
      extractBtn.disabled = false;
    }
  }

  window.extractWallpaperFromMain = extractWallpaper;

  document.getElementById('extract-btn').addEventListener('click', async () => {
    const wallpaper = window.currentlySelectedWallpaper;
    if (!wallpaper) {
      alert(window.i18n.t('messages.no_wallpaper_selected'));
      return;
    }

    const extractPath = document.getElementById('extract-path').value.trim();
    if (!wallpaper.path || !extractPath) {
      alert(window.i18n.t('messages.empty_path'));
      return;
    }

    await extractWallpaper(wallpaper.path, extractPath);
  });

  document.getElementById('open-extract-folder-btn').addEventListener('click', async () => {
    const extractPathInput = document.getElementById('extract-path');
    const extractPath = extractPathInput.value;

    if (!extractPath) {
      alert(window.i18n.t('messages.set_extract_path_first'));
      return;
    }

    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core;
        // 确保路径格式正确（使用反斜杠）
        const normalizedPath = extractPath.replace(/\//g, '\\');
        await invoke('open_folder', { path: normalizedPath });
      }
    } catch (error) {
      // console.error('打开文件夹失败:', error);
      alert(window.i18n.t('messages.open_folder_error') + error);
    }
  });

  // 为详情页的导入壁纸编辑器按钮添加事件监听器
  document.getElementById('import-wallpaper-editor-btn').addEventListener('click', async () => {
    if (typeof importToWallpaperEditor === 'function') {
      await importToWallpaperEditor('detail');
    } else {
      alert(window.i18n.t('messages.wallpaper_editor_not_loaded'));
    }
  });

  // --- 主题切换逻辑 ---
  const themeButtons = document.querySelectorAll('.theme-btn');
  const rootHtml = document.documentElement;

  async function applyTheme(theme) {
    rootHtml.classList.remove('system', 'light', 'dark');
    rootHtml.classList.add(theme);
    await settingsManager.init();
    settingsManager.set('theme', theme);

    themeButtons.forEach(btn => {
      if (btn.dataset.theme === theme) {
        btn.style.backgroundColor = 'var(--accent-color)';
        btn.style.color = 'var(--accent-text)';
      } else {
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'var(--text-primary)';
      }
    });

    // 更新GitHub图标显示
    updateThemeIcons();

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      rootHtml.classList.toggle('dark', prefersDark);
      // 系统主题变化时也需要更新图标
      updateThemeIcons();
    }
  }

  // 更新主题图标显示
  function updateThemeIcons() {
    const isDark = rootHtml.classList.contains('dark');
    const lightIcons = document.querySelectorAll('.theme-icon-light');
    const darkIcons = document.querySelectorAll('.theme-icon-dark');

    lightIcons.forEach(icon => {
      icon.style.display = isDark ? 'none' : 'block';
    });

    darkIcons.forEach(icon => {
      icon.style.display = isDark ? 'block' : 'none';
    });
  }

  themeButtons.forEach(button => {
    button.addEventListener('click', async () => {
      await applyTheme(button.dataset.theme);
    });
  });

  // 初始化主题 - 延迟到样式加载完成后执行
  async function initializeThemeAfterLoad() {
    await settingsManager.init();
    const savedTheme = settingsManager.get('theme') || 'system';
    applyTheme(savedTheme);
    updateThemeIcons();
  }

  // 在样式加载完成后初始化主题
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThemeAfterLoad);
  } else {
    initializeThemeAfterLoad();
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    await settingsManager.init();
    if (settingsManager.get('theme') === 'system') {
      applyTheme('system');
    }
  });

  // --- 手动提取页逻辑 ---
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');

  function isPkgFile(name) {
    return /\.pkg$/i.test(name);
  }

  async function addManualPaths(paths) {
    const { invoke } = window.__TAURI__.core;
    const files = [];

    for (const path of paths) {
      if (!isPkgFile(path)) continue;
      const name = path.split(/[/\\]/).pop();
      let size = 0;
      try {
        const info = await invoke('get_file_info', { path });
        if (info.is_dir) continue;
        size = info.size;
      } catch {
        // Retain a selected file when optional size metadata is unavailable.
      }
      files.push({ name, path, size });
    }

    addManualFiles(files);
  }

  function addBrowserFiles(files) {
    addManualFiles(Array.from(files)
      .filter(file => isPkgFile(file.name))
      .map(file => ({ name: file.name, path: file.name, size: file.size })));
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });

  const manualWebview = window.__TAURI__?.webview?.getCurrentWebview();
  if (manualWebview) {
    let draggingPackages = false;
    manualWebview.onDragDropEvent(({ payload }) => {
      if (payload.type === 'leave') {
        draggingPackages = false;
        dropzone.classList.remove('is-drag-over');
        return;
      }

      if (payload.type === 'enter') {
        draggingPackages = payload.paths.some(isPkgFile);
      }
      const { x, y } = payload.position;
      const target = document.elementFromPoint(x / window.devicePixelRatio, y / window.devicePixelRatio);
      const overDropzone = dropzone.contains(target);
      const dropped = payload.type === 'drop';
      dropzone.classList.toggle('is-drag-over', !dropped && overDropzone && draggingPackages);

      if (dropped) {
        draggingPackages = false;
        if (overDropzone) void addManualPaths(payload.paths);
      }
    });
  } else if (!window.__TAURI__) {
    dropzone.addEventListener('dragover', event => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      dropzone.classList.add('is-drag-over');
    });
    dropzone.addEventListener('dragleave', event => {
      if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-drag-over');
    });
    dropzone.addEventListener('drop', event => {
      event.preventDefault();
      dropzone.classList.remove('is-drag-over');
      addBrowserFiles(event.dataTransfer.files);
    });
  }

  fileInput.addEventListener('click', async (event) => {
    event.preventDefault();

    try {
      if (window.__TAURI__) {
        const { open } = window.__TAURI__.dialog;
        const paths = await open({
          multiple: true,
          filters: [{ name: 'PKG Files', extensions: ['pkg'] }]
        });
        if (paths) await addManualPaths(Array.isArray(paths) ? paths : [paths]);
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pkg';
        input.multiple = true;
        input.addEventListener('change', () => addBrowserFiles(input.files));
        input.click();
      }
    } catch (error) {
      alert(window.i18n.t('messages.select_file_error') + error);
    }
  });

  function addManualFiles(files) {
    const knownPaths = new Set(manualFiles.map(file => file.path.replaceAll('\\', '/')));
    const addedFiles = [];
    for (const file of files) {
      const key = file.path.replaceAll('\\', '/');
      if (knownPaths.has(key)) continue;
      knownPaths.add(key);
      addedFiles.push(file);
    }
    if (addedFiles.length === 0) return;
    manualFiles = [...manualFiles, ...addedFiles];
    renderManualFiles();
  }

  function renderManualFiles() {
    fileList.replaceChildren();
    for (const file of manualFiles) {
      const fileItem = document.createElement('div');
      fileItem.className = 'flex items-center justify-between gap-2 p-2 settings-glass rounded-md text-sm';
      fileItem.innerHTML = `
        <div class="flex min-w-0 items-center">
          <button type="button" class="remove-file-btn shrink-0 mr-2 text-red-500 hover:text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
          <span class="truncate"></span>
        </div>
        <span class="shrink-0 text-[var(--text-secondary)]"></span>
      `;
      const [name, size] = fileItem.querySelectorAll('span');
      name.textContent = file.name;
      name.title = file.path;
      size.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

      fileItem.querySelector('button').addEventListener('click', () => {
        manualFiles = manualFiles.filter(item => item.path !== file.path);
        renderManualFiles();
      });
      fileList.appendChild(fileItem);
    }
  }

  // 初始化窗口控制
  setupWindowControls();

  // --- 创意工坊路径设置逻辑 ---
  const workshopPathInput = document.getElementById('workshop-path');
  const saveWorkshopPathBtn = document.getElementById('save-workshop-path');
  const browseWorkshopPathBtn = document.getElementById('browse-workshop-path');
  const currentWorkshopPath = document.getElementById('current-workshop-path');

  // 读取保存的路径
  async function loadWorkshopPath() {
    await settingsManager.init();
    const savedWorkshopPath = settingsManager.get('workshop-path');
    if (savedWorkshopPath && workshopPathInput) {
      workshopPathInput.value = savedWorkshopPath;
      if (currentWorkshopPath) {
        currentWorkshopPath.textContent = window.i18n.t('workshop.current_path') + savedWorkshopPath;
      }
    }
  }

  // 自动补全创意工坊路径
  async function autoCompleteWorkshopPath(basePath) {
    if (!basePath) return null;

    // 定义标准的创意工坊子路径
    const workshopSubPath = 'steamapps/workshop/content/431960';

    try {
      // 检查是否在Tauri环境中运行
      if (typeof window.__TAURI__ !== 'undefined') {
        const { invoke } = window.__TAURI__.core;

        // 标准化路径分隔符
        let normalizedBasePath = basePath.replace(/\\/g, '/').replace(/\/$/, '');

        // 如果基础路径本身已经是完整路径，直接返回
        if (basePath.includes('workshop/content/431960')) {
          return basePath;
        }

        // 检查用户输入的路径是否包含steamapps，但缺少后续部分
        if (normalizedBasePath.includes('steamapps')) {
          // 如果路径已经包含steamapps，尝试直接补全剩余部分
          const workshopFullPath = `${normalizedBasePath}/workshop/content/431960`;
          const exists = await invoke('check_file_exists', { path: workshopFullPath });
          if (exists) {
            return workshopFullPath;
          }

          // 如果steamapps后面还有内容，尝试清理并重新构建
          const steamappsIndex = normalizedBasePath.indexOf('steamapps');
          if (steamappsIndex !== -1) {
            const steamappsBase = normalizedBasePath.substring(0, steamappsIndex + 'steamapps'.length);
            const potentialPath = `${steamappsBase}/workshop/content/431960`;
            const potentialExists = await invoke('check_file_exists', { path: potentialPath });
            if (potentialExists) {
              return potentialPath;
            }
          }
        }

        // 尝试直接拼接的完整路径
        const fullPath = `${normalizedBasePath}/${workshopSubPath}`;
        const exists = await invoke('check_file_exists', { path: fullPath });
        if (exists) {
          return fullPath;
        }

        // 处理常见的Steam安装路径模式
        const pathPatterns = [
          // 直接路径
          `${normalizedBasePath}/${workshopSubPath}`,
          // SteamLibrary路径
          `${normalizedBasePath}/SteamLibrary/${workshopSubPath}`,
          `${normalizedBasePath}/steamapps/common/SteamLibrary/${workshopSubPath}`,
          // Program Files路径
          `${normalizedBasePath}/Program Files (x86)/Steam/${workshopSubPath}`,
          `${normalizedBasePath}/Program Files/Steam/${workshopSubPath}`,
          // 驱动器根目录下的Steam
          `${normalizedBasePath}/Steam/${workshopSubPath}`,
          // 如果输入的是驱动器字母，如C:、D:
          `${normalizedBasePath}/Steam/${workshopSubPath}`,
          `${normalizedBasePath}/Program Files (x86)/Steam/${workshopSubPath}`,
          // 检查SteamLibrary在其他驱动器
          `${normalizedBasePath}/SteamLibrary/steamapps/workshop/content/431960`
        ];

        // 去重路径
        const uniquePaths = [...new Set(pathPatterns)];

        for (const testPath of uniquePaths) {
          try {
            const exists = await invoke('check_file_exists', { path: testPath });
            if (exists) {
              return testPath;
            }
          } catch (e) {
            // 路径不存在，继续尝试下一个
            continue;
          }
        }

        // 特殊处理：如果用户输入了部分steamapps路径
        const steamappsVariants = [
          `${normalizedBasePath}/workshop/content/431960`,
          `${normalizedBasePath.replace(/steamapps.*$/, 'steamapps')}/workshop/content/431960`,
          `${normalizedBasePath.replace(/steamapps.*$/, 'steamapps/common')}/SteamLibrary/workshop/content/431960`
        ];

        for (const variantPath of steamappsVariants) {
          try {
            const exists = await invoke('check_file_exists', { path: variantPath });
            if (exists) {
              return variantPath;
            }
          } catch (e) {
            continue;
          }
        }

        // 如果没有找到，返回原始输入（保持兼容性）
        return basePath;
      }
    } catch (error) {
      // console.error('路径检测失败:', error);
    }

    return basePath;
  }

  // 保存路径按钮事件
  if (saveWorkshopPathBtn) {
    saveWorkshopPathBtn.addEventListener('click', async () => {
      let path = workshopPathInput.value.trim();
      if (path) {
        // 自动补全路径（静默补全，不弹窗）
        const completedPath = await autoCompleteWorkshopPath(path);
        if (completedPath !== path) {
          path = completedPath;
          workshopPathInput.value = path;
        }

        await settingsManager.init();
        settingsManager.set('workshop-path', path);
        if (currentWorkshopPath) {
          currentWorkshopPath.textContent = window.i18n.t('workshop.current_path', { path: path });
        }
        alert(window.i18n.t('messages.path_saved'));
        // 重新加载壁纸
        loadSteamWorkshopWallpapers();
      } else {
        alert(window.i18n.t('messages.enter_valid_path'));
      }
    });
  }

  // 浏览按钮事件
  if (browseWorkshopPathBtn) {
    browseWorkshopPathBtn.addEventListener('click', async () => {
      try {
        const { invoke } = window.__TAURI__.core;
        const selectedPath = await invoke('select_folder');
        if (selectedPath && workshopPathInput) {
          workshopPathInput.value = selectedPath;
        }
      } catch (error) {
        // console.error('选择文件夹失败:', error);
        alert(window.i18n.t('messages.select_folder_error') + error);
      }
    });
  }

  // 恢复默认按钮事件
  const restoreDefaultPathBtn = document.getElementById('restore-default-path');
  if (restoreDefaultPathBtn) {
    restoreDefaultPathBtn.addEventListener('click', () => {
      const defaultPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\431960';
      workshopPathInput.value = defaultPath;
      settingsManager.set('workshop-path', defaultPath);
      if (currentWorkshopPath) {
        currentWorkshopPath.textContent = window.i18n.t('workshop.current_path', { path: defaultPath });
      }
      alert(window.i18n.t('messages.path_restored'));
      // 重新加载壁纸
      loadSteamWorkshopWallpapers();
    });
  }

  // --- 解包设置逻辑 ---
  // 初始化解包设置
  async function initUnpackSettings() {
    const checkboxIds = {
      'only-images': 'only-images-checkbox',
      'no-tex-convert': 'no-tex-convert-checkbox',
      'ignore-dir-structure': 'ignore-dir-structure-checkbox',
      'overwrite-files': 'overwrite-files-checkbox',
      'create-folder-per-wallpaper': 'create-folder-per-wallpaper-checkbox',
      'auto-open-extract-folder': 'auto-open-extract-folder',
      'auto-open-import-folder': 'auto-open-import-folder'
    };

    await settingsManager.init();
    for (const [key, id] of Object.entries(checkboxIds)) {
      const checkbox = document.getElementById(id);
      checkbox.checked = settingsManager.get(key) === true;
      checkbox.addEventListener('change', () => settingsManager.set(key, checkbox.checked));
    }
  }

  initUnpackSettings();

  // 添加刷新按钮事件监听器
  const refreshButton = document.getElementById('refresh-wallpapers');
  if (refreshButton) {
    refreshButton.addEventListener('click', function () {
      const icon = refreshButton.querySelector('svg');

      // 添加旋转动画类
      icon.classList.add('refresh-icon-spinning');

      ratingCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
      });
      currentSortMethod = 'date';
      sortOrders.date = 'desc';

      loadSteamWorkshopWallpapers().finally(() => {
        // 动画完成后移除旋转类
        setTimeout(() => {
          icon.classList.remove('refresh-icon-spinning');
        }, 1000); // 等待1秒动画完成
      });
    });
  }
});

// --- 提取路径相关功能 ---

// 保存提取路径到settings.json
async function saveExtractPath(path) {
  if (path === undefined) {
    const extractPathInput = document.getElementById('extract-path');
    if (extractPathInput) {
      path = extractPathInput.value;
    }
  }
  await settingsManager.init();
  settingsManager.set('extract-path', path);
}

// 加载保存的提取路径
async function loadExtractPath() {
  const extractPathInput = document.getElementById('extract-path');
  if (extractPathInput) {
    await settingsManager.init();
    const savedPath = settingsManager.get('extract-path');
    if (savedPath) {
      extractPathInput.value = savedPath;
    } else {
      // 如果没有保存的路径，使用默认路径
      await setDefaultExtractPath();
    }
  }
}

// 初始化提取路径相关事件
async function initExtractPathEvents() {
  const changeExtractPathBtn = document.getElementById('change-extract-path');
  const restoreDefaultExtractPathBtn = document.getElementById('restore-default-extract-path');
  const extractPathInput = document.getElementById('extract-path');

  if (changeExtractPathBtn) {
    changeExtractPathBtn.addEventListener('click', async () => {
      try {
        const { invoke } = window.__TAURI__.core;
        const selectedPath = await invoke('select_folder');
        if (selectedPath && extractPathInput) {
          extractPathInput.value = selectedPath;
          await saveExtractPath(selectedPath);
        }
      } catch (error) {
        // console.error('选择文件夹失败:', error);
        alert(window.i18n.t('messages.select_folder_error') + error);
      }
    });
  }

  if (restoreDefaultExtractPathBtn) {
    restoreDefaultExtractPathBtn.addEventListener('click', async () => {
      await setDefaultExtractPath();
    });
  }

  if (extractPathInput) {
    extractPathInput.addEventListener('input', async () => {
      await saveExtractPath();
    });
  }
}

// 在 DOMContentLoaded 后初始化提取路径
document.addEventListener('DOMContentLoaded', async () => {
  await initExtractPathEvents();
  await loadExtractPath();
});

// 初始化手动提取页面的提取路径相关事件
async function initManualExtractPathEvents() {
  const changeExtractPathBtnManual = document.getElementById('change-extract-path-manual');
  const restoreDefaultExtractPathBtnManual = document.getElementById('restore-default-extract-path-manual');
  const extractPathInputManual = document.getElementById('extract-path-manual');

  if (changeExtractPathBtnManual) {
    changeExtractPathBtnManual.addEventListener('click', async () => {
      try {
        const { invoke } = window.__TAURI__.core;
        const selectedPath = await invoke('select_folder');
        if (selectedPath && extractPathInputManual) {
          extractPathInputManual.value = selectedPath;
          await saveManualExtractPath(selectedPath);
        }
      } catch (error) {
        // console.error('选择文件夹失败:', error);
        alert(window.i18n.t('messages.select_folder_error') + error);
      }
    });
  }

  if (restoreDefaultExtractPathBtnManual) {
    restoreDefaultExtractPathBtnManual.addEventListener('click', async () => {
      await setDefaultManualExtractPath();
    });
  }

  if (extractPathInputManual) {
    extractPathInputManual.addEventListener('input', async () => {
      await saveManualExtractPath();
    });
  }
}

// 设置默认手动提取路径
async function setDefaultManualExtractPath() {
  const extractPathInputManual = document.getElementById('extract-path-manual');
  if (!extractPathInputManual) return;

  try {
    if (window.__TAURI__) {
      const { invoke } = window.__TAURI__.core;
      const homeDir = await invoke('get_home_dir');
      // 确保homeDir末尾没有反斜杠，然后拼接路径
      const normalizedHomeDir = homeDir.replace(/\\$/, '');
      const defaultPath = `${normalizedHomeDir}\\Desktop\\RePKG-GUI`;
      extractPathInputManual.value = defaultPath;
      await saveManualExtractPath(defaultPath);
    } else {
      extractPathInputManual.value = 'C:\\RePKG-GUI';
    }
  } catch (error) {
    // console.error('设置默认路径失败:', error);
    extractPathInputManual.value = 'C:\\RePKG-GUI';
  }
}

// 保存手动提取路径到localStorage
async function saveManualExtractPath(path) {
  if (path === undefined) {
    const extractPathInputManual = document.getElementById('extract-path-manual');
    if (extractPathInputManual) {
      path = extractPathInputManual.value;
    }
  }
  await settingsManager.init();
  await settingsManager.set('extract-path-manual', path);
}

// 加载保存的手动提取路径
async function loadManualExtractPath() {
  const extractPathInputManual = document.getElementById('extract-path-manual');
  if (extractPathInputManual) {
    await settingsManager.init();
    const savedPath = await settingsManager.get('extract-path-manual');
    if (savedPath) {
      extractPathInputManual.value = savedPath;
    } else {
      await setDefaultManualExtractPath();
    }
  }
}

// 在 DOMContentLoaded 后初始化手动提取页面的提取路径
document.addEventListener('DOMContentLoaded', async () => {
  await initManualExtractPathEvents();
  await loadManualExtractPath();

  // 初始化手动提取页面的提取功能
  await initManualExtractFunction();

});

async function initManualExtractFunction() {
  const manualExtractBtn = document.getElementById('manual-extract-btn');
  const openManualExtractFolderBtn = document.getElementById('open-manual-extract-folder-btn');

  if (manualExtractBtn) {
    manualExtractBtn.addEventListener('click', async () => {
      const files = manualFiles;
      if (files.length === 0) {
        alert(window.i18n.t('messages.select_pkg_files'));
        return;
      }

      const extractPath = document.getElementById('extract-path-manual').value.trim();
      if (!extractPath) {
        alert(window.i18n.t('messages.enter_extract_path'));
        return;
      }

      manualExtractBtn.textContent = window.i18n.t('messages.extracting');
      manualExtractBtn.disabled = true;
      try {
        const { invoke } = window.__TAURI__.core;
        const settings = await readExtractionSettings();
        const separateFolders = settingsManager.get('create-folder-per-wallpaper') === true;
        const usedFolderNames = new Set();
        const outputs = new Set();
        let successCount = 0;
        let firstError;

        for (const file of files) {
          let folderName = null;
          if (separateFolders) {
            const stem = file.name.replace(/\.pkg$/i, '') || file.name;
            folderName = stem;
            for (let suffix = 1; settings.overwrite && usedFolderNames.has(folderName.toLowerCase()); suffix++) {
              folderName = stem + '_' + suffix;
            }
            usedFolderNames.add(folderName.toLowerCase());
          }

          try {
            const output = await invoke('extract_pkg', {
              input: file.path,
              options: { ...settings, output: extractPath, folder_name: folderName }
            });
            outputs.add(output);
            successCount++;
          } catch (error) {
            firstError ??= String(error);
          }
        }

        let message = window.i18n.t('messages.extract_complete', {
          success: successCount, error: files.length - successCount
        });
        if (firstError) {
          message += '\n' + window.i18n.t('messages.extract_failed') + firstError;
        }
        await showExtractionResult(message);
        const [output] = outputs;
        await openExtractionFolder(outputs.size > 1 ? extractPath : output);
      } catch (error) {
        await showExtractionResult(window.i18n.t('messages.extract_failed') + error);
      } finally {
        manualExtractBtn.textContent = window.i18n.t('buttons.extract_start');
        manualExtractBtn.disabled = false;
      }
    });
  }

  if (openManualExtractFolderBtn) {
    openManualExtractFolderBtn.addEventListener('click', async () => {
      const extractPathInput = document.getElementById('extract-path-manual');
      const extractPath = extractPathInput.value;

      if (!extractPath) {
        alert(window.i18n.t('messages.set_extract_path_first'));
        return;
      }

      try {
        if (window.__TAURI__) {
          const { invoke } = window.__TAURI__.core;
          const normalizedPath = extractPath.replace(/\\/g, '\\');
          await invoke('open_folder', { path: normalizedPath });
        }
      } catch (error) {
        // console.error('打开文件夹失败:', error);
        alert(window.i18n.t('messages.open_folder_error') + error);
      }
    });
  }
}

