(function(App) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

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
      const t = setTimeout(() => {
        el.textContent = '';
        el.classList.add('form-note--hidden');
        formMessageTimers.delete(id);
      }, 3000);
      formMessageTimers.set(id, t);
    }
  }

  let toastTimer = null;
  function showToast(message, type = 'success') {
    return; // Disabled by UX request
  }

  function getFriendlyErrorMessage(err, context = {}) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    const raw = err && err.message ? String(err.message) : '';

    if (status === 429 || raw === 'Too many requests') return 'Demasiadas solicitudes. Espera unos segundos y vuelve a intentar.';
    if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
    if (status === 403) return 'No tienes permisos para realizar esta acción.';
    if (!raw) return 'No se pudo completar la operación. Inténtalo de nuevo.';

    if (raw === 'Internal server error') return 'Ocurrió un error interno. Inténtalo más tarde.';
    if (raw === 'Resource already exists') return 'Ya existe un registro con esos datos.';
    if (raw === 'Referenced resource not found') return 'No se encontró un dato relacionado. Verifica la información e inténtalo de nuevo.';
    if (raw === 'Invalid data constraints') return 'Los datos ingresados no son válidos. Revisa e inténtalo de nuevo.';
    if (raw === 'Laboratory not found') return 'No se encontró el laboratorio seleccionado.';
    if (raw === 'Laboratory is under maintenance') return 'Este laboratorio está en mantenimiento. Elige otro laboratorio.';
    if (raw === 'Reservations cannot be made for past dates') return 'No se pueden hacer reservas en fechas pasadas. Elige una fecha futura.';
    if (raw === 'Time slot conflict - laboratory already reserved') return 'Ese laboratorio ya está reservado en ese horario. Elige otra hora o fecha.';
    if (raw === 'Time slot blocked - laboratory has classes') return 'Ese horario no se puede reservar porque el laboratorio está ocupado por clases.';

    const stockMatch = raw.match(/^Insufficient stock for "(.+)"\. Available: (\d+), Requested: (\d+)$/);
    if (stockMatch) {
      const [, itemName, available, requested] = stockMatch;
      return `No hay stock suficiente para "${itemName}". Disponible: ${available}, Solicitado: ${requested}.`;
    }

    if (/^Item\s+.+\s+not found$/.test(raw)) return 'Uno de los materiales seleccionados no existe o fue eliminado.';
    if (raw.includes('"end_time"') && raw.includes('greater than') && raw.includes('start_time')) return 'La hora de fin debe ser mayor que la hora de inicio.';

    const fieldLabels = {
      lab_id: 'Laboratorio', start_time: 'Hora de inicio', end_time: 'Hora de fin', notes: 'Notas',
      name: 'Nombre', location: 'Ubicación', capacity: 'Capacidad', total_stock: 'Stock total',
      description: 'Descripción', item_id: 'Material', quantity_used: 'Cantidad', email: 'Email', password: 'Contraseña'
    };

    const m = raw.match(/^"([a-zA-Z0-9_\.]+)"\s+(.*)$/);
    if (m) {
      const field = m[1];
      const rest = m[2];
      const label = fieldLabels[field] || field;

      if (rest === 'is required') return field === 'lab_id' ? 'Selecciona un laboratorio.' : `El campo ${label} es obligatorio.`;
      if (rest.includes('must be a valid')) return field === 'email' ? 'Escribe un email válido.' : `${label} tiene un formato inválido.`;
      const minNum = rest.match(/must be greater than or equal to (\d+)/);
      if (minNum) return `${label} debe ser mayor o igual a ${minNum[1]}.`;
      const minLen = rest.match(/length must be at least (\d+)/);
      if (minLen) return `${label} debe tener al menos ${minLen[1]} caracteres.`;
      const maxLen = rest.match(/length must be less than or equal to (\d+)/);
      if (maxLen) return `${label} no puede superar ${maxLen[1]} caracteres.`;
      if (rest.includes('fails to match the required pattern')) return `${label} tiene un formato inválido.`;
    }

    return raw.replace(/\"/g, '"');
  }

  function renderErrorEmptyState(err) {
    return `<div class="empty-state empty-state--error">${getFriendlyErrorMessage(err)}</div>`;
  }

  function showAlert(message, title = 'Alerta') {
    const modal = $('#alertModal');
    if (!modal) { alert(`${title}\n\n${message}`); return; }
    $('#alertModalTitle').textContent = title;
    $('#alertModalMessage').textContent = message;
    modal.classList.add('modal--active');

    const close = () => {
      modal.classList.remove('modal--active');
      $('#alertModalOk').removeEventListener('click', close);
    };
    $('#alertModalOk').addEventListener('click', close);
  }

  function showConfirm(message, title = 'Confirmar', options = {}) {
    const { confirmText = 'Aceptar', cancelText = 'Cancelar' } = options;
    const modal = $('#confirmModal');
    
    if (!modal) return Promise.resolve(confirm(`${title}\n\n${message}`));

    $('#confirmModalTitle').textContent = title;
    $('#confirmModalMessage').textContent = message;
    $('#confirmModalOk').textContent = confirmText;
    $('#confirmModalCancel').textContent = cancelText;
    modal.classList.add('modal--active');

    return new Promise((resolve) => {
      const cleanup = () => {
        modal.classList.remove('modal--active');
        $('#confirmModalOk').removeEventListener('click', onOk);
        $('#confirmModalCancel').removeEventListener('click', onCancel);
      };
      const onOk = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };

      $('#confirmModalOk').addEventListener('click', onOk);
      $('#confirmModalCancel').addEventListener('click', onCancel);
      $('#confirmModalOk').focus();
    });
  }

  App.UI = {
    $, $$,
    setFormMessage,
    showToast,
    getFriendlyErrorMessage,
    renderErrorEmptyState,
    showAlert,
    showConfirm
  };

})(window.App = window.App || {});
