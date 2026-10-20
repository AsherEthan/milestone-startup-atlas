const STORAGE_KEY = 'milestone-theme-v1';
const choices = ['light', 'dark', 'system'];

export function initializeTheme(onChange, notify) {
  const root = document.documentElement;
  const query = matchMedia('(prefers-color-scheme: dark)');
  const select = document.querySelector('#theme-selector');
  let preference = root.dataset.themePreference || 'system';
  if (!choices.includes(preference)) preference = 'system';
  function apply() {
    const resolved = preference === 'system' ? (query.matches ? 'dark' : 'light') : preference;
    const changed = root.dataset.theme !== resolved;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    select.value = preference;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#101c17' : '#f5f6f0');
    if (changed) {
      onChange(resolved);
      window.dispatchEvent(new CustomEvent('theme-change', { detail: resolved }));
    }
  }
  select.addEventListener('change', () => {
    preference = choices.includes(select.value) ? select.value : 'system';
    apply();
    try { localStorage.setItem(STORAGE_KEY, preference); }
    catch { notify('主题已切换；浏览器未能保存偏好，本次会话仍然有效'); }
  });
  query.addEventListener('change', () => { if (preference === 'system') apply(); });
  apply();
  return { get mode() { return root.dataset.theme; } };
}
