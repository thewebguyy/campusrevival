/**
 * UI Utilities
 */

async function loadHeader() {
    try {
        const response = await fetch('/header.html');
        if (!response.ok) throw new Error('Failed to load header');
        const html = await response.text();

        // Insert header
        const placeholder = document.getElementById('header-placeholder');
        if (!placeholder) return;

        // Extract body content only (ignore head/scripts if any, though usually header.html is partial)
        // For simplicity, just innerHTML it.
        placeholder.innerHTML = html;

        // Initialize Navigation Logic
        initNavigation();

        // Update Auth State in Header
        updateHeaderAuth();

    } catch (error) {
        console.error('Header loading failed:', error);
        // Fallback?
    }
}

function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !hamburger.contains(e.target)) {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });

        // Handle language switcher if present
        const langSwitcher = document.getElementById('lang-switcher');
        if (langSwitcher) {
            langSwitcher.addEventListener('change', (e) => {
                console.log('Language changed:', e.target.value);
                // Implement translation logic here
            });
        }
    }
}

function updateHeaderAuth() {
    const authBtn = document.getElementById('header-auth-btn');
    if (authBtn && typeof isLoggedIn === 'function' && isLoggedIn()) {
        authBtn.textContent = 'Dashboard';
        authBtn.href = '/dashboard.html';
        authBtn.classList.add('btn-dashboard');
    }
}

// Global UI Init
document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
});
