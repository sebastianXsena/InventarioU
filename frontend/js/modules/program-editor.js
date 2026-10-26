(function (App) {
  'use strict';
  let mode = 'create';
  let editorId = null;
  const message = (text) => { const el = document.getElementById('programEditorMessage'); if (el) { el.textContent = text || ''; el.classList.toggle('form-note--hidden', !text); } };
  const back = () => { sessionStorage.setItem('adminReturnTab', 'programs'); window.location.hash = '#admin'; };
  function alertError(text, title) { const modal = document.getElementById('alertModal'); if (!modal) { window.alert((title || 'Error') + '\n\n' + text); return; } document.getElementById('alertModalTitle').textContent = title || 'Error'; document.getElementById('alertModalMessage').textContent = text; modal.classList.add('modal--active'); const button = document.getElementById('alertModalOk'); const close = () => { modal.classList.remove('modal--active'); button.removeEventListener('click', close); }; button.addEventListener('click', close); }
  async function populate(selected) { const select = document.getElementById('programEditorFaculty'); try { const faculties = await API.getFaculties(); select.innerHTML = '<option value="">Seleccione una facultad</option>'; faculties.forEach((faculty) => { const option = document.createElement('option'); option.value = faculty.id; option.textContent = faculty.name; select.appendChild(option); }); if (selected) select.value = selected; } catch (_) { select.innerHTML = '<option value="">Error al cargar facultades</option>'; } }
  async function submit(event) { event.preventDefault(); message(''); const name = document.getElementById('programEditorName').value.trim(); const facultyId = document.getElementById('programEditorFaculty').value; if (!name || !facultyId) { message('Completa el nombre del programa y selecciona una facultad.'); return; } const button = document.querySelector('#programEditorForm button[type="submit"]'); if (button) { button.disabled = true; button.textContent = 'Guardando...'; } try { const data = { name, faculty_id: facultyId }; if (mode === 'create') await API.createProgram(data); else await API.updateProgram(editorId, data); back(); } catch (error) { if (button) { button.disabled = false; button.textContent = 'Guardar'; } alertError(error.message || 'No se pudo completar la operación.', mode === 'create' ? 'No se pudo crear el programa' : 'No se pudo actualizar el programa'); } }
  async function init(id) { const form = document.getElementById('programEditorForm'); if (!form) return; if (!App.State.currentUser || App.State.currentUser.role !== 'admin') { window.location.hash = '#calendar'; return; } editorId = id || null; mode = editorId ? 'edit' : 'create'; const title = mode === 'edit' ? 'Editar Programa' : 'Nuevo Programa'; document.getElementById('pageTitle').textContent = title; document.getElementById('programEditorTitle').textContent = title; form.addEventListener('submit', submit, { once: true }); document.getElementById('cancelProgramEditorBtn').addEventListener('click', back, { once: true }); if (editorId) { try { const program = await API.getProgramById(editorId); await populate(program.faculty_id); document.getElementById('programEditorName').value = program.name || ''; } catch (_) { await populate(null); alertError('No se pudo cargar el programa.', 'Error'); } } else await populate(null); }
  App.ProgramEditor = { init };
})(window.App = window.App || {});(function(App) {
  'use strict';

  function setMessage(msg) {
    const el = document.getElementById('programEditorMessage');
    if (!el) return;
    if (!msg) { el.textContent = ''; el.classList.add('form-note--hidden'); return; }
    el.textContent = msg;
    el.classList.remove('form-note--hidden');
  }

  function goBack() {
    sessionStorage.setItem('adminReturnTab', 'programs');
    window.location.hash = '#admin';
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

  function setupEvents() {
    const cancelBtn = document.getElementById('cancelProgramEditorBtn');
    if (cancelBtn) {
      cancelBtn.removeEventListener('click', goBack);
      cancelBtn.addEventListener('click', goBack);
    }

    const form = document.getElementById('programEditorForm');
    if (form) {
      form.removeEventListener('submit', formSubmitHandler);
      form.addEventListener('submit', formSubmitHandler);
    }
  }

  async function formSubmitHandler(e) {
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
      App.UI.showAlert(App.UI.getFriendlyErrorMessage(err), title);
    }
  }

  async function init(programId) {
    const user = App.State.currentUser;
    if (!user || user.role !== 'admin') { window.location.hash = '#calendar'; return; }

    setupEvents();

    if (programId) {
      programEditorMode = 'edit';
      programEditorId = programId;
      document.getElementById('pageTitle').textContent = 'Editar Programa';
      document.getElementById('programEditorTitle').textContent = 'Editar Programa';
      
      try {
        const program = await API.getProgramById(programId);
        document.getElementById('programEditorName').value = program.name || '';
        await populateFacultySelect(program.faculty_id);
      } catch (err) {
        App.UI.showAlert('No se pudo cargar la información del programa.', 'Error');
        goBack();
      }
    } else {
      programEditorMode = 'create';
      programEditorId = null;
      document.getElementById('pageTitle').textContent = 'Programa';
      document.getElementById('programEditorTitle').textContent = 'Nuevo Programa';
      document.getElementById('programEditorForm').reset();
      await populateFacultySelect();
    }
  }

  App.ProgramEditor = {
    init
  };

})(window.App = window.App || {});
