(function () {
  'use strict';

  function setMessage(msg) {
    const el = document.getElementById('facultyEditorMessage');
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
    if (raw === 'Resource already exists') return 'Ya existe una facultad con esos datos.';
    if (raw === 'Invalid data constraints') return 'Los datos ingresados no son válidos. Revisa e inténtalo de nuevo.';
    if (!raw) return 'No se pudo completar la operación. Inténtalo de nuevo.';
    return raw;
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'faculties');
    window.location.href = '/#admin';
  }

  let facultyEditorMode = 'create';
  let facultyEditorId = null;

  document.getElementById('facultyEditorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');

    const name = document.getElementById('facultyEditorName').value.trim();
    if (!name) {
      setMessage('El nombre de la facultad es obligatorio.');
      return;
    }

    const submitBtn = document.querySelector('#facultyEditorForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

    try {
      if (facultyEditorMode === 'create') {
        await API.createFaculty({ name });
      } else {
        await API.updateFaculty(facultyEditorId, { name });
      }
      goBack();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
      const title = facultyEditorMode === 'create' ? 'No se pudo crear la facultad' : 'No se pudo actualizar la facultad';
      showAlert(getFriendlyErrorMessage(err), title);
    }
  });

  document.getElementById('cancelFacultyEditorBtn')?.addEventListener('click', goBack);

  async function init({ user }) {
    if (!user || user.role !== 'admin') { window.location.href = '/'; return; }

    const params = new URLSearchParams(window.location.search);
    const facultyId = params.get('id');

    if (facultyId) {
      facultyEditorMode = 'edit';
      facultyEditorId = facultyId;
      document.getElementById('pageTitle').textContent = 'Editar Facultad';
      document.getElementById('facultyEditorTitle').textContent = 'Editar Facultad';
      try {
        const faculty = await API.getFacultyById(facultyId);
        document.getElementById('facultyEditorName').value = faculty.name || '';
      } catch (err) {
        showAlert('No se pudo cargar la facultad.', 'Error');
      }
    } else {
      facultyEditorMode = 'create';
      facultyEditorId = null;
      document.getElementById('pageTitle').textContent = 'Nueva Facultad';
      document.getElementById('facultyEditorTitle').textContent = 'Nueva Facultad';
    }
  }

  document.addEventListener('shell:ready', (e) => init(e.detail));
})();