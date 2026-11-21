let notificationQueue = Promise.resolve();

function showNotification(message, { titleKey = 'messages.notification_title', duration = 0 } = {}) {
  notificationQueue = notificationQueue.then(() => new Promise(resolve => {
    const dialog = document.getElementById('app-notification');
    const title = document.getElementById('app-notification-title');
    const translatedTitle = window.i18n?.t(titleKey);
    title.dataset.i18n = titleKey;
    title.textContent = translatedTitle && translatedTitle !== titleKey
      ? translatedTitle
      : (titleKey === 'messages.extract_result' ? '提取结果' : '提示');
    document.getElementById('app-notification-message').textContent = message;

    dialog.showModal();
    const closeTimer = duration > 0 ? window.setTimeout(() => dialog.close(), duration) : null;
    dialog.addEventListener('close', () => {
      window.clearTimeout(closeTimer);
      resolve();
    }, { once: true });
  }));
  return notificationQueue;
}
