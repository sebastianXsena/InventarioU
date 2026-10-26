(function(App) {
  'use strict';

  function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        selectAdminTab(e.currentTarget.dataset.adminTab);
      });
    });
  }

  function selectAdminTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('admin-tab--active'));
    document.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('admin-panel--hidden'));

    const tabEl = document.querySelector(`.admin-tab[data-admin-tab="${tabId}"]`);
    const panelEl = document.getElementById(`admin${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);

    if (tabEl) tabEl.classList.add('admin-tab--active');
    if (panelEl) panelEl.classList.remove('admin-panel--hidden');

    if (tabId === 'pending') loadPendingReservations();
    else if (tabId === 'all') loadAllReservations();
    else if (tabId === 'labs' && App.AdminLabs) App.AdminLabs.loadAdminLabs();
    else if (tabId === 'items' && App.AdminItems) App.AdminItems.loadAdminItems();
    else if (tabId === 'faculties' && App.AdminFaculties) App.AdminFaculties.loadFaculties();
    else if (tabId === 'programs' && App.AdminPrograms) App.AdminPrograms.loadPrograms();
  }

  let adminPendingPage = 1;
  let adminAllPage = 1;
  let adminAllStatusFilter = '';
  let adminAllLabFilter = '';
  let cachedPending = [];
  let cachedAll = [];

  async function loadPendingReservations() {
    const list = document.getElementById('pendingList');
    if (!list) return;
    list.innerHTML = '<div class="loading">Cargando pendientes...</div>';
    try {
      cachedPending = await API.getReservations({ status: 'pending' });
      renderPendingReservationsPage(1);
    } catch (err) {
      list.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function renderPendingReservationsPage(page = 1) {
    adminPendingPage = page;
    const list = document.getElementById('pendingList');
    if (!list) return;

    if (!Array.isArray(cachedPending) || cachedPending.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay reservas pendientes.</div>';
      return;
    }

    const itemsPerPage = 6;
    const totalPages = Math.ceil(cachedPending.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (safePage - 1) * itemsPerPage;
    const pageData = cachedPending.slice(startIdx, startIdx + itemsPerPage);

    let html = '<div class="reservations-grid">';
    pageData.forEach((r) => { html += renderAdminReservationItem(r, true); });
    html += '</div>';

    if (totalPages > 1) {
      html += '<div class="pagination">';
      html += `<button class="pagination__btn" ${safePage === 1 ? 'disabled' : ''} onclick="App.AdminReservations.renderPendingReservationsPage(${safePage - 1})">Anterior</button>`;
      html += `<span class="pagination__info">Página ${safePage} de ${totalPages}</span>`;
      html += `<button class="pagination__btn" ${safePage === totalPages ? 'disabled' : ''} onclick="App.AdminReservations.renderPendingReservationsPage(${safePage + 1})">Siguiente</button>`;
      html += '</div>';
    }

    list.innerHTML = html;
    attachAdminActions(list, true);
  }

  async function loadAllReservations() {
    const list = document.getElementById('allReservationsList');
    if (!list) return;

    if (!document.getElementById('allReservationsFilters')) {
      const filterHtml = `
        <div id="allReservationsFilters" class="form-row" style="margin-bottom: 1.5rem;">
          <div class="form-group form-group--col">
            <select class="form-select" id="allResStatusFilter">
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
              <option value="cancelled">Cancelada</option>
              <option value="completed">Completada</option>
            </select>
          </div>
          <div class="form-group form-group--col">
            <select class="form-select" id="allResLabFilter">
              <option value="">Todos los laboratorios</option>
              ${(App.State.labs || []).map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="allReservationsContent"></div>
      `;
      list.innerHTML = filterHtml;

      document.getElementById('allResStatusFilter').value = adminAllStatusFilter;
      document.getElementById('allResLabFilter').value = adminAllLabFilter;

      document.getElementById('allResStatusFilter').addEventListener('change', (e) => {
        adminAllStatusFilter = e.target.value;
        fetchAndRenderAll();
      });
      document.getElementById('allResLabFilter').addEventListener('change', (e) => {
        adminAllLabFilter = e.target.value;
        fetchAndRenderAll();
      });
    }

    fetchAndRenderAll();
  }

  async function fetchAndRenderAll() {
    const content = document.getElementById('allReservationsContent');
    if (!content) return;
    content.innerHTML = '<div class="loading">Cargando reservas...</div>';
    try {
      const filters = {};
      if (adminAllStatusFilter) filters.status = adminAllStatusFilter;
      if (adminAllLabFilter) filters.lab_id = adminAllLabFilter;

      cachedAll = await API.getReservations(filters);
      renderAllReservationsPage(1);
    } catch (err) {
      content.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function renderAllReservationsPage(page = 1) {
    adminAllPage = page;
    const content = document.getElementById('allReservationsContent');
    if (!content) return;

    if (!Array.isArray(cachedAll) || cachedAll.length === 0) {
      content.innerHTML = '<div class="empty-state">No se encontraron reservas con los filtros actuales.</div>';
      return;
    }

    const itemsPerPage = 6;
    const totalPages = Math.ceil(cachedAll.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (safePage - 1) * itemsPerPage;
    const pageData = cachedAll.slice(startIdx, startIdx + itemsPerPage);

    let html = '<div class="reservations-grid">';
    pageData.forEach((r) => { html += renderAdminReservationItem(r, false); });
    html += '</div>';

    if (totalPages > 1) {
      html += '<div class="pagination">';
      html += `<button class="pagination__btn" ${safePage === 1 ? 'disabled' : ''} onclick="App.AdminReservations.renderAllReservationsPage(${safePage - 1})">Anterior</button>`;
      html += `<span class="pagination__info">Página ${safePage} de ${totalPages}</span>`;
      html += `<button class="pagination__btn" ${safePage === totalPages ? 'disabled' : ''} onclick="App.AdminReservations.renderAllReservationsPage(${safePage + 1})">Siguiente</button>`;
      html += '</div>';
    }

    content.innerHTML = html;
    attachAdminActions(content, false);
  }

  function renderAdminReservationItem(r, showPendingActions = false) {
    const startDt = new Date(r.start_time);
    const endDt = new Date(r.end_time);

    let datesHtml = `<div>N/A</div>`;
    if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
      const dateStr = startDt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = `${startDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${endDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
      datesHtml = `
        <div class="reservation-card__date"><i class="bi bi-calendar3"></i> ${dateStr}</div>
        <div class="reservation-card__time"><i class="bi bi-clock"></i> ${timeStr}</div>
      `;
    }

    const itemsHtml = (r.items && r.items.length > 0)
      ? `<div class="reservation-card__items">
          <strong>Materiales:</strong>
          <ul>${r.items.map(i => `<li>${i.quantity_used}x ${i.item_name}</li>`).join('')}</ul>
         </div>`
      : '';

    let html = `
      <div class="reservation-card">
        <div class="reservation-card__header">
          <h3 class="reservation-card__title">${(r.lab_name || 'Lab').replace(/</g, '&lt;')}</h3>
          <span class="status-badge status-badge--${r.status}">${App.MyReservations.translateStatus(r.status)}</span>
        </div>
        <div class="reservation-card__body">
          <div class="reservation-card__user"><i class="bi bi-person"></i> ${r.user_name || 'Usuario'}</div>
          ${datesHtml}
          ${itemsHtml}
          ${r.notes ? `<div class="reservation-card__notes"><i class="bi bi-card-text"></i> ${r.notes.replace(/</g, '&lt;')}</div>` : ''}
        </div>
    `;

    if (showPendingActions && r.status === 'pending') {
      html += `
        <div class="reservation-card__footer">
          <button class="btn btn--success btn--sm btn--approve" data-id="${r.id}">
            <i class="ph ph-check-circle"></i> Aprobar
          </button>
          <button class="btn btn--danger btn--sm btn--reject" data-id="${r.id}">
            <i class="ph ph-x-circle"></i> Rechazar
          </button>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  function attachAdminActions(container, isPendingTab) {
    container.querySelectorAll('.btn--approve').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        try {
          await API.approveReservation(id, 'approved');
          App.UI.showAlert('Reserva aprobada', 'Éxito');
          if (isPendingTab) loadPendingReservations();
          else fetchAndRenderAll();
        } catch (err) {
          App.UI.showAlert(App.UI.getFriendlyErrorMessage(err), 'Error');
        }
      });
    });

    container.querySelectorAll('.btn--reject').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const ok = await App.UI.showConfirm('¿Rechazar esta reserva?', 'Rechazar');
        if (!ok) return;
        try {
          await API.approveReservation(id, 'rejected');
          App.UI.showAlert('Reserva rechazada', 'Éxito');
          if (isPendingTab) loadPendingReservations();
          else fetchAndRenderAll();
        } catch (err) {
          App.UI.showAlert(App.UI.getFriendlyErrorMessage(err), 'Error');
        }
      });
    });
  }

  function init() {
    initTabs();
  }

  App.AdminReservations = {
    loadPendingReservations,
    loadAllReservations,
    renderPendingReservationsPage,
    renderAllReservationsPage,
    init
  };

  App.Admin = {
    initTabs,
    selectAdminTab,
    init: function() {
      initTabs();
    }
  };

})(window.App = window.App || {});
