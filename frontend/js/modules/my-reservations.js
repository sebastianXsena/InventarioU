(function(App) {
  'use strict';

  async function loadMyReservations() {
    const list = document.getElementById('myReservationsList');
    if (!list) return;
    list.innerHTML = '<div class="loading">Cargando tus reservas...</div>';
    try {
      const res = await API.getMyReservations();
      renderMyReservationsPage(res, 1);
    } catch (err) {
      list.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function renderMyReservationsPage(reservations, page = 1) {
    const list = document.getElementById('myReservationsList');
    if (!list) return;

    if (!Array.isArray(reservations) || reservations.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          No has realizado ninguna reserva.<br>
          <button class="btn btn--primary" style="margin-top: 1rem;" onclick="App.Router.navigateTo('reserve')">
            Hacer una reserva
          </button>
        </div>`;
      return;
    }

    const itemsPerPage = 6;
    const totalPages = Math.ceil(reservations.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (safePage - 1) * itemsPerPage;
    const pageData = reservations.slice(startIdx, startIdx + itemsPerPage);

    let html = '<div class="reservations-grid">';
    pageData.forEach((r) => {
      html += renderReservationCard(r, true);
    });
    html += '</div>';

    if (totalPages > 1) {
      html += '<div class="pagination">';
      html += `<button class="pagination__btn" ${safePage === 1 ? 'disabled' : ''} data-page="${safePage - 1}">Anterior</button>`;
      html += `<span class="pagination__info">Página ${safePage} de ${totalPages}</span>`;
      html += `<button class="pagination__btn" ${safePage === totalPages ? 'disabled' : ''} data-page="${safePage + 1}">Siguiente</button>`;
      html += '</div>';
    }

    list.innerHTML = html;

    list.querySelectorAll('.pagination__btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        renderMyReservationsPage(reservations, parseInt(btn.dataset.page, 10));
      });
    });

    attachReservationActions(list);
  }

  function translateStatus(s) {
    const map = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      cancelled: 'Cancelada',
      completed: 'Completada',
    };
    return map[s] || s;
  }

  function renderReservationCard(r, showActions = false) {
    const statusText = translateStatus(r.status);
    const safeName = (r.lab_name || 'Desconocido').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const startDt = new Date(r.start_time);
    const endDt = new Date(r.end_time);

    let datesHtml = `<div>N/A</div>`;
    if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
      const dateStr = startDt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = `${startDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${endDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
      datesHtml = `
        <div class="reservation-card__date"><i class="bi bi-calendar3"></i> ${dateStr}</div>
        <div class="reservation-card__time"><i class="bi bi-clock"></i> ${timeStr}</div>
      `;
    }

    let html = `
      <div class="reservation-card">
        <div class="reservation-card__header">
          <h3 class="reservation-card__title">${safeName}</h3>
          <span class="status-badge status-badge--${r.status}">${statusText}</span>
        </div>
        <div class="reservation-card__body">
          ${datesHtml}
        </div>
    `;

    if (showActions && (r.status === 'pending' || r.status === 'approved')) {
      html += `
        <div class="reservation-card__footer">
          <button class="btn btn--danger btn--sm btn--cancel-res" data-id="${r.id}">
            <i class="ph ph-x-circle"></i> Cancelar Reserva
          </button>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  function attachReservationActions(container) {
    container.querySelectorAll('.btn--cancel-res').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const ok = await App.UI.showConfirm('¿Estás seguro de cancelar esta reserva?', 'Cancelar Reserva');
        if (!ok) return;

        try {
          await API.cancelReservation(id);
          App.UI.showAlert('Reserva cancelada correctamente', 'Éxito');
          loadMyReservations();
        } catch (err) {
          App.UI.showAlert(App.UI.getFriendlyErrorMessage(err, { action: 'cancel', entity: 'reservation' }), 'Error al cancelar');
        }
      });
    });
  }

  function init() {
    loadMyReservations();
  }

  App.MyReservations = {
    loadMyReservations,
    renderReservationCard,
    translateStatus,
    init
  };

})(window.App = window.App || {});
