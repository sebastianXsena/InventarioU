(function(App) {
  'use strict';

  let reserveCheckTimer = null;
  let reserveCheckSeq = 0;

  async function onLabChangeForReserve() {
    const labId = document.getElementById('reserveLab').value;
    const container = document.getElementById('itemsSelector');

    if (!labId) {
      container.innerHTML = '<p class="items-selector__hint">Selecciona un laboratorio para ver materiales disponibles</p>';
      scheduleReserveAvailabilityCheck();
      return;
    }

    try {
      App.State.items = await API.getItemsByLab(labId);
      if (App.State.items.length === 0) {
        container.innerHTML = '<p class="items-selector__hint">No hay materiales disponibles en este laboratorio</p>';
        return;
      }

      container.innerHTML = App.State.items
        .map((item) => `
          <div class="item-checkbox">
            <input class="item-checkbox__input" type="checkbox" id="item-${item.id}" data-item-id="${item.id}" data-max="${item.available_stock}">
            <label class="item-checkbox__label" for="item-${item.id}">${item.name}</label>
            <span class="item-checkbox__stock">Stock: ${item.available_stock}/${item.total_stock}</span>
            <input class="item-checkbox__qty" type="number" id="qty-${item.id}" min="1" max="${item.available_stock}" value="1" disabled>
          </div>
        `).join('');

      container.querySelectorAll('.item-checkbox__input').forEach((cb) => {
        cb.addEventListener('change', function () {
          const qtyInput = document.getElementById('qty-' + this.dataset.itemId);
          qtyInput.disabled = !this.checked;
          if (this.checked) qtyInput.focus();
        });
      });

      scheduleReserveAvailabilityCheck();
    } catch (err) {
      container.innerHTML = `<p class="items-selector__hint">${App.UI.getFriendlyErrorMessage(err)}</p>`;
      scheduleReserveAvailabilityCheck();
    }
  }

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

    const toDayOfWeek = (d) => ((d.getDay() + 6) % 7) + 1;
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

    const labId = document.getElementById('reserveLab')?.value;
    const date = document.getElementById('reserveDate')?.value;
    const startTime = document.getElementById('reserveStartTime')?.value;
    const endTime = document.getElementById('reserveEndTime')?.value;

    if (!labId || !date || !startTime || !endTime) {
      App.UI.setFormMessage('reserveFormMessage', '', { sticky: true });
      setReserveSubmitEnabled(true);
      return true;
    }

    const startDt = parseLocalDateTime(date, startTime);
    const endDt = parseLocalDateTime(date, endTime);
    if (!startDt || !endDt) {
      App.UI.setFormMessage('reserveFormMessage', 'Revisa la fecha y las horas.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    if (!(endDt > startDt)) {
      App.UI.setFormMessage('reserveFormMessage', 'La hora de fin debe ser mayor que la hora de inicio.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    if (startDt <= new Date()) {
      App.UI.setFormMessage('reserveFormMessage', 'No se pueden hacer reservas en fechas pasadas. Elige una fecha futura.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    const lab = (Array.isArray(App.State.labs) ? App.State.labs : []).find((l) => String(l.id) === String(labId));
    if (lab && lab.status === 'maintenance') {
      App.UI.setFormMessage('reserveFormMessage', 'Este laboratorio está en mantenimiento. Elige otro laboratorio.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    if (lab && isBlockedBySchedule(lab.blocked_schedule, startDt, endDt)) {
      App.UI.setFormMessage('reserveFormMessage', 'Ese horario no se puede reservar porque el laboratorio está ocupado por clases.', { sticky: true });
      setReserveSubmitEnabled(false);
      return false;
    }

    try {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const existing = await API.getReservationsByLab(labId, dayStart, dayEnd);
      if (seq !== reserveCheckSeq) return false;

      const hasOverlap = Array.isArray(existing) && existing.some((r) => {
        const rs = new Date(r.start_time);
        const re = new Date(r.end_time);
        if (isNaN(rs.getTime()) || isNaN(re.getTime())) return false;
        return rs < endDt && re > startDt;
      });

      if (hasOverlap) {
        App.UI.setFormMessage('reserveFormMessage', 'Ese laboratorio ya está reservado en ese horario. Elige otra hora o fecha.', { sticky: true });
        setReserveSubmitEnabled(false);
        return false;
      }

      App.UI.setFormMessage('reserveFormMessage', '', { sticky: true });
      setReserveSubmitEnabled(true);
      return true;
    } catch (err) {
      const status = err && typeof err.status === 'number' ? err.status : null;
      if (status === 401 || status === 403) {
        App.UI.setFormMessage('reserveFormMessage', 'Tu sesión expiró. Inicia sesión nuevamente.', { sticky: true });
        setReserveSubmitEnabled(false);
        return false;
      }

      App.UI.setFormMessage('reserveFormMessage', '', { sticky: true });
      setReserveSubmitEnabled(true);
      return true;
    }
  }

  async function handleReserve(e) {
    e.preventDefault();
    App.UI.setFormMessage('reserveFormMessage', '');
    const labId = document.getElementById('reserveLab').value;
    const date = document.getElementById('reserveDate').value;
    const startTime = document.getElementById('reserveStartTime').value;
    const endTime = document.getElementById('reserveEndTime').value;
    const notes = document.getElementById('reserveNotes').value;

    if (!labId || !date || !startTime || !endTime) {
      App.UI.setFormMessage('reserveFormMessage', 'Completa los campos obligatorios: Laboratorio, Fecha, Hora inicio y Hora fin.');
      return;
    }

    const ok = await checkReserveAvailabilityLive();
    if (!ok) return;

    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;

    const selectedItems = [];
    document.querySelectorAll('.item-checkbox__input:checked').forEach((cb) => {
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
      App.UI.setFormMessage('reserveFormMessage', '');
      document.getElementById('reserveForm').reset();
      document.getElementById('itemsSelector').innerHTML = '<p class="items-selector__hint">Selecciona un laboratorio para ver materiales disponibles</p>';
      App.Router.showView('my-reservations');
      if (App.MyReservations) App.MyReservations.loadMyReservations();
    } catch (err) {
      App.UI.showAlert(App.UI.getFriendlyErrorMessage(err, { action: 'create', entity: 'reservation' }), 'No se pudo crear la reserva');
    }
  }

  function init() {
    const resForm = document.getElementById('reserveForm');
    if (resForm) {
      resForm.removeEventListener('submit', handleReserve);
      resForm.addEventListener('submit', handleReserve);
    }
    
    const resLab = document.getElementById('reserveLab');
    if (resLab) {
      resLab.removeEventListener('change', onLabChangeForReserve);
      resLab.addEventListener('change', onLabChangeForReserve);
    }
    
    ['reserveDate', 'reserveStartTime', 'reserveEndTime'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.removeEventListener('change', scheduleReserveAvailabilityCheck);
        el.addEventListener('change', scheduleReserveAvailabilityCheck);
        el.removeEventListener('input', scheduleReserveAvailabilityCheck);
        el.addEventListener('input', scheduleReserveAvailabilityCheck);
      }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const resDate = document.getElementById('reserveDate');
    if (resDate) {
      resDate.value = dateStr;
      resDate.min = dateStr;
    }

    setReserveSubmitEnabled(true);
    scheduleReserveAvailabilityCheck();
    
    if (App.Calendar && typeof App.Calendar.populateLabSelects === 'function') {
      App.Calendar.populateLabSelects();
    }
  }

  App.Reserve = {
    handleReserve,
    checkReserveAvailabilityLive,
    onLabChangeForReserve,
    init
  };

})(window.App = window.App || {});
