(function () {
  'use strict';

  const NAV_ITEMS = [
    { view: 'calendar', href: '/index.html#calendar', icon: 'ph-duotone ph-calendar', label: 'Calendario' },
    { view: 'reserve', href: '/index.html#reserve', icon: 'bi bi-calendar-plus-fill', label: 'Nueva Reserva' },
    { view: 'my-reservations', href: '/index.html#my-reservations', icon: 'ph-duotone ph-list-checks', label: 'Mis Reservas' },
    { view: 'admin', href: '/index.html#admin', icon: 'ph-duotone ph-gear', label: 'Panel Admin', id: 'navAdmin', adminOnly: true },
    { view: 'reports', href: '/index.html#reports', icon: 'ph-duotone ph-chart-bar', label: 'Reportes', id: 'navReports', adminOnly: true },
  ];

  const THEME_KEY = 'theme';

  function getEffectiveTheme() {
    const pref = localStorage.getItem(THEME_KEY) || 'system';
    if (pref === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, animate = false) {
    document.documentElement.classList.add('theme-transitioning');
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('themeToggleBtn');
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

  function buildSidebar(isAdmin) {
    const items = NAV_ITEMS
      .filter(item => !item.adminOnly || isAdmin)
      .map(item => {
        const idAttr = item.id ? ` id="${item.id}"` : '';
        return `
        <li class="nav__item" data-view="${item.view}">
          <a href="${item.href}" class="nav__link"${idAttr}>
            <i class="${item.icon}"></i> ${item.label}
          </a>
        </li>`;
      }).join('');

    return `
    <header class="header header--sidebar">
      <div class="header__container">
        <h1 class="header__logo">Reserva <span class="header__logo--accent">De Laboratorios</span></h1>
        <nav class="nav" id="mainNav">
          <ul class="nav__list">
            ${items}
            <div class="nav__indicator" id="navIndicator"></div>
          </ul>
        </nav>
      </div>
    </header>`;
  }

  function buildTopbar() {
    return `
    <header class="topbar">
      <div class="topbar__actions" id="topbarActions">
        <button class="btn btn--icon" id="themeToggleBtn" type="button" title="Alternar tema">
          <i class="ph-duotone ph-moon"></i>
        </button>
        <a href="/index.html#settings" class="btn btn--icon" id="navSettingsIconBtn" title="Ajustes">
          <i class="ph-duotone ph-gear"></i>
        </a>
        <button class="btn" id="logoutBtn" type="button">
          <i class="ph-duotone ph-sign-out" style="margin-right:0.4rem;font-size:1.1rem;"></i> Salir
        </button>
      </div>
    </header>`;
  }

  async function injectShell() {
    if (!API.getToken()) {
      window.location.href = '/';
      return;
    }

    let user = null;
    try {
      user = await API.getProfile();
    } catch (_) {
      window.location.href = '/';
      return;
    }

    const isAdmin = user && user.role === 'admin';

    const sidebarSlot = document.getElementById('shell-sidebar');
    if (sidebarSlot) sidebarSlot.outerHTML = buildSidebar(isAdmin);

    const topbarSlot = document.getElementById('shell-topbar');
    if (topbarSlot) topbarSlot.outerHTML = buildTopbar();

    applyTheme(getEffectiveTheme());

    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next, true);
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      API.setToken(null);
      window.location.href = '/';
    });

    window.__shellUser = user;
    document.dispatchEvent(new CustomEvent('shell:ready', { detail: { user } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectShell);
  } else {
    injectShell();
  }
})();