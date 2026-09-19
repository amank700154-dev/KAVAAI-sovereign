/**
 * KAVAAI SOVEREIGN — CLIENT RUNTIME ENVIRONMENT CONFIGURATION
 * Module: frontend/config.js
 * 
 * Provides dynamic environment configuration for Vercel / Cloud deployments.
 * When deploying to Vercel, set API_BASE_URL to your Render backend URL.
 * When running locally, leave blank to automatically default to loopback (127.0.0.1:8000).
 */

window.KAVAAI_ENV = window.KAVAAI_ENV || {
    // Render backend URL (e.g. "https://kavaai-backend.onrender.com")
    // When empty, defaults automatically to loopback in dev mode
    API_BASE_URL: "",

    // Supabase Anonymous Public Configuration (Safe for client browsers)
    // If empty, frontend will query ${API_BASE_URL}/api/auth/config automatically
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: ""
};

// Expose standard environment variable aliases
window.VITE_API_BASE_URL = window.KAVAAI_ENV.API_BASE_URL;
window.VITE_SUPABASE_URL = window.KAVAAI_ENV.SUPABASE_URL;
window.VITE_SUPABASE_ANON_KEY = window.KAVAAI_ENV.SUPABASE_ANON_KEY;
window.SIH_API_BASE_URL = window.KAVAAI_ENV.API_BASE_URL;
