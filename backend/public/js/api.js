const API = {
  token: null,

  setToken(t) {
    this.token = t;
    if (t) {
      localStorage.setItem('token', t);
    } else {
      localStorage.removeItem('token');
    }
  },

  getToken() {
    return this.token || localStorage.getItem('token');
  },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: this.headers(),
    };
    if (body && (method === 'POST' || method === 'PATCH')) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(`/api${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },

  // Auth
  register(data) { return this.post('/auth/register', data); },
  login(data) { return this.post('/auth/login', data); },
  getProfile() { return this.get('/auth/me'); },

  // Labs
  getLabs() { return this.get('/labs'); },
  getActiveLabs() { return this.get('/labs/active'); },
  createLab(data) { return this.post('/labs', data); },
  updateLab(id, data) { return this.patch(`/labs/${id}`, data); },
  deleteLab(id) { return this.request('DELETE', `/labs/${id}`); },

  // Items
  getItems() { return this.get('/items'); },
  getItemsByLab(labId) { return this.get(`/items/lab/${labId}`); },
  createItem(data) { return this.post('/items', data); },
  updateItem(id, data) { return this.patch(`/items/${id}`, data); },
  deleteItem(id) { return this.request('DELETE', `/items/${id}`); },
  getItemStats() { return this.get('/items/stats'); },

  // Reservations
  getReservations(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.lab_id) qs.set('lab_id', filters.lab_id);
    if (filters.start_date) qs.set('start_date', filters.start_date);
    if (filters.end_date) qs.set('end_date', filters.end_date);
    const q = qs.toString();
    return this.get(`/reservations${q ? '?' + q : ''}`);
  },
  getMyReservations() { return this.get('/reservations/my'); },
  getReservation(id) { return this.get(`/reservations/${id}`); },
  getReservationsByLab(labId, startDate, endDate) {
    return this.get(`/reservations/lab/${labId}?start_date=${startDate}&end_date=${endDate}`);
  },
  createReservation(data) { return this.post('/reservations', data); },
  approveReservation(id, status) { return this.patch(`/reservations/${id}/approve`, { status }); },
  cancelReservation(id) { return this.patch(`/reservations/${id}/cancel`); },
  getMonthlyReport(year, month) { return this.get(`/reservations/report/${year}/${month}`); },
};
