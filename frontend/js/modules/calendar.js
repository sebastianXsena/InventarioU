(function(App) {
  'use strict';

  const CAL_START_MIN = 7 * 60;
  const CAL_END_MIN = 22 * 60;
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
    const dow = d.getDay();
    const diff = (dow + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  }

  async function loadLabs() {
    try {
      App.State.labs = await API.getLabs();
      populateLabSelects();
      if (App.AdminLabs && typeof App.AdminLabs.renderAdminLabs === 'function') {
        App.AdminLabs.renderAdminLabs();
      }
    } catch (err) {
      console.error('Error loading labs:', err);
    }
  }

  function populateLabSelects() {
    const selects = [
      { el: document.getElementById('calendarLabSelect'), allOption: true },
      { el: document.getElementById('reserveLab'), allOption: true },
    ];

    selects.forEach(({ el }) => {
      if (!el) return;
      const val = el.value;
      el.innerHTML = '<option value="">Seleccionar laboratorio</option>';
      App.State.labs
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

  async function loadCalendar() {
    const labSelect = document.getElementById('calendarLabSelect');
    if (!labSelect) return;
    const labId = labSelect.value;
    if (!labId) {
      const grid = document.getElementById('calendarGrid');
      if (grid) {
        grid.innerHTML = '<div class="empty-state">Selecciona un laboratorio para ver la disponibilidad semanal.</div>';
      }
      const navContainer = document.getElementById('calendarNavigation');
      if (navContainer) navContainer.style.display = 'none';
      return;
    }

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '<div class="loading">Cargando</div>';

    try {
      const selected = App.State.currentCalendarDate;
      const weekStart = getWeekStartMonday(selected);
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const navContainer = document.getElementById('calendarNavigation');
      if (navContainer) {
        navContainer.style.display = 'flex';
        const rangeLabel = document.getElementById('calendarWeekRangeLabel');
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

      const lab = (Array.isArray(App.State.labs) ? App.State.labs : []).find((l) => String(l.id) === String(labId));
      const blockedSchedule = lab && Array.isArray(lab.blocked_schedule) ? lab.blocked_schedule : [];
      const toDayOfWeek = (d) => ((d.getDay() + 6) % 7) + 1;
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
            ${weekDays.map((d, idx) => {
              const label = `${dayNames[idx]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
              return `<th class="calendar-table__day" scope="col">${label}</th>`;
            }).join('')}
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
          }).join('');

        const startMin = slotMin;
        const endMin = startMin + CAL_SLOT_MIN;
        const label = `${formatTimeFromMinutes(startMin)} - ${formatTimeFromMinutes(endMin)}`;
        const timeHeader = `<th class="calendar-table__time" scope="row">${label}</th>`;

        tbodyRows += `<tr>${timeHeader}${cells}</tr>`;
      }

      grid.innerHTML = `<table class="calendar-table" role="grid">${thead}<tbody>${tbodyRows}</tbody></table>`;
    } catch (err) {
      grid.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function init() {
    const loadBtn = document.getElementById('loadCalendarBtn');
    if (loadBtn) {
      loadBtn.removeEventListener('click', loadCalendar);
      loadBtn.addEventListener('click', loadCalendar);
    }
    
    const prevBtn = document.getElementById('calendarPrevWeekBtn');
    if (prevBtn) {
      prevBtn.removeEventListener('click', onPrevWeek);
      prevBtn.addEventListener('click', onPrevWeek);
    }
    
    const nextBtn = document.getElementById('calendarNextWeekBtn');
    if (nextBtn) {
      nextBtn.removeEventListener('click', onNextWeek);
      nextBtn.addEventListener('click', onNextWeek);
    }
    
    const labSel = document.getElementById('calendarLabSelect');
    if (labSel) {
      labSel.removeEventListener('change', onLabChange);
      labSel.addEventListener('change', onLabChange);
    }
    populateLabSelects();
  }

  function onPrevWeek() {
    App.State.currentCalendarDate.setDate(App.State.currentCalendarDate.getDate() - 7);
    loadCalendar();
  }

  function onNextWeek() {
    App.State.currentCalendarDate.setDate(App.State.currentCalendarDate.getDate() + 7);
    loadCalendar();
  }

  function onLabChange() {
    App.State.currentCalendarDate = new Date();
  }

  App.Calendar = {
    loadLabs,
    populateLabSelects,
    loadCalendar,
    init
  };

})(window.App = window.App || {});
