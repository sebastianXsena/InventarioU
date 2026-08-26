(function (App) {
  'use strict';
  let mode = 'create';
  let editorId = null;
  const message = (text) => { const el = document.getElementById('facultyEditorMessage'); if (el) { el.textContent = text || ''; el.classList.toggle('form-note--hidden', !text); } };
  const back = () => { sessionStorage.setItem('adminReturnTab', 'faculties'); window.location.hash = '#admin'; };
  function alertError(text, title) { const modal = document.getElementById('alertModal'); if (!modal) { window.alert((title || 'Error') + '\n\n' + text); return; } document.getElementById('alertModalTitle').textContent = title || 'Error'; document.getElementById('alertModalMessage').textContent = text; modal.classList.add('modal--active'); const button = document.getElementById('alertModalOk'); const close = () => { modal.classList.remove('modal--active'); button.removeEventListener('click', close); }; button.addEventListener('click', close); }
  async function submit(event) { event.preventDefault(); message(''); const name = document.getElementById('facultyEditorName').value.trim(); if (!name) { message('El nombre de la facultad es obligatorio.'); return; } const button = document.querySelector('#facultyEditorForm button[type="submit"]'); if (button) { button.disabled = true; button.textContent = 'Guardando...'; } try { if (mode === 'create') await API.createFaculty({ name }); else await API.updateFaculty(editorId, { name }); back(); } catch (error) { if (button) { button.disabled = false; button.textContent = 'Guardar'; } alertError(error.message || 'No se pudo completar la operación.', mode === 'create' ? 'No se pudo crear la facultad' : 'No se pudo actualizar la facultad'); } }
  async function init(id) { const form = document.getElementById('facultyEditorForm'); if (!form) return; if (!App.State.currentUser || App.State.currentUser.role !== 'admin') { window.location.hash = '#calendar'; return; } editorId = id || null; mode = editorId ? 'edit' : 'create'; const title = mode === 'edit' ? 'Editar Facultad' : 'Nueva Facultad'; document.getElementById('pageTitle').textContent = title; document.getElementById('facultyEditorTitle').textContent = title; form.addEventListener('submit', submit, { once: true }); document.getElementById('cancelFacultyEditorBtn').addEventListener('click', back, { once: true }); if (editorId) { try { const faculty = await API.getFacultyById(editorId); document.getElementById('facultyEditorName').value = faculty.name || ''; } catch (_) { alertError('No se pudo cargar la facultad.', 'Error'); } } }
  App.FacultyEditor = { init };
})(window.App = window.App || {});(function(App) {
  'use strict';

  function setMessage(msg) {
    const el = document.getElementById('facultyEditorMessage');
    if (!el) return;
    if (!msg) { el.textContent = ''; el.classList.add('form-note--hidden'); return; }
    el.textContent = msg;
    el.classList.remove('form-note--hidden');
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'faculties');
    window.location.hash = '#admin';
  }

  let facultyEditorMode = 'create';
  let facultyEditorId = null;

  function setupEvents() {
    const cancelBtn = document.getElementById('cancelFacultyEditorBtn');
    if (cancelBtn) {
      cancelBtn.removeEventListener('click', goBack);
      cancelBtn.addEventListener('click', goBack);
    }

    const form = document.getElementById('facultyEditorForm');
    if (form) {
      form.removeEventListener('submit', formSubmitHandler);
      form.addEventListener('submit', formSubmitHandler);
    }
  }

  async function formSubmitHandler(e) {
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
      App.UI.showAlert(App.UI.getFriendlyErrorMessage(err), title);
    }
  }

  async function init(facultyId) {
    const user = App.State.currentUser;
    if (!user || user.role !== 'admin') { window.location.hash = '#calendar'; return; }

    setupEvents();

    if (facultyId) {
      facultyEditorMode = 'edit';
      facultyEditorId = facultyId;
      document.getElementById('pageTitle').textContent = 'Editar Facultad';
      document.getElementById('facultyEditorTitle').textContent = 'Editar Facultad';
      
      try {
        const faculty = await API.getFacultyById(facultyId);
        document.getElementById('facultyEditorName').value = faculty.name || '';
      } catch (err) {
        App.UI.showAlert('No se pudo cargar la información de la facultad.', 'Error');
        goBack();
      }
    } else {
      facultyEditorMode = 'create';
      facultyEditorId = null;
      document.getElementById('pageTitle').textContent = 'Facultad';
      document.getElementById('facultyEditorTitle').textContent = 'Nueva Facultad';
      document.getElementById('facultyEditorForm').reset();
    }
  }

  App.FacultyEditor = {
    init
  };

})(window.App = window.App || {});
