(function () {
  'use strict';
  // Tema y auth los maneja shell.js — este script escucha 'shell:ready' para iniciar.

  // --- Helpers ---
  function setMessage(msg) {
    const el = document.getElementById('itemEditorMessage');
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
    if (raw === 'Resource already exists') return 'Ya existe un material con esos datos.';
    if (raw === 'Invalid data constraints') return 'Los datos ingresados no son válidos. Revisa e inténtalo de nuevo.';
    if (raw === 'Referenced resource not found') return 'No se encontró el laboratorio seleccionado.';
    if (!raw) return 'No se pudo completar la operación. Inténtalo de nuevo.';
    return raw;
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'items');
    window.location.href = '/#admin';
  }

  // --- State ---
  let itemEditorMode = 'create';
  let itemEditorId = null;

  // --- Load labs into select ---
  async function populateLabSelect(selectedValue) {
    const select = document.getElementById('itemEditorLab');
    if (!select) return;
    try {
      const labs = await API.getLabs();
      select.innerHTML = '<option value="">Seleccionar laboratorio</option>';
      labs.filter(l => l.status === 'active').forEach(lab => {
        const opt = document.createElement('option');
        opt.value = lab.id;
        opt.textContent = lab.name;
        select.appendChild(opt);
      });
      if (selectedValue) select.value = selectedValue;
    } catch (err) {
      select.innerHTML = '<option value="">Error al cargar laboratorios</option>';
    }
  }

  // --- Form submit ---
  document.getElementById('itemEditorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');

    const name = document.getElementById('itemEditorName').value.trim();
    const description = document.getElementById('itemEditorDescription').value.trim();
    const stockRaw = document.getElementById('itemEditorStock').value;
    const totalStock = parseInt(stockRaw, 10);
    const labId = document.getElementById('itemEditorLab').value;

    if (!name || !stockRaw || Number.isNaN(totalStock) || totalStock < 0 || !labId) {
      setMessage('Completa Nombre, Stock válido (0 o mayor) y selecciona un Laboratorio.');
      return;
    }

    const data = { name, description, total_stock: totalStock, lab_id: labId };

    const submitBtn = document.querySelector('#itemEditorForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

    try {
      if (itemEditorMode === 'create') {
        await API.createItem(data);
      } else {
        await API.updateItem(itemEditorId, data);
      }
      goBack();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
      const title = itemEditorMode === 'create' ? 'No se pudo crear el material' : 'No se pudo actualizar el material';
      showAlert(getFriendlyErrorMessage(err), title);
    }
  });

  // --- Cancel ---
  document.getElementById('cancelItemEditorBtn')?.addEventListener('click', goBack);

  // --- Init: espera a que shell.js inyecte el sidebar y valide la sesión ---
  async function init({ user }) {
    if (!user || user.role !== 'admin') { window.location.href = '/'; return; }

    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');

    if (itemId) {
      itemEditorMode = 'edit';
      itemEditorId = itemId;
      document.getElementById('pageTitle').textContent = 'Editar Material';
      document.getElementById('itemEditorTitle').textContent = 'Editar Material';
      try {
        const item = await API.get('/items/' + itemId);
        await populateLabSelect(item.lab_id);
        document.getElementById('itemEditorName').value = item.name || '';
        document.getElementById('itemEditorDescription').value = item.description || '';
        document.getElementById('itemEditorStock').value = String(item.total_stock ?? '');
      } catch (err) {
        showAlert('No se pudo cargar el material.', 'Error');
        await populateLabSelect(null);
      }
    } else {
      itemEditorMode = 'create';
      itemEditorId = null;
      document.getElementById('pageTitle').textContent = 'Nuevo Material';
      document.getElementById('itemEditorTitle').textContent = 'Nuevo Material';
      await populateLabSelect(null);
    }
  }

  document.addEventListener('shell:ready', (e) => init(e.detail));
})();
