const repository = 'naiheeeee/repkg-gui';
const releaseApi = `https://api.github.com/repos/${repository}/releases/latest`;
const versionLabel = document.getElementById('app-version');
const checkButton = document.getElementById('check-for-updates');
const status = document.getElementById('update-check-status');
const releaseLink = document.getElementById('update-release-link');
const installedVersion = readInstalledVersion();
let statusMessage;

async function readInstalledVersion() {
  try {
    const version = await window.__TAURI__?.app?.getVersion?.();
    if (version) versionLabel.textContent = `v${version}`;
  } catch {
    // The version in the About card is also filled in by the release build.
  }
  return versionLabel.textContent.trim();
}

function isNewerVersion(tag, installed) {
  const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)$/i;
  const latest = versionPattern.exec(tag);
  const current = versionPattern.exec(installed);
  if (!latest || !current) throw new Error('Invalid release or installed version');

  for (let part = 1; part <= 3; part++) {
    const difference = Number(latest[part]) - Number(current[part]);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function renderStatus() {
  if (statusMessage && window.i18n) {
    status.textContent = window.i18n.t(statusMessage.key, statusMessage.params);
  }
}

function setStatus(key, params) {
  statusMessage = { key: `about.${key}`, params };
  renderStatus();
}

window.addEventListener('languageChanged', renderStatus);

checkButton.addEventListener('click', async () => {
  checkButton.disabled = true;
  releaseLink.hidden = true;
  releaseLink.removeAttribute('href');
  setStatus('checking_updates');

  try {
    const tag = await fetchReleaseTag();
    const current = await installedVersion;

    if (isNewerVersion(tag, current)) {
      const latest = `v${tag.replace(/^v/i, '')}`;
      showReleaseLink(`tag/${encodeURIComponent(tag)}`);
      setStatus('update_available', { current, latest });
    } else {
      setStatus('no_update', { current });
    }
  } catch {
    showReleaseLink('latest');
    setStatus('update_failed');
  } finally {
    checkButton.disabled = false;
  }
});

function showReleaseLink(release) {
  releaseLink.href = `https://github.com/${repository}/releases/${release}`;
  releaseLink.hidden = false;
}

async function fetchReleaseTag() {
  const core = window.__TAURI__?.core;
  if (core) {
    try {
      const tag = await core.invoke('get_latest_release_tag');
      if (typeof tag === 'string' && tag) return tag;
    } catch {
      // Fall back to the REST API if the release page cannot be reached.
    }
  }

  const response = await fetch(releaseApi, {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`GitHub Releases returned ${response.status}`);
  const { tag_name: tag } = await response.json();
  return tag;
}

releaseLink.addEventListener('click', async event => {
  const core = window.__TAURI__?.core;
  if (!core) return;

  event.preventDefault();
  const url = releaseLink.href;
  try {
    await core.invoke('open_shell', { path: url });
  } catch {
    if (!releaseLink.hidden && releaseLink.href === url) setStatus('release_open_failed');
  }
});
