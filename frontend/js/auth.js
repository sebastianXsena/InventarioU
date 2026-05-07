// ============================================================================
// AUTH MODULE - Autenticación y sesión
// ============================================================================

class AuthManager {
  constructor() {
    this.user = null;
    this.token = localStorage.getItem('token');
    this.loadUser();
  }

  async loadUser() {
    if (!this.token) return;

    try {
      this.user = await api.getProfile();
      return this.user;
    } catch (error) {
      console.error('Error cargando usuario:', error);
      this.logout();
    }
  }

  async register(name, email, password) {
    try {
      this.user = await api.register(name, email, password);
      this.token = api.token;
      return this.user;
    } catch (error) {
      throw error;
    }
  }

  async login(email, password) {
    try {
      this.user = await api.login(email, password);
      this.token = api.token;
      return this.user;
    } catch (error) {
      throw error;
    }
  }

  logout() {
    this.user = null;
    this.token = null;
    api.clearToken();
    localStorage.removeItem('token');
  }

  isAuthenticated() {
    return !!this.user && !!this.token;
  }

  isAdmin() {
    return this.user?.role === 'admin';
  }

  getCurrentUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }
}

// Instancia global
const auth = new AuthManager();
