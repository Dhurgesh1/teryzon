(() => {
  const key = 'teryzon-theme-preference';
  const stored = localStorage.getItem(key);
  const theme = ['system', 'light', 'dark'].includes(stored) ? stored : 'system';
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.theme = resolved;
})();
