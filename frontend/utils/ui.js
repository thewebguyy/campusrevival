/**
 * @file UI Utilities
 * Handles header loading, navigation, and auth-state UI updates.
 */

// ═══════════════════════════════════════════════════════════
//  Header Loading
// ═══════════════════════════════════════════════════════════

/**
 * Load the shared header HTML from /header.html and inject it into
 * the #header-placeholder element.  Falls back to a minimal inline
 * navigation if the fetch fails (e.g. during local file:// testing).
 */
async function loadHeader() {
    const placeholder = document.getElementById('header-placeholder');
    if (!placeholder) return;

    try {
        // Try same-origin fetch first
        const response = await fetch('/header.html');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        placeholder.innerHTML = html;
    } catch (error) {
        console.warn('[UI] Header fetch failed, rendering fallback:', error.message);
        placeholder.innerHTML = buildFallbackHeader();
    }

    // Always initialise nav after injecting HTML
    initNavigation();
    updateHeaderAuth();
}

/**
 * Build a minimal inline header when /header.html cannot be fetched.
 *
 * @returns {string} HTML string.
 */
function buildFallbackHeader() {
    return `
    <header>
      <a href="/">
        <img src="/crmfulllogo.png" alt="Campus Revival Movement Logo" class="logo"
             onerror="this.style.display='none'">
      </a>
      <div class="hamburger" id="hamburger">
        <span></span><span></span><span></span>
      </div>
      <nav>
        <ul id="nav-menu">
          <li><a href="/">Home</a></li>
          <li><a href="/about.html">About CRM</a></li>
          <li><a href="/map.html">CRM Map</a></li>
          <li><a href="/signin.html" id="header-auth-btn" class="sign-in-btn">Login</a></li>
        </ul>
      </nav>
    </header>
  `;
}

// ═══════════════════════════════════════════════════════════
//  Navigation
// ═══════════════════════════════════════════════════════════

function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (
            navMenu.classList.contains('active') &&
            !navMenu.contains(e.target) &&
            !hamburger.contains(e.target)
        ) {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        }
    });

    // Language switcher placeholder
    const langSwitcher = document.getElementById('lang-switcher');
    if (langSwitcher) {
        langSwitcher.addEventListener('change', (e) => {
            console.log('[UI] Language changed:', e.target.value);
        });
    }
}

// ═══════════════════════════════════════════════════════════
//  Auth-Aware Header
// ═══════════════════════════════════════════════════════════

function updateHeaderAuth() {
    const authBtn = document.getElementById('header-auth-btn');
    if (!authBtn) return;

    if (typeof isLoggedIn === 'function' && isLoggedIn()) {
        authBtn.textContent = 'Dashboard';
        authBtn.href = '/dashboard.html';
        authBtn.classList.add('btn-dashboard');
    } else {
        authBtn.textContent = 'Login';
        authBtn.href = '/signin.html';
        authBtn.classList.remove('btn-dashboard');
    }
}

// ═══════════════════════════════════════════════════════════
//  Toast Notifications
// ═══════════════════════════════════════════════════════════

/**
 * Show a toast notification.
 *
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [durationMs=4000]
 */
function showToast(message, type = 'info', durationMs = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
    padding: 12px 20px;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transform: translateX(40px);
    transition: opacity 0.3s, transform 0.3s;
    max-width: 360px;
    word-wrap: break-word;
  `;

    const colours = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
    };
    toast.style.backgroundColor = colours[type] ?? colours.info;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, durationMs);
}

// ═══════════════════════════════════════════════════════════
//  Error Display Helper
// ═══════════════════════════════════════════════════════════

/**
 * Show an API error as a toast with an appropriate icon and message.
 *
 * @param {Error} error
 * @param {string} [fallbackMessage]
 */
function showApiError(error, fallbackMessage = 'Something went wrong') {
    if (error?.name === 'ApiError') {
        showToast(
            `${error.message}\n${error.userAction}`,
            error.type === 'AUTH' ? 'warning' : 'error'
        );
    } else {
        showToast(fallbackMessage, 'error');
    }
}

// ═══════════════════════════════════════════════════════════
//  Global Init
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
});

// Expose globally
window.showToast = showToast;
window.showApiError = showApiError;
window.loadHeader = loadHeader;
