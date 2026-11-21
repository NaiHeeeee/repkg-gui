// 内容评级筛选模块

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

}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化内容评级筛选功能
  initContentRatingFilter();
});