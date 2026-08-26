(function() {
  'use strict';

  function init() {
    App.Theme.init();

    // Global listeners
    window.addEventListener('hashchange', App.Router.routeOnLoadOrHashChange);
    document.querySelectorAll('.nav__link').forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = e.currentTarget.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const view = href.substring(1);
          App.Router.navigateTo(view);
        }
      });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', App.Auth.handleLogout);

    const checkAuthAndRoute = async () => {
      if (API.getToken()) {
        try {
          App.State.currentUser = await API.getProfile();
        } catch (err) {
          API.setToken(null);
          App.State.currentUser = null;
        }
      }
      App.Router.updateNav();
      App.Router.routeOnLoadOrHashChange();
    };

    checkAuthAndRoute();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
