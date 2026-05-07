// ============================================================================
// UI MODULE - Gestión de interfaz y componentes
// ============================================================================

class UIManager {
  // ========== NAVEGACIÓN ==========
  showPage(pageName) {
    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('page--active');
    });

    // Mostrar página seleccionada
    const page = document.getElementById(`${pageName}-page`);
    if (page) {
      page.classList.add('page--active');
    }

    // Actualizar links de navegación
    document.querySelectorAll('.navbar__link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.page === pageName) {
        link.classList.add('active');
      }
    });
  }

  updateNavbar(user) {
    const userName = document.getElementById('user-name');
    const adminLink = document.getElementById('admin-link');

    if (user) {
      userName.textContent = user.name;
      if (user.role === 'admin') {
        adminLink.style.display = 'block';
      } else {
        adminLink.style.display = 'none';
      }
    }
  }

  // ========== FORMULARIOS ==========
  toggleAuthForms(showLogin = true) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginToggle = document.getElementById('login-toggle');
    const registerToggle = document.getElementById('register-toggle');

    if (showLogin) {
      loginForm.classList.add('form--active');
      registerForm.classList.remove('form--active');
      loginToggle.classList.add('auth-toggle__btn--active');
      registerToggle.classList.remove('auth-toggle__btn--active');
    } else {
      loginForm.classList.remove('form--active');
      registerForm.classList.add('form--active');
      loginToggle.classList.remove('auth-toggle__btn--active');
      registerToggle.classList.add('auth-toggle__btn--active');
    }
  }

  // ========== TOAST NOTIFICATIONS ==========
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast__close">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast__close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  // ========== MODAL ==========
  openModal(content) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = content;
    modal.classList.add('modal--active');
  }

  closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('modal--active');
  }

  // ========== RENDERING ==========
  renderReservationItem(reservation) {
    const statusClass = `badge--${reservation.status === 'approved' ? 'success' : reservation.status === 'pending' ? 'pending' : 'danger'}`;
    const statusText = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      cancelled: 'Cancelada',
      completed: 'Completada',
    }[reservation.status] || reservation.status;

    return `
      <div class="reservation-item">
        <div class="reservation-item__info">
          <div class="reservation-item__laboratory">${reservation.lab_id}</div>
          <div class="reservation-item__date">
            ${new Date(reservation.start_time).toLocaleString('es-ES')}
          </div>
          <div style="margin-top: 8px; font-size: 0.875rem; color: #6b7280;">
            ${reservation.items?.length || 0} material(es)
          </div>
        </div>
        <div class="reservation-item__actions">
          <span class="badge ${statusClass}">${statusText}</span>
          ${reservation.status === 'pending' ? `
            <button class="btn btn--sm btn--danger js-cancel-reservation" data-id="${reservation.id}">
              Cancelar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderLaboratoryCard(lab) {
    const statusClass = lab.status === 'active' ? 'laboratory-card__status--active' : 'laboratory-card__status--maintenance';
    const statusText = lab.status === 'active' ? 'Activo' : 'Mantenimiento';

    return `
      <div class="laboratory-card js-lab-card" data-lab-id="${lab.id}">
        <div class="laboratory-card__header">
          <div class="laboratory-card__name">${lab.name}</div>
          <div class="laboratory-card__location">📍 ${lab.location}</div>
        </div>
        <div class="laboratory-card__body">
          <div class="laboratory-card__info">
            <span class="laboratory-card__capacity">👥 ${lab.capacity} lugares</span>
            <span class="laboratory-card__status ${statusClass}">${statusText}</span>
          </div>
          <p style="font-size: 0.875rem; color: #6b7280; margin: 8px 0;">
            ${lab.description || 'Sin descripción'}
          </p>
          <button class="btn btn--primary" style="width: 100%; margin-top: 8px;" 
                  onclick="ui.showPage('create-reservation')">
            Reservar
          </button>
        </div>
      </div>
    `;
  }

  renderTable(data, columns) {
    let html = '<table class="table"><thead class="table__header"><tr>';

    // Headers
    columns.forEach(col => {
      html += `<th class="table__header-cell">${col.label}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Rows
    data.forEach(row => {
      html += '<tr class="table__row">';
      columns.forEach(col => {
        const value = col.render ? col.render(row) : row[col.key];
        html += `<td class="table__cell">${value}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
  }

  // ========== ADMIN ==========
  showAdminTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.admin-tab, .admin-content').forEach(el => {
      if (el.classList.contains('admin-tab')) {
        el.classList.remove('admin-tab--active');
      } else {
        el.classList.remove('admin-content--active');
      }
    });

    // Mostrar tab seleccionado
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    const content = document.getElementById(`${tabName}-tab`);

    if (tab) tab.classList.add('admin-tab--active');
    if (content) content.classList.add('admin-content--active');
  }

  // ========== LOADING STATES ==========
  showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = '<p class="text--muted">Cargando...</p>';
    }
  }

  showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = `<p class="text--muted">❌ ${message}</p>`;
    }
  }

  showEmpty(elementId, message = 'Sin datos') {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = `<p class="text--muted">${message}</p>`;
    }
  }
}

// Instancia global
const ui = new UIManager();
