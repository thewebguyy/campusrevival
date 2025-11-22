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

// ===== Authentication Helper =====
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

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

function clearAuthToken() {
  localStorage.removeItem('authToken');
}

// ===== API Functions =====

// Get all schools
async function getAllSchools() {
  try {
    const response = await fetch(`${API_URL}/schools`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch schools`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching schools:', error);
    throw new Error(`Failed to load schools. Please check if the backend is running on port 5000.`);
  }
}

// Get single school by ID
async function getSchoolById(schoolId) {
  try {
    const response = await fetch(`${API_URL}/schools/${schoolId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: School not found`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching school:', error);
    throw error;
  }
}

// Get school adopters
async function getSchoolAdopters(schoolId) {
  try {
    const response = await fetch(`${API_URL}/schools/${schoolId}/adopters`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch adopters`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching adopters:', error);
    throw error;
  }
}

// Adopt a school
async function adoptSchool(schoolId, adoptionType = 'prayer') {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Please login first');
  }

  try {
    const response = await fetch(`${API_URL}/adoptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        schoolId,
        adoptionType 
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to adopt school');
    }

    return data;
  } catch (error) {
    console.error('Adoption error:', error);
    throw error;
  }
}

// Get user's adoptions (for dashboard)
async function getMyAdoptions() {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Please login first');
  }

  try {
    const response = await fetch(`${API_URL}/adoptions/my`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch your adoptions');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching adoptions:', error);
    throw error;
  }
}

// User signup
async function signup(name, email, password) {
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Signup failed');
    }

    // Save token
    if (data.token) {
      setAuthToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Signup error:', error);
    throw error;
  }
}

// User signin
async function signin(email, password) {
  try {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Login failed');
    }

    // Save token
    if (data.token) {
      setAuthToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Signin error:', error);
    throw error;
  }
}

// Logout
function logout() {
  clearAuthToken();
  window.location.href = 'index.html';
}

// Get current user profile
async function getProfile() {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Please login first');
  }

  try {
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthToken();
        throw new Error('Session expired. Please login again.');
      }
      throw new Error('Failed to fetch profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Profile error:', error);
    throw error;
  }
}