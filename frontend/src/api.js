// The only place the frontend talks to the backend. Pages never call fetch.
// One function per endpoint in API.md; keep the two in sync.

import { API_URL, DEV_USER } from './config.js';

let tokenGetter = null;

/** Called once by the Auth0 wrapper with getAccessTokenSilently. */
export function setTokenGetter(fn) {
  tokenGetter = fn;
}

async function authHeaders() {
  if (DEV_USER) return { 'X-Dev-User': DEV_USER };
  if (!tokenGetter) return {};
  try {
    const token = await tokenGetter();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // Not logged in (login_required etc.): send no token, backend answers 401.
    return {};
  }
}

/**
 * fetch wrapper: adds auth, JSON-encodes `body` objects, parses JSON,
 * and throws Error(detail) on non-2xx. The Error has .status.
 */
export async function apiFetch(path, options = {}) {
  const { body, headers, ...rest } = options;
  const init = {
    ...rest,
    headers: { Accept: 'application/json', ...(await authHeaders()), ...headers },
  };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      init.headers['Content-Type'] = 'application/json';
    }
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    const err = new Error(`Cannot reach the API at ${API_URL}`);
    err.status = 0;
    throw err;
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail = data && typeof data === 'object' ? data.detail : data;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ') // FastAPI 422
          : `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

// --- shared ---
export const getMe = () => apiFetch('/me');

// --- Feature A: lease check (Person A) ---
/** payload: { lease_text, neighbourhood, rooms, rent_eur, ui_language } */
export const analyzeLease = (payload) => apiFetch('/lease/analyze', { method: 'POST', body: payload });
export const listAnalyses = () => apiFetch('/lease/analyses');
export const getAnalysis = (id) => apiFetch(`/lease/analyses/${encodeURIComponent(id)}`);
/** Redacted text sent to Gemini, Gemini's JSON and the price verdict inputs ("How this was checked"). */
export const getAnalysisDetails = (id) =>
  apiFetch(`/lease/analyses/${encodeURIComponent(id)}/details`);
export const getNeighbourhoods = () => apiFetch('/pricing/neighbourhoods');
/** params: { rooms: 1..3 (required), neighbourhood (optional; leave out for city-wide) } */
export const getPriceTrend = ({ rooms, neighbourhood } = {}) =>
  apiFetch(`/pricing/trend${qs({ rooms, neighbourhood })}`);

// --- Feature B: event groups (Person B) ---
/** filters: { interest: slug, from: ISO datetime, to: ISO datetime }, all optional. */
export const listEvents = (filters = {}) => apiFetch(`/events${qs(filters)}`);
export const getInterests = () => apiFetch('/profile/interests');
export const getProfile = () => apiFetch('/profile');
/** profile: { display_name, interest_slugs: [slug], availability: [slot] } */
export const saveProfile = (profile) => apiFetch('/profile', { method: 'PUT', body: profile });
export const joinEvent = (eventId) =>
  apiFetch(`/events/${encodeURIComponent(eventId)}/join`, { method: 'POST' });
export const leaveEvent = (eventId) =>
  apiFetch(`/events/${encodeURIComponent(eventId)}/leave`, { method: 'POST' });
export const runMatch = (eventId) =>
  apiFetch(`/events/${encodeURIComponent(eventId)}/match`, { method: 'POST' });
export const getMyGroup = (eventId) => apiFetch(`/events/${encodeURIComponent(eventId)}/my-group`);
