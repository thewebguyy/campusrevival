// ===== Dynamic API URL Configuration =====
// This automatically detects the correct API URL for mobile and desktop

function getApiUrl() {
  // Check if we're in production (you'll set this when deploying)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Production: use the same domain as the frontend
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  
  // Development: check if accessing via network IP
  if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    // Accessing via IP address (mobile on same network)
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  
  // Default: localhost for desktop development
  return 'http://localhost:5000/api';
}

const API_URL = getApiUrl();

console.log('API URL configured as:', API_URL);

// ===== Authentication Helper Functions =====
function isLoggedIn() {
  const token = localStorage.getItem('authToken');
  if (!token) return false;
  
  try {
    // Check if token is expired (basic check)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

function clearAuthToken() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
}

// ===== API Request Helper =====
async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401) {
        clearAuthToken();
        if (window.location.pathname !== '/signin.html') {
          window.location.href = '/signin.html';
        }
      }
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// ===== SCHOOL API FUNCTIONS =====

// Get all schools
async function getAllSchools() {
  try {
    const data = await apiRequest('/schools');
    return data.schools || [];
  } catch (error) {
    console.error('Error fetching schools:', error);
    throw new Error('Failed to load schools. Please check if the backend is running.');
  }
}

// Get single school by ID
async function getSchoolById(schoolId) {
  try {
    const data = await apiRequest(`/schools/${schoolId}`);
    return data.school || data;
  } catch (error) {
    console.error('Error fetching school:', error);
    throw error;
  }
}

// Get school adopters
async function getSchoolAdopters(schoolId) {
  try {
    return await apiRequest(`/schools/${schoolId}/adopters`);
  } catch (error) {
    console.error('Error fetching adopters:', error);
    throw error;
  }
}

// ===== ADOPTION API FUNCTIONS =====

// Adopt a school
async function adoptSchool(schoolId, adoptionType = 'prayer') {
  if (!isLoggedIn()) {
    throw new Error('Please login first');
  }

  try {
    return await apiRequest('/adoptions', {
      method: 'POST',
      body: JSON.stringify({ 
        schoolId,
        adoptionType 
      })
    });
  } catch (error) {
    console.error('Adoption error:', error);
    throw error;
  }
}

// Get user's adoptions (for dashboard)
async function getMyAdoptions() {
  if (!isLoggedIn()) {
    throw new Error('Please login first');
  }

  try {
    return await apiRequest('/adoptions');
  } catch (error) {
    console.error('Error fetching adoptions:', error);
    throw error;
  }
}

// ===== AUTHENTICATION API FUNCTIONS =====

// User registration
async function registerUser(name, email, password) {
  try {
    const data = await apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    // Save token and user info
    if (data.token) {
      setAuthToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// User login
async function loginUser(email, password) {
  try {
    const data = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    // Save token and user info
    if (data.token) {
      setAuthToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Logout
async function logout() {
  try {
    await apiRequest('/logout', {
      method: 'POST'
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAuthToken();
    window.location.href = '/index.html';
  }
}

// Get current user profile
async function getProfile() {
  if (!isLoggedIn()) {
    throw new Error('Please login first');
  }

  try {
    return await apiRequest('/me');
  } catch (error) {
    console.error('Profile error:', error);
    throw error;
  }
}

// ===== DASHBOARD API FUNCTIONS =====

// Get dashboard data
async function getDashboard() {
  if (!isLoggedIn()) {
    throw new Error('Please login first');
  }

  try {
    return await apiRequest('/dashboard');
  } catch (error) {
    console.error('Dashboard error:', error);
    throw error;
  }
}

// ===== JOURNAL API FUNCTIONS =====

// Get journal entries
async function getJournalEntries(schoolId = null, limit = 50) {
  if (!isLoggedIn()) {
    throw new Error('Please login first');
  }

  try {
    let endpoint = `/journal?limit=${limit}`;
    if (schoolId) {
      endpoint += `&schoolId=${schoolId}`;
    }
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    throw error;
  }
}

// Create journal entry
async function createJournalEntry(entryText, schoolId = null) {
  if (!isLoggedIn()) {
    throw new Error('Please login first');
  }

  try {
    return await apiRequest('/journal', {
      method: 'POST',
      body: JSON.stringify({ entryText, schoolId })
    });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    throw error;
  }
}

// Delete journal entry
async function deleteJournalEntry(entryId) {
  if (!isLoggedIn()) {
    throw new Error('Please login first');
  }

  try {
    return await apiRequest(`/journal/${entryId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    throw error;
  }
}

// ===== HEALTH CHECK =====
async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('API Health Check Failed:', error);
    return { success: false, error: error.message };
  }
}

// Log API configuration on load
console.log('CRM API Client Loaded');
console.log('Environment:', window.location.hostname);
console.log('API Endpoint:', API_URL);