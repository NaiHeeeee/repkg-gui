// 内容评级筛选模块

// 内容评级数据缓存
const contentRatingCache = new Map();

// 获取壁纸的内容评级
async function getWallpaperContentRating(wallpaper) {
  // 如果已经缓存，直接返回
  if (contentRatingCache.has(wallpaper.id)) {
    return contentRatingCache.get(wallpaper.id);
  }
  
  try {
    const { invoke } = window.__TAURI__.core;
    const projectJsonPath = `${wallpaper.path}/project.json`;
    const projectData = await invoke('read_json_file', { path: projectJsonPath });
    
    let contentRating = null;
    if (projectData && projectData.contentrating) {
      contentRating = projectData.contentrating.toLowerCase();
    }
    
    // 缓存结果
    contentRatingCache.set(wallpaper.id, contentRating);
    return contentRating;
  } catch (error) {
    // 读取失败时缓存null
    contentRatingCache.set(wallpaper.id, null);
    return null;
  }
}

// 初始化内容评级筛选功能
function initContentRatingFilter() {
  const filterBtn = document.getElementById('content-rating-filter-btn');
  const dropdown = document.getElementById('content-rating-dropdown');
  const checkboxes = document.querySelectorAll('.content-rating-checkbox');
  
  if (!filterBtn || !dropdown) return;
  
  // 默认全选所有内容评级选项
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  
  // 切换下拉菜单显示/隐藏
  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    
    // 切换箭头旋转效果
    const arrow = document.getElementById('content-rating-arrow');
    if (arrow) {
      if (dropdown.classList.contains('hidden')) {
        arrow.classList.remove('rotate-180');
      } else {
        arrow.classList.add('rotate-180');
      }
    }
  });
  
  // 点击其他地方关闭下拉菜单
  document.addEventListener('click', () => {
    if (!dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
      
      // 恢复箭头原状
      const arrow = document.getElementById('content-rating-arrow');
      if (arrow) {
        arrow.classList.remove('rotate-180');
      }
    }
  });
  
  // 阻止下拉菜单内部点击事件冒泡
  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // 监听复选框变化
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      applyContentRatingFilter();
    });
  });
}

// 应用内容评级筛选
async function applyContentRatingFilter() {
  const checkboxes = document.querySelectorAll('.content-rating-checkbox');
  const selectedRatings = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  
  const wallpaperCards = document.querySelectorAll('.wallpaper-card');
  const searchTerm = document.getElementById('search-wallpapers')?.value.toLowerCase().trim() || '';
  
  wallpaperCards.forEach(async (card) => {
    const wallpaperId = card.dataset.wallpaperId;
    const wallpaperName = card.querySelector('.text-white.text-sm.font-medium')?.textContent.toLowerCase() || '';
    
    // 搜索条件匹配
    const matchesSearch = searchTerm === '' || 
                         wallpaperName.includes(searchTerm) || 
                         wallpaperId?.toLowerCase().includes(searchTerm);
    
    // 如果没有选择任何内容评级，只应用搜索筛选
    if (selectedRatings.length === 0) {
      card.style.display = matchesSearch ? 'block' : 'none';
      return;
    }
    
    // 获取壁纸数据
    const wallpaperIndex = parseInt(card.dataset.index);
    const wallpaper = wallpapers[wallpaperIndex];
    
    if (!wallpaper) {
      card.style.display = 'none';
      return;
    }
    
    // 获取内容评级
    const contentRating = await getWallpaperContentRating(wallpaper);
    
    // 内容评级筛选条件匹配
    const matchesContentRating = contentRating && selectedRatings.includes(contentRating);
    
    // 同时满足搜索和内容评级条件才显示
    card.style.display = (matchesSearch && matchesContentRating) ? 'block' : 'none';
  });
}

// 更新内容评级下拉菜单背景色
function updateContentRatingDropdownBackground(isDark) {
  const contentRatingDropdown = document.getElementById('content-rating-dropdown');
  if (contentRatingDropdown) {
    if (isDark) {
      contentRatingDropdown.style.backgroundColor = 'rgba(75, 85, 99, 0.95)';
      contentRatingDropdown.style.borderColor = 'rgba(107, 114, 128, 0.3)';
    } else {
      contentRatingDropdown.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
      contentRatingDropdown.style.borderColor = 'rgba(229, 231, 235, 0.8)';
    }
  }
}

// 清空内容评级缓存
function clearContentRatingCache() {
  contentRatingCache.clear();
}

// 重置内容评级筛选复选框为默认全选
function resetContentRatingCheckboxes() {
  const checkboxes = document.querySelectorAll('.content-rating-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
}

// 导出函数供其他模块使用
window.contentRatingFilter = {
  init: initContentRatingFilter,
  apply: applyContentRatingFilter,
  updateBackground: updateContentRatingDropdownBackground,
  clearCache: clearContentRatingCache,
  resetCheckboxes: resetContentRatingCheckboxes,
  getWallpaperContentRating: getWallpaperContentRating
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化内容评级筛选功能
  initContentRatingFilter();
  
  // 初始化内容评级下拉菜单背景色
  const isDark = document.documentElement.classList.contains('dark');
  updateContentRatingDropdownBackground(isDark);
});