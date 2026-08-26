(function (App) {
  'use strict';

  let editorMode = 'create';
  let editorId = null;

  function setMessage(message) {
    const element = document.getElementById('itemEditorMessage');
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('form-note--hidden', !message);
  }

  function showAlert(message, title) {
    const modal = document.getElementById('alertModal');
    if (!modal) { window.alert((title || 'Error') + '\n\n' + message); return; }
    document.getElementById('alertModalTitle').textContent = title || 'Error';
    document.getElementById('alertModalMessage').textContent = message;
    modal.classList.add('modal--active');
    const okButton = document.getElementById('alertModalOk');
    const close = () => { modal.classList.remove('modal--active'); okButton.removeEventListener('click', close); };
    okButton.addEventListener('click', close);
  }

  function friendlyError(error) {
    const status = error && typeof error.status === 'number' ? error.status : null;
    const raw = error && error.message ? String(error.message) : '';
    if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
    if (status === 403) return 'No tienes permisos para realizar esta acción.';
    if (raw === 'Resource already exists') return 'Ya existe un material con esos datos.';
    if (raw === 'Invalid data constraints') return 'Los datos ingresados no son válidos. Revisa e inténtalo de nuevo.';
    if (raw === 'Referenced resource not found') return 'No se encontró el laboratorio seleccionado.';
    return raw || 'No se pudo completar la operación. Inténtalo de nuevo.';
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'items');
    window.location.hash = '#admin';
  }

  async function populateLabSelect(selectedValue) {
    const select = document.getElementById('itemEditorLab');
    if (!select) return;
    try {
      const labs = await API.getLabs();
      select.innerHTML = '<option value="">Seleccionar laboratorio</option>';
      labs.filter((lab) => lab.status === 'active').forEach((lab) => {
        const option = document.createElement('option');
        option.value = lab.id;
        option.textContent = lab.name;
        select.appendChild(option);
      });
      if (selectedValue) select.value = selectedValue;
    } catch (_) {
      select.innerHTML = '<option value="">Error al cargar laboratorios</option>';
    }
  }

  async function init(id) {
    const form = document.getElementById('itemEditorForm');
    if (!form) return;
    const user = App.State.currentUser;
    if (!user || user.role !== 'admin') { window.location.hash = '#calendar'; return; }

    editorId = id || null;
    editorMode = editorId ? 'edit' : 'create';
    const title = editorMode === 'edit' ? 'Editar Material' : 'Nuevo Material';
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('itemEditorTitle').textContent = title;
    form.addEventListener('submit', handleSubmit, { once: true });
    document.getElementById('cancelItemEditorBtn').addEventListener('click', goBack, { once: true });

    if (!editorId) { await populateLabSelect(null); return; }
    try {
      const item = await API.get('/items/' + encodeURIComponent(editorId));
      await populateLabSelect(item.lab_id);
      document.getElementById('itemEditorName').value = item.name || '';
      document.getElementById('itemEditorDescription').value = item.description || '';
      document.getElementById('itemEditorStock').value = String(item.total_stock ?? '');
    } catch (_) {
      await populateLabSelect(null);
      showAlert('No se pudo cargar el material.', 'Error');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
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
    const button = document.querySelector('#itemEditorForm button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Guardando...'; }
    try {
      const data = { name, description, total_stock: totalStock, lab_id: labId };
      if (editorMode === 'create') await API.createItem(data);
      else await API.updateItem(editorId, data);
      goBack();
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = 'Guardar'; }
      showAlert(friendlyError(error), editorMode === 'create' ? 'No se pudo crear el material' : 'No se pudo actualizar el material');
    }
  }

  App.ItemEditor = { init };
})(window.App = window.App || {});(function(App) {
  'use strict';

  function setMessage(msg) {
    const el = document.getElementById('itemEditorMessage');
    if (!el) return;
    if (!msg) { el.textContent = ''; el.classList.add('form-note--hidden'); return; }
    el.textContent = msg;
    el.classList.remove('form-note--hidden');
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'items');
    window.location.hash = '#admin';
  }

  let itemEditorMode = 'create';
  let itemEditorId = null;

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

  function setupEvents() {
    const cancelBtn = document.getElementById('cancelItemEditorBtn');
    if (cancelBtn) {
      cancelBtn.removeEventListener('click', goBack);
      cancelBtn.addEventListener('click', goBack);
    }

    const form = document.getElementById('itemEditorForm');
    if (form) {
      form.removeEventListener('submit', formSubmitHandler);
      form.addEventListener('submit', formSubmitHandler);
    }
  }

  async function formSubmitHandler(e) {
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
      App.UI.showAlert(App.UI.getFriendlyErrorMessage(err), title);
    }
  }

  async function init(itemId) {
    const user = App.State.currentUser;
    if (!user || user.role !== 'admin') { window.location.hash = '#calendar'; return; }

    setupEvents();
    
    if (itemId) {
      itemEditorMode = 'edit';
      itemEditorId = itemId;
      document.getElementById('pageTitle').textContent = 'Editar Material';
      document.getElementById('itemEditorTitle').textContent = 'Editar Material';
      
      try {
        const item = await API.getItemById(itemId);
        document.getElementById('itemEditorName').value = item.name || '';
        document.getElementById('itemEditorDescription').value = item.description || '';
        document.getElementById('itemEditorStock').value = item.total_stock !== undefined ? item.total_stock : '';
        await populateLabSelect(item.lab_id);
      } catch (err) {
        App.UI.showAlert('No se pudo cargar la información del material.', 'Error');
        goBack();
      }
    } else {
      itemEditorMode = 'create';
      itemEditorId = null;
      document.getElementById('pageTitle').textContent = 'Material';
      document.getElementById('itemEditorTitle').textContent = 'Nuevo Material';
      document.getElementById('itemEditorForm').reset();
      await populateLabSelect();
    }
  }

  App.ItemEditor = {
    init
  };

})(window.App = window.App || {});
