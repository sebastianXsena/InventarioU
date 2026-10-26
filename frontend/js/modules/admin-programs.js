(function(App) {
  'use strict';

  async function loadPrograms(page = 1) {
    App.State.adminProgramsPage = page;
    const list = document.getElementById('adminProgramsList');
    if (!list) return;

    const btn = document.getElementById('addProgramBtn');
    if (btn) {
      btn.removeEventListener('click', navigateToProgramEditorCreate);
      btn.addEventListener('click', navigateToProgramEditorCreate);
    }

    list.innerHTML = '<div class="loading">Cargando programas...</div>';
    try {
      const progs = await API.getPrograms();
      App.State.programs = progs;
      renderAdminProgramsList(progs, page);
    } catch (err) {
      list.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function renderAdminProgramsList(progs, page = 1) {
    const list = document.getElementById('adminProgramsList');
    if (!list) return;

    if (!Array.isArray(progs) || progs.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay programas.</div>';
      return;
    }

    const itemsPerPage = 10;
    const totalPages = Math.ceil(progs.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (safePage - 1) * itemsPerPage;
    const pageData = progs.slice(startIdx, startIdx + itemsPerPage);

    let html = '';
    pageData.forEach((prog) => {
      const facName = prog.faculty_name || 'Sin Facultad';
      html += `
        <div class="admin-item">
          <div class="admin-item__info">
            <div class="admin-item__title">${prog.name}</div>
            <div class="admin-item__meta">Facultad: <strong>${facName}</strong></div>
          </div>
          <div class="admin-item__actions">
            <button class="btn btn--outline btn--sm" onclick="App.Router.navigateToProgramEditor('${prog.id}')">
              <i class="bi bi-pencil"></i> Editar
            </button>
          </div>
        </div>
      `;
    });

    if (totalPages > 1) {
      html += '<div class="pagination" style="margin-top: 1rem;">';
      html += `<button class="pagination__btn" ${safePage === 1 ? 'disabled' : ''} onclick="App.AdminPrograms.loadPrograms(${safePage - 1})">Anterior</button>`;
      html += `<span class="pagination__info">Página ${safePage} de ${totalPages}</span>`;
      html += `<button class="pagination__btn" ${safePage === totalPages ? 'disabled' : ''} onclick="App.AdminPrograms.loadPrograms(${safePage + 1})">Siguiente</button>`;
      html += '</div>';
    }

    list.innerHTML = html;
  }

  function navigateToProgramEditorCreate() {
    App.Router.navigateToProgramEditor(null);
  }

  App.Router.navigateToProgramEditor = function(id) {
    window.location.hash = id ? '#program-editor/' + encodeURIComponent(id) : '#program-editor';
  };

  App.AdminPrograms = {
    loadPrograms,
    renderAdminProgramsList
  };

})(window.App = window.App || {});
