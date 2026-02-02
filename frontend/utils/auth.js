const API_URL = '/api'; // Vercel will proxy this to backend

function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function isLoggedIn() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('user');
  return !!(token && user);
}

function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

async function protectedFetch(url, options = {}) {
  const token = localStorage.getItem('authToken');
  if (!token) throw new Error('Please login');

  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers }
  });

  const data = await response.json();

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = '/login.html';
  }

  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// AUTH
async function registerUser(name, email, password) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

async function logout() {
  localStorage.clear();
}

// SCHOOLS
async function getAllSchools() {
  const res = await fetch(`${API_URL}/schools`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.schools;
}

async function adoptSchool(schoolId) {
  return protectedFetch(`${API_URL}/adoptions`, {
    method: 'POST',
    body: JSON.stringify({ schoolId })
  });
}

async function getMyAdoptions() {
  return protectedFetch(`${API_URL}/adoptions`);
}

async function getDashboard() {
  return protectedFetch(`${API_URL}/dashboard`);
}