// All frontend config comes from Vite env vars (frontend/.env).
const env = import.meta.env;

export const AUTH0_DOMAIN = env.VITE_AUTH0_DOMAIN || '';
export const AUTH0_CLIENT_ID = env.VITE_AUTH0_CLIENT_ID || '';
export const AUTH0_AUDIENCE = env.VITE_AUTH0_AUDIENCE || '';
export const API_URL = (env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
export const DEV_USER = (env.VITE_DEV_USER || '').trim();

export const AUTH0_CONFIGURED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);
