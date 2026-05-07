// ============================================================================
// MAIN APP - Orquestador principal
// ============================================================================

class App {
  constructor() {
    this.init();
  }

  async init() {
    console.log('🚀 Inicializando aplicación...');

    // Esperar a que se cargue el usuario
    await auth.loadUser();

    // Renderizar interfaz inicial
    if (auth.isAuthenticated()) {
      this.showMainApp();
    } else {
      this.showAuthPage();
    }

    // Configurar event listeners
    this.setupEventListeners();
  }

  showAuthPage() {
    ui.showPage('auth');
  }

  async showMainApp() {
    ui.updateNavbar(auth.getCurrentUser());
    ui.showPage('dashboard');
    await this.loadDashboardData();
  }

  // ========== EVENT LISTENERS ==========
  setupEventListeners() {
    // Auth
    document.getElementById('login-toggle')?.addEventListener('click', () => {
      ui.toggleAuthForms(true);
    });

    document.getElementById('register-toggle')?.addEventListener('click', () => {
      ui.toggleAuthForms(false);
    });

    document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('register-form')?.addEventListener('submit', (e) => this.handleRegister(e));
    document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

    // Navegación
    document.querySelectorAll('.js-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.dataset.page;
        if (page) {
          ui.showPage(page);
          this.loadPageData(page);
        }
      });
    });

    // Modal
    document.querySelectorAll('.js-close-modal').forEach(btn => {
      btn.addEventListener('click', () => ui.closeModal());
    });

    // Reserva
    document.getElementById('create-reservation-form')?.addEventListener('submit', (e) => this.handleCreateReservation(e));

    // Admin tabs
    document.querySelectorAll('.js-admin-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        ui.showAdminTab(tabName);
        this.loadAdminTabData(tabName);
      });
    });
  }

  // ========== AUTH HANDLERS ==========
  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      await auth.login(email, password);
      ui.showToast('✅ Iniciaste sesión correctamente', 'success');
      this.showMainApp();
      document.getElementById('login-form').reset();
    } catch (error) {
      ui.showToast(`❌ ${error.message}`, 'error');
    }
  }

  async handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
      await auth.register(name, email, password);
      ui.showToast('✅ Cuenta creada correctamente', 'success');
      this.showMainApp();
      document.getElementById('register-form').reset();
    } catch (error) {
      ui.showToast(`❌ ${error.message}`, 'error');
    }
  }

  handleLogout() {
    auth.logout();
    ui.showToast('👋 Sesión cerrada', 'info');
    this.showAuthPage();
  }

  // ========== DATA LOADING ==========
  async loadDashboardData() {
    try {
      // Cargar reservas del usuario
      const reservations = await api.getMyReservations(5, 0);
      const pending = reservations.data.filter(r => r.status === 'pending').length;
      const approved = reservations.data.filter(r => r.status === 'approved').length;

      // Cargar laboratorios activos
      const labs = await api.getActiveLaboratories(10, 0);

      // Actualizar estadísticas
      document.getElementById('stat-reservations').textContent = reservations.data.length;
      document.getElementById('stat-approved').textContent = approved;
      document.getElementById('stat-pending').textContent = pending;
      document.getElementById('stat-labs').textContent = labs.data.length;

      // Mostrar próximas reservas
      const upcomingContainer = document.getElementById('upcoming-reservations');
      if (reservations.data.length > 0) {
        upcomingContainer.innerHTML = reservations.data
          .filter(r => r.status === 'approved')
          .slice(0, 5)
          .map(r => ui.renderReservationItem(r))
          .join('');
      } else {
        ui.showEmpty('upcoming-reservations', '📭 Sin reservas próximas');
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  }

  async loadPageData(page) {
    switch (page) {
      case 'reservations':
        await this.loadReservationsPage();
        break;
      case 'laboratories':
        await this.loadLaboratoriesPage();
        break;
      case 'create-reservation':
        await this.loadCreateReservationPage();
        break;
      case 'admin':
        await this.loadAdminPage();
        break;
    }
  }

  async loadReservationsPage() {
    ui.showLoading('reservations-list');

    try {
      const result = await api.getMyReservations(20, 0);
      const container = document.getElementById('reservations-list');

      if (result.data.length > 0) {
        container.innerHTML = result.data.map(r => ui.renderReservationItem(r)).join('');

        // Agregar event listeners para cancelaciones
        document.querySelectorAll('.js-cancel-reservation').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const reservationId = e.target.dataset.id;
            if (confirm('¿Estás seguro de que deseas cancelar esta reserva?')) {
              try {
                await api.cancelReservation(reservationId);
                ui.showToast('✅ Reserva cancelada', 'success');
                await this.loadReservationsPage();
              } catch (error) {
                ui.showToast(`❌ ${error.message}`, 'error');
              }
            }
          });
        });
      } else {
        ui.showEmpty('reservations-list', '📭 No tienes reservas');
      }
    } catch (error) {
      ui.showError('reservations-list', error.message);
    }
  }

  async loadLaboratoriesPage() {
    ui.showLoading('laboratories-grid');

    try {
      const result = await api.getActiveLaboratories(10, 0);
      const container = document.getElementById('laboratories-grid');

      if (result.data.length > 0) {
        container.innerHTML = result.data.map(lab => ui.renderLaboratoryCard(lab)).join('');
      } else {
        ui.showEmpty('laboratories-grid', '🏢 No hay laboratorios disponibles');
      }
    } catch (error) {
      ui.showError('laboratories-grid', error.message);
    }
  }

  async loadCreateReservationPage() {
    try {
      // Cargar laboratorios
      const labs = await api.getActiveLaboratories(10, 0);
      const labSelect = document.getElementById('res-lab');

      labSelect.innerHTML = '<option value="">Seleccionar laboratorio...</option>' +
        labs.data.map(lab => `<option value="${lab.id}">${lab.name}</option>`).join('');

      // Event listener para cambios de laboratorio
      labSelect.addEventListener('change', async (e) => {
        const labId = e.target.value;
        if (labId) {
          await this.loadItemsForLaboratory(labId);
        }
      });
    } catch (error) {
      ui.showToast(`❌ ${error.message}`, 'error');
    }
  }

  async loadItemsForLaboratory(labId) {
    try {
      const result = await api.getItemsByLaboratory(labId, 10, 0);
      const container = document.getElementById('items-container');

      if (result.data.length > 0) {
        container.innerHTML = result.data
          .map(item => `
            <div class="item-entry">
              <div>
                <div class="item-entry__label">${item.name}</div>
                <div style="font-size: 0.875rem; color: #6b7280;">
                  Disponible: ${item.available_stock}/${item.total_stock}
                </div>
              </div>
              <input type="number" 
                     min="0" 
                     max="${item.available_stock}" 
                     value="0" 
                     class="item-quantity"
                     data-item-id="${item.id}"
                     data-item-name="${item.name}">
            </div>
          `)
          .join('');
      } else {
        ui.showEmpty('items-container', 'Sin materiales disponibles');
      }
    } catch (error) {
      ui.showError('items-container', error.message);
    }
  }

  async handleCreateReservation(e) {
    e.preventDefault();

    const labId = document.getElementById('res-lab').value;
    const startTime = document.getElementById('res-start').value;
    const endTime = document.getElementById('res-end').value;


    // Recopilar items
    const items = [];
    document.querySelectorAll('.item-quantity').forEach(input => {
      const quantity = parseInt(input.value) || 0;
      if (quantity > 0) {
        items.push({
          item_id: input.dataset.itemId,
          quantity_requested: quantity,
        });
      }
    });

    if (!labId || !startTime || !endTime) {
      ui.showToast('❌ Por favor completa todos los campos', 'warning');
      return;
    }

    try {
      await api.createReservation({
        labId: labId,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        items,
      });

      ui.showToast('✅ Reserva creada correctamente', 'success');
      ui.showPage('reservations');
      await this.loadReservationsPage();
      document.getElementById('create-reservation-form').reset();
    } catch (error) {
      ui.showToast(`❌ ${error.message}`, 'error');
    }
  }

  async loadAdminPage() {
    if (!auth.isAdmin()) {
      ui.showToast('❌ No tienes acceso a esta sección', 'error');
      ui.showPage('dashboard');
      return;
    }

    // Mostrar tabs de admin
    document.querySelectorAll('.js-admin-tab').forEach(tab => {
      tab.style.display = 'block';
    });

    // Cargar primer tab por defecto
    ui.showAdminTab('requests');
    await this.loadAdminTabData('requests');
  }

  async loadAdminTabData(tabName) {
    switch (tabName) {
      case 'requests':
        await this.loadPendingRequests();
        break;
    }
  }

  async loadPendingRequests() {
    ui.showLoading('pending-requests');

    try {
      const result = await api.getAllReservations(20, 0);
      const pending = result.data.filter(r => r.status === 'pending');
      const container = document.getElementById('pending-requests');

      if (pending.length > 0) {
        const columns = [
          { key: 'id', label: 'ID', render: (row) => row.id.substring(0, 8) + '...' },
          { key: 'user_id', label: 'Usuario', render: (row) => row.user_id.substring(0, 8) + '...' },
          { key: 'start_time', label: 'Fecha', render: (row) => new Date(row.start_time).toLocaleString('es-ES') },
          {
            key: 'actions',
            label: 'Acciones',
            render: (row) => `
              <div style="display: flex; gap: 8px;">
                <button class="btn btn--sm btn--success js-approve-req" data-id="${row.id}">Aprobar</button>
                <button class="btn btn--sm btn--danger js-reject-req" data-id="${row.id}">Rechazar</button>
              </div>
            `,
          },
        ];

        container.innerHTML = ui.renderTable(pending, columns);

        // Event listeners
        document.querySelectorAll('.js-approve-req').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            try {
              await api.approveReservation(e.target.dataset.id);
              ui.showToast('✅ Reserva aprobada', 'success');
              await this.loadAdminTabData('requests');
            } catch (error) {
              ui.showToast(`❌ ${error.message}`, 'error');
            }
          });
        });

        document.querySelectorAll('.js-reject-req').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const reason = prompt('Motivo del rechazo:');
            if (reason) {
              try {
                await api.rejectReservation(e.target.dataset.id, reason);
                ui.showToast('✅ Reserva rechazada', 'success');
                await this.loadAdminTabData('requests');
              } catch (error) {
                ui.showToast(`❌ ${error.message}`, 'error');
              }
            }
          });
        });
      } else {
        ui.showEmpty('pending-requests', '✅ No hay solicitudes pendientes');
      }
    } catch (error) {
      ui.showError('pending-requests', error.message);
    }
  }
}

// Iniciar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
