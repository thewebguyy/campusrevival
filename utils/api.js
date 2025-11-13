// API Configuration
const API_URL = 'http://localhost:5000/api';

// ============== HELPER FUNCTIONS ==============
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
  if (!token) {
    throw new Error('Please login');
  }

  const response = await fetch(url, {
    ...options,
    headers: { 
      ...getAuthHeaders(), 
      ...options.headers 
    }
  });

  const data = await response.json();

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = '/signin.html';
    throw new Error('Unauthorized - please login again');
  }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

// ============== AUTHENTICATION ==============
async function registerUser(name, email, password) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed');
  }
  
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
  
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }
  
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

async function logout() {
  try {
    await protectedFetch(`${API_URL}/logout`, { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.clear();
    window.location.href = '/index.html';
  }
}

// ============== SCHOOLS ==============
async function getAllSchools() {
  const res = await fetch(`${API_URL}/schools`);
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch schools');
  }
  
  return data.schools;
}

async function getSchoolById(schoolId) {
  const res = await fetch(`${API_URL}/schools/${schoolId}`);
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch school');
  }
  
  return data.school;
}

// ============== ADOPTIONS ==============
async function adoptSchool(schoolId) {
  return protectedFetch(`${API_URL}/adoptions`, {
    method: 'POST',
    body: JSON.stringify({ schoolId })
  });
}

async function getMyAdoptions() {
  const data = await protectedFetch(`${API_URL}/adoptions`);
  return data.adoptions;
}

// ============== JOURNAL ==============
async function createJournalEntry(entryText, schoolId = null) {
  return protectedFetch(`${API_URL}/journal`, {
    method: 'POST',
    body: JSON.stringify({ entryText, schoolId })
  });
}

async function getJournalEntries(schoolId = null, limit = 50) {
  const url = schoolId 
    ? `${API_URL}/journal?schoolId=${schoolId}&limit=${limit}`
    : `${API_URL}/journal?limit=${limit}`;
  
  const data = await protectedFetch(url);
  return data.entries;
}

async function deleteJournalEntry(entryId) {
  return protectedFetch(`${API_URL}/journal/${entryId}`, {
    method: 'DELETE'
  });
}

// ============== DASHBOARD ==============
async function getDashboard() {
  const data = await protectedFetch(`${API_URL}/dashboard`);
  return data.dashboard;
}

// ============== USER INFO ==============
async function getMe() {
  const data = await protectedFetch(`${API_URL}/me`);
  return data.user;
}
