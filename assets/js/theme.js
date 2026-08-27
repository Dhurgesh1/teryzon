const THEME_KEY = 'teryzon-theme-preference';
const themeModes = ['system', 'light', 'dark'];

const getStoredTheme = () => {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return themeModes.includes(storedTheme) ? storedTheme : 'system';
};

const resolveTheme = (theme) => theme === 'system'
  ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  : theme;

const applyTheme = (theme = getStoredTheme()) => {
  const resolvedTheme = resolveTheme(theme);
  document.body.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.theme = resolvedTheme;
  const themeControl = document.querySelector('#theme-control');
  if (themeControl) {
    if (themeControl.matches('select')) {
      themeControl.value = theme;
    } else {
      themeControl.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.checked = input.value === theme;
      });
    }
    themeControl.setAttribute('aria-label', `Theme: ${theme}`);
  }
};

const setTheme = (theme) => {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
};

applyTheme();

const themeControl = document.querySelector('#theme-control');
if (themeControl) {
  themeControl.addEventListener('change', (event) => setTheme(event.target.value));
}

const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
if (typeof mediaQuery.addEventListener === 'function') {
  mediaQuery.addEventListener('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  });
}
