(function(App) {
  'use strict';

  async function handleLogin(e) {
    e.preventDefault();
    App.UI.setFormMessage('loginFormMessage', '');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      App.UI.setFormMessage('loginFormMessage', 'Completa tu email y contraseña para continuar.');
      return;
    }

    try {
      const result = await API.login({ email, password });
      API.setToken(result.token);
      App.State.currentUser = result.user;
      App.Router.updateNav();
      const route = App.Router.parseHashRoute();
      if (route.view && route.view !== 'login') App.Router.routeOnLoadOrHashChange();
      else App.Router.navigateTo('calendar');
      if (App.Calendar) App.Calendar.loadLabs();
    } catch (err) {
      App.UI.showAlert(App.UI.getFriendlyErrorMessage(err, { action: 'login', entity: 'user' }), 'No se pudo iniciar sesión');
    }
  }

  function handleLogout() {
    API.setToken(null);
    App.State.currentUser = null;
    App.Router.updateNav();
    App.Router.navigateTo('login');
  }

  async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    App.UI.setFormMessage('forgotPasswordFormMessage', '');
    const email = document.getElementById('forgotPasswordEmail').value.trim();

    if (!email) {
      App.UI.setFormMessage('forgotPasswordFormMessage', 'Escribe tu email para continuar.');
      return;
    }

    try {
      const res = await API.forgotPassword({ email });
      document.getElementById('forgotPasswordModal').classList.remove('modal--active');
      document.getElementById('forgotPasswordForm').reset();
      
      App.UI.showAlert(
        `Tu contraseña temporal es: "${res.tempPassword}"\n\nÚsala para iniciar sesión y cámbiala de inmediato en la pestaña de Ajustes.`,
        'Contraseña Restablecida'
      );
    } catch (err) {
      App.UI.setFormMessage('forgotPasswordFormMessage', App.UI.getFriendlyErrorMessage(err) || 'No se pudo restablecer la contraseña.');
    }
  }

  async function loadSettings() {
    try {
      const user = await API.getProfile();
      document.getElementById('settingsFullName').value = user.full_name || '';
      document.getElementById('settingsSemester').value = user.semester || '';

      const faculties = await API.getFaculties();
      const facSelect = document.getElementById('settingsFaculty');
      facSelect.innerHTML = '<option value="">Seleccionar facultad</option>';
      faculties.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        facSelect.appendChild(opt);
      });
      if (user.faculty_id) facSelect.value = user.faculty_id;

      await loadSettingsPrograms(user.faculty_id, user.program_id);

      facSelect.onchange = async (e) => {
        await loadSettingsPrograms(e.target.value, null);
      };
    } catch (err) {
      console.error(err);
      App.UI.showAlert('No se pudo cargar el perfil', 'Error');
    }
  }

  async function loadSettingsPrograms(facultyId, selectedProgramId) {
    const progSelect = document.getElementById('settingsProgram');
    progSelect.innerHTML = '<option value="">Seleccionar programa</option>';
    if (!facultyId) return;
    try {
      const programs = await API.getPrograms();
      programs.filter(p => p.faculty_id === facultyId).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        progSelect.appendChild(opt);
      });
      if (selectedProgramId) progSelect.value = selectedProgramId;
    } catch (err) {
      console.error(err);
    }
  }

  async function handleProfileSettingsSubmit(e) {
    e.preventDefault();
    App.UI.setFormMessage('profileSettingsMessage', '');
    const data = {
      full_name: document.getElementById('settingsFullName').value.trim(),
      faculty_id: document.getElementById('settingsFaculty').value || null,
      program_id: document.getElementById('settingsProgram').value || null,
      semester: parseInt(document.getElementById('settingsSemester').value, 10) || null
    };

    if (!data.full_name) {
      App.UI.setFormMessage('profileSettingsMessage', 'El nombre completo es obligatorio.');
      return;
    }

    try {
      const updatedUser = await API.updateProfile(data);
      App.State.currentUser = updatedUser; 
      App.UI.showAlert('Datos personales actualizados correctamente.', 'Éxito');
    } catch (err) {
      App.UI.setFormMessage('profileSettingsMessage', err.message || 'No se pudo actualizar el perfil.');
    }
  }

  async function handlePasswordSettingsSubmit(e) {
    e.preventDefault();
    App.UI.setFormMessage('passwordSettingsMessage', '');
    const oldPassword = document.getElementById('settingsOldPassword').value;
    const newPassword = document.getElementById('settingsNewPassword').value;
    const confirmPassword = document.getElementById('settingsConfirmPassword').value;

    if (!oldPassword || !newPassword || !confirmPassword) {
      App.UI.setFormMessage('passwordSettingsMessage', 'Completa todos los campos.');
      return;
    }
    if (newPassword.length < 6) {
      App.UI.setFormMessage('passwordSettingsMessage', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      App.UI.setFormMessage('passwordSettingsMessage', 'Las nuevas contraseñas no coinciden.');
      return;
    }

    try {
      await API.changePassword({ oldPassword, newPassword });
      App.UI.showAlert('Contraseña actualizada correctamente.', 'Éxito');
      e.target.reset();
    } catch (err) {
      App.UI.setFormMessage('passwordSettingsMessage', err.message || 'No se pudo cambiar la contraseña.');
    }
  }

  function initLogin() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.removeEventListener('submit', handleLogin);
      loginForm.addEventListener('submit', handleLogin);
    }
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
      forgotLink.removeEventListener('click', openForgotModal);
      forgotLink.addEventListener('click', openForgotModal);
    }
  }

  function openForgotModal(e) {
    e.preventDefault();
    App.UI.setFormMessage('forgotPasswordFormMessage', '');
    document.getElementById('forgotPasswordForm').reset();
    document.getElementById('forgotPasswordModal').classList.add('modal--active');
  }

  function initSettings() {
    const pForm = document.getElementById('profileSettingsForm');
    if (pForm) {
      pForm.removeEventListener('submit', handleProfileSettingsSubmit);
      pForm.addEventListener('submit', handleProfileSettingsSubmit);
    }
    const pwdForm = document.getElementById('passwordSettingsForm');
    if (pwdForm) {
      pwdForm.removeEventListener('submit', handlePasswordSettingsSubmit);
      pwdForm.addEventListener('submit', handlePasswordSettingsSubmit);
    }
  }

  App.Auth = {
    handleLogin,
    handleLogout,
    handleForgotPasswordSubmit,
    loadSettings,
    initLogin,
    initSettings
  };

})(window.App = window.App || {});
