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

const cleanRoutes = {
  'accessibility.html': '/accessibility',
  'contact.html': '/contact',
  'cookie-policy.html': '/cookie-policy',
  'dashboard.html': '/dashboard',
  'download.html': '/download',
  'forgot-password.html': '/forgot-password',
  'index.html': '/',
  'login.html': '/login',
  'privacy-policy.html': '/privacy-policy',
  'reset-password.html': '/reset-password',
  'signup.html': '/signup',
  'terms-of-service.html': '/terms-of-service'
};

document.querySelectorAll('a[href]').forEach((link) => {
  const [path, suffix = ''] = link.getAttribute('href').split(/([?#].*)/, 2);
  if (cleanRoutes[path]) link.setAttribute('href', `${cleanRoutes[path]}${suffix}`);
});
