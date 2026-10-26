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
    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(`/api${path}`, opts);

    // Read once; some error responses are not JSON.
    const rawText = await res.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      let message = (data && data.error) ? data.error : (rawText || 'Request failed');
      if (res.status === 429) {
        message = 'Too many requests';
      }

      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    return data ?? {};
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
  put(path, body) { return this.request('PUT', path, body); },

  // Auth
  register(data) { return this.post('/auth/register', data); },
  login(data) { return this.post('/auth/login', data); },
  forgotPassword(data) { return this.post('/auth/forgot-password', data); },
  getProfile() { return this.get('/auth/me'); },
  updateProfile(data) { return this.put('/auth/me', data); },
  changePassword(data) { return this.put('/auth/me/password', data); },

  // Labs
  getLabs() { return this.get('/labs'); },
  getActiveLabs() { return this.get('/labs/active'); },
  getLabById(id) { return this.get(`/labs/${id}`); },
  createLab(data) { return this.post('/labs', data); },
  updateLab(id, data) { return this.patch(`/labs/${id}`, data); },
  deleteLab(id) { return this.request('DELETE', `/labs/${id}`); },

  // Items
  getItems() { return this.get('/items'); },
  getItemById(id) { return this.get(`/items/${encodeURIComponent(id)}`); },
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
    const qs = new URLSearchParams();
    qs.set('start_date', startDate);
    qs.set('end_date', endDate);
    return this.get(`/reservations/lab/${encodeURIComponent(labId)}?${qs.toString()}`);
  },
  createReservation(data) { return this.post('/reservations', data); },
  approveReservation(id, status) { return this.patch(`/reservations/${id}/approve`, { status }); },
  cancelReservation(id) { return this.patch(`/reservations/${id}/cancel`); },
  getMonthlyReport(year, month) { return this.get(`/reservations/report/${year}/${month}`); },
  getReportByDateRange(startDate, endDate) {
    const qs = new URLSearchParams({ start_date: startDate, end_date: endDate });
    return this.get(`/reservations/report-range?${qs.toString()}`);
  },

  // Faculties
  getFaculties() { return this.get('/faculties'); },
  getFacultyById(id) { return this.get(`/faculties/${id}`); },
  createFaculty(data) { return this.post('/faculties', data); },
  updateFaculty(id, data) { return this.request('PUT', `/faculties/${id}`, data); },
  deleteFaculty(id) { return this.request('DELETE', `/faculties/${id}`); },

  // Programs
  getPrograms() { return this.get('/programs'); },
  getProgramById(id) { return this.get(`/programs/${id}`); },
  createProgram(data) { return this.post('/programs', data); },
  updateProgram(id, data) { return this.request('PUT', `/programs/${id}`, data); },
  deleteProgram(id) { return this.request('DELETE', `/programs/${id}`); },
};
