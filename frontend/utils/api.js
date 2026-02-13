/**
 * @file CRM Frontend API Client
 * Handles all API communication, authentication, token management,
 * and provides user-friendly error classification.
 */

// ═══════════════════════════════════════════════════════════
//  Configuration
// ═══════════════════════════════════════════════════════════

/**
 * Determine the API base URL based on the current hostname.
 * This allows the same frontend code to work in local dev,
 * staging, and production without changes.
 *
 * @returns {string} The API base URL (no trailing slash).
 */
function getApiUrl() {
  const { hostname, protocol, port } = window.location;

  // Local development with Vercel CLI or similar
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
  }

  // Same-origin deployment (Vercel, etc.)
  return '/api';
}

const API_URL = getApiUrl();
console.log('[CRM] API Base:', API_URL);

// ═══════════════════════════════════════════════════════════
//  Error Classification
// ═══════════════════════════════════════════════════════════

/** @enum {string} */
const ErrorType = {
  NETWORK: 'NETWORK',
  AUTH: 'AUTH',
  CLIENT: 'CLIENT',
  SERVER: 'SERVER',
  RATE_LIMIT: 'RATE_LIMIT',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Custom error with extra metadata for UI-level handling.
 */
class ApiError extends Error {
  /**
   * @param {string} message   - Human-readable message.
   * @param {string} type      - One of ErrorType values.
   * @param {number} status    - HTTP status code.
   * @param {string} [code]    - Machine-readable code from the server.
   * @param {object} [details] - Extra context.
   */
  constructor(message, type, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.status = status;
    this.code = code ?? '';
    this.details = details ?? null;
  }

  /** Suggest a user-facing action based on error type. */
  get userAction() {
    switch (this.type) {
      case ErrorType.NETWORK:
        return 'Please check your internet connection and try again.';
      case ErrorType.AUTH:
        return 'Please log in again to continue.';
      case ErrorType.RATE_LIMIT:
        return 'You are being rate-limited. Please wait a moment and try again.';
      case ErrorType.CLIENT:
        return 'Please check your input and try again.';
      case ErrorType.SERVER:
        return 'Something went wrong on our end. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  Authentication Helpers
// ═══════════════════════════════════════════════════════════

const TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

/** @returns {string|null} */
function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** @param {string} token */
function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** @returns {string|null} */
function getRefreshTokenValue() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** @param {string} token */
function setRefreshToken(token) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Log out the current user.
 */
async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('API Logout failed, clearing local state anyway', err);
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = 'signin.html';
}

// Expose logout globally for easy access from HTML
window.logout = logout;

/**
 * Check whether the user is logged in by inspecting the JWT expiry.
 *
 * @returns {boolean}
 */
function isLoggedIn() {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp) {
      return payload.exp * 1000 > Date.now();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the cached user object from localStorage.
 *
 * @returns {object|null}
 */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
//  Token Refresh
// ═══════════════════════════════════════════════════════════

/** Tracks whether a refresh is already in progress. */
let refreshPromise = null;

/**
 * Attempt to exchange the stored refresh token for a new access token.
 * De-duplicates concurrent calls.
 *
 * @returns {Promise<string|null>} New access token, or null on failure.
 */
async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rt = getRefreshTokenValue();
    if (!rt) return null;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });

      if (!response.ok) {
        clearAuthTokens();
        return null;
      }

      const data = await response.json();
      const newToken = data?.data?.token ?? data?.token;
      if (newToken) {
        setAuthToken(newToken);
        if (data?.data?.user ?? data?.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(data.data?.user ?? data.user));
        }
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ═══════════════════════════════════════════════════════════
//  Core API Request Helper
// ═══════════════════════════════════════════════════════════

/** Maximum retries for transient failures. */
const MAX_RETRIES = 2;

/**
 * Make an authenticated (if token available) API request.
 * Automatically retries on transient errors and refreshes the token
 * if a 401 is received.
 *
 * @param {string} endpoint - Path relative to API_URL (e.g. `/schools`).
 * @param {RequestInit} [options] - Fetch options.
 * @param {number} [attempt=0]
 * @returns {Promise<any>} Parsed JSON body.
 * @throws {ApiError}
 */
async function apiRequest(endpoint, options = {}, attempt = 0) {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    // Retry once on network failure
    if (attempt < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return apiRequest(endpoint, options, attempt + 1);
    }
    throw new ApiError(
      'Unable to reach the server. Please check your connection.',
      ErrorType.NETWORK,
      0
    );
  }

  // ── Handle 401 with refresh token ──────────────────────
  if (response.status === 401 && attempt === 0) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest(endpoint, options, attempt + 1);
    }
    // Refresh failed — clear everything
    clearAuthTokens();
    if (!window.location.pathname.includes('signin')) {
      window.location.href = '/signin.html';
    }
    throw new ApiError(
      'Your session has expired. Please log in again.',
      ErrorType.AUTH,
      401,
      'AUTH_TOKEN_EXPIRED'
    );
  }

  // ── Parse response body ────────────────────────────────
  let data;
  try {
    data = await response.json();
  } catch {
    if (response.ok) return {};
    throw new ApiError(
      'The server returned an unexpected response.',
      ErrorType.SERVER,
      response.status
    );
  }

  // ── Successful response ────────────────────────────────
  if (response.ok) {
    return data;
  }

  // ── Classify error ─────────────────────────────────────
  const errorMsg =
    data?.error?.message ?? data?.error ?? data?.message ?? 'Request failed';
  const errorCode = data?.error?.code ?? '';

  if (response.status === 429) {
    throw new ApiError(errorMsg, ErrorType.RATE_LIMIT, 429, errorCode, data?.error?.details);
  }
  if (response.status >= 400 && response.status < 500) {
    throw new ApiError(errorMsg, ErrorType.CLIENT, response.status, errorCode);
  }

  // 5xx — retry once
  if (response.status >= 500 && attempt < MAX_RETRIES) {
    const delay = 1000 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, delay));
    return apiRequest(endpoint, options, attempt + 1);
  }

  throw new ApiError(errorMsg, ErrorType.SERVER, response.status, errorCode);
}

// ═══════════════════════════════════════════════════════════
//  School API
// ═══════════════════════════════════════════════════════════

/**
 * Fetch all active schools. Supports search and pagination.
 *
 * @param {{ search?: string, page?: number, limit?: number }} [params]
 * @returns {Promise<Array>}
 */
async function getAllSchools(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const data = await apiRequest(`/schools${qs ? '?' + qs : ''}`);
  return data?.schools ?? data?.data?.schools ?? [];
}

async function getSchoolById(schoolId) {
  const data = await apiRequest(`/schools/${schoolId}`);
  return data?.data?.school ?? data?.school ?? data;
}

async function getSchoolBySlug(slug) {
  const data = await apiRequest(`/schools/slug/${slug}`);
  return data?.data?.school ?? data?.school ?? data;
}

async function getPublicActivity() {
  try {
    const data = await apiRequest('/public/activity');
    return data?.data?.activity ?? data?.activity ?? [];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
//  Adoption API
// ═══════════════════════════════════════════════════════════

async function adoptSchool(schoolId, adoptionType = 'prayer') {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  return apiRequest('/adoptions', {
    method: 'POST',
    body: JSON.stringify({ schoolId, adoptionType }),
  });
}

async function getMyAdoptions() {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  const data = await apiRequest('/adoptions');
  return data?.data ?? data;
}

// ═══════════════════════════════════════════════════════════
//  Auth API
// ═══════════════════════════════════════════════════════════

async function registerUser(name, email, password) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

  const payload = data?.data ?? data;
  if (payload?.token) {
    setAuthToken(payload.token);
    if (payload.refreshToken) setRefreshToken(payload.refreshToken);
    if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
  return payload;
}

async function loginUser(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const payload = data?.data ?? data;
  if (payload?.token) {
    setAuthToken(payload.token);
    if (payload.refreshToken) setRefreshToken(payload.refreshToken);
    if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
  return payload;
}

async function logout() {
  clearAuthTokens();
  window.location.href = '/index.html';
}

async function getProfile() {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  const data = await apiRequest('/auth/me');
  return data?.data ?? data;
}

// ═══════════════════════════════════════════════════════════
//  Dashboard API
// ═══════════════════════════════════════════════════════════

async function getDashboard() {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  const data = await apiRequest('/dashboard');
  return data?.data?.dashboard ?? data?.dashboard ?? data;
}

// ═══════════════════════════════════════════════════════════
//  Journal API
// ═══════════════════════════════════════════════════════════

async function getJournalEntries(schoolId = null, limit = 50) {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  let endpoint = `/journal?limit=${limit}`;
  if (schoolId) endpoint += `&schoolId=${schoolId}`;

  const data = await apiRequest(endpoint);
  return data?.data ?? data;
}

async function createJournalEntry(entryText, schoolId = null) {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  return apiRequest('/journal', {
    method: 'POST',
    body: JSON.stringify({ entryText, schoolId }),
  });
}

async function deleteJournalEntry(entryId) {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  return apiRequest(`/journal/${entryId}`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════════════════════
//  Prayer Requests API
// ═══════════════════════════════════════════════════════════

async function createPrayerRequest(schoolId, content, category = 'Other', isUrgent = false) {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  return apiRequest('/prayer-requests', {
    method: 'POST',
    body: JSON.stringify({ schoolId, content, category, isUrgent }),
  });
}

async function getPrayerRequests(schoolId) {
  const data = await apiRequest(`/prayer-requests/${schoolId}`);
  return data?.data ?? data;
}

/**
 * Mark a prayer request as answered.
 */
async function answerPrayerRequest(requestId, answerNote = '') {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  return apiRequest('/prayer-requests/answer', {
    method: 'PATCH',
    body: JSON.stringify({ requestId, answerNote }),
  });
}

// ═══════════════════════════════════════════════════════════
//  School Submission & Search
// ═══════════════════════════════════════════════════════════

/**
 * Submit a new school for admin review.
 */
async function submitSchool(schoolData) {
  if (!isLoggedIn()) throw new ApiError('Please log in first.', ErrorType.AUTH, 401);

  return apiRequest('/schools/submit', {
    method: 'POST',
    body: JSON.stringify(schoolData),
  });
}

/**
 * Search for schools by name or city.
 */
async function searchSchools(query) {
  const data = await apiRequest(`/schools?search=${encodeURIComponent(query)}`);
  return data?.schools ?? data?.data?.schools ?? [];
}

// ═══════════════════════════════════════════════════════════
//  Email Verification
// ═══════════════════════════════════════════════════════════

async function verifyEmail(token) {
  return apiRequest(`/auth/verify-email?token=${token}`);
}

// ═══════════════════════════════════════════════════════════
//  Health Check
// ═══════════════════════════════════════════════════════════

async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return await response.json();
  } catch {
    return { success: false, error: 'API unreachable' };
  }
}

// ═══════════════════════════════════════════════════════════
//  Expose to global scope
// ═══════════════════════════════════════════════════════════

window.ApiError = ApiError;
window.ErrorType = ErrorType;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.getProfile = getProfile;
window.getAllSchools = getAllSchools;
window.getSchoolById = getSchoolById;
window.getSchoolBySlug = getSchoolBySlug;
window.getPublicActivity = getPublicActivity;
window.adoptSchool = adoptSchool;
window.getMyAdoptions = getMyAdoptions;
window.getDashboard = getDashboard;
window.getJournalEntries = getJournalEntries;
window.createJournalEntry = createJournalEntry;
window.deleteJournalEntry = deleteJournalEntry;
window.createPrayerRequest = createPrayerRequest;
window.getPrayerRequests = getPrayerRequests;
window.answerPrayerRequest = answerPrayerRequest;
window.submitSchool = submitSchool;
window.searchSchools = searchSchools;
window.verifyEmail = verifyEmail;
window.checkAPIHealth = checkAPIHealth;
window.apiRequest = apiRequest;

console.log('[CRM] API Client ready');