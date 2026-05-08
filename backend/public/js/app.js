(function () {
  'use strict';

  // --- State ---
  let currentUser = null;
  let labs = [];
  let items = [];

  // --- DOM Helpers ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // --- Toast ---
  let toastTimer = null;
  function showToast(message, type = 'success') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = 'toast toast--visible toast--' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
  }

  // --- Navigation ---
  function showView(viewId) {
    $$('.view').forEach((v) => v.classList.add('view--hidden'));
    const target = $(`#${viewId}View`);
    if (target) target.classList.remove('view--hidden');

    $$('.nav__link').forEach((l) => l.classList.remove('nav__link--active'));
    const activeLink = $(`.nav__item[data-view="${viewId}"] .nav__link`);
    if (activeLink) activeLink.classList.add('nav__link--active');
  }

  function updateNav() {
    const loggedIn = !!currentUser;
    const isAdmin = currentUser && currentUser.role === 'admin';

    document.querySelector('.layout')?.classList.toggle('layout--auth', !loggedIn);

    $$('[data-view]').forEach((item) => {
      const view = item.dataset.view;
      if (!loggedIn) {
        item.classList.toggle('nav__item--hidden', view !== 'login');
      } else {
        if (view === 'login') {
          item.classList.add('nav__item--hidden');
        } else if (view === 'admin') {
          item.classList.toggle('nav__item--hidden', !isAdmin);
        } else if (view === 'reports') {
          item.classList.toggle('nav__item--hidden', !isAdmin);
        } else {
          item.classList.remove('nav__item--hidden');
        }
      }
    });

    $('#logoutBtn').style.display = loggedIn ? 'inline-flex' : 'none';
  }

  // --- Auth ---
  async function handleLogin(e) {
    e.preventDefault();
    const email = $('#loginEmail').value;
    const password = $('#loginPassword').value;
    try {
      const result = await API.login({ email, password });
      API.setToken(result.token);
      currentUser = result.user;
      updateNav();
      showToast('Bienvenido, ' + currentUser.name);
      showView('calendar');
      loadLabs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const data = {
      name: $('#registerName').value,
      email: $('#registerEmail').value,
      password: $('#registerPassword').value,
    };
    try {
      const result = await API.register(data);
      API.setToken(result.token);
      currentUser = result.user;
      updateNav();
      showToast('Cuenta creada exitosamente');
      showView('calendar');
      loadLabs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function handleLogout() {
    API.setToken(null);
    currentUser = null;
    updateNav();
    showView('login');
    showToast('Sesion cerrada', 'warning');
  }

  // --- Auth Tabs ---
  function initAuthTabs() {
    $$('.auth-card__tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.auth-card__tab').forEach((t) => t.classList.remove('auth-card__tab--active'));
        tab.classList.add('auth-card__tab--active');
        const isLogin = tab.dataset.tab === 'login';
        $('#loginForm').classList.toggle('auth-form--hidden', !isLogin);
        $('#registerForm').classList.toggle('auth-form--hidden', isLogin);
      });
    });
  }

  // --- Labs ---
  async function loadLabs() {
    try {
      labs = await API.getLabs();
      populateLabSelects();
    } catch (err) {
      console.error('Error loading labs:', err);
    }
  }

  function populateLabSelects() {
    const selects = [
      { el: $('#calendarLabSelect'), allOption: true },
      { el: $('#reserveLab'), allOption: true },
      { el: $('#itemLabSelect'), allOption: true },
    ];

    selects.forEach(({ el }) => {
      if (!el) return;
      const val = el.value;
      el.innerHTML = '<option value="">Seleccionar laboratorio</option>';
      labs
        .filter((l) => l.status === 'active')
        .forEach((lab) => {
          const opt = document.createElement('option');
          opt.value = lab.id;
          opt.textContent = lab.name;
          el.appendChild(opt);
        });
      el.value = val;
    });

    // Admin labs list
    renderAdminLabs();
  }

  // --- Calendar ---
  const HOURS = [];
  for (let h = 7; h <= 21; h++) HOURS.push(h);

  async function loadCalendar() {
    const labId = $('#calendarLabSelect').value;
    const date = $('#calendarDate').value;
    if (!labId || !date) {
      showToast('Selecciona un laboratorio y fecha', 'warning');
      return;
    }

    const grid = $('#calendarGrid');
    grid.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const start = date + 'T00:00:00';
      const end = date + 'T23:59:59';
      const reservations = await API.getReservationsByLab(labId, start, end);

      grid.innerHTML = '';
      HOURS.forEach((hour) => {
        const slot = document.createElement('div');
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        const slotReservations = reservations.filter((r) => {
          const rStart = new Date(r.start_time).getHours();
          return rStart === hour;
        });

        if (slotReservations.length > 0) {
          const r = slotReservations[0];
          const isPending = r.status === 'pending';
          slot.className = `calendar-slot calendar-slot--${isPending ? 'pending' : 'occupied'}`;
          slot.innerHTML = `
            <div>${timeStr}</div>
            <div style="margin-top:4px;font-size:0.7rem">${r.user_name || 'Reservado'}</div>
          `;
        } else {
          slot.className = 'calendar-slot calendar-slot--available';
          slot.textContent = timeStr;
        }

        grid.appendChild(slot);
      });
    } catch (err) {
      grid.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  // --- Reserve ---
  async function onLabChangeForReserve() {
    const labId = $('#reserveLab').value;
    const container = $('#itemsSelector');

    if (!labId) {
      container.innerHTML = '<p class="items-selector__hint">Selecciona un laboratorio para ver materiales disponibles</p>';
      return;
    }

    try {
      items = await API.getItemsByLab(labId);
      if (items.length === 0) {
        container.innerHTML = '<p class="items-selector__hint">No hay materiales disponibles en este laboratorio</p>';
        return;
      }

      container.innerHTML = items
        .map(
          (item) => `
        <div class="item-checkbox">
          <input class="item-checkbox__input" type="checkbox" id="item-${item.id}" data-item-id="${item.id}" data-max="${item.available_stock}">
          <label class="item-checkbox__label" for="item-${item.id}">${item.name}</label>
          <span class="item-checkbox__stock">Stock: ${item.available_stock}/${item.total_stock}</span>
          <input class="item-checkbox__qty" type="number" id="qty-${item.id}" min="1" max="${item.available_stock}" value="1" disabled>
        </div>
      `
        )
        .join('');

      container.querySelectorAll('.item-checkbox__input').forEach((cb) => {
        cb.addEventListener('change', function () {
          const qtyInput = document.getElementById('qty-' + this.dataset.itemId);
          qtyInput.disabled = !this.checked;
          if (this.checked) qtyInput.focus();
        });
      });
    } catch (err) {
      container.innerHTML = `<p class="items-selector__hint">Error: ${err.message}</p>`;
    }
  }

  async function handleReserve(e) {
    e.preventDefault();
    const labId = $('#reserveLab').value;
    const date = $('#reserveDate').value;
    const startTime = $('#reserveStartTime').value;
    const endTime = $('#reserveEndTime').value;
    const notes = $('#reserveNotes').value;

    if (!labId || !date || !startTime || !endTime) {
      showToast('Completa todos los campos obligatorios', 'warning');
      return;
    }

    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;

    const selectedItems = [];
    $$('.item-checkbox__input:checked').forEach((cb) => {
      const itemId = cb.dataset.itemId;
      const qty = parseInt(document.getElementById('qty-' + itemId).value, 10);
      if (qty > 0) {
        selectedItems.push({ item_id: itemId, quantity_used: qty });
      }
    });

    const data = {
      lab_id: labId,
      start_time: startDateTime,
      end_time: endDateTime,
      notes,
    };
    if (selectedItems.length > 0) data.items = selectedItems;

    try {
      await API.createReservation(data);
      showToast('Reserva solicitada exitosamente');
      $('#reserveForm').reset();
      $('#itemsSelector').innerHTML = '<p class="items-selector__hint">Selecciona un laboratorio para ver materiales disponibles</p>';
      showView('my-reservations');
      loadMyReservations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- My Reservations ---
  async function loadMyReservations() {
    const container = $('#myReservationsList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const reservations = await API.getMyReservations();
      if (reservations.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📋</div>No tienes reservas</div>';
        return;
      }

      container.innerHTML = reservations.map(renderReservationCard).join('');
      attachReservationActions(container);
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  function renderReservationCard(r) {
    const start = new Date(r.start_time).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
    const end = new Date(r.end_time).toLocaleString('es-ES', { timeStyle: 'short' });
    const itemsText =
      r.items && r.items.length > 0
        ? r.items.map((i) => `${i.item_name || i.name} x${i.quantity_used}`).join(', ')
        : 'Sin materiales';

    return `
      <div class="reservation-card" data-id="${r.id}" data-status="${r.status}">
        <div class="reservation-card__header">
          <div>
            <div class="reservation-card__lab">${r.lab_name}</div>
            <div class="reservation-card__time">${start} - ${end}</div>
          </div>
          <span class="status-badge status-badge--${r.status}">${translateStatus(r.status)}</span>
        </div>
        ${r.notes ? `<p style="font-size:0.8rem;color:var(--color-gray-500);margin-top:0.5rem">${r.notes}</p>` : ''}
        <div class="reservation-card__items">📦 ${itemsText}</div>
        ${r.status === 'pending' ? `<button class="btn btn--danger btn--sm" style="margin-top:0.75rem" data-action="cancel" data-id="${r.id}">Cancelar Reserva</button>` : ''}
      </div>
    `;
  }

  function translateStatus(status) {
    const map = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' };
    return map[status] || status;
  }

  function attachReservationActions(container) {
    container.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener('click', async function () {
        if (!confirm('¿Estas seguro de cancelar esta reserva?')) return;
        try {
          await API.cancelReservation(this.dataset.id);
          showToast('Reserva cancelada', 'warning');
          loadMyReservations();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // --- Admin ---
  function initAdminTabs() {
    $$('.admin-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.admin-tab').forEach((t) => t.classList.remove('admin-tab--active'));
        tab.classList.add('admin-tab--active');

        $$('.admin-panel').forEach((p) => p.classList.add('admin-panel--hidden'));
        const panels = { pending: '#adminPending', all: '#adminAll', labs: '#adminLabs', items: '#adminItems' };
        $(panels[tab.dataset.adminTab]).classList.remove('admin-panel--hidden');

        if (tab.dataset.adminTab === 'pending') loadPendingReservations();
        if (tab.dataset.adminTab === 'all') loadAllReservations();
        if (tab.dataset.adminTab === 'labs') loadLabs();
        if (tab.dataset.adminTab === 'items') loadAdminItems();
      });
    });
  }

  async function loadPendingReservations() {
    const container = $('#pendingList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const reservations = await API.getReservations({ status: 'pending' });
      if (reservations.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay solicitudes pendientes</div>';
        return;
      }

      container.innerHTML = reservations.map((r) => renderAdminReservationItem(r, true)).join('');
      attachAdminActions(container);
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  async function loadAllReservations() {
    const container = $('#allReservationsList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const reservations = await API.getReservations();
      if (reservations.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay reservas</div>';
        return;
      }

      container.innerHTML = reservations.map((r) => renderAdminReservationItem(r, false)).join('');
      attachAdminActions(container);
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  function renderAdminReservationItem(r, showActions) {
    const start = new Date(r.start_time).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
    const end = new Date(r.end_time).toLocaleString('es-ES', { timeStyle: 'short' });
    const itemsText =
      r.items && r.items.length > 0
        ? r.items.map((i) => `${i.item_name || i.name} x${i.quantity_used}`).join(', ')
        : 'Sin materiales';

    return `
      <div class="admin-item" data-id="${r.id}">
        <div class="admin-item__info">
          <div class="admin-item__title">${r.lab_name}</div>
          <div class="admin-item__meta">
            Por: ${r.user_name} (${r.user_email})<br>
            ${start} - ${end}<br>
            ${itemsText}
            ${r.notes ? '<br>📝 ' + r.notes : ''}
          </div>
        </div>
        <span class="status-badge status-badge--${r.status}">${translateStatus(r.status)}</span>
        ${showActions && r.status === 'pending' ? `
          <div class="admin-item__actions">
            <button class="btn btn--success btn--sm" data-action="approve" data-id="${r.id}">Aprobar</button>
            <button class="btn btn--danger btn--sm" data-action="reject" data-id="${r.id}">Rechazar</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function attachAdminActions(container) {
    container.querySelectorAll('[data-action="approve"]').forEach((btn) => {
      btn.addEventListener('click', async function () {
        try {
          await API.approveReservation(this.dataset.id, 'approved');
          showToast('Reserva aprobada - Stock actualizado');
          loadPendingReservations();
          loadAllReservations();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-action="reject"]').forEach((btn) => {
      btn.addEventListener('click', async function () {
        try {
          await API.approveReservation(this.dataset.id, 'rejected');
          showToast('Reserva rechazada', 'warning');
          loadPendingReservations();
          loadAllReservations();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // --- Admin Labs ---
  function renderAdminLabs() {
    const container = $('#adminLabsList');
    if (!container) return;

    if (labs.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay laboratorios</div>';
      return;
    }

    container.innerHTML = labs
      .map(
        (lab) => `
      <div class="admin-item">
        <div class="admin-item__info">
          <div class="admin-item__title">${lab.name}</div>
          <div class="admin-item__meta">📍 ${lab.location} | 👥 Capacidad: ${lab.capacity}</div>
        </div>
        <span class="status-badge status-badge--${lab.status === 'active' ? 'approved' : 'rejected'}">${lab.status === 'active' ? 'Activo' : 'Mantenimiento'}</span>
        <div class="admin-item__actions">
          <button class="btn btn--secondary btn--sm" data-action="toggle-lab" data-id="${lab.id}">${lab.status === 'active' ? 'Desactivar' : 'Activar'}</button>
        </div>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('[data-action="toggle-lab"]').forEach((btn) => {
      btn.addEventListener('click', async function () {
        const lab = labs.find((l) => l.id === this.dataset.id);
        const newStatus = lab.status === 'active' ? 'maintenance' : 'active';
        try {
          await API.updateLab(lab.id, { status: newStatus });
          showToast('Laboratorio actualizado');
          loadLabs();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // --- Admin Items ---
  async function loadAdminItems() {
    const labId = $('#itemLabSelect')?.value;
    const container = $('#adminItemsList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const allItems = labId ? await API.getItemsByLab(labId) : await API.getItems();
      items = allItems;

      if (allItems.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay materiales</div>';
        return;
      }

      container.innerHTML = allItems
        .map(
          (item) => `
        <div class="admin-item">
          <div class="admin-item__info">
            <div class="admin-item__title">${item.name}</div>
            <div class="admin-item__meta">
              ${item.description || 'Sin descripcion'}<br>
              Stock: ${item.available_stock}/${item.total_stock} | Lab: ${item.lab_name}
            </div>
          </div>
          <div class="admin-item__actions">
            <button class="btn btn--danger btn--sm" data-action="delete-item" data-id="${item.id}">Eliminar</button>
          </div>
        </div>
      `
        )
        .join('');

      container.querySelectorAll('[data-action="delete-item"]').forEach((btn) => {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Eliminar este material?')) return;
          try {
            await API.deleteItem(this.dataset.id);
            showToast('Material eliminado');
            loadAdminItems();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  // --- Modals ---
  function initModals() {
    $('#addLabBtn')?.addEventListener('click', () => {
      $('#labModalTitle').textContent = 'Nuevo Laboratorio';
      $('#labForm').reset();
      $('#labModal').classList.add('modal--active');
    });

    $('#closeLabModal')?.addEventListener('click', () => {
      $('#labModal').classList.remove('modal--active');
    });

    $('#labForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: $('#labName').value,
        location: $('#labLocation').value,
        capacity: parseInt($('#labCapacity').value, 10),
        status: 'active',
      };
      try {
        await API.createLab(data);
        showToast('Laboratorio creado');
        $('#labModal').classList.remove('modal--active');
        loadLabs();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    $('#addItemBtn')?.addEventListener('click', () => {
      const labId = $('#itemLabSelect').value;
      if (!labId) {
        showToast('Selecciona un laboratorio primero', 'warning');
        return;
      }
      $('#itemModalTitle').textContent = 'Nuevo Material';
      $('#itemForm').reset();
      $('#itemModal').classList.add('modal--active');
      $('#itemForm').dataset.labId = labId;
    });

    $('#closeItemModal')?.addEventListener('click', () => {
      $('#itemModal').classList.remove('modal--active');
    });

    $('#itemForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: $('#itemName').value,
        description: $('#itemDescription').value,
        total_stock: parseInt($('#itemStock').value, 10),
        lab_id: this.dataset.labId,
      };
      try {
        await API.createItem(data);
        showToast('Material creado');
        $('#itemModal').classList.remove('modal--active');
        loadAdminItems();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --- Inventory ---
  async function loadInventory() {
    const container = $('#inventoryStats');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const stats = await API.getItemStats();
      if (stats.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay datos de inventario</div>';
        return;
      }

      container.innerHTML = stats
        .map(
          (item) => {
            const pct = item.total_stock > 0 ? (item.available_stock / item.total_stock) * 100 : 0;
            const barClass = pct > 50 ? 'high' : pct > 20 ? 'medium' : 'low';
            return `
            <div class="inventory-card">
              <div class="inventory-card__name">${item.item_name}</div>
              <div class="inventory-card__lab">${item.lab_name}</div>
              <div class="inventory-card__progress">
                <div class="inventory-card__progress-bar inventory-card__progress-bar--${barClass}" style="width:${pct}%"></div>
              </div>
              <div class="inventory-card__stats">
                <span>Disponible: ${item.available_stock}/${item.total_stock}</span>
                <span>Reservas: ${item.times_reserved}</span>
              </div>
            </div>
          `;
          }
        )
        .join('');
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  // --- Reports ---
  async function generateReport() {
    const month = parseInt($('#reportMonth').value, 10);
    const year = parseInt($('#reportYear').value, 10);
    const container = $('#reportContent');
    container.innerHTML = '<div class="loading">Generando reporte</div>';

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    try {
      const report = await API.getMonthlyReport(year, month);

      if (report.length === 0) {
        container.innerHTML = `<div class="empty-state">No hay datos para ${monthNames[month - 1]} ${year}</div>`;
        return;
      }

      const totalReservations = report.length;
      const approved = report.filter((r) => r.status === 'approved').length;
      const pending = report.filter((r) => r.status === 'pending').length;
      const totalHours = report.reduce((sum, r) => sum + parseFloat(r.duration_hours), 0);

      let html = `
        <div class="report-summary">
          <div class="report-summary__title">Resumen - ${monthNames[month - 1]} ${year}</div>
          <div class="report-summary__grid">
            <div class="report-summary__stat">
              <div class="report-summary__value">${totalReservations}</div>
              <div class="report-summary__label">Total Reservas</div>
            </div>
            <div class="report-summary__stat">
              <div class="report-summary__value">${approved}</div>
              <div class="report-summary__label">Aprobadas</div>
            </div>
            <div class="report-summary__stat">
              <div class="report-summary__value">${pending}</div>
              <div class="report-summary__label">Pendientes</div>
            </div>
            <div class="report-summary__stat">
              <div class="report-summary__value">${totalHours.toFixed(1)}h</div>
              <div class="report-summary__label">Horas Totales</div>
            </div>
          </div>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Laboratorio</th>
              <th>Fecha</th>
              <th>Duracion</th>
              <th>Materiales</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
      `;

      report.forEach((r) => {
        const date = new Date(r.start_time).toLocaleDateString('es-ES');
        const items = r.items_used && r.items_used.length > 0
          ? r.items_used.map((i) => `${i.item_name} x${i.quantity}`).join(', ')
          : '-';

        html += `
          <tr>
            <td>${r.user_name}<br><small style="color:var(--color-gray-400)">${r.user_email}</small></td>
            <td>${r.lab_name}<br><small style="color:var(--color-gray-400)">${r.lab_location}</small></td>
            <td>${date}<br><small style="color:var(--color-gray-400)">${new Date(r.start_time).toLocaleTimeString('es-ES', { timeStyle: 'short' })} - ${new Date(r.end_time).toLocaleTimeString('es-ES', { timeStyle: 'short' })}</small></td>
            <td>${parseFloat(r.duration_hours).toFixed(1)}h</td>
            <td>${items}</td>
            <td><span class="status-badge status-badge--${r.status}">${translateStatus(r.status)}</span></td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  // --- Init ---
  function init() {
    API.token = API.getToken();

    initAuthTabs();
    initAdminTabs();
    initModals();

    // Event listeners
    $('#loginForm').addEventListener('submit', handleLogin);
    $('#registerForm').addEventListener('submit', handleRegister);
    $('#logoutBtn').addEventListener('click', handleLogout);

    $('#loadCalendarBtn').addEventListener('click', loadCalendar);
    $('#reserveLab').addEventListener('change', onLabChangeForReserve);
    $('#reserveForm').addEventListener('submit', handleReserve);

    $('#generateReportBtn').addEventListener('click', generateReport);

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    $('#reserveDate').value = dateStr;
    $('#reserveDate').min = dateStr;
    $('#calendarDate').value = dateStr;

    // Set default report month/year
    const now = new Date();
    $('#reportMonth').value = now.getMonth() + 1;
    $('#reportYear').value = now.getFullYear();

    // Nav click handlers
    $$('.nav__link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.parentElement.dataset.view;
        showView(view);

        if (view === 'calendar') loadCalendar();
        if (view === 'my-reservations') loadMyReservations();
        if (view === 'inventory') loadInventory();
        if (view === 'admin') {
          loadPendingReservations();
          loadAdminItems();
        }
      });
    });

    // Try auto-login
    if (API.getToken()) {
      API.getProfile()
        .then((user) => {
          currentUser = user;
          updateNav();
          loadLabs();
          showView('calendar');
        })
        .catch(() => {
          API.setToken(null);
          showView('login');
        });
    } else {
      showView('login');
      updateNav();
    }
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);
})();
