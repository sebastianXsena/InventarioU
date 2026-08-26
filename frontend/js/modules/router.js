(function(App) {
  'use strict';

  const viewCache = {};

  function updateNavIndicator() {
    const activeItem = document.querySelector('.header--sidebar .nav__item .nav__link--active');
    const indicator = document.getElementById('navIndicator');
    if (!activeItem || !indicator) return;

    const navList = document.querySelector('.header--sidebar .nav__list');
    if (!navList) return;

    const activeRect = activeItem.getBoundingClientRect();
    const listRect = navList.getBoundingClientRect();

    indicator.style.top = `${activeRect.top - listRect.top}px`;
    indicator.style.height = `${activeRect.height}px`;
    indicator.style.opacity = '1';
  }

  async function showView(viewId, paramId = null) {
    const targetId = `${viewId}View`;
    const appMain = document.getElementById('appMain');
    
    if (!viewCache[viewId]) {
      try {
        const res = await fetch(`/templates/${viewId}.html`);
        if (res.ok) {
          viewCache[viewId] = await res.text();
        } else {
          console.error(`Failed to load view ${viewId}`);
          return;
        }
      } catch (err) {
        console.error(`Error loading view ${viewId}`, err);
        return;
      }
    }

    appMain.innerHTML = viewCache[viewId];

    // After injecting HTML, initialize the module logic
    if (viewId === 'calendar' && App.Calendar) App.Calendar.init();
    if (viewId === 'reserve' && App.Reserve) App.Reserve.init();
    if (viewId === 'my-reservations' && App.MyReservations) App.MyReservations.init();
    if (viewId === 'admin' && App.Admin) App.Admin.init();
    if (viewId === 'reports' && App.Reports) App.Reports.init();
    if (viewId === 'settings' && App.Auth) App.Auth.initSettings();
    if (viewId === 'login' && App.Auth) App.Auth.initLogin();
    if (viewId === 'lab-editor' && App.LabEditor) App.LabEditor.init(paramId);
    if (viewId === 'item-editor' && App.ItemEditor) App.ItemEditor.init(paramId);
    if (viewId === 'faculty-editor' && App.FacultyEditor) App.FacultyEditor.init(paramId);
    if (viewId === 'program-editor' && App.ProgramEditor) App.ProgramEditor.init(paramId);

    document.querySelectorAll('.nav__link').forEach((l) => l.classList.remove('nav__link--active'));
    const activeLink = document.querySelector(`.nav__item[data-view="${viewId}"] .nav__link`);
    if (activeLink) activeLink.classList.add('nav__link--active');
    requestAnimationFrame(updateNavIndicator);
  }

  async function applyRoute(view, params = {}) {
    await showView(view, params.paramId);
    
    if (view === 'calendar' && App.Calendar) App.Calendar.loadCalendar();
    if (view === 'my-reservations' && App.MyReservations) App.MyReservations.loadMyReservations();
    if (view === 'admin' && App.Admin) {
      const returnTab = sessionStorage.getItem('adminReturnTab');
      const tab = returnTab || (params && params.tab) || 'labs';
      sessionStorage.setItem('adminReturnTab', tab);
      App.Admin.selectAdminTab(tab);
    }
    if (view === 'settings' && App.Auth) App.Auth.loadSettings();
  }

  function navigateTo(view) {
    const nextHash = `#${view}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      applyRoute(view);
    }
  }

  function parseHashRoute() {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return { view: null, paramId: null };
    let cleaned = raw;
    try { cleaned = decodeURIComponent(cleaned); } catch (_) {}
    cleaned = cleaned.trim().replace(/^\//, '').split('?')[0];
    const parts = cleaned.split('/').filter(Boolean);
    return { view: parts[0] || null, paramId: parts[1] || null };
  }

  function routeOnLoadOrHashChange() {
    const route = parseHashRoute();
    const requested = route.view;
    const loggedIn = !!API.getToken();
    const isAdmin = App.State.currentUser && App.State.currentUser.role === 'admin';
    const roleUnknown = loggedIn && !App.State.currentUser;

    if (!loggedIn) {
      applyRoute('login');
      return;
    }

    const allowed = new Set(['calendar', 'reserve', 'my-reservations', 'admin', 'reports', 'settings', 'lab-editor', 'item-editor', 'faculty-editor', 'program-editor']);
    let view = allowed.has(requested) ? requested : 'calendar';
    if ((view === 'admin' || view === 'reports' || view.endsWith('-editor')) && !isAdmin && !roleUnknown) {
      view = 'calendar';
    }

    applyRoute(view, { paramId: route.paramId });
  }

  function updateNav() {
    const loggedIn = !!API.getToken();
    const isAdmin = App.State.currentUser && App.State.currentUser.role === 'admin';

    document.querySelector('.layout')?.classList.toggle('layout--auth', !loggedIn);

    document.querySelectorAll('[data-view]').forEach((item) => {
      const view = item.dataset.view;
      if (!loggedIn) {
        item.classList.toggle('nav__item--hidden', view !== 'login');
      } else {
        if (view === 'login') {
          item.classList.add('nav__item--hidden');
        } else if (view === 'admin' || view === 'reports') {
          item.classList.toggle('nav__item--hidden', !isAdmin);
        } else {
          item.classList.remove('nav__item--hidden');
        }
      }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    const themeBtn = document.getElementById('themeToggleBtn');
    const settingsBtn = document.getElementById('navSettingsIconBtn');
    
    if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    if (themeBtn) themeBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    if (settingsBtn) settingsBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    
    requestAnimationFrame(updateNavIndicator);
  }

  App.Router = {
    updateNavIndicator,
    showView,
    applyRoute,
    navigateTo,
    parseHashRoute,
    routeOnLoadOrHashChange,
    updateNav
  };

})(window.App = window.App || {});
