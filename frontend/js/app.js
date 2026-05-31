(function () {
  'use strict';

  // --- State ---
  let currentUser = null;
  let labs = [];
  let items = [];

  // --- Theme ---
  const THEME_KEY = 'theme'; // 'system' | 'light' | 'dark'
  const getThemePref = () => localStorage.getItem(THEME_KEY) || 'system';
  const setThemePref = (pref) => localStorage.setItem(THEME_KEY, pref);

  function getEffectiveTheme(pref = getThemePref()) {
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (pref === 'system') return systemDark ? 'dark' : 'light';
    return pref === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;

    const btn = $('#themeToggleBtn');
    if (btn) btn.textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
  }

  function initTheme() {
    // Ensure we match the early inline script state.
    applyTheme(getEffectiveTheme());

    const btn = $('#themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = getEffectiveTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        setThemePref(next);
        applyTheme(next);
      });
    }

    // Follow system changes when preference is system
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (getThemePref() === 'system') applyTheme(getEffectiveTheme('system'));
      };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
      else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    }
  }

  // --- DOM Helpers ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // --- Inline Form Messages ---
  const formMessageTimers = new Map();
  function setFormMessage(id, message) {
    const el = document.getElementById(id);
    if (!el) return;

    const existingTimer = formMessageTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      formMessageTimers.delete(id);
    }

    if (!message) {
      el.textContent = '';
      el.classList.add('form-note--hidden');
      return;
    }
    el.textContent = message;
    el.classList.remove('form-note--hidden');

    // Auto-hide after 3 seconds
    const t = setTimeout(() => {
      el.textContent = '';
      el.classList.add('form-note--hidden');
      formMessageTimers.delete(id);
    }, 3000);
    formMessageTimers.set(id, t);
  }

  // --- Toast ---
  let toastTimer = null;
  function showToast(message, type = 'success') {
    // Toast notifications disabled by UX request.
    return;
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = 'toast toast--visible toast--' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
  }

  // --- Alert Modal ---
  function getFriendlyErrorMessage(err, context = {}) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    const raw = err && err.message ? String(err.message) : '';

    if (status === 429 || raw === 'Too many requests') return 'Demasiadas solicitudes. Espera unos segundos y vuelve a intentar.';
    if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
    if (status === 403) return 'No tienes permisos para realizar esta acción.';

    if (!raw) return 'No se pudo completar la operación. Inténtalo de nuevo.';

    // Backend standard errors
    if (raw === 'Internal server error') return 'Ocurrió un error interno. Inténtalo más tarde.';
    if (raw === 'Resource already exists') return 'Ya existe un registro con esos datos.';
    if (raw === 'Referenced resource not found') return 'No se encontró un dato relacionado. Verifica la información e inténtalo de nuevo.';
    if (raw === 'Invalid data constraints') return 'Los datos ingresados no son válidos. Revisa e inténtalo de nuevo.';
    if (raw === 'Laboratory not found') return 'No se encontró el laboratorio seleccionado.';
    if (raw === 'Laboratory is under maintenance') return 'Este laboratorio está en mantenimiento. Elige otro laboratorio.';
    if (raw === 'Reservations cannot be made for past dates') {
      return 'No se pueden hacer reservas en fechas pasadas. Elige una fecha futura.';
    }
    if (raw === 'Time slot conflict - laboratory already reserved') {
      return 'Ese laboratorio ya está reservado en ese horario. Elige otra hora o fecha.';
    }
    if (raw === 'Time slot blocked - laboratory has classes') {
      return 'Ese horario no se puede reservar porque el laboratorio está ocupado por clases.';
    }

    // Stock errors
    // Example: Insufficient stock for "Mouse". Available: 1, Requested: 2
    const stockMatch = raw.match(/^Insufficient stock for "(.+)"\. Available: (\d+), Requested: (\d+)$/);
    if (stockMatch) {
      const [, itemName, available, requested] = stockMatch;
      return `No hay stock suficiente para "${itemName}". Disponible: ${available}, Solicitado: ${requested}.`;
    }

    // Item not found
    if (/^Item\s+.+\s+not found$/.test(raw)) {
      return 'Uno de los materiales seleccionados no existe o fue eliminado.';
    }

    // Joi messages -> Spanish
    // Example: "end_time" must be greater than "ref:start_time"
    if (raw.includes('"end_time"') && raw.includes('greater than') && raw.includes('start_time')) {
      return 'La hora de fin debe ser mayor que la hora de inicio.';
    }

    const fieldLabels = {
      lab_id: 'Laboratorio',
      start_time: 'Hora de inicio',
      end_time: 'Hora de fin',
      notes: 'Notas',
      name: 'Nombre',
      location: 'Ubicación',
      capacity: 'Capacidad',
      total_stock: 'Stock total',
      description: 'Descripción',
      item_id: 'Material',
      quantity_used: 'Cantidad',
      email: 'Email',
      password: 'Contraseña',
    };

    const m = raw.match(/^"([a-zA-Z0-9_\.]+)"\s+(.*)$/);
    if (m) {
      const field = m[1];
      const rest = m[2];
      const label = fieldLabels[field] || field;

      if (rest === 'is required') {
        if (field === 'lab_id') return 'Selecciona un laboratorio.';
        return `El campo ${label} es obligatorio.`;
      }

      if (rest.includes('must be a valid') || rest.includes('must be a valid GUID') || rest.includes('must be a valid email')) {
        if (field === 'email') return 'Escribe un email válido.';
        return `${label} tiene un formato inválido.`;
      }

      const minNum = rest.match(/must be greater than or equal to (\d+)/);
      if (minNum) {
        return `${label} debe ser mayor o igual a ${minNum[1]}.`;
      }

      const minLen = rest.match(/length must be at least (\d+)/);
      if (minLen) {
        return `${label} debe tener al menos ${minLen[1]} caracteres.`;
      }

      const maxLen = rest.match(/length must be less than or equal to (\d+)/);
      if (maxLen) {
        return `${label} no puede superar ${maxLen[1]} caracteres.`;
      }

      if (rest.includes('fails to match the required pattern')) {
        return `${label} tiene un formato inválido.`;
      }
    }

    // Safe fallback: keep message but remove quotes noise
    return raw.replace(/\"/g, '"');
  }

  function renderErrorEmptyState(err) {
    const msg = getFriendlyErrorMessage(err);
    return `<div class="empty-state empty-state--error">${msg}</div>`;
  }

  function showAlert(message, title = 'Alerta') {
    const modal = $('#alertModal');
    const titleEl = $('#alertModalTitle');
    const msgEl = $('#alertModalMessage');
    const okBtn = $('#alertModalOk');

    if (!modal || !titleEl || !msgEl || !okBtn) {
      // Fallback (should not happen unless HTML changed)
      alert(`${title}\n\n${message}`);
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    modal.classList.add('modal--active');

    const close = () => {
      modal.classList.remove('modal--active');
      okBtn.removeEventListener('click', close);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeydown);
    };

    const onBackdrop = (e) => {
      if (e.target === modal) close();
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') close();
    };

    okBtn.addEventListener('click', close);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeydown);
  }

  function showConfirm(message, title = 'Confirmar', options = {}) {
    const {
      confirmText = 'Aceptar',
      cancelText = 'Cancelar',
    } = options;

    const modal = $('#confirmModal');
    const titleEl = $('#confirmModalTitle');
    const msgEl = $('#confirmModalMessage');
    const okBtn = $('#confirmModalOk');
    const cancelBtn = $('#confirmModalCancel');

    if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      return Promise.resolve(confirm(`${title}\n\n${message}`));
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    modal.classList.add('modal--active');

    return new Promise((resolve) => {
      const cleanup = () => {
        modal.classList.remove('modal--active');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeydown);
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      const onBackdrop = (e) => {
        if (e.target === modal) onCancel();
      };

      const onKeydown = (e) => {
        if (e.key === 'Escape') onCancel();
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeydown);

      // Focus primary action for keyboard users
      okBtn.focus();
    });
  }

  // --- Navigation ---
  function showView(viewId) {
    $$('.view').forEach((v) => v.classList.add('view--hidden'));
    const target =
      document.getElementById(`${viewId}View`) ||
      document.getElementById(viewId);
    if (target) {
      target.classList.remove('view--hidden');
    } else {
      // Avoid blank screens if an unknown route is requested.
      const fallback = document.getElementById('calendarView') || document.getElementById('loginView');
      if (fallback) fallback.classList.remove('view--hidden');
      console.warn('[router] Unknown view:', viewId);
    }

    $$('.nav__link').forEach((l) => l.classList.remove('nav__link--active'));
    const activeLink = $(`.nav__item[data-view="${viewId}"] .nav__link`);
    if (activeLink) activeLink.classList.add('nav__link--active');
  }

  function selectAdminTab(tabName) {
    const adminRoot = document.getElementById('adminView');
    if (!adminRoot) return;

    const tab = adminRoot.querySelector(`.admin-tab[data-admin-tab="${tabName}"]`);
    if (!tab) return;
    adminRoot.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('admin-tab--active'));
    tab.classList.add('admin-tab--active');

    adminRoot.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('admin-panel--hidden'));
    const panels = { pending: '#adminPending', all: '#adminAll', labs: '#adminLabs', items: '#adminItems' };
    $(panels[tabName]).classList.remove('admin-panel--hidden');
  }

  function applyRoute(view, params = {}) {
    showView(view);
    if (view === 'calendar') loadCalendar();
    if (view === 'my-reservations') loadMyReservations();
    if (view === 'inventory') loadInventory();
    if (view === 'admin') {
      // Default to labs when coming from editor
      selectAdminTab('labs');
      loadLabs();
    }
    if (view === 'labEditor') {
      const labId = params && params.labId ? params.labId : null;
      if (labId) loadLabEditorFromId(labId);
      else prepareLabEditorCreate();
    }
  }

  function navigateTo(view) {
    const nextHash = `#${view}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      applyRoute(view);
    }
  }

  function navigateToLabEditor(labId = null) {
    const nextHash = labId ? `#labEditor/${labId}` : '#labEditor';
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      applyRoute('labEditor', { labId });
    }
  }

  function parseHashRoute() {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return { view: null, labId: null };
    let cleaned = raw;
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch (_) {
      // ignore decoding errors
    }
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^\//, '');
    cleaned = cleaned.split('?')[0];
    const parts = cleaned.split('/').filter(Boolean);
    return { view: parts[0] || null, labId: parts[1] || null };
  }

  function routeOnLoadOrHashChange() {
    const route = parseHashRoute();
    const requested = route.view;
    const loggedIn = !!API.getToken();
    const isAdmin = currentUser && currentUser.role === 'admin';
    const roleUnknown = loggedIn && !currentUser;

    if (!loggedIn) {
      applyRoute('login');
      return;
    }

    const allowed = new Set(['calendar', 'reserve', 'my-reservations', 'inventory', 'admin', 'reports', 'labEditor']);
    let view = allowed.has(requested) ? requested : 'calendar';
    if ((view === 'admin' || view === 'reports' || view === 'labEditor') && !isAdmin && !roleUnknown) {
      view = 'calendar';
    }

    applyRoute(view, { labId: route.labId });
  }

  function updateNav() {
    const loggedIn = !!API.getToken();
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
    $('#themeToggleBtn').style.display = loggedIn ? 'inline-flex' : 'none';
  }

  // --- Auth ---
  async function handleLogin(e) {
    e.preventDefault();
    setFormMessage('loginFormMessage', '');
    const email = $('#loginEmail').value;
    const password = $('#loginPassword').value;

    if (!email || !password) {
      setFormMessage('loginFormMessage', 'Completa tu email y contraseña para continuar.');
      return;
    }

    try {
      const result = await API.login({ email, password });
      API.setToken(result.token);
      currentUser = result.user;
      updateNav();
      // Respect current hash (e.g. #labEditor/3) if present; otherwise go to calendar.
      const route = parseHashRoute();
      if (route.view && route.view !== 'login') routeOnLoadOrHashChange();
      else navigateTo('calendar');
      loadLabs();
    } catch (err) {
      showAlert(getFriendlyErrorMessage(err, { action: 'login', entity: 'user' }), 'No se pudo iniciar sesión');
    }
  }

  function handleLogout() {
    API.setToken(null);
    currentUser = null;
    updateNav();
    navigateTo('login');
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

  function formatDateYYYYMMDD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getWeekStartMonday(dateObj) {
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=Sun..6=Sat
    const diff = (dow + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    return d;
  }

  async function loadCalendar() {
    const labId = $('#calendarLabSelect').value;
    if (!labId) {
      const grid = $('#calendarGrid');
      if (grid) {
        grid.innerHTML = '<div class="empty-state">Selecciona un laboratorio para ver la disponibilidad semanal.</div>';
      }
      return;
    }

    const grid = $('#calendarGrid');
    grid.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const selected = new Date();
      const weekStart = getWeekStartMonday(selected);
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const start = formatDateYYYYMMDD(weekStart) + 'T00:00:00';
      const end = formatDateYYYYMMDD(weekEnd) + 'T23:59:59';
      const reservations = await API.getReservationsByLab(labId, start, end);

      const byDayHour = new Map();
      reservations.forEach((r) => {
        const startDt = new Date(r.start_time);
        const endDt = new Date(r.end_time);
        if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) return;

        const cursor = new Date(startDt);
        cursor.setMinutes(0, 0, 0);
        while (cursor < endDt) {
          const dayKey = formatDateYYYYMMDD(cursor);
          const hour = cursor.getHours();
          if (HOURS.includes(hour)) {
            const key = `${dayKey}|${hour}`;
            // Keep the first reservation for that slot (conflicts shouldn't occur)
            if (!byDayHour.has(key)) byDayHour.set(key, r);
          }
          cursor.setHours(cursor.getHours() + 1);
        }
      });

      const lab = (Array.isArray(labs) ? labs : []).find((l) => String(l.id) === String(labId));
      const blockedSchedule = lab && Array.isArray(lab.blocked_schedule) ? lab.blocked_schedule : [];
      const toDayOfWeek = (d) => ((d.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
      const timeToMinutes = (hhmm) => {
        const [h, m] = String(hhmm || '').split(':').map((n) => parseInt(n, 10));
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return (h * 60) + m;
      };
      const getBlockedEntryForHour = (dateObj, hour) => {
        if (!blockedSchedule || blockedSchedule.length === 0) return null;
        const dow = toDayOfWeek(dateObj);
        const hourMin = hour * 60;
        for (const entry of blockedSchedule) {
          if (!entry || entry.day_of_week !== dow) continue;
          const startMin = timeToMinutes(entry.start);
          const endMin = timeToMinutes(entry.end);
          if (startMin === null || endMin === null) continue;
          if (hourMin >= startMin && hourMin < endMin) return entry;
        }
        return null;
      };

      const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const thead = `
        <thead>
          <tr>
            <th class="calendar-table__corner">Hora</th>
            ${weekDays
              .map((d, idx) => {
                const label = `${dayNames[idx]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                return `<th class="calendar-table__day" scope="col">${label}</th>`;
              })
              .join('')}
          </tr>
        </thead>
      `;

      const tbodyRows = HOURS
        .map((hour) => {
          const timeStr = `${String(hour).padStart(2, '0')}:00`;
          const cells = weekDays
            .map((d) => {
              const dayKey = formatDateYYYYMMDD(d);
              const r = byDayHour.get(`${dayKey}|${hour}`);

              if (!r) {
                const blockedEntry = getBlockedEntryForHour(d, hour);
                if (blockedEntry) {
                  const className = (blockedEntry.name || '').trim() || 'Clase';
                  const safeName = className.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  return `<td class="calendar-cell calendar-cell--blocked" aria-label="${dayKey} ${timeStr} ${safeName}"><div class="calendar-cell__main">${safeName}</div></td>`;
                }
                return `<td class="calendar-cell calendar-cell--available" aria-label="${dayKey} ${timeStr} disponible"></td>`;
              }

              const isPending = r.status === 'pending';
              const cls = isPending ? 'calendar-cell--pending' : 'calendar-cell--occupied';
              const who = (r.user_name || 'Reservado');
              const statusText = isPending ? 'Pendiente' : 'Reservado';
              return `
                <td class="calendar-cell ${cls}" aria-label="${dayKey} ${timeStr} ${statusText}">
                  <div class="calendar-cell__main">${who}</div>
                </td>
              `;
            })
            .join('');

          return `
            <tr>
              <th class="calendar-table__time" scope="row">${timeStr}</th>
              ${cells}
            </tr>
          `;
        })
        .join('');

      grid.innerHTML = `
        <table class="calendar-table" role="grid">
          ${thead}
          <tbody>
            ${tbodyRows}
          </tbody>
        </table>
      `;
    } catch (err) {
      grid.innerHTML = renderErrorEmptyState(err);
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
      container.innerHTML = `<p class="items-selector__hint">${getFriendlyErrorMessage(err)}</p>`;
    }
  }

  async function handleReserve(e) {
    e.preventDefault();
    setFormMessage('reserveFormMessage', '');
    const labId = $('#reserveLab').value;
    const date = $('#reserveDate').value;
    const startTime = $('#reserveStartTime').value;
    const endTime = $('#reserveEndTime').value;
    const notes = $('#reserveNotes').value;

    if (!labId || !date || !startTime || !endTime) {
      setFormMessage('reserveFormMessage', 'Completa los campos obligatorios: Laboratorio, Fecha, Hora inicio y Hora fin.');
      if (!labId) $('#reserveLab')?.focus();
      else if (!date) $('#reserveDate')?.focus();
      else if (!startTime) $('#reserveStartTime')?.focus();
      else if (!endTime) $('#reserveEndTime')?.focus();
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
      setFormMessage('reserveFormMessage', '');
      $('#reserveForm').reset();
      $('#itemsSelector').innerHTML = '<p class="items-selector__hint">Selecciona un laboratorio para ver materiales disponibles</p>';
      showView('my-reservations');
      loadMyReservations();
    } catch (err) {
      showAlert(getFriendlyErrorMessage(err, { action: 'create', entity: 'reservation' }), 'No se pudo crear la reserva');
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
      container.innerHTML = renderErrorEmptyState(err);
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
        const ok = await showConfirm('¿Estás seguro de cancelar esta reserva?', 'Cancelar reserva', {
          confirmText: 'Sí, cancelar',
          cancelText: 'No',
        });
        if (!ok) return;
        try {
          await API.cancelReservation(this.dataset.id);
          loadMyReservations();
        } catch (err) {
          showAlert(getFriendlyErrorMessage(err, { action: 'cancel', entity: 'reservation' }), 'No se pudo cancelar la reserva');
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
      container.innerHTML = renderErrorEmptyState(err);
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
      container.innerHTML = renderErrorEmptyState(err);
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
          loadPendingReservations();
          loadAllReservations();
        } catch (err) {
          showAlert(getFriendlyErrorMessage(err, { action: 'approve', entity: 'reservation' }), 'No se pudo aprobar');
        }
      });
    });

    container.querySelectorAll('[data-action="reject"]').forEach((btn) => {
      btn.addEventListener('click', async function () {
        try {
          await API.approveReservation(this.dataset.id, 'rejected');
          loadPendingReservations();
          loadAllReservations();
        } catch (err) {
          showAlert(getFriendlyErrorMessage(err, { action: 'reject', entity: 'reservation' }), 'No se pudo rechazar');
        }
      });
    });
  }

  // --- Admin Labs ---
  const LAB_DAYS = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 7, label: 'Domingo' },
  ];

  let labEditorMode = 'create';
  let labEditorId = null;

  function resetLabEditorMessage() {
    setFormMessage('labEditorMessage', '');
  }

  function prepareLabEditorCreate() {
    labEditorMode = 'create';
    labEditorId = null;
    resetLabEditorMessage();
    document.getElementById('labEditorTitle').textContent = 'Nuevo Laboratorio';
    document.getElementById('labEditorName').value = '';
    document.getElementById('labEditorLocation').value = '';
    document.getElementById('labEditorCapacity').value = '';
    renderScheduleRows([]);
  }

  function prepareLabEditorEditFromLab(lab) {
    labEditorMode = 'edit';
    labEditorId = lab.id;
    resetLabEditorMessage();
    document.getElementById('labEditorTitle').textContent = 'Editar Laboratorio';
    document.getElementById('labEditorName').value = lab.name || '';
    document.getElementById('labEditorLocation').value = lab.location || '';
    document.getElementById('labEditorCapacity').value = String(lab.capacity ?? '');
    renderScheduleRows(Array.isArray(lab.blocked_schedule) ? lab.blocked_schedule : []);
  }

  async function loadLabEditorFromId(labId) {
    const idStr = String(labId);

    // Always fetch fresh to avoid stale cached schedules after saving.
    try {
      const lab = await API.getLabById(idStr);
      // Keep local cache in sync
      const idx = labs.findIndex((l) => String(l.id) === idStr);
      if (idx >= 0) labs[idx] = lab;
      else labs.push(lab);
      prepareLabEditorEditFromLab(lab);
    } catch (err) {
      // Fallback to cache if API call fails
      const cached = labs.find((l) => String(l.id) === idStr);
      if (cached) {
        prepareLabEditorEditFromLab(cached);
        return;
      }
      showAlert(getFriendlyErrorMessage(err, { action: 'read', entity: 'lab' }), 'No se pudo cargar el laboratorio');
    }
  }

  function parseHHMMToMinutes(hhmm) {
    const m = String(hhmm || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    return (parseInt(m[1], 10) * 60) + parseInt(m[2], 10);
  }

  function getScheduleFromEditor() {
    const rows = Array.from(document.querySelectorAll('#labScheduleList .lab-schedule-row'));
    const schedule = [];
    for (const row of rows) {
      const day = parseInt(row.querySelector('[data-field="day"]')?.value, 10);
      const className = (row.querySelector('[data-field="name"]')?.value || '').trim();
      const start = row.querySelector('[data-field="start"]')?.value;
      const end = row.querySelector('[data-field="end"]')?.value;
      if (!day || !start || !end) {
        const err = new Error('Completa Día, Inicio y Fin en los horarios de clases.');
        err.code = 'schedule_incomplete';
        throw err;
      }
      const sMin = parseHHMMToMinutes(start);
      const eMin = parseHHMMToMinutes(end);
      if (sMin === null || eMin === null || !(eMin > sMin)) {
        const err = new Error('Revisa los horarios: la hora fin debe ser mayor que la hora inicio.');
        err.code = 'schedule_invalid';
        throw err;
      }
      schedule.push({ day_of_week: day, start, end, name: className });
    }

    // prevent overlaps for same day
    const byDay = new Map();
    for (const entry of schedule) {
      if (!byDay.has(entry.day_of_week)) byDay.set(entry.day_of_week, []);
      byDay.get(entry.day_of_week).push(entry);
    }
    for (const [day, entries] of byDay.entries()) {
      const sorted = entries
        .map((e) => ({ ...e, s: parseHHMMToMinutes(e.start), t: parseHHMMToMinutes(e.end) }))
        .sort((a, b) => a.s - b.s);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].s < sorted[i - 1].t) {
          const label = LAB_DAYS.find((d) => d.value === day)?.label || 'Ese día';
          const err = new Error(`Hay horarios de clases que se traslapan en ${label}.`);
          err.code = 'schedule_overlap';
          throw err;
        }
      }
    }

    return schedule;
  }

  function renderScheduleRows(schedule = []) {
    const list = document.getElementById('labScheduleList');
    if (!list) return;
    const rows = Array.isArray(schedule) ? schedule : [];
    if (rows.length === 0) {
      list.innerHTML = '<div class="items-selector__hint">Sin horarios bloqueados. Agrega si el laboratorio tiene clases.</div>';
      return;
    }

    const rowHtml = (entry, idx) => {
      const dayVal = entry.day_of_week;
      const nameVal = (entry.name || '').replace(/"/g, '&quot;');
      const startVal = entry.start || '07:00';
      const endVal = entry.end || '08:00';
      return `
        <div class="lab-schedule-row" data-idx="${idx}">
          <select class="form-select lab-schedule-row__day" data-field="day">
            ${LAB_DAYS.map((d) => `<option value="${d.value}" ${d.value === dayVal ? 'selected' : ''}>${d.label}</option>`).join('')}
          </select>
          <input class="form-input lab-schedule-row__name" type="text" maxlength="120" data-field="name" value="${nameVal}" placeholder="Nombre de la clase (opcional)">
          <input class="form-input lab-schedule-row__time" type="time" step="900" data-field="start" value="${startVal}">
          <input class="form-input lab-schedule-row__time" type="time" step="900" data-field="end" value="${endVal}">
          <button class="btn btn--danger btn--sm" type="button" data-action="remove-schedule" aria-label="Eliminar horario">Eliminar</button>
        </div>
      `;
    };

    list.innerHTML = rows.map((entry, idx) => rowHtml(entry, idx)).join('');
  }

  function addEmptyScheduleRow() {
    const list = document.getElementById('labScheduleList');
    if (!list) return;

    const hint = list.querySelector('.items-selector__hint');
    if (hint) {
      list.innerHTML = '';
    }

    const idx = list.querySelectorAll('.lab-schedule-row').length;
    list.insertAdjacentHTML(
      'beforeend',
      `
        <div class="lab-schedule-row" data-idx="${idx}">
          <select class="form-select lab-schedule-row__day" data-field="day">
            ${LAB_DAYS.map((d) => `<option value="${d.value}">${d.label}</option>`).join('')}
          </select>
          <input class="form-input lab-schedule-row__name" type="text" maxlength="120" data-field="name" value="" placeholder="Nombre de la clase (opcional)">
          <input class="form-input lab-schedule-row__time" type="time" step="900" data-field="start" value="07:00">
          <input class="form-input lab-schedule-row__time" type="time" step="900" data-field="end" value="08:00">
          <button class="btn btn--danger btn--sm" type="button" data-action="remove-schedule" aria-label="Eliminar horario">Eliminar</button>
        </div>
      `
    );
  }

  function openLabEditorCreate() {
    navigateToLabEditor(null);
  }

  function openLabEditorEdit(lab) {
    navigateToLabEditor(lab.id);
  }

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
          <button class="btn btn--secondary btn--sm" data-action="edit-lab" data-id="${lab.id}">Editar</button>
          <button class="btn btn--secondary btn--sm" data-action="toggle-lab" data-id="${lab.id}">${lab.status === 'active' ? 'Desactivar' : 'Activar'}</button>
        </div>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('[data-action="edit-lab"]').forEach((btn) => {
      btn.addEventListener('click', function () {
        const lab = labs.find((l) => String(l.id) === String(this.dataset.id));
        if (!lab) return;
        openLabEditorEdit(lab);
      });
    });

    container.querySelectorAll('[data-action="toggle-lab"]').forEach((btn) => {
      btn.addEventListener('click', async function () {
        const lab = labs.find((l) => String(l.id) === String(this.dataset.id));
        if (!lab) return;
        const newStatus = lab.status === 'active' ? 'maintenance' : 'active';
        try {
          await API.updateLab(lab.id, { status: newStatus });
          loadLabs();
        } catch (err) {
          showAlert(getFriendlyErrorMessage(err, { action: 'update', entity: 'lab' }), 'No se pudo actualizar el laboratorio');
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
          const ok = await showConfirm('¿Eliminar este material?', 'Eliminar material', {
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
          });
          if (!ok) return;
          try {
            await API.deleteItem(this.dataset.id);
            loadAdminItems();
          } catch (err) {
            showAlert(getFriendlyErrorMessage(err, { action: 'delete', entity: 'item' }), 'No se pudo eliminar el material');
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  // --- Modals ---
  function initModals() {
    // Labs editor (separate view)
    $('#addLabBtn')?.addEventListener('click', () => {
      openLabEditorCreate();
    });

    $('#cancelLabEditorBtn')?.addEventListener('click', () => {
      resetLabEditorMessage();
      navigateTo('admin');
    });

    $('#addScheduleRowBtn')?.addEventListener('click', () => {
      resetLabEditorMessage();
      addEmptyScheduleRow();
    });

    $('#labScheduleList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-schedule"]');
      if (!btn) return;
      const row = btn.closest('.lab-schedule-row');
      if (!row) return;
      row.remove();
      // If none remain, render the hint state
      const remaining = document.querySelectorAll('#labScheduleList .lab-schedule-row').length;
      if (remaining === 0) renderScheduleRows([]);
    });

    $('#labEditorForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      resetLabEditorMessage();

      const name = $('#labEditorName').value;
      const location = $('#labEditorLocation').value;
      const capacityRaw = $('#labEditorCapacity').value;
      const capacity = parseInt(capacityRaw, 10);

      if (!name || !location || !capacityRaw || Number.isNaN(capacity) || capacity < 1) {
        setFormMessage('labEditorMessage', 'Completa Nombre, Ubicación y una Capacidad válida (mínimo 1).');
        return;
      }

      let blocked_schedule = [];
      try {
        blocked_schedule = getScheduleFromEditor();
      } catch (err) {
        setFormMessage('labEditorMessage', err.message || 'Revisa los horarios de clases.');
        return;
      }

      try {
        if (labEditorMode === 'create') {
          await API.createLab({ name, location, capacity, status: 'active', blocked_schedule });
        } else {
          await API.updateLab(labEditorId, { name, location, capacity, blocked_schedule });
        }
        navigateTo('admin');
        loadLabs();
      } catch (err) {
        const title = labEditorMode === 'create' ? 'No se pudo crear el laboratorio' : 'No se pudo actualizar el laboratorio';
        showAlert(getFriendlyErrorMessage(err, { action: labEditorMode, entity: 'lab' }), title);
      }
    });

    $('#addItemBtn')?.addEventListener('click', () => {
      const labId = $('#itemLabSelect').value;
      if (!labId) {
        showAlert('Selecciona un laboratorio para agregar materiales.', 'Faltan datos');
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
      setFormMessage('itemFormMessage', '');

      const name = $('#itemName').value;
      const description = $('#itemDescription').value;
      const stockRaw = $('#itemStock').value;
      const totalStock = parseInt(stockRaw, 10);

      if (!name || !stockRaw || Number.isNaN(totalStock) || totalStock < 0) {
        setFormMessage('itemFormMessage', 'Completa Nombre y un Stock válido (0 o mayor).');
        return;
      }

      const data = {
        name,
        description,
        total_stock: totalStock,
        lab_id: this.dataset.labId,
      };
      try {
        await API.createItem(data);
        $('#itemModal').classList.remove('modal--active');
        loadAdminItems();
      } catch (err) {
        showAlert(getFriendlyErrorMessage(err, { action: 'create', entity: 'item' }), 'No se pudo crear el material');
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
      container.innerHTML = renderErrorEmptyState(err);
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
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  // --- Init ---
  function init() {
    API.token = API.getToken();

    initTheme();
    initAdminTabs();
    initModals();

    // Event listeners
    $('#loginForm').addEventListener('submit', handleLogin);
    $('#logoutBtn').addEventListener('click', handleLogout);

    $('#loadCalendarBtn').addEventListener('click', loadCalendar);
    $('#reserveLab').addEventListener('change', onLabChangeForReserve);
    $('#reserveForm').addEventListener('submit', handleReserve);

    $('#itemLabSelect')?.addEventListener('change', loadAdminItems);

    $('#generateReportBtn').addEventListener('click', generateReport);

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    $('#reserveDate').value = dateStr;
    $('#reserveDate').min = dateStr;


    // Set default report month/year
    const now = new Date();
    $('#reportMonth').value = now.getMonth() + 1;
    $('#reportYear').value = now.getFullYear();

    // Hash-based navigation (supports refresh/F5)
    window.addEventListener('hashchange', routeOnLoadOrHashChange);
    $$('.nav__link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.parentElement.dataset.view;
        navigateTo(view);
      });
    });

    // Try auto-login
    if (API.getToken()) {
      // Optimistic UI: keep user inside app while we validate token.
      updateNav();
      routeOnLoadOrHashChange();
      loadLabs();

      API.getProfile()
        .then((user) => {
          currentUser = user;
          updateNav();
          routeOnLoadOrHashChange();
        })
        .catch((err) => {
          const status = err && typeof err.status === 'number' ? err.status : null;
          // Only force logout for real auth failures.
          if (status === 401 || status === 403) {
            API.setToken(null);
            currentUser = null;
            updateNav();
            navigateTo('login');
            return;
          }

          // For transient errors (server down, 429, etc), keep token and stay in app.
          const grid = document.getElementById('calendarGrid');
          if (grid) {
            grid.innerHTML = '<div class="empty-state empty-state--error">No se pudo validar la sesión en este momento. Intenta recargar en unos segundos.</div>';
          }
        });
        updateNav();
        routeOnLoadOrHashChange();
      updateNav();
    }
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);
})();
