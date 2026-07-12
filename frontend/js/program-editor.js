(function () {
  'use strict';

  function setMessage(msg) {
    const el = document.getElementById('programEditorMessage');
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
    if (raw === 'Resource already exists') return 'Ya existe un programa con esos datos.';
    if (raw === 'Invalid data constraints') return 'Los datos ingresados no son válidos. Revisa e inténtalo de nuevo.';
    if (!raw) return 'No se pudo completar la operación. Inténtalo de nuevo.';
    return raw;
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'programs');
    window.location.href = '/#admin';
  }

  let programEditorMode = 'create';
  let programEditorId = null;

  async function populateFacultySelect(selectedValue) {
    const select = document.getElementById('programEditorFaculty');
    if (!select) return;
    try {
      const faculties = await API.getFaculties();
      select.innerHTML = '<option value="">Seleccione una facultad</option>';
      faculties.forEach((faculty) => {
        const opt = document.createElement('option');
        opt.value = faculty.id;
        opt.textContent = faculty.name;
        select.appendChild(opt);
      });
      if (selectedValue) select.value = selectedValue;
    } catch (err) {
      select.innerHTML = '<option value="">Error al cargar facultades</option>';
    }
  }

  document.getElementById('programEditorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');

    const name = document.getElementById('programEditorName').value.trim();
    const faculty_id = document.getElementById('programEditorFaculty').value;

    if (!name || !faculty_id) {
      setMessage('Completa el nombre del programa y selecciona una facultad.');
      return;
    }

    const submitBtn = document.querySelector('#programEditorForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

    try {
      if (programEditorMode === 'create') {
        await API.createProgram({ name, faculty_id });
      } else {
        await API.updateProgram(programEditorId, { name, faculty_id });
      }
      goBack();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
      const title = programEditorMode === 'create' ? 'No se pudo crear el programa' : 'No se pudo actualizar el programa';
      showAlert(getFriendlyErrorMessage(err), title);
    }
  });

  document.getElementById('cancelProgramEditorBtn')?.addEventListener('click', goBack);

  async function init({ user }) {
    if (!user || user.role !== 'admin') { window.location.href = '/'; return; }

    const params = new URLSearchParams(window.location.search);
    const programId = params.get('id');

    if (programId) {
      programEditorMode = 'edit';
      programEditorId = programId;
      document.getElementById('pageTitle').textContent = 'Editar Programa';
      document.getElementById('programEditorTitle').textContent = 'Editar Programa';
      try {
        const program = await API.getProgramById(programId);
        await populateFacultySelect(program.faculty_id);
        document.getElementById('programEditorName').value = program.name || '';
      } catch (err) {
        await populateFacultySelect(null);
        showAlert('No se pudo cargar el programa.', 'Error');
      }
    } else {
      programEditorMode = 'create';
      programEditorId = null;
      document.getElementById('pageTitle').textContent = 'Nuevo Programa';
      document.getElementById('programEditorTitle').textContent = 'Nuevo Programa';
      await populateFacultySelect(null);
    }
  }

  document.addEventListener('shell:ready', (e) => init(e.detail));
})();