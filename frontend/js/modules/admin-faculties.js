(function(App) {
  'use strict';

  async function loadFaculties(page = 1) {
    App.State.adminFacultiesPage = page;
    const list = document.getElementById('adminFacultiesList');
    if (!list) return;

    const btn = document.getElementById('addFacultyBtn');
    if (btn) {
      btn.removeEventListener('click', navigateToFacultyEditorCreate);
      btn.addEventListener('click', navigateToFacultyEditorCreate);
    }

    list.innerHTML = '<div class="loading">Cargando facultades...</div>';
    try {
      const facs = await API.getFaculties();
      App.State.faculties = facs;
      renderAdminFacultiesList(facs, page);
    } catch (err) {
      list.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function renderAdminFacultiesList(facs, page = 1) {
    const list = document.getElementById('adminFacultiesList');
    if (!list) return;

    if (!Array.isArray(facs) || facs.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay facultades.</div>';
      return;
    }

    const itemsPerPage = 10;
    const totalPages = Math.ceil(facs.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (safePage - 1) * itemsPerPage;
    const pageData = facs.slice(startIdx, startIdx + itemsPerPage);

    let html = '';
    pageData.forEach((fac) => {
      html += `
        <div class="admin-item">
          <div class="admin-item__info">
            <div class="admin-item__title">${fac.name}</div>
          </div>
          <div class="admin-item__actions">
            <button class="btn btn--outline btn--sm" onclick="App.Router.navigateToFacultyEditor('${fac.id}')">
              <i class="bi bi-pencil"></i> Editar
            </button>
          </div>
        </div>
      `;
    });

    if (totalPages > 1) {
      html += '<div class="pagination" style="margin-top: 1rem;">';
      html += `<button class="pagination__btn" ${safePage === 1 ? 'disabled' : ''} onclick="App.AdminFaculties.loadFaculties(${safePage - 1})">Anterior</button>`;
      html += `<span class="pagination__info">Página ${safePage} de ${totalPages}</span>`;
      html += `<button class="pagination__btn" ${safePage === totalPages ? 'disabled' : ''} onclick="App.AdminFaculties.loadFaculties(${safePage + 1})">Siguiente</button>`;
      html += '</div>';
    }

    list.innerHTML = html;
  }

  function navigateToFacultyEditorCreate() {
    App.Router.navigateToFacultyEditor(null);
  }

  App.Router.navigateToFacultyEditor = function(id) {
    window.location.hash = id ? '#faculty-editor/' + encodeURIComponent(id) : '#faculty-editor';
  };

  App.AdminFaculties = {
    loadFaculties,
    renderAdminFacultiesList
  };

})(window.App = window.App || {});
