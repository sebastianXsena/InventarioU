(function (App) {
  'use strict';
  let mode = 'create';
  let editorId = null;
  let draft = [];
  const days = [{ value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' }, { value: 3, label: 'Miércoles' }, { value: 4, label: 'Jueves' }, { value: 5, label: 'Viernes' }, { value: 6, label: 'Sábado' }, { value: 7, label: 'Domingo' }];
  const message = (text) => { const el = document.getElementById('labEditorMessage'); if (el) { el.textContent = text || ''; el.classList.toggle('form-note--hidden', !text); } };
  const back = () => { sessionStorage.setItem('adminReturnTab', 'labs'); window.location.hash = '#admin'; };
  function alertError(text, title) { const modal = document.getElementById('alertModal'); if (!modal) { window.alert((title || 'Error') + '\n\n' + text); return; } document.getElementById('alertModalTitle').textContent = title || 'Error'; document.getElementById('alertModalMessage').textContent = text; modal.classList.add('modal--active'); const button = document.getElementById('alertModalOk'); const close = () => { modal.classList.remove('modal--active'); button.removeEventListener('click', close); }; button.addEventListener('click', close); }
  const normalize = (entry) => ({ day_of_week: Math.max(1, Math.min(7, parseInt(entry && entry.day_of_week, 10) || 1)), name: String(entry && entry.name || ''), start: String(entry && entry.start || '07:00'), end: String(entry && entry.end || '08:00') });
  function renderSchedule() { const list = document.getElementById('labScheduleList'); if (!list) return; if (!draft.length) { list.innerHTML = '<div class="items-selector__hint">Sin horarios bloqueados. Agrega si el laboratorio tiene clases.</div>'; return; } list.innerHTML = draft.map((entry, index) => '<div class="lab-schedule-row" data-index="' + index + '"><select class="form-select" data-field="day">' + days.map((day) => '<option value="' + day.value + '"' + (day.value === entry.day_of_week ? ' selected' : '') + '>' + day.label + '</option>').join('') + '</select><input class="form-input" type="text" maxlength="120" data-field="name" value="' + entry.name.replace(/"/g, '&quot;') + '" placeholder="Nombre de la clase (opcional)"><input class="form-input" type="time" step="900" data-field="start" value="' + entry.start + '"><input class="form-input" type="time" step="900" data-field="end" value="' + entry.end + '"><button class="btn btn--danger btn--sm" type="button" data-action="remove">Eliminar</button></div>').join(''); }
  function scheduleData() { const result = []; const byDay = new Map(); draft.forEach((entry, index) => { const start = entry.start.split(':').map(Number); const end = entry.end.split(':').map(Number); const startMinutes = start[0] * 60 + start[1]; const endMinutes = end[0] * 60 + end[1]; if (!entry.start || !entry.end || endMinutes <= startMinutes) throw new Error('Revisa los horarios: la hora fin debe ser mayor que la hora inicio.'); const current = { day_of_week: entry.day_of_week, start: entry.start, end: entry.end, name: entry.name.trim(), startMinutes, endMinutes, index }; result.push(current); if (!byDay.has(current.day_of_week)) byDay.set(current.day_of_week, []); byDay.get(current.day_of_week).push(current); }); for (const entries of byDay.values()) { entries.sort((a, b) => a.startMinutes - b.startMinutes); for (let index = 1; index < entries.length; index++) if (entries[index].startMinutes < entries[index - 1].endMinutes) throw new Error('Hay horarios de clases que se traslapan.'); } return result.map(({ day_of_week, start, end, name }) => ({ day_of_week, start, end, name })); }
  function scheduleChange(event) { const field = event.target.closest('[data-field]'); const row = event.target.closest('.lab-schedule-row'); if (!field || !row) return; const entry = draft[Number(row.dataset.index)]; if (field.dataset.field === 'day') entry.day_of_week = parseInt(field.value, 10); else entry[field.dataset.field] = field.value; }
  async function submit(event) { event.preventDefault(); message(''); const name = document.getElementById('labEditorName').value.trim(); const location = document.getElementById('labEditorLocation').value.trim(); const capacityRaw = document.getElementById('labEditorCapacity').value; const capacity = parseInt(capacityRaw, 10); if (!name || !location || !capacityRaw || Number.isNaN(capacity) || capacity < 1) { message('Completa Nombre, Ubicación y una Capacidad válida (mínimo 1).'); return; } let blocked_schedule; try { blocked_schedule = scheduleData(); } catch (error) { message(error.message); return; } const button = document.querySelector('#labEditorForm button[type="submit"]'); if (button) { button.disabled = true; button.textContent = 'Guardando...'; } try { const data = { name, location, capacity, blocked_schedule }; if (mode === 'create') await API.createLab({ ...data, status: 'active' }); else await API.updateLab(editorId, data); back(); } catch (error) { if (button) { button.disabled = false; button.textContent = 'Guardar'; } alertError(error.message || 'No se pudo completar la operación.', mode === 'create' ? 'No se pudo crear el laboratorio' : 'No se pudo actualizar el laboratorio'); } }
  async function init(id) { const form = document.getElementById('labEditorForm'); if (!form) return; if (!App.State.currentUser || App.State.currentUser.role !== 'admin') { window.location.hash = '#calendar'; return; } editorId = id || null; mode = editorId ? 'edit' : 'create'; const title = mode === 'edit' ? 'Editar Laboratorio' : 'Nuevo Laboratorio'; document.getElementById('pageTitle').textContent = title; document.getElementById('labEditorTitle').textContent = title; form.addEventListener('submit', submit, { once: true }); document.getElementById('cancelLabEditorBtn').addEventListener('click', back, { once: true }); const list = document.getElementById('labScheduleList'); list.addEventListener('change', scheduleChange); list.addEventListener('input', scheduleChange); list.addEventListener('click', (event) => { if (event.target.closest('[data-action="remove"]')) { draft.splice(Number(event.target.closest('.lab-schedule-row').dataset.index), 1); renderSchedule(); } }); document.getElementById('addScheduleRowBtn').addEventListener('click', () => { draft.unshift(normalize({})); renderSchedule(); }); draft = []; if (editorId) { try { const lab = await API.getLabById(editorId); document.getElementById('labEditorName').value = lab.name || ''; document.getElementById('labEditorLocation').value = lab.location || ''; document.getElementById('labEditorCapacity').value = String(lab.capacity ?? ''); draft = Array.isArray(lab.blocked_schedule) ? lab.blocked_schedule.map(normalize) : []; } catch (_) { alertError('No se pudo cargar el laboratorio.', 'Error'); } } renderSchedule(); }
  App.LabEditor = { init };
})(window.App = window.App || {});(function(App) {
  'use strict';

  function setMessage(msg) {
    const el = document.getElementById('labEditorMessage');
    if (!el) return;
    if (!msg) { el.textContent = ''; el.classList.add('form-note--hidden'); return; }
    el.textContent = msg;
    el.classList.remove('form-note--hidden');
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'labs');
    window.location.hash = '#admin';
  }

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
        throw new Error('Todos los horarios bloqueados deben tener día, hora de inicio y hora de fin válidos.');
      }

      const startMins = parseHHMMToMinutes(start);
      const endMins = parseHHMMToMinutes(end);
      if (startMins === null || endMins === null || startMins >= endMins) {
        labScheduleErrorIndices.add(i);
        labSchedulePage = Math.floor(i / SCHEDULE_PAGE_SIZE) + 1;
        renderSchedulePage();
        focusScheduleRow(i, 'start');
        throw new Error(`En la fila ${i + 1}: La hora de inicio (${start}) debe ser anterior a la hora de fin (${end}).`);
      }

      schedule.push({ day_of_week: day, start_time: start + ':00', end_time: end + ':00', name: entry.name });
    }
    return schedule;
  }

  function setupEvents() {
    const list = document.getElementById('labScheduleList');
    if (list && !list.dataset.bound) {
      list.dataset.bound = "true";
      list.addEventListener('input', (e) => {
        const row = e.target.closest('.lab-schedule-row');
        if (!row) return;
        const globalIdx = parseInt(row.dataset.index, 10);
        const field = e.target.dataset.field;
        if (Number.isFinite(globalIdx) && labScheduleDraft[globalIdx] && field) {
          labScheduleDraft[globalIdx][field] = e.target.value;
          if (labScheduleErrorIndices.has(globalIdx)) {
            labScheduleErrorIndices.delete(globalIdx);
            row.classList.remove('lab-schedule-row--error');
          }
        }
      });
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'remove-schedule') {
          const row = btn.closest('.lab-schedule-row');
          if (row) {
            const idx = parseInt(row.dataset.index, 10);
            if (Number.isFinite(idx)) {
              labScheduleDraft.splice(idx, 1);
              const total = getScheduleTotalPages();
              if (labSchedulePage > total) labSchedulePage = total;
              renderSchedulePage();
            }
          }
        } else if (action === 'schedule-prev') {
          if (labSchedulePage > 1) { labSchedulePage--; renderSchedulePage(); }
        } else if (action === 'schedule-next') {
          if (labSchedulePage < getScheduleTotalPages()) { labSchedulePage++; renderSchedulePage(); }
        }
      });
    }

    const addBtn = document.getElementById('addScheduleRowBtn');
    if (addBtn) {
      addBtn.removeEventListener('click', addScheduleRowHandler);
      addBtn.addEventListener('click', addScheduleRowHandler);
    }
    
    const cancelBtn = document.getElementById('cancelLabEditorBtn');
    if (cancelBtn) {
      cancelBtn.removeEventListener('click', goBack);
      cancelBtn.addEventListener('click', goBack);
    }

    const form = document.getElementById('labEditorForm');
    if (form) {
      form.removeEventListener('submit', formSubmitHandler);
      form.addEventListener('submit', formSubmitHandler);
    }
  }

  function addScheduleRowHandler() {
    labScheduleDraft.push({ day_of_week: 1, name: '', start: '07:00', end: '08:00' });
    labSchedulePage = getScheduleTotalPages();
    renderSchedulePage();
    requestAnimationFrame(() => focusScheduleRow(labScheduleDraft.length - 1, 'day'));
  }

  async function formSubmitHandler(e) {
    e.preventDefault();
    setMessage('');

    const name = document.getElementById('labEditorName').value.trim();
    const location = document.getElementById('labEditorLocation').value.trim();
    const capacity = parseInt(document.getElementById('labEditorCapacity').value, 10);

    if (!name || !location || Number.isNaN(capacity) || capacity < 1) {
      setMessage('Por favor, completa Nombre, Ubicación y Capacidad (mínimo 1).');
      return;
    }

    let schedule = [];
    try {
      schedule = getScheduleFromEditor();
    } catch (err) {
      setMessage(err.message);
      return;
    }

    const data = { name, location, capacity, schedule };
    const submitBtn = document.querySelector('#labEditorForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

    try {
      if (labEditorMode === 'create') {
        await API.createLab(data);
      } else {
        await API.updateLab(labEditorId, data);
      }
      goBack();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
      const title = labEditorMode === 'create' ? 'No se pudo crear el laboratorio' : 'No se pudo actualizar el laboratorio';
      App.UI.showAlert(App.UI.getFriendlyErrorMessage(err), title);
    }
  }

  async function init(labId) {
    const user = App.State.currentUser;
    if (!user || user.role !== 'admin') { window.location.hash = '#calendar'; return; }

    setupEvents();

    if (labId) {
      labEditorMode = 'edit';
      labEditorId = labId;
      document.getElementById('pageTitle').textContent = 'Editar Laboratorio';
      document.getElementById('labEditorTitle').textContent = 'Editar Laboratorio';
      
      try {
        const lab = await API.getLabById(labId);
        document.getElementById('labEditorName').value = lab.name || '';
        document.getElementById('labEditorLocation').value = lab.location || '';
        document.getElementById('labEditorCapacity').value = lab.capacity || '';

        const scheduleEntries = (lab.schedule || []).map(s => ({
          day_of_week: s.day_of_week,
          name: s.name || '',
          start: String(s.start_time).substring(0, 5),
          end: String(s.end_time).substring(0, 5)
        }));
        setLabScheduleDraft(scheduleEntries);
      } catch (err) {
        App.UI.showAlert('No se pudo cargar la información del laboratorio.', 'Error');
        goBack();
      }
    } else {
      labEditorMode = 'create';
      labEditorId = null;
      document.getElementById('pageTitle').textContent = 'Laboratorio';
      document.getElementById('labEditorTitle').textContent = 'Nuevo Laboratorio';
      document.getElementById('labEditorForm').reset();
      setLabScheduleDraft([]);
    }
  }

  App.LabEditor = {
    init
  };

})(window.App = window.App || {});
