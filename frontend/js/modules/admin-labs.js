(function(App) {
  'use strict';

  async function loadAdminLabs() {
    const list = document.getElementById('adminLabsList');
    if (!list) return;
    list.innerHTML = '<div class="loading">Cargando laboratorios...</div>';
    try {
      App.State.labs = await API.getLabs();
      renderAdminLabs();
    } catch (err) {
      list.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function renderAdminLabs() {
    const list = document.getElementById('adminLabsList');
    if (!list) return;

    const btn = document.getElementById('addLabBtn');
    if (btn) {
      btn.removeEventListener('click', navigateToLabEditorCreate);
      btn.addEventListener('click', navigateToLabEditorCreate);
    }

    if (!Array.isArray(App.State.labs) || App.State.labs.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay laboratorios registrados.</div>';
      return;
    }

    const html = App.State.labs.map((lab) => `
      <div class="admin-item">
        <div class="admin-item__info">
          <div class="admin-item__title" style="display: flex; align-items: center; gap: 0.5rem;">
            ${lab.name}
            <span class="status-badge status-badge--${lab.status === 'active' ? 'completed' : (lab.status === 'maintenance' ? 'pending' : 'rejected')}">
              ${lab.status === 'active' ? 'Activo' : (lab.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo')}
            </span>
          </div>
          <div class="admin-item__meta">
             Capacidad: ${lab.capacity} | ${lab.location}
          </div>
        </div>
        <div class="admin-item__actions">
          <button class="btn btn--outline btn--sm" onclick="App.Router.navigateToLabEditor('${lab.id}')"><i class="bi bi-pencil"></i> Editar</button>
        </div>
      </div>
    `).join('');

    list.innerHTML = html;
  }

  function navigateToLabEditorCreate() {
    App.Router.navigateToLabEditor(null);
  }

  // To be used by the router
  App.Router.navigateToLabEditor = function(labId) {
    window.location.hash = labId ? '#lab-editor/' + labId : '#lab-editor';
  };

  App.AdminLabs = {
    loadAdminLabs,
    renderAdminLabs
  };

})(window.App = window.App || {});
