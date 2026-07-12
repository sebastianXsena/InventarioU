(function () {
  'use strict';

  // --- State ---
  let currentUser = null;
  let labs = [];
  let items = [];
  let faculties = [];
  let programs = [];
  let itemEditorMode = 'create';
  let itemEditorId = null;
  let adminFacultiesPage = 1;
  let adminProgramsPage = 1;
  let currentCalendarDate = new Date();

  // --- Theme ---
  const THEME_KEY = 'theme'; // 'system' | 'light' | 'dark'
  const getThemePref = () => localStorage.getItem(THEME_KEY) || 'system';
  const setThemePref = (pref) => localStorage.setItem(THEME_KEY, pref);

  function getEffectiveTheme(pref = getThemePref()) {
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (pref === 'system') return systemDark ? 'dark' : 'light';
    return pref === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, animate = false) {
    document.documentElement.classList.add('theme-transitioning');
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    const btn = $('#themeToggleBtn');
    if (btn) {
      if (animate) {
        btn.className = 'btn btn--icon theme-toggle--spin-out';
        setTimeout(() => {
          btn.innerHTML = theme === 'dark'
            ? '<i class="ph-duotone ph-sun"></i>'
            : '<i class="ph-duotone ph-moon"></i>';
          btn.className = 'btn btn--icon theme-toggle--spin-in';
          setTimeout(() => {
            btn.className = 'btn btn--icon';
          }, 300);
        }, 220);
      } else {
        btn.innerHTML = theme === 'dark'
          ? '<i class="ph-duotone ph-sun"></i>'
          : '<i class="ph-duotone ph-moon"></i>';
      }
    }
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 420);
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
        applyTheme(next, true);
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
  function setFormMessage(id, message, options = {}) {
    const el = document.getElementById(id);
    if (!el) return;

    const { sticky = false } = options;

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

    if (!sticky) {
      // Auto-hide after 3 seconds
      const t = setTimeout(() => {
        el.textContent = '';
        el.classList.add('form-note--hidden');
        formMessageTimers.delete(id);
      }, 3000);
      formMessageTimers.set(id, t);
    }
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
  function updateNavIndicator() {
    const activeItem = document.querySelector('.header--sidebar .nav__item .nav__link--active');
    const indicator = document.getElementById('navIndicator');
    if (!activeItem || !indicator) {
      if (indicator) indicator.style.opacity = '0';
      return;
    }

    const navList = document.querySelector('.header--sidebar .nav__list');
    if (!navList) return;

    const activeRect = activeItem.getBoundingClientRect();
    const listRect = navList.getBoundingClientRect();

    indicator.style.top = `${activeRect.top - listRect.top}px`;
    indicator.style.height = `${activeRect.height}px`;
    indicator.style.opacity = '1';
  }

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
    requestAnimationFrame(updateNavIndicator);
  }

  function selectAdminTab(tabName) {
    const adminRoot = document.getElementById('adminView');
    if (!adminRoot) return;

    const tab = adminRoot.querySelector(`.admin-tab[data-admin-tab="${tabName}"]`);
    if (!tab) return;
    adminRoot.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('admin-tab--active'));
    tab.classList.add('admin-tab--active');

    const tabsContainer = tab.closest('.admin-tabs');
    if (tabsContainer) {
      // Usar requestAnimationFrame para asegurar que el DOM ha pintado el tamaño
      requestAnimationFrame(() => {
        tabsContainer.style.setProperty('--pill-left', `${tab.offsetLeft}px`);
        tabsContainer.style.setProperty('--pill-width', `${tab.offsetWidth}px`);
      });
    }

    adminRoot.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('admin-panel--hidden'));
    const panels = {
      pending: '#adminPending',
      all: '#adminAll',
      labs: '#adminLabs',
      items: '#adminItems',
      faculties: '#adminFaculties',
      programs: '#adminPrograms'
    };
    const targetPanel = adminRoot.querySelector(panels[tabName]);
    if (targetPanel) targetPanel.classList.remove('admin-panel--hidden');
  }

  function applyRoute(view, params = {}) {
    showView(view);
    if (view === 'calendar') loadCalendar();
    if (view === 'my-reservations') loadMyReservations();
    if (view === 'admin') {
      // Read the return tab stored by lab-editor.html / item-editor.html
      const returnTab = sessionStorage.getItem('adminReturnTab');
      const tab = returnTab || (params && params.tab) || 'labs';
      sessionStorage.setItem('adminReturnTab', tab);
      selectAdminTab(tab);
      if (tab === 'labs') loadLabs();
      else if (tab === 'items') loadAdminItems();
      else if (tab === 'pending') loadPendingReservations();
      else if (tab === 'all') loadAllReservations();
      else if (tab === 'faculties') loadFaculties();
      else if (tab === 'programs') loadPrograms();
      else loadLabs();
    }
    if (view === 'settings') loadSettings();
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
    window.location.href = labId ? '/lab-editor.html?id=' + labId : '/lab-editor.html';
  }

  function navigateToItemEditor(itemId = null) {
    window.location.href = itemId ? '/item-editor.html?id=' + itemId : '/item-editor.html';
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
    return { view: parts[0] || null, paramId: parts[1] || null };
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

    const allowed = new Set(['calendar', 'reserve', 'my-reservations', 'admin', 'reports', 'settings']);
    let view = allowed.has(requested) ? requested : 'calendar';
    if ((view === 'admin' || view === 'reports') && !isAdmin && !roleUnknown) {
      view = 'calendar';
    }

    applyRoute(view, { paramId: route.paramId });
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
    const settingsIconBtn = $('#navSettingsIconBtn');
    if (settingsIconBtn) settingsIconBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    requestAnimationFrame(updateNavIndicator);
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

  async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    setFormMessage('forgotPasswordFormMessage', '');
    const email = $('#forgotPasswordEmail').value.trim();

    if (!email) {
      setFormMessage('forgotPasswordFormMessage', 'Escribe tu email para continuar.');
      return;
    }

    try {
      const res = await API.forgotPassword({ email });
      $('#forgotPasswordModal').classList.remove('modal--active');
      $('#forgotPasswordForm').reset();
      
      showAlert(
        `Tu contraseña temporal es: "${res.tempPassword}"\n\nÚsala para iniciar sesión y cámbiala de inmediato en la pestaña de Ajustes.`,
        'Contraseña Restablecida'
      );
    } catch (err) {
      setFormMessage('forgotPasswordFormMessage', getFriendlyErrorMessage(err) || 'No se pudo restablecer la contraseña.');
    }
  }

  // --- Settings ---
  async function loadSettings() {
    try {
      const user = await API.getProfile();
      $('#settingsFullName').value = user.full_name || '';
      $('#settingsSemester').value = user.semester || '';

      const faculties = await API.getFaculties();
      const facSelect = $('#settingsFaculty');
      facSelect.innerHTML = '<option value="">Seleccionar facultad</option>';
      faculties.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        facSelect.appendChild(opt);
      });
      if (user.faculty_id) facSelect.value = user.faculty_id;

      await loadSettingsPrograms(user.faculty_id, user.program_id);

      facSelect.onchange = async (e) => {
        await loadSettingsPrograms(e.target.value, null);
      };
    } catch (err) {
      console.error(err);
      showAlert('No se pudo cargar el perfil', 'Error');
    }
  }

  async function loadSettingsPrograms(facultyId, selectedProgramId) {
    const progSelect = $('#settingsProgram');
    progSelect.innerHTML = '<option value="">Seleccionar programa</option>';
    if (!facultyId) return;
    try {
      const programs = await API.getPrograms();
      programs.filter(p => p.faculty_id === facultyId).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        progSelect.appendChild(opt);
      });
      if (selectedProgramId) progSelect.value = selectedProgramId;
    } catch (err) {
      console.error(err);
    }
  }

  async function handleProfileSettingsSubmit(e) {
    e.preventDefault();
    setFormMessage('profileSettingsMessage', '');
    const data = {
      full_name: $('#settingsFullName').value.trim(),
      faculty_id: $('#settingsFaculty').value || null,
      program_id: $('#settingsProgram').value || null,
      semester: parseInt($('#settingsSemester').value, 10) || null
    };

    if (!data.full_name) {
      setFormMessage('profileSettingsMessage', 'El nombre completo es obligatorio.');
      return;
    }

    try {
      const updatedUser = await API.updateProfile(data);
      currentUser = updatedUser; // Update local state
      showAlert('Datos personales actualizados correctamente.', 'Éxito');
    } catch (err) {
      setFormMessage('profileSettingsMessage', err.message || 'No se pudo actualizar el perfil.');
    }
  }

  async function handlePasswordSettingsSubmit(e) {
    e.preventDefault();
    setFormMessage('passwordSettingsMessage', '');
    const oldPassword = $('#settingsOldPassword').value;
    const newPassword = $('#settingsNewPassword').value;
    const confirmPassword = $('#settingsConfirmPassword').value;

    if (!oldPassword || !newPassword || !confirmPassword) {
      setFormMessage('passwordSettingsMessage', 'Completa todos los campos.');
      return;
    }
    if (newPassword.length < 6) {
      setFormMessage('passwordSettingsMessage', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormMessage('passwordSettingsMessage', 'Las nuevas contraseñas no coinciden.');
      return;
    }

    try {
      await API.changePassword({ oldPassword, newPassword });
      showAlert('Contraseña actualizada correctamente.', 'Éxito');
      e.target.reset(); // Clear form
    } catch (err) {
      setFormMessage('passwordSettingsMessage', err.message || 'No se pudo cambiar la contraseña.');
    }
  }

  // --- Labs ---
  async function loadLabs() {
    try {
      labs = await API.getLabs();
      populateLabSelects();
      renderAdminLabs();
    } catch (err) {
      console.error('Error loading labs:', err);
    }
  }

  function populateLabSelects() {
    const selects = [
      { el: $('#calendarLabSelect'), allOption: true },
      { el: $('#reserveLab'), allOption: true },
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
  }

  // --- Calendar ---
  // Calendar time slots
  // In this university, 1 "hour" = 45 minutes. We render the grid in 45-min slots.
  const CAL_START_MIN = 7 * 60;
  const CAL_END_MIN = 22 * 60; // exclusive (matches old 21:00-22:00 last hour)
  const CAL_SLOT_MIN = 45;
  const SLOTS = [];
  for (let m = CAL_START_MIN; m < CAL_END_MIN; m += CAL_SLOT_MIN) SLOTS.push(m);

  const pad2 = (n) => String(n).padStart(2, '0');
  const formatTimeFromMinutes = (totalMinutes) => {
    const mins = ((totalMinutes % 1440) + 1440) % 1440;
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  };

  // Align rounding to the calendar grid that starts at CAL_START_MIN (07:00).
  // If we round from 00:00, we can generate slot minutes that don't exist in SLOTS (e.g. 09:45),
  // causing reservations to never match rendered cells.
  const floorMinutesToSlot = (minutes) => {
    if (!Number.isFinite(minutes)) return CAL_START_MIN;
    if (minutes <= CAL_START_MIN) return CAL_START_MIN;
    const offset = minutes - CAL_START_MIN;
    return CAL_START_MIN + (Math.floor(offset / CAL_SLOT_MIN) * CAL_SLOT_MIN);
  };
  const minutesSinceMidnight = (d) => (d.getHours() * 60) + d.getMinutes();

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
      const navContainer = $('#calendarNavigation');
      if (navContainer) navContainer.style.display = 'none';
      return;
    }

    const grid = $('#calendarGrid');
    grid.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const selected = currentCalendarDate;
      const weekStart = getWeekStartMonday(selected);
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      console.log('[DEBUG CALENDAR] currentCalendarDate:', currentCalendarDate.toDateString());
      console.log('[DEBUG CALENDAR] weekStart:', weekStart.toDateString(), 'weekEnd:', weekEnd.toDateString());

      const navContainer = $('#calendarNavigation');
      if (navContainer) {
        navContainer.style.display = 'flex';
        const rangeLabel = $('#calendarWeekRangeLabel');
        if (rangeLabel) {
          const startOpt = { day: 'numeric', month: 'short' };
          const endOpt = { day: 'numeric', month: 'short', year: 'numeric' };
          const startStr = weekStart.toLocaleDateString('es-ES', startOpt);
          const endStr = weekEnd.toLocaleDateString('es-ES', endOpt);
          rangeLabel.textContent = `${startStr} - ${endStr}`;
        }
      }

      const start = formatDateYYYYMMDD(weekStart) + 'T00:00:00';
      const end = formatDateYYYYMMDD(weekEnd) + 'T23:59:59';
      const reservations = await API.getReservationsByLab(labId, start, end);

      const byDaySlot = new Map();
      reservations.forEach((r) => {
        const startDt = new Date(r.start_time);
        const endDt = new Date(r.end_time);
        if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) return;

        const cursor = new Date(startDt);
        // Align to slot boundary (45-min)
        const startMin = minutesSinceMidnight(cursor);
        const alignedStartMin = floorMinutesToSlot(startMin);
        cursor.setHours(0, 0, 0, 0);
        cursor.setMinutes(alignedStartMin, 0, 0);

        while (cursor < endDt) {
          const dayKey = formatDateYYYYMMDD(cursor);
          const slotMin = minutesSinceMidnight(cursor);
          if (slotMin >= CAL_START_MIN && slotMin < CAL_END_MIN) {
            const key = `${dayKey}|${slotMin}`;
            if (!byDaySlot.has(key)) byDaySlot.set(key, r);
          }
          cursor.setMinutes(cursor.getMinutes() + CAL_SLOT_MIN);
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
      const getBlockedEntryForSlot = (dateObj, slotMin) => {
        if (!blockedSchedule || blockedSchedule.length === 0) return null;
        const dow = toDayOfWeek(dateObj);
        for (const entry of blockedSchedule) {
          if (!entry || entry.day_of_week !== dow) continue;
          const startMin = timeToMinutes(entry.start);
          const endMin = timeToMinutes(entry.end);
          if (startMin === null || endMin === null) continue;
          if (slotMin >= startMin && slotMin < endMin) return entry;
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

      let tbodyRows = '';
      for (let i = 0; i < SLOTS.length; i++) {
        const slotMin = SLOTS[i];
        const timeStr = formatTimeFromMinutes(slotMin);

        const cells = weekDays
          .map((d) => {
            const dayKey = formatDateYYYYMMDD(d);
            const r = byDaySlot.get(`${dayKey}|${slotMin}`);

            if (!r) {
              const blockedEntry = getBlockedEntryForSlot(d, slotMin);
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

        // Time label: one academic block per row (45 minutes)
        const startMin = slotMin;
        const endMin = startMin + CAL_SLOT_MIN;
        const label = `${formatTimeFromMinutes(startMin)} - ${formatTimeFromMinutes(endMin)}`;
        const timeHeader = `<th class="calendar-table__time" scope="row">${label}</th>`;

        tbodyRows += `
          <tr>
            ${timeHeader}
            ${cells}
          </tr>
        `;
      }

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
      scheduleReserveAvailabilityCheck();
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

      scheduleReserveAvailabilityCheck();
    } catch (err) {
      container.innerHTML = `<p class="items-selector__hint">${getFriendlyErrorMessage(err)}</p>`;
      scheduleReserveAvailabilityCheck();
    }
  }

  // --- Live Reserve Availability ---
  let reserveCheckTimer = null;
  let reserveCheckSeq = 0;

  function getReserveSubmitButton() {
    return document.querySelector('#reserveForm button[type="submit"]');
  }

  function setReserveSubmitEnabled(enabled) {
    const btn = getReserveSubmitButton();
    if (!btn) return;
    btn.disabled = !enabled;
  }

  function parseLocalDateTime(date, time) {
    if (!date || !time) return null;
    const dt = new Date(`${date}T${time}:00`);
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  function isBlockedBySchedule(blockedSchedule, startDt, endDt) {
    if (!Array.isArray(blockedSchedule) || blockedSchedule.length === 0) return false;
    if (!(endDt > startDt)) return false;

    const toDayOfWeek = (d) => ((d.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    const minutesOfDay = (d) => (d.getHours() * 60) + d.getMinutes();
    const dow = toDayOfWeek(startDt);
    const segStartMin = minutesOfDay(startDt);
    const segEndMin = minutesOfDay(endDt);

    for (const entry of blockedSchedule) {
      if (!entry || entry.day_of_week !== dow) continue;
      const [sh, sm] = String(entry.start).split(':').map((n) => parseInt(n, 10));
      const [eh, em] = String(entry.end).split(':').map((n) => parseInt(n, 10));
      const blockStartMin = (sh * 60) + sm;
      const blockEndMin = (eh * 60) + em;
      const overlaps = segStartMin < blockEndMin && segEndMin > blockStartMin;
      if (overlaps) return true;
    }
    return false;
  }

  function scheduleReserveAvailabilityCheck() {
    clearTimeout(reserveCheckTimer);
    reserveCheckTimer = setTimeout(() => {
      checkReserveAvailabilityLive();
    }, 250);
  }

  async function checkReserveAvailabilityLive() {
    const seq = ++reserveCheckSeq;

    const labId = $('#reserveLab')?.value;
    const date = $('#reserveDate')?.value;
    const startTime = $('#reserveStartTime')?.value;
    const endTime = $('#reserveEndTime')?.value;

    // If incomplete, don't block submission.
    if (!labId || !date || !startTime || !endTime) {
      setFormMessage('reserveFormMessage', '', { sticky: true });
      setReserveSubmitEnabled(true);
      return true;
    }

    const startDt = parseLocalDateTime(date, startTime);
    const endDt = parseLocalDateTime(date, endTime);
    if (!startDt || !endDt) {
      setFormMessage('reserveFormMessage', 'Revisa la fecha y las horas.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    if (!(endDt > startDt)) {
      setFormMessage('reserveFormMessage', 'La hora de fin debe ser mayor que la hora de inicio.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    if (startDt <= new Date()) {
      setFormMessage('reserveFormMessage', 'No se pueden hacer reservas en fechas pasadas. Elige una fecha futura.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    const lab = (Array.isArray(labs) ? labs : []).find((l) => String(l.id) === String(labId));
    if (lab && lab.status === 'maintenance') {
      setFormMessage('reserveFormMessage', 'Este laboratorio está en mantenimiento. Elige otro laboratorio.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    if (lab && isBlockedBySchedule(lab.blocked_schedule, startDt, endDt)) {
      setFormMessage('reserveFormMessage', 'Ese horario no se puede reservar porque el laboratorio está ocupado por clases.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    // Check overlap with existing approved/pending reservations (API endpoint already filters those).
    try {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const existing = await API.getReservationsByLab(labId, dayStart, dayEnd);
      // Ignore stale results if user changed inputs quickly.
      if (seq !== reserveCheckSeq) return false;

      const hasOverlap = Array.isArray(existing) && existing.some((r) => {
        const rs = new Date(r.start_time);
        const re = new Date(r.end_time);
        if (isNaN(rs.getTime()) || isNaN(re.getTime())) return false;
        return rs < endDt && re > startDt;
      });

      if (hasOverlap) {
        setFormMessage('reserveFormMessage', 'Ese laboratorio ya está reservado en ese horario. Elige otra hora o fecha.', { sticky: true });
        setReserveSubmitEnabled(false);
        return false;
      }

      setFormMessage('reserveFormMessage', '', { sticky: true });
      setReserveSubmitEnabled(true);
      return true;
    } catch (err) {
      // If we can't validate (network/auth), don't hard-block.
      const status = err && typeof err.status === 'number' ? err.status : null;
      if (status === 401 || status === 403) {
        setFormMessage('reserveFormMessage', 'Tu sesión expiró. Inicia sesión nuevamente.', { sticky: true });
        setReserveSubmitEnabled(false);
        return false;
      }

      setFormMessage('reserveFormMessage', '', { sticky: true });
      setReserveSubmitEnabled(true);
      return true;
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

    // Live guard: if invalid, stop here (message already shown)
    const ok = await checkReserveAvailabilityLive();
    if (!ok) return;

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
  const MY_RESERVATIONS_PAGE_SIZE = 5;
  let myReservationsCache = [];
  let myReservationsPage = 1;

  async function loadMyReservations() {
    const container = $('#myReservationsList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const reservations = await API.getMyReservations();
      myReservationsCache = reservations;
      myReservationsPage = 1;
      renderMyReservationsPage();
    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  function renderMyReservationsPage() {
    const container = $('#myReservationsList');

    if (myReservationsCache.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📋</div>No tienes reservas</div>';
      return;
    }

    const start = (myReservationsPage - 1) * MY_RESERVATIONS_PAGE_SIZE;
    const end = start + MY_RESERVATIONS_PAGE_SIZE;
    const pageItems = myReservationsCache.slice(start, end);

    let html = pageItems.map(renderReservationCard).join('');

    // Paginator
    const totalPages = Math.ceil(myReservationsCache.length / MY_RESERVATIONS_PAGE_SIZE);
    if (totalPages > 1) {
      html += `
        <div class="pagination" style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; align-items: center;">
          <button class="btn btn--outline btn--sm" id="btnMyResPrev" ${myReservationsPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.875rem; font-weight: 500;">Página ${myReservationsPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnMyResNext" ${myReservationsPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      `;
    }

    container.innerHTML = html;
    attachReservationActions(container);

    const btnPrev = $('#btnMyResPrev');
    const btnNext = $('#btnMyResNext');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (myReservationsPage > 1) {
          myReservationsPage--;
          renderMyReservationsPage();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (myReservationsPage < totalPages) {
          myReservationsPage++;
          renderMyReservationsPage();
        }
      });
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
            <div class="reservation-card__lab"><i class="ph ph-flask"></i> ${r.lab_name}</div>
            <div class="reservation-card__time"><i class="ph ph-clock"></i> ${start} - ${end}</div>
          </div>
          <span class="status-badge status-badge--${r.status}">${translateStatus(r.status)}</span>
        </div>
        ${r.notes ? `<p style="font-size:0.8rem;color:var(--color-gray-500);margin-top:0.5rem"><i class="ph ph-text-align-left"></i> ${r.notes}</p>` : ''}
        <div class="reservation-card__items"><i class="ph ph-package"></i> ${itemsText}</div>
        ${r.status === 'pending' ? `<button class="btn btn--danger btn--sm" style="margin-top:0.75rem" data-action="cancel" data-id="${r.id}"><i class="ph ph-x-circle"></i> Cancelar Reserva</button>` : ''}
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
        sessionStorage.setItem('adminReturnTab', tab.dataset.adminTab);
        $$('.admin-tab').forEach((t) => t.classList.remove('admin-tab--active'));
        tab.classList.add('admin-tab--active');

        const tabsContainer = tab.closest('.admin-tabs');
        if (tabsContainer) {
          requestAnimationFrame(() => {
            tabsContainer.style.setProperty('--pill-left', `${tab.offsetLeft}px`);
            tabsContainer.style.setProperty('--pill-width', `${tab.offsetWidth}px`);
          });
        }

        $$('.admin-panel').forEach((p) => p.classList.add('admin-panel--hidden'));
        const panels = {
          pending: '#adminPending',
          all: '#adminAll',
          labs: '#adminLabs',
          items: '#adminItems',
          faculties: '#adminFaculties',
          programs: '#adminPrograms'
        };
        $(panels[tab.dataset.adminTab]).classList.remove('admin-panel--hidden');

        if (tab.dataset.adminTab === 'pending') loadPendingReservations();
        if (tab.dataset.adminTab === 'all') loadAllReservations();
        if (tab.dataset.adminTab === 'labs') loadLabs();
        if (tab.dataset.adminTab === 'items') loadAdminItems();
        if (tab.dataset.adminTab === 'faculties') loadFaculties();
        if (tab.dataset.adminTab === 'programs') loadPrograms();
      });
    });
  }

  const PENDING_RESERVATIONS_PAGE_SIZE = 5;
  let pendingReservationsCache = [];
  let pendingReservationsPage = 1;

  async function loadPendingReservations() {
    const container = $('#pendingList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const reservations = await API.getReservations({ status: 'pending' });
      pendingReservationsCache = reservations;
      pendingReservationsPage = 1;
      renderPendingReservationsPage();
    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  function renderPendingReservationsPage() {
    const container = $('#pendingList');

    if (pendingReservationsCache.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay solicitudes pendientes</div>';
      return;
    }

    const start = (pendingReservationsPage - 1) * PENDING_RESERVATIONS_PAGE_SIZE;
    const end = start + PENDING_RESERVATIONS_PAGE_SIZE;
    const pageItems = pendingReservationsCache.slice(start, end);

    let html = pageItems.map((r) => renderAdminReservationItem(r, true)).join('');

    // Paginator
    const totalPages = Math.ceil(pendingReservationsCache.length / PENDING_RESERVATIONS_PAGE_SIZE);
    if (totalPages > 1) {
      html += `
        <div class="pagination" style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; align-items: center;">
          <button class="btn btn--outline btn--sm" id="btnPendingPrev" ${pendingReservationsPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.875rem; font-weight: 500;">Página ${pendingReservationsPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnPendingNext" ${pendingReservationsPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      `;
    }

    container.innerHTML = html;
    attachAdminActions(container);

    const btnPrev = $('#btnPendingPrev');
    const btnNext = $('#btnPendingNext');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (pendingReservationsPage > 1) {
          pendingReservationsPage--;
          renderPendingReservationsPage();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (pendingReservationsPage < totalPages) {
          pendingReservationsPage++;
          renderPendingReservationsPage();
        }
      });
    }
  }

  const ALL_RESERVATIONS_PAGE_SIZE = 5;
  let allReservationsCache = [];
  let allReservationsPage = 1;

  async function loadAllReservations() {
    const container = $('#allReservationsList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const reservations = await API.getReservations();
      allReservationsCache = reservations;
      allReservationsPage = 1;
      renderAllReservationsPage();
    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  function renderAllReservationsPage() {
    const container = $('#allReservationsList');

    if (allReservationsCache.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay reservas</div>';
      return;
    }

    const start = (allReservationsPage - 1) * ALL_RESERVATIONS_PAGE_SIZE;
    const end = start + ALL_RESERVATIONS_PAGE_SIZE;
    const pageItems = allReservationsCache.slice(start, end);

    let html = pageItems.map((r) => renderAdminReservationItem(r, false)).join('');

    // Paginator
    const totalPages = Math.ceil(allReservationsCache.length / ALL_RESERVATIONS_PAGE_SIZE);
    if (totalPages > 1) {
      html += `
        <div class="pagination" style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; align-items: center;">
          <button class="btn btn--outline btn--sm" id="btnAllResPrev" ${allReservationsPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.875rem; font-weight: 500;">Página ${allReservationsPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnAllResNext" ${allReservationsPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      `;
    }

    container.innerHTML = html;
    attachAdminActions(container);

    const btnPrev = $('#btnAllResPrev');
    const btnNext = $('#btnAllResNext');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (allReservationsPage > 1) {
          allReservationsPage--;
          renderAllReservationsPage();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (allReservationsPage < totalPages) {
          allReservationsPage++;
          renderAllReservationsPage();
        }
      });
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
          <div class="admin-item__title"><i class="ph ph-flask"></i> ${r.lab_name}</div>
          <div class="admin-item__meta">
            <i class="ph ph-user"></i> Por: ${r.user_name} (${r.user_email})<br>
            <i class="ph ph-clock"></i> ${start} - ${end}<br>
            <i class="ph ph-package"></i> ${itemsText}
            ${r.notes ? '<br><i class="ph ph-text-align-left"></i> ' + r.notes : ''}
          </div>
        </div>
        <span class="status-badge status-badge--${r.status}">${translateStatus(r.status)}</span>
        ${showActions && r.status === 'pending' ? `
          <div class="admin-item__actions">
            <button class="btn btn--success btn--sm" data-action="approve" data-id="${r.id}"><i class="ph ph-check"></i> Aprobar</button>
            <button class="btn btn--danger btn--sm" data-action="reject" data-id="${r.id}"><i class="ph ph-x"></i> Rechazar</button>
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

  // Blocked schedule editor state (pagination)
  const SCHEDULE_PAGE_SIZE = 5;
  let labScheduleDraft = [];
  let labSchedulePage = 1;
  let labScheduleErrorIndices = new Set();

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
    setLabScheduleDraft([]);
  }

  function prepareLabEditorEditFromLab(lab) {
    labEditorMode = 'edit';
    labEditorId = lab.id;
    resetLabEditorMessage();
    document.getElementById('labEditorTitle').textContent = 'Editar Laboratorio';
    document.getElementById('labEditorName').value = lab.name || '';
    document.getElementById('labEditorLocation').value = lab.location || '';
    document.getElementById('labEditorCapacity').value = String(lab.capacity ?? '');
    setLabScheduleDraft(Array.isArray(lab.blocked_schedule) ? lab.blocked_schedule : []);
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

  function clearScheduleRowErrors() {
    labScheduleErrorIndices = new Set();
  }

  function ensureScheduleHeader() {
    const list = document.getElementById('labScheduleList');
    if (!list) return;
    if (list.querySelector('.lab-schedule-header')) return;
    list.insertAdjacentHTML(
      'afterbegin',
      `
        <div class="lab-schedule-header" aria-hidden="true">
          <div>Día</div>
          <div>Clase</div>
          <div>Inicio</div>
          <div>Fin</div>
          <div></div>
        </div>
      `
    );
  }

  function focusScheduleRow(index, preferredField = 'name') {
    const row = document.querySelector(`#labScheduleList .lab-schedule-row[data-index="${index}"]`);
    if (!row) return;
    const order = [preferredField, 'day', 'start', 'end', 'name'];
    for (const f of order) {
      const el = row.querySelector(`[data-field="${f}"]`);
      if (el && typeof el.focus === 'function') {
        el.focus();
        return;
      }
    }
  }

  function normalizeScheduleEntry(entry) {
    const day = parseInt(entry?.day_of_week, 10);
    return {
      day_of_week: Number.isFinite(day) && day >= 1 && day <= 7 ? day : 1,
      name: (entry?.name || '').toString(),
      start: (entry?.start || '07:00').toString(),
      end: (entry?.end || '08:00').toString(),
    };
  }

  function getScheduleTotalPages() {
    return Math.max(1, Math.ceil(labScheduleDraft.length / SCHEDULE_PAGE_SIZE));
  }

  function setLabScheduleDraft(entries) {
    labScheduleDraft = Array.isArray(entries) ? entries.map(normalizeScheduleEntry) : [];
    labSchedulePage = 1;
    clearScheduleRowErrors();
    renderSchedulePage();
  }

  function renderSchedulePage() {
    const list = document.getElementById('labScheduleList');
    if (!list) return;

    if (!Array.isArray(labScheduleDraft) || labScheduleDraft.length === 0) {
      list.innerHTML = '<div class="items-selector__hint">Sin horarios bloqueados. Agrega si el laboratorio tiene clases.</div>';
      return;
    }

    const totalPages = getScheduleTotalPages();
    labSchedulePage = Math.min(Math.max(1, labSchedulePage), totalPages);

    const startIdx = (labSchedulePage - 1) * SCHEDULE_PAGE_SIZE;
    const pageEntries = labScheduleDraft.slice(startIdx, startIdx + SCHEDULE_PAGE_SIZE);

    list.innerHTML = '';
    ensureScheduleHeader();

    const rowHtml = (entry, globalIdx) => {
      const dayVal = entry.day_of_week;
      const nameVal = (entry.name || '').replace(/"/g, '&quot;');
      const startVal = entry.start || '07:00';
      const endVal = entry.end || '08:00';
      const hasError = labScheduleErrorIndices.has(globalIdx);
      return `
        <div class="lab-schedule-row ${hasError ? 'lab-schedule-row--error' : ''}" data-index="${globalIdx}">
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

    list.insertAdjacentHTML(
      'beforeend',
      pageEntries.map((entry, offset) => rowHtml(entry, startIdx + offset)).join('')
    );

    const prevDisabled = labSchedulePage <= 1;
    const nextDisabled = labSchedulePage >= totalPages;
    list.insertAdjacentHTML(
      'beforeend',
      `
        <div class="lab-schedule-pager" aria-label="Paginación de horarios">
          <button class="btn btn--outline btn--sm" type="button" data-action="schedule-prev" ${prevDisabled ? 'disabled' : ''}>Anterior</button>
          <div class="lab-schedule-pager__text">Página ${labSchedulePage} de ${totalPages}</div>
          <button class="btn btn--outline btn--sm" type="button" data-action="schedule-next" ${nextDisabled ? 'disabled' : ''}>Siguiente</button>
        </div>
      `
    );
  }

  function getScheduleFromEditor() {
    const schedule = [];
    clearScheduleRowErrors();

    // Basic validation
    for (let i = 0; i < labScheduleDraft.length; i++) {
      const entry = normalizeScheduleEntry(labScheduleDraft[i]);
      const day = parseInt(entry.day_of_week, 10);
      const start = entry.start;
      const end = entry.end;
      const className = (entry.name || '').trim();

      if (!day || !start || !end) {
        labScheduleErrorIndices.add(i);
        labSchedulePage = Math.floor(i / SCHEDULE_PAGE_SIZE) + 1;
        renderSchedulePage();
        focusScheduleRow(i, !day ? 'day' : (!start ? 'start' : 'end'));
        const err = new Error('Completa Día, Inicio y Fin en los horarios de clases.');
        err.code = 'schedule_incomplete';
        throw err;
      }

      const sMin = parseHHMMToMinutes(start);
      const eMin = parseHHMMToMinutes(end);
      if (sMin === null || eMin === null || !(eMin > sMin)) {
        labScheduleErrorIndices.add(i);
        labSchedulePage = Math.floor(i / SCHEDULE_PAGE_SIZE) + 1;
        renderSchedulePage();
        focusScheduleRow(i, 'end');
        const err = new Error('Revisa los horarios: la hora fin debe ser mayor que la hora inicio.');
        err.code = 'schedule_invalid';
        throw err;
      }

      schedule.push({ day_of_week: day, start, end, name: className });
    }

    // prevent overlaps for same day (and highlight all entries for that day)
    const byDay = new Map();
    for (let i = 0; i < schedule.length; i++) {
      const entry = schedule[i];
      if (!byDay.has(entry.day_of_week)) byDay.set(entry.day_of_week, []);
      byDay.get(entry.day_of_week).push({ idx: i, ...entry, s: parseHHMMToMinutes(entry.start), t: parseHHMMToMinutes(entry.end) });
    }

    for (const [day, entries] of byDay.entries()) {
      const sorted = entries.slice().sort((a, b) => a.s - b.s);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].s < sorted[i - 1].t) {
          // mark all rows for the conflicting day
          entries.forEach((e) => labScheduleErrorIndices.add(e.idx));

          const firstIdx = Math.min(...entries.map((e) => e.idx));
          labSchedulePage = Math.floor(firstIdx / SCHEDULE_PAGE_SIZE) + 1;
          renderSchedulePage();
          focusScheduleRow(firstIdx, 'start');

          const label = LAB_DAYS.find((d) => d.value === day)?.label || 'Ese día';
          const err = new Error(`Hay horarios de clases que se traslapan en ${label}.`);
          err.code = 'schedule_overlap';
          throw err;
        }
      }
    }

    return schedule;
  }

  function addEmptyScheduleRow() {
    resetLabEditorMessage();
    clearScheduleRowErrors();

    // Insert new schedule first
    labScheduleDraft.unshift(normalizeScheduleEntry({ day_of_week: 1, start: '07:00', end: '08:00', name: '' }));
    labSchedulePage = 1;
    renderSchedulePage();

    // Focus name of the first row (new entry)
    const firstRow = document.querySelector('#labScheduleList .lab-schedule-row[data-index="0"]');
    firstRow?.querySelector('[data-field="name"]')?.focus?.();
  }

  function openLabEditorCreate() {
    navigateToLabEditor(null);
  }

  function openLabEditorEdit(lab) {
    navigateToLabEditor(lab.id);
  }

  const ADMIN_LABS_PAGE_SIZE = 5;
  let adminLabsPage = 1;

  function renderAdminLabs() {
    const container = $('#adminLabsList');
    if (!container) return;

    if (labs.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay laboratorios</div>';
      return;
    }

    const start = (adminLabsPage - 1) * ADMIN_LABS_PAGE_SIZE;
    const end = start + ADMIN_LABS_PAGE_SIZE;
    const pageItems = labs.slice(start, end);

    let html = pageItems
      .map(
        (lab) => `
      <div class="admin-item">
        <div class="admin-item__info">
          <div class="admin-item__title">${lab.name}</div>
          <div class="admin-item__meta">📍 ${lab.location} | 👥 Capacidad: ${lab.capacity}</div>
        </div>
        <span class="status-badge status-badge--${lab.status === 'active' ? 'approved' : 'rejected'}"><span class="status-badge__text">${lab.status === 'active' ? 'Activo' : 'Mantenimiento'}</span></span>
        <div class="admin-item__actions">
          <button class="btn btn--secondary btn--sm" data-action="edit-lab" data-id="${lab.id}"><i class="ph ph-pencil-simple"></i> Editar</button>
          <button class="btn btn--secondary btn--sm" data-action="toggle-lab" data-id="${lab.id}"><i class="ph ${lab.status === 'active' ? 'ph-power' : 'ph-check'}"></i> ${lab.status === 'active' ? 'Desactivar' : 'Activar'}</button>
        </div>
      </div>
    `
      )
      .join('');

    // Paginator
    const totalPages = Math.ceil(labs.length / ADMIN_LABS_PAGE_SIZE);
    if (totalPages > 1) {
      html += `
        <div class="pagination" style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; align-items: center;">
          <button class="btn btn--outline btn--sm" id="btnLabsPrev" ${adminLabsPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.875rem; font-weight: 500;">Página ${adminLabsPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnLabsNext" ${adminLabsPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      `;
    }

    container.innerHTML = html;

    const btnPrev = $('#btnLabsPrev');
    const btnNext = $('#btnLabsNext');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (adminLabsPage > 1) {
          adminLabsPage--;
          renderAdminLabs();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (adminLabsPage < totalPages) {
          adminLabsPage++;
          renderAdminLabs();
        }
      });
    }

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

        const card = this.closest('.admin-item');
        const badge = card ? card.querySelector('.status-badge') : null;

        if (card) {
          card.classList.add('admin-item--updating');
        }
        this.disabled = true;

        const newStatus = lab.status === 'active' ? 'maintenance' : 'active';
        try {
          await API.updateLab(lab.id, { status: newStatus });

          // Update local state in memory
          lab.status = newStatus;

          // Update DOM in-place with animations
          if (badge) {
            const textSpan = badge.querySelector('.status-badge__text') || badge;

            // 1. Prepare colors for the sweep and transition classes
            badge.className = 'status-badge';
            if (newStatus === 'active') {
              badge.classList.add('status-badge--approved-sweep');
            } else {
              badge.classList.add('status-badge--rejected-sweep');
            }

            // 2. Hide text (slide to the right)
            textSpan.classList.add('status-badge__text--hidden-right');

            // Force reflow
            badge.offsetHeight;

            // 3. Trigger sweep animation (starts from left to right)
            badge.classList.add('status-badge--sweeping');

            // 4. Change text content and slide it back in from the left
            setTimeout(() => {
              textSpan.textContent = newStatus === 'active' ? 'Activo' : 'Mantenimiento';
              textSpan.classList.remove('status-badge__text--hidden-right');
              textSpan.classList.add('status-badge__text--hidden-left');

              // Force reflow
              badge.offsetHeight;

              textSpan.classList.remove('status-badge__text--hidden-left');
            }, 200);

            // 5. Finalize animation state (550ms, once sweep is finished)
            setTimeout(() => {
              badge.className = 'status-badge';
              if (newStatus === 'active') {
                badge.classList.add('status-badge--approved', 'status-badge--pulse-approved');
              } else {
                badge.classList.add('status-badge--rejected', 'status-badge--pulse-rejected');
              }

              // Remove pulse classes after it completes
              setTimeout(() => {
                badge.classList.remove('status-badge--pulse-approved', 'status-badge--pulse-rejected');
              }, 600);
            }, 550);
          }

          // Update the button icon and text
          this.innerHTML = `<i class="ph ${newStatus === 'active' ? 'ph-power' : 'ph-check'}"></i> ${newStatus === 'active' ? 'Desactivar' : 'Activar'}`;

          // Keep selects synchronized on other views (e.g. calendar/reservations)
          populateLabSelects();

          // After all animations complete, clean up card updating states and button
          setTimeout(() => {
            if (card) card.classList.remove('admin-item--updating');
            this.disabled = false;
          }, 600);

        } catch (err) {
          if (card) card.classList.remove('admin-item--updating');
          this.disabled = false;
          showAlert(getFriendlyErrorMessage(err, { action: 'update', entity: 'lab' }), 'No se pudo actualizar el laboratorio');
        }
      });
    });
  }

  // --- Admin Items ---
  const ADMIN_ITEMS_PAGE_SIZE = 5;
  let adminItemsPage = 1;
  let adminItemsStatsMap = {};

  async function loadAdminItems() {
    const container = $('#adminItemsList');
    container.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const [allItems, stats] = await Promise.all([
        API.getItems(),
        API.getItemStats()
      ]);
      items = allItems;

      if (allItems.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay materiales</div>';
        return;
      }

      adminItemsStatsMap = {};
      stats.forEach(s => {
        adminItemsStatsMap[s.item_id] = s;
      });

      adminItemsPage = 1;
      renderAdminItems();

    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  function renderAdminItems() {
    const container = $('#adminItemsList');

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay materiales</div>';
      return;
    }

    const start = (adminItemsPage - 1) * ADMIN_ITEMS_PAGE_SIZE;
    const end = start + ADMIN_ITEMS_PAGE_SIZE;
    const pageItems = items.slice(start, end);

    let html = pageItems
      .map(
        (item) => {
          const itemStats = adminItemsStatsMap[item.id] || {};
          const timesReserved = itemStats.times_reserved || 0;
          const pct = item.total_stock > 0 ? (item.available_stock / item.total_stock) * 100 : 0;
          const barClass = pct > 50 ? 'high' : pct > 20 ? 'medium' : 'low';

          return `
          <div class="inventory-card" style="margin-bottom: 0;">
            <div class="inventory-card__header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div>
                <div class="inventory-card__name">${item.name}</div>
                <div class="inventory-card__lab">${item.lab_name} - <span style="font-size: 0.8em; color: var(--color-gray-500);">${item.description || 'Sin descripcion'}</span></div>
              </div>
              <div class="admin-item__actions" style="margin-top: 0;">
                <button class="btn btn--secondary btn--sm" data-action="edit-item" data-id="${item.id}"><i class="ph ph-pencil-simple"></i> Editar</button>
                <button class="btn btn--danger btn--sm" data-action="delete-item" data-id="${item.id}"><i class="ph ph-trash"></i> Eliminar</button>
              </div>
            </div>
            <div class="inventory-card__progress">
              <div class="inventory-card__progress-bar inventory-card__progress-bar--${barClass}" style="width:${pct}%"></div>
            </div>
            <div class="inventory-card__stats" style="margin-top: 0.5rem;">
              <span>Disponible: ${item.available_stock}/${item.total_stock}</span>
              <span>Reservas: ${timesReserved}</span>
            </div>
          </div>
          `;
        }
      )
      .join('');

    // Paginator
    const totalPages = Math.ceil(items.length / ADMIN_ITEMS_PAGE_SIZE);
    if (totalPages > 1) {
      html += `
        <div class="pagination" style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; align-items: center;">
          <button class="btn btn--outline btn--sm" id="btnItemsPrev" ${adminItemsPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.875rem; font-weight: 500;">Página ${adminItemsPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnItemsNext" ${adminItemsPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      `;
    }

    container.innerHTML = html;

    const btnPrev = $('#btnItemsPrev');
    const btnNext = $('#btnItemsNext');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (adminItemsPage > 1) {
          adminItemsPage--;
          renderAdminItems();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (adminItemsPage < totalPages) {
          adminItemsPage++;
          renderAdminItems();
        }
      });
    }

    container.querySelectorAll('[data-action="edit-item"]').forEach((btn) => {
      btn.addEventListener('click', function () {
        const item = items.find((i) => String(i.id) === String(this.dataset.id));
        if (!item) return;
        openItemEditorEdit(item);
      });
    });

    container.querySelectorAll('[data-action="delete-item"]').forEach((btn) => {
      btn.addEventListener('click', async function () {
        const item = items.find((i) => String(i.id) === String(this.dataset.id));
        if (!item) return;

        const ok = await showConfirm(
          `¿Estás seguro de eliminar el material "${item.name}"? Esta acción no se puede deshacer.`,
          'Eliminar Material',
          { confirmText: 'Eliminar', cancelText: 'Cancelar' }
        );
        if (!ok) return;

        try {
          await API.deleteItem(item.id);
          loadAdminItems();
        } catch (err) {
          showAlert(getFriendlyErrorMessage(err, { action: 'delete', entity: 'item' }), 'No se pudo eliminar el material');
        }
      });
    });
  }

  function resetItemEditorMessage() {
    setFormMessage('itemEditorMessage', '');
  }

  function populateItemEditorLabSelect(selectedValue) {
    const labSelect = document.getElementById('itemEditorLab');
    if (!labSelect) return;
    labSelect.innerHTML = '<option value="">Seleccionar laboratorio</option>';
    labs.filter((l) => l.status === 'active').forEach((lab) => {
      const opt = document.createElement('option');
      opt.value = lab.id;
      opt.textContent = lab.name;
      labSelect.appendChild(opt);
    });
    if (selectedValue) {
      labSelect.value = selectedValue;
    }
  }

  function prepareItemEditorCreate() {
    itemEditorMode = 'create';
    itemEditorId = null;
    resetItemEditorMessage();
    document.getElementById('itemEditorTitle').textContent = 'Nuevo Material';
    document.getElementById('itemEditorName').value = '';
    document.getElementById('itemEditorDescription').value = '';
    document.getElementById('itemEditorStock').value = '';

    populateItemEditorLabSelect(null);
  }

  function prepareItemEditorEditFromItem(item) {
    itemEditorMode = 'edit';
    itemEditorId = item.id;
    resetItemEditorMessage();
    document.getElementById('itemEditorTitle').textContent = 'Editar Material';
    document.getElementById('itemEditorName').value = item.name || '';
    document.getElementById('itemEditorDescription').value = item.description || '';
    document.getElementById('itemEditorStock').value = String(item.total_stock ?? '');

    populateItemEditorLabSelect(item.lab_id);
  }

  async function loadItemEditorFromId(itemId) {
    const idStr = String(itemId);
    try {
      const item = await API.get(`/items/${idStr}`);
      const idx = items.findIndex((i) => String(i.id) === idStr);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      prepareItemEditorEditFromItem(item);
    } catch (err) {
      const cached = items.find((i) => String(i.id) === idStr);
      if (cached) {
        prepareItemEditorEditFromItem(cached);
      } else {
        prepareItemEditorCreate();
        showAlert('No se pudo cargar la informacion del material.', 'Error');
      }
    }
  }

  function openItemEditorCreate() {
    navigateToItemEditor(null);
  }

  function openItemEditorEdit(item) {
    navigateToItemEditor(item.id);
  }

  // --- Modals ---
  function initModals() {
    // Lab editor → standalone page
    $('#addLabBtn')?.addEventListener('click', () => {
      openLabEditorCreate();
    });

    // Item editor → standalone page
    $('#addItemBtn')?.addEventListener('click', () => {
      openItemEditorCreate();
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
    const startDate = $('#reportStartDate').value;
    const endDate = $('#reportEndDate').value;
    const container = $('#reportContent');

    if (!startDate || !endDate) {
      container.innerHTML = '<div class="empty-state empty-state--error">Selecciona fecha inicial y fecha final</div>';
      return;
    }

    container.innerHTML = '<div class="loading">Generando reporte</div>';

    try {
      const report = await API.getReportByDateRange(startDate, endDate);

      if (report.length === 0) {
        container.innerHTML = `<div class="empty-state">No hay datos del ${new Date(startDate + 'T00:00:00').toLocaleDateString('es-ES')} al ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-ES')}</div>`;
        return;
      }

      const totalReservations = report.length;
      const approved = report.filter((r) => r.status === 'approved').length;
      const pending = report.filter((r) => r.status === 'pending').length;
      const totalHours = report.reduce((sum, r) => sum + parseFloat(r.duration_hours), 0);

      let html = `
        <div class="report-summary">
          <div class="report-summary__title">Resumen: ${new Date(startDate + 'T00:00:00').toLocaleDateString('es-ES')} al ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-ES')}</div>
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

        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-wrapper"><canvas id="statusChart"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="chart-wrapper"><canvas id="labChart"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="chart-wrapper"><canvas id="hoursChart"></canvas></div>
          </div>
          <div class="chart-card chart-card--wide">
            <div class="chart-wrapper"><canvas id="trendChart"></canvas></div>
          </div>
        </div>

        <div id="reportTableContainer"></div>
      `;
      container.innerHTML = html;

      let currentPage = 1;
      const itemsPerPage = 5;

      const renderTablePage = (page) => {
        const tableContainer = document.getElementById('reportTableContainer');
        if (!tableContainer) return;

        const totalPages = Math.ceil(report.length / itemsPerPage);
        if (totalPages === 0) {
          tableContainer.innerHTML = '<div class="empty-state">No hay reservas para mostrar.</div>';
          return;
        }

        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;

        const startIdx = (page - 1) * itemsPerPage;
        const pageItems = report.slice(startIdx, startIdx + itemsPerPage);

        let tableHtml = `
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

        pageItems.forEach((r) => {
          const date = new Date(r.start_time).toLocaleDateString('es-ES');
          const items = r.items_used && r.items_used.length > 0
            ? r.items_used.map((i) => `${i.item_name} x${i.quantity}`).join(', ')
            : '-';

          tableHtml += `
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

        tableHtml += '</tbody></table>';

        if (totalPages > 1) {
          tableHtml += `
            <div class="pagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
              <button class="btn btn--outline" id="prevPageBtn" ${page === 1 ? 'disabled' : ''}>Anterior</button>
              <span style="display: flex; align-items: center; color: var(--color-gray-600);">Página ${page} de ${totalPages}</span>
              <button class="btn btn--outline" id="nextPageBtn" ${page === totalPages ? 'disabled' : ''}>Siguiente</button>
            </div>
          `;
        }

        tableContainer.innerHTML = tableHtml;

        if (totalPages > 1) {
          document.getElementById('prevPageBtn')?.addEventListener('click', () => renderTablePage(currentPage - 1));
          document.getElementById('nextPageBtn')?.addEventListener('click', () => renderTablePage(currentPage + 1));
        }
      };

      renderTablePage(1);

      // Generar Gráficas Dinámicas con Chart.js
      if (window.reportChartStatus) window.reportChartStatus.destroy();
      if (window.reportChartLab) window.reportChartLab.destroy();
      if (window.reportChartHours) window.reportChartHours.destroy();
      if (window.reportChartTrend) window.reportChartTrend.destroy();

      // Prepare chart data
      const statusCounts = { aprobadas: 0, pendientes: 0, rechazadas: 0, canceladas: 0 };
      const labCounts = {};
      const hoursPerLab = {};
      const datesTrend = {};

      report.forEach(r => {
        // Status
        if (r.status === 'approved') statusCounts.aprobadas++;
        else if (r.status === 'pending') statusCounts.pendientes++;
        else if (r.status === 'rejected') statusCounts.rechazadas++;
        else if (r.status === 'cancelled') statusCounts.canceladas++;

        // Lab counts
        const labName = r.lab_name || 'Desconocido';
        labCounts[labName] = (labCounts[labName] || 0) + 1;

        // Hours per lab
        const hours = parseFloat(r.duration_hours) || 0;
        hoursPerLab[labName] = (hoursPerLab[labName] || 0) + hours;

        // Trend over time
        const dateStr = r.start_time.split('T')[0];
        datesTrend[dateStr] = (datesTrend[dateStr] || 0) + 1;
      });

      // Sort dates for trend chart
      const sortedDates = Object.keys(datesTrend).sort();
      const trendData = sortedDates.map(date => datesTrend[date]);

      const isDarkMode = document.documentElement.classList.contains('theme-dark');
      const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';

      const ctxStatus = document.getElementById('statusChart').getContext('2d');
      window.reportChartStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['Pendientes', 'Aprobadas', 'Rechazadas', 'Canceladas'],
          datasets: [{
            data: [statusCounts.pendientes, statusCounts.aprobadas, statusCounts.rechazadas, statusCounts.canceladas],
            backgroundColor: ['#eab308', '#22c55e', '#ef4444', '#64748b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 15 },
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor } },
            title: { display: true, text: 'Estado de Reservas', color: textColor, font: { size: 16 } }
          }
        }
      });

      const ctxLab = document.getElementById('labChart').getContext('2d');
      window.reportChartLab = new Chart(ctxLab, {
        type: 'bar',
        data: {
          labels: Object.keys(labCounts),
          datasets: [{
            label: 'Reservas',
            data: Object.values(labCounts),
            backgroundColor: '#3b82f6',
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { left: 10, right: 20, top: 10, bottom: 10 } },
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Reservas por Laboratorio', color: textColor, font: { size: 16 } }
          },
          scales: {
            x: { beginAtZero: true, ticks: { stepSize: 1, color: textColor }, grid: { color: isDarkMode ? '#334155' : '#e2e8f0' } },
            y: { ticks: { color: textColor }, grid: { display: false } }
          }
        }
      });

      const ctxHours = document.getElementById('hoursChart').getContext('2d');
      window.reportChartHours = new Chart(ctxHours, {
        type: 'bar',
        data: {
          labels: Object.keys(hoursPerLab),
          datasets: [{
            label: 'Horas Reservadas',
            data: Object.values(hoursPerLab).map(h => h.toFixed(1)),
            backgroundColor: '#10b981',
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { left: 10, right: 20, top: 10, bottom: 10 } },
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Horas de Uso por Laboratorio', color: textColor, font: { size: 16 } }
          },
          scales: {
            x: { beginAtZero: true, ticks: { color: textColor }, grid: { color: isDarkMode ? '#334155' : '#e2e8f0' } },
            y: { ticks: { color: textColor }, grid: { display: false } }
          }
        }
      });

      const ctxTrend = document.getElementById('trendChart').getContext('2d');
      window.reportChartTrend = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: sortedDates,
          datasets: [{
            label: 'Reservas',
            data: trendData,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { left: 10, right: 20, top: 10, bottom: 10 } },
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Tendencia de Reservas por Día', color: textColor, font: { size: 16 } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: textColor }, grid: { color: isDarkMode ? '#334155' : '#e2e8f0' } },
            x: { ticks: { color: textColor }, grid: { display: false } }
          }
        }
      });

    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  // --- Admin Faculties ---
  async function loadFaculties() {
    const container = $('#adminFacultiesList');
    container.innerHTML = '<div class="loading">Cargando Facultades</div>';
    try {
      faculties = await API.getFaculties();
      renderAdminFacultiesList();
    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  const ADMIN_FACULTIES_PAGE_SIZE = 5;

  function renderAdminFacultiesList() {
    const container = $('#adminFacultiesList');
    if (!container) return;

    if (faculties.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay facultades registradas</div>';
      return;
    }

    const start = (adminFacultiesPage - 1) * ADMIN_FACULTIES_PAGE_SIZE;
    const end = start + ADMIN_FACULTIES_PAGE_SIZE;
    const pageItems = faculties.slice(start, end);

    let html = pageItems.map(f => `
      <div class="admin-item">
        <div class="admin-item__info">
          <div class="admin-item__title">${f.name}</div>
        </div>
        <div class="admin-item__actions">
          <button class="btn btn--secondary btn--sm edit-faculty-btn" data-id="${f.id}"><i class="ph ph-pencil-simple"></i> Editar</button>
          <button class="btn btn--danger btn--sm delete-faculty-btn" data-id="${f.id}"><i class="ph ph-trash"></i> Eliminar</button>
        </div>
      </div>
    `).join('');

    // Paginator
    const totalPages = Math.ceil(faculties.length / ADMIN_FACULTIES_PAGE_SIZE);
    if (totalPages > 1) {
      html += `
        <div class="pagination" style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; align-items: center;">
          <button class="btn btn--outline btn--sm" id="btnFacultiesPrev" ${adminFacultiesPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.875rem; font-weight: 500;">Página ${adminFacultiesPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnFacultiesNext" ${adminFacultiesPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      `;
    }

    container.innerHTML = html;

    const btnPrev = $('#btnFacultiesPrev');
    const btnNext = $('#btnFacultiesNext');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (adminFacultiesPage > 1) {
          adminFacultiesPage--;
          renderAdminFacultiesList();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (adminFacultiesPage < totalPages) {
          adminFacultiesPage++;
          renderAdminFacultiesList();
        }
      });
    }

    container.querySelectorAll('.edit-faculty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fac = faculties.find(x => x.id === btn.dataset.id);
        if (fac) window.location.href = '/faculty-editor.html?id=' + encodeURIComponent(fac.id);
      });
    });

    container.querySelectorAll('.delete-faculty-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await showConfirm('¿Seguro de eliminar esta facultad?', 'Eliminar Facultad');
        if (!ok) return;
        try {
          await API.deleteFaculty(btn.dataset.id);
          loadFaculties();
        } catch (err) {
          showAlert(getFriendlyErrorMessage(err), 'Error');
        }
      });
    });
  }

  $('#addFacultyBtn')?.addEventListener('click', () => {
    window.location.href = '/faculty-editor.html';
  });

  // --- Admin Programs ---
  async function loadPrograms() {
    const container = $('#adminProgramsList');
    container.innerHTML = '<div class="loading">Cargando Programas</div>';
    try {
      programs = await API.getPrograms();
      renderAdminProgramsList();
    } catch (err) {
      container.innerHTML = renderErrorEmptyState(err);
    }
  }

  const ADMIN_PROGRAMS_PAGE_SIZE = 5;

  function renderAdminProgramsList() {
    const container = $('#adminProgramsList');
    if (!container) return;

    if (programs.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay programas registrados</div>';
      return;
    }

    const start = (adminProgramsPage - 1) * ADMIN_PROGRAMS_PAGE_SIZE;
    const end = start + ADMIN_PROGRAMS_PAGE_SIZE;
    const pageItems = programs.slice(start, end);

    let html = pageItems.map(p => `
      <div class="admin-item">
        <div class="admin-item__info">
          <div class="admin-item__title">${p.name}</div>
          <div class="admin-item__meta"><i class="ph-duotone ph-buildings"></i> ${p.faculty_name}</div>
        </div>
        <div class="admin-item__actions">
          <button class="btn btn--secondary btn--sm edit-program-btn" data-id="${p.id}"><i class="ph ph-pencil-simple"></i> Editar</button>
          <button class="btn btn--danger btn--sm delete-program-btn" data-id="${p.id}"><i class="ph ph-trash"></i> Eliminar</button>
        </div>
      </div>
    `).join('');

    // Paginator
    const totalPages = Math.ceil(programs.length / ADMIN_PROGRAMS_PAGE_SIZE);
    if (totalPages > 1) {
      html += `
        <div class="pagination" style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; align-items: center;">
          <button class="btn btn--outline btn--sm" id="btnProgramsPrev" ${adminProgramsPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.875rem; font-weight: 500;">Página ${adminProgramsPage} de ${totalPages}</span>
          <button class="btn btn--outline btn--sm" id="btnProgramsNext" ${adminProgramsPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      `;
    }

    container.innerHTML = html;

    const btnPrev = $('#btnProgramsPrev');
    const btnNext = $('#btnProgramsNext');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (adminProgramsPage > 1) {
          adminProgramsPage--;
          renderAdminProgramsList();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (adminProgramsPage < totalPages) {
          adminProgramsPage++;
          renderAdminProgramsList();
        }
      });
    }

    container.querySelectorAll('.edit-program-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prog = programs.find(x => x.id === btn.dataset.id);
        if (prog) window.location.href = '/program-editor.html?id=' + encodeURIComponent(prog.id);
      });
    });

    container.querySelectorAll('.delete-program-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await showConfirm('¿Seguro de eliminar este programa?', 'Eliminar Programa');
        if (!ok) return;
        try {
          await API.deleteProgram(btn.dataset.id);
          loadPrograms();
        } catch (err) {
          showAlert(getFriendlyErrorMessage(err), 'Error');
        }
      });
    });
  }

  $('#addProgramBtn')?.addEventListener('click', () => {
    window.location.href = '/program-editor.html';
  });

  // --- Init ---
  function init() {
    API.token = API.getToken();

    initTheme();
    initAdminTabs();
    initModals();

    $('#loginForm').addEventListener('submit', handleLogin);
    $('#logoutBtn').addEventListener('click', handleLogout);

    $('#forgotPasswordLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      setFormMessage('forgotPasswordFormMessage', '');
      $('#forgotPasswordForm').reset();
      $('#forgotPasswordModal').classList.add('modal--active');
    });
    $('#closeForgotPasswordModal')?.addEventListener('click', () => {
      $('#forgotPasswordModal').classList.remove('modal--active');
    });
    $('#forgotPasswordForm')?.addEventListener('submit', handleForgotPasswordSubmit);

    $('#profileSettingsForm')?.addEventListener('submit', handleProfileSettingsSubmit);
    $('#passwordSettingsForm')?.addEventListener('submit', handlePasswordSettingsSubmit);

    $('#loadCalendarBtn').addEventListener('click', loadCalendar);
    $('#calendarPrevWeekBtn')?.addEventListener('click', () => {
      console.log('[DEBUG CLICK] Clicked Prev Week');
      currentCalendarDate.setDate(currentCalendarDate.getDate() - 7);
      loadCalendar();
    });
    $('#calendarNextWeekBtn')?.addEventListener('click', () => {
      console.log('[DEBUG CLICK] Clicked Next Week');
      currentCalendarDate.setDate(currentCalendarDate.getDate() + 7);
      loadCalendar();
    });
    $('#calendarLabSelect')?.addEventListener('change', () => {
      console.log('[DEBUG CLICK] Lab changed. Resetting currentCalendarDate');
      currentCalendarDate = new Date();
    });
    $('#reserveLab').addEventListener('change', onLabChangeForReserve);
    $('#reserveForm').addEventListener('submit', handleReserve);
    $('#reserveDate')?.addEventListener('change', scheduleReserveAvailabilityCheck);
    $('#reserveStartTime')?.addEventListener('change', scheduleReserveAvailabilityCheck);
    $('#reserveEndTime')?.addEventListener('change', scheduleReserveAvailabilityCheck);
    $('#reserveStartTime')?.addEventListener('input', scheduleReserveAvailabilityCheck);
    $('#reserveEndTime')?.addEventListener('input', scheduleReserveAvailabilityCheck);
    $('#reserveDate')?.addEventListener('input', scheduleReserveAvailabilityCheck);

    $('#itemLabSelect')?.addEventListener('change', loadAdminItems);

    $('#generateReportBtn').addEventListener('click', generateReport);

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    $('#reserveDate').value = dateStr;
    $('#reserveDate').min = dateStr;

    // Ensure initial state
    setReserveSubmitEnabled(true);
    scheduleReserveAvailabilityCheck();


    // Set default report dates (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    $('#reportStartDate').value = firstDay.toISOString().split('T')[0];
    $('#reportEndDate').value = lastDay.toISOString().split('T')[0];

    // Hash-based navigation (supports refresh/F5)
    window.addEventListener('hashchange', routeOnLoadOrHashChange);
    $$('.nav__link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.parentElement.dataset.view;
        navigateTo(view);
      });
    });

    window.addEventListener('resize', () => requestAnimationFrame(updateNavIndicator));

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
