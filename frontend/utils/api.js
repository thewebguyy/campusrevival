console.log('CRM API Client Initializing...');
console.log('Hostname detected:', window.location.hostname);

// ===== CONFIGURATION =====
function getApiUrl() {
  return '/api';
}

const API_URL = getApiUrl();
console.log('Final API_URL chosen:', API_URL);

// ===== Authentication Helper Functions =====
function isLoggedIn() {
  const token = localStorage.getItem('authToken');
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));

    // If exp is present, check it. If not, assume valid (some tokens dont have exp)
    if (payload.exp) {
      return payload.exp * 1000 > Date.now();
    }
    return true;
  } catch (e) {
    console.error('Token validation error:', e);
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

// Get school by slug
async function getSchoolBySlug(slug) {
  try {
    const data = await apiRequest(`/schools/slug/${slug}`);
    return data.school || data;
  } catch (error) {
    console.error('Error fetching school by slug:', error);
    throw error;
  }
}

// Get public activity pulse
async function getPublicActivity() {
  try {
    const data = await apiRequest('/public/activity');
    return data.activity || [];
  } catch (error) {
    console.error('Error fetching pulse:', error);
    return [];
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

// Attach to window for global access
window.registerUser = registerUser;
window.loginUser = loginUser;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.getAllSchools = getAllSchools;
window.getPublicActivity = getPublicActivity;
window.apiRequest = apiRequest;

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