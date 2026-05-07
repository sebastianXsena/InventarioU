// ============================================================================
// API CLIENT - Comunicación con el backend
// ============================================================================

const API_BASE_URL = 'http://localhost:3000/api/v1';

class APIClient {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  // Método privado para hacer requests
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      return data;
    } catch (error) {
      console.error('Error en API:', error);
      throw error;
    }
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  // ========== AUTH ==========
  async register(name, email, password) {
    const result = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setToken(result.data.token);
    return result.data.user;
  }

  async login(email, password) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.data.token);
    return result.data.user;
  }

  // ========== USERS ==========
  async getProfile() {
    const result = await this.request('/users/me');
    return result.data;
  }

  async updateProfile(data) {
    const result = await this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async getUsers(limit = 10, offset = 0) {
    const result = await this.request(`/users?limit=${limit}&offset=${offset}`);
    return result;
  }

  // ========== LABORATORIES ==========
  async getLaboratories(limit = 10, offset = 0) {
    const result = await this.request(`/laboratories?limit=${limit}&offset=${offset}`);
    return result;
  }

  async getLaboratory(id) {
    const result = await this.request(`/laboratories/${id}`);
    return result.data;
  }

  async getActiveLaboratories(limit = 10, offset = 0) {
    const result = await this.request(`/laboratories/active?limit=${limit}&offset=${offset}`);
    return result;
  }

  async createLaboratory(data) {
    const result = await this.request('/laboratories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async updateLaboratory(id, data) {
    const result = await this.request(`/laboratories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  // ========== ITEMS ==========
  async getItems(limit = 10, offset = 0) {
    const result = await this.request(`/items?limit=${limit}&offset=${offset}`);
    return result;
  }

  async getItem(id) {
    const result = await this.request(`/items/${id}`);
    return result.data;
  }

  async getItemsByLaboratory(labId, limit = 10, offset = 0) {
    const result = await this.request(`/items/laboratory/${labId}?limit=${limit}&offset=${offset}`);
    return result;
  }

  async createItem(data) {
    const result = await this.request('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  // ========== RESERVATIONS ==========
  async createReservation(data) {
    const result = await this.request('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async getMyReservations(limit = 10, offset = 0) {
    const result = await this.request(`/reservations/me?limit=${limit}&offset=${offset}`);
    return result;
  }

  async getReservation(id) {
    const result = await this.request(`/reservations/${id}`);
    return result.data;
  }

  async getAllReservations(limit = 10, offset = 0) {
    const result = await this.request(`/reservations?limit=${limit}&offset=${offset}`);
    return result;
  }

  async getReservationsByLaboratory(labId, status = null, limit = 10, offset = 0) {
    let url = `/reservations/laboratory/${labId}?limit=${limit}&offset=${offset}`;
    if (status) url += `&status=${status}`;
    const result = await this.request(url);
    return result;
  }

  async approveReservation(id) {
    const result = await this.request(`/reservations/${id}/approve`, {
      method: 'PATCH',
    });
    return result.data;
  }

  async rejectReservation(id, reason) {
    const result = await this.request(`/reservations/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'rejected',
        rejection_reason: reason,
      }),
    });
    return result.data;
  }

  async cancelReservation(id) {
    const result = await this.request(`/reservations/${id}`, {
      method: 'DELETE',
    });
    return result.data;
  }

  async checkAvailability(labId, startDate, endDate) {
    const result = await this.request('/reservations/availability/check', {
      method: 'POST',
      body: JSON.stringify({
        labId,
        start_date: startDate,
        end_date: endDate,
      }),
    });
    return result.data;
  }
}

// Instancia global
const api = new APIClient();
