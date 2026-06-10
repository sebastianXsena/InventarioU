(function () {
  'use strict';
  // Tema y auth los maneja shell.js — este script escucha 'shell:ready' para iniciar.

  // --- Helpers ---
  function setMessage(msg) {
    const el = document.getElementById('labEditorMessage');
    if (!el) return;
    if (!msg) { el.textContent = ''; el.classList.add('form-note--hidden'); return; }
    el.textContent = msg;
    el.classList.remove('form-note--hidden');
  }

  function showAlert(message, title) {
    title = title || 'Error';
    const modal = document.getElementById('alertModal');
    if (!modal) { alert(title + '\n\n' + message); return; }
    document.getElementById('alertModalTitle').textContent = title;
    document.getElementById('alertModalMessage').textContent = message;
    modal.classList.add('modal--active');
    const okBtn = document.getElementById('alertModalOk');
    const close = () => { modal.classList.remove('modal--active'); okBtn.removeEventListener('click', close); };
    okBtn.addEventListener('click', close);
  }

  function getFriendlyErrorMessage(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    const raw = err && err.message ? String(err.message) : '';
    if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
    if (status === 403) return 'No tienes permisos para realizar esta acción.';
    if (raw === 'Resource already exists') return 'Ya existe un laboratorio con esos datos.';
    if (raw === 'Invalid data constraints') return 'Los datos ingresados no son válidos. Revisa e inténtalo de nuevo.';
    if (!raw) return 'No se pudo completar la operación. Inténtalo de nuevo.';
    return raw;
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'labs');
    window.location.href = '/#admin';
  }

  // --- State ---
  let labEditorMode = 'create';
  let labEditorId = null;

  const LAB_DAYS = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 7, label: 'Domingo' },
  ];

  const SCHEDULE_PAGE_SIZE = 5;
  let labScheduleDraft = [];
  let labSchedulePage = 1;
  let labScheduleErrorIndices = new Set();

  // --- Schedule Editor ---
  function parseHHMMToMinutes(hhmm) {
    const m = String(hhmm || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    return (parseInt(m[1], 10) * 60) + parseInt(m[2], 10);
  }

  function clearScheduleRowErrors() { labScheduleErrorIndices = new Set(); }

  function ensureScheduleHeader() {
    const list = document.getElementById('labScheduleList');
    if (!list || list.querySelector('.lab-schedule-header')) return;
    list.insertAdjacentHTML('afterbegin', `
      <div class="lab-schedule-header" aria-hidden="true">
        <div>Día</div><div>Clase</div><div>Inicio</div><div>Fin</div><div></div>
      </div>`);
  }

  function focusScheduleRow(index, preferredField) {
    preferredField = preferredField || 'name';
    const row = document.querySelector('#labScheduleList .lab-schedule-row[data-index="' + index + '"]');
    if (!row) return;
    for (const f of [preferredField, 'day', 'start', 'end', 'name']) {
      const el = row.querySelector('[data-field="' + f + '"]');
      if (el && typeof el.focus === 'function') { el.focus(); return; }
    }
  }

  function normalizeScheduleEntry(entry) {
    const day = parseInt(entry && entry.day_of_week, 10);
    return {
      day_of_week: Number.isFinite(day) && day >= 1 && day <= 7 ? day : 1,
      name: String((entry && entry.name) || ''),
      start: String((entry && entry.start) || '07:00'),
      end: String((entry && entry.end) || '08:00'),
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

    if (!labScheduleDraft.length) {
      list.innerHTML = '<div class="items-selector__hint">Sin horarios bloqueados. Agrega si el laboratorio tiene clases.</div>';
      return;
    }

    const totalPages = getScheduleTotalPages();
    labSchedulePage = Math.min(Math.max(1, labSchedulePage), totalPages);
    const startIdx = (labSchedulePage - 1) * SCHEDULE_PAGE_SIZE;
    const pageEntries = labScheduleDraft.slice(startIdx, startIdx + SCHEDULE_PAGE_SIZE);

    list.innerHTML = '';
    ensureScheduleHeader();

    list.insertAdjacentHTML('beforeend', pageEntries.map((entry, offset) => {
      const globalIdx = startIdx + offset;
      const hasError = labScheduleErrorIndices.has(globalIdx);
      const nameVal = (entry.name || '').replace(/"/g, '&quot;');
      return `
        <div class="lab-schedule-row ${hasError ? 'lab-schedule-row--error' : ''}" data-index="${globalIdx}">
          <select class="form-select lab-schedule-row__day" data-field="day">
            ${LAB_DAYS.map(d => `<option value="${d.value}" ${d.value === entry.day_of_week ? 'selected' : ''}>${d.label}</option>`).join('')}
          </select>
          <input class="form-input lab-schedule-row__name" type="text" maxlength="120" data-field="name" value="${nameVal}" placeholder="Nombre de la clase (opcional)">
          <input class="form-input lab-schedule-row__time" type="time" step="900" data-field="start" value="${entry.start || '07:00'}">
          <input class="form-input lab-schedule-row__time" type="time" step="900" data-field="end" value="${entry.end || '08:00'}">
          <button class="btn btn--danger btn--sm" type="button" data-action="remove-schedule" aria-label="Eliminar horario">Eliminar</button>
        </div>`;
    }).join(''));

    list.insertAdjacentHTML('beforeend', `
      <div class="lab-schedule-pager" aria-label="Paginación de horarios">
        <button class="btn btn--outline btn--sm" type="button" data-action="schedule-prev" ${labSchedulePage <= 1 ? 'disabled' : ''}>Anterior</button>
        <div class="lab-schedule-pager__text">Página ${labSchedulePage} de ${totalPages}</div>
        <button class="btn btn--outline btn--sm" type="button" data-action="schedule-next" ${labSchedulePage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>`);
  }

  function getScheduleFromEditor() {
    const schedule = [];
    clearScheduleRowErrors();

    for (let i = 0; i < labScheduleDraft.length; i++) {
      const entry = normalizeScheduleEntry(labScheduleDraft[i]);
      const day = parseInt(entry.day_of_week, 10);
      const start = entry.start;
      const end = entry.end;

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

      schedule.push({ day_of_week: day, start, end, name: (entry.name || '').trim() });
    }

    // Check overlaps per day
    const byDay = new Map();
    for (let i = 0; i < schedule.length; i++) {
      const e = schedule[i];
      if (!byDay.has(e.day_of_week)) byDay.set(e.day_of_week, []);
      byDay.get(e.day_of_week).push({ idx: i, ...e, s: parseHHMMToMinutes(e.start), t: parseHHMMToMinutes(e.end) });
    }

    for (const [day, entries] of byDay.entries()) {
      const sorted = entries.slice().sort((a, b) => a.s - b.s);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].s < sorted[i - 1].t) {
          entries.forEach(e => labScheduleErrorIndices.add(e.idx));
          const firstIdx = Math.min(...entries.map(e => e.idx));
          labSchedulePage = Math.floor(firstIdx / SCHEDULE_PAGE_SIZE) + 1;
          renderSchedulePage();
          focusScheduleRow(firstIdx, 'start');
          const label = LAB_DAYS.find(d => d.value === day)?.label || 'Ese día';
          const err = new Error('Hay horarios de clases que se traslapan en ' + label + '.');
          err.code = 'schedule_overlap';
          throw err;
        }
      }
    }

    return schedule;
  }

  // --- Schedule list event delegation ---
  document.getElementById('labScheduleList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'schedule-prev') {
      if (labSchedulePage > 1) { labSchedulePage--; renderSchedulePage(); }
      return;
    }
    if (action === 'schedule-next') {
      if (labSchedulePage < getScheduleTotalPages()) { labSchedulePage++; renderSchedulePage(); }
      return;
    }
    if (action === 'remove-schedule') {
      const row = btn.closest('.lab-schedule-row');
      if (!row) return;
      const index = parseInt(row.dataset.index, 10);
      if (!Number.isFinite(index) || index < 0 || index >= labScheduleDraft.length) return;
      labScheduleDraft.splice(index, 1);
      clearScheduleRowErrors();
      labSchedulePage = Math.min(labSchedulePage, getScheduleTotalPages());
      renderSchedulePage();
    }
  });

  const onScheduleFieldChange = (e) => {
    const fieldEl = e.target.closest('[data-field]');
    const row = e.target.closest('.lab-schedule-row');
    if (!fieldEl || !row) return;
    const index = parseInt(row.dataset.index, 10);
    if (!Number.isFinite(index) || index < 0 || index >= labScheduleDraft.length) return;
    const field = fieldEl.dataset.field;
    const value = fieldEl.value;
    const entry = labScheduleDraft[index] || normalizeScheduleEntry({});
    if (field === 'day') entry.day_of_week = parseInt(value, 10) || 1;
    if (field === 'name') entry.name = String(value || '');
    if (field === 'start') entry.start = String(value || '');
    if (field === 'end') entry.end = String(value || '');
    labScheduleDraft[index] = entry;
    if (labScheduleErrorIndices.has(index)) {
      labScheduleErrorIndices.delete(index);
      row.classList.remove('lab-schedule-row--error');
    }
  };

  document.getElementById('labScheduleList')?.addEventListener('change', onScheduleFieldChange);
  document.getElementById('labScheduleList')?.addEventListener('input', onScheduleFieldChange);

  document.getElementById('addScheduleRowBtn')?.addEventListener('click', () => {
    setMessage('');
    clearScheduleRowErrors();
    labScheduleDraft.unshift(normalizeScheduleEntry({ day_of_week: 1, start: '07:00', end: '08:00', name: '' }));
    labSchedulePage = 1;
    renderSchedulePage();
    document.querySelector('#labScheduleList .lab-schedule-row[data-index="0"] [data-field="name"]')?.focus();
  });

  // --- Form submit ---
  document.getElementById('labEditorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');

    const name = document.getElementById('labEditorName').value.trim();
    const location = document.getElementById('labEditorLocation').value.trim();
    const capacityRaw = document.getElementById('labEditorCapacity').value;
    const capacity = parseInt(capacityRaw, 10);

    if (!name || !location || !capacityRaw || Number.isNaN(capacity) || capacity < 1) {
      setMessage('Completa Nombre, Ubicación y una Capacidad válida (mínimo 1).');
      return;
    }

    let blocked_schedule = [];
    try {
      blocked_schedule = getScheduleFromEditor();
    } catch (err) {
      setMessage(err.message || 'Revisa los horarios de clases.');
      return;
    }

    const submitBtn = document.querySelector('#labEditorForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

    try {
      if (labEditorMode === 'create') {
        await API.createLab({ name, location, capacity, status: 'active', blocked_schedule });
      } else {
        await API.updateLab(labEditorId, { name, location, capacity, blocked_schedule });
      }
      goBack();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
      const title = labEditorMode === 'create' ? 'No se pudo crear el laboratorio' : 'No se pudo actualizar el laboratorio';
      showAlert(getFriendlyErrorMessage(err), title);
    }
  });

  // --- Cancel ---
  document.getElementById('cancelLabEditorBtn')?.addEventListener('click', goBack);

  // --- Init: espera a que shell.js inyecte el sidebar y valide la sesión ---
  async function init({ user }) {
    if (!user || user.role !== 'admin') { window.location.href = '/'; return; }

    const params = new URLSearchParams(window.location.search);
    const labId = params.get('id');

    if (labId) {
      labEditorMode = 'edit';
      labEditorId = labId;
      document.getElementById('pageTitle').textContent = 'Editar Laboratorio';
      document.getElementById('labEditorTitle').textContent = 'Editar Laboratorio';
      try {
        const lab = await API.getLabById(labId);
        document.getElementById('labEditorName').value = lab.name || '';
        document.getElementById('labEditorLocation').value = lab.location || '';
        document.getElementById('labEditorCapacity').value = String(lab.capacity ?? '');
        setLabScheduleDraft(Array.isArray(lab.blocked_schedule) ? lab.blocked_schedule : []);
      } catch (err) {
        showAlert('No se pudo cargar el laboratorio.', 'Error');
        setLabScheduleDraft([]);
      }
    } else {
      labEditorMode = 'create';
      labEditorId = null;
      document.getElementById('pageTitle').textContent = 'Nuevo Laboratorio';
      document.getElementById('labEditorTitle').textContent = 'Nuevo Laboratorio';
      setLabScheduleDraft([]);
    }
  }

  document.addEventListener('shell:ready', (e) => init(e.detail));
})();
