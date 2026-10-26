(function(App) {
  'use strict';

  const THEME_KEY = 'theme'; // 'system' | 'light' | 'dark'
  const getThemePref = () => localStorage.getItem(THEME_KEY) || 'system';
  const setThemePref = (pref) => localStorage.setItem(THEME_KEY, pref);

  function getEffectiveTheme(pref = getThemePref()) {
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (pref === 'system') return systemDark ? 'dark' : 'light';
    return pref === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, animate = false) {
    document.documentElement.classList.add('theme-transitioning');
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    
    // We use App.UI.$ instead of direct querySelector to maintain consistency if loaded later
    const btn = document.querySelector('#themeToggleBtn');
    if (btn) {
      if (animate) {
        btn.className = 'btn btn--icon theme-toggle--spin-out';
        setTimeout(() => {
          btn.innerHTML = theme === 'dark'
            ? '<i class="ph-duotone ph-sun"></i>'
            : '<i class="ph-duotone ph-moon"></i>';
          btn.className = 'btn btn--icon theme-toggle--spin-in';
          setTimeout(() => {
            btn.className = 'btn btn--icon';
          }, 300);
        }, 220);
      } else {
        btn.innerHTML = theme === 'dark'
          ? '<i class="ph-duotone ph-sun"></i>'
          : '<i class="ph-duotone ph-moon"></i>';
      }
    }
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 420);
  }

  function initTheme() {
    applyTheme(getEffectiveTheme());

    const btn = document.querySelector('#themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = getEffectiveTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        setThemePref(next);
        applyTheme(next, true);
      });
    }

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (getThemePref() === 'system') applyTheme(getEffectiveTheme('system'));
      };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
      else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    }
  }

  App.Theme = {
    init: initTheme,
    applyTheme,
    getEffectiveTheme
  };

})(window.App = window.App || {});
