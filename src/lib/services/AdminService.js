// @ts-check
import { fetchWithTimeout } from '../utils/timeout.js';

/**
 * @param {string} host
 * @param {string} token
 * @param {number} [page]
 * @returns {Promise<any[]>}
 */
export async function fetchPendingGames(host, token, page = 1) {
  const url = `${host}/api/collections/pending_games/records?filter=status%3D'pending'&sort=-created&page=${page}&perPage=50`;
  const resp = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } }, 15000);
  if (!resp.ok) throw new Error('Fehler beim Laden der Anträge.');
  const data = await resp.json();
  return data.items ?? [];
}

/**
 * @param {string} host
 * @param {string} token
 * @returns {Promise<number>}
 */
export async function fetchPendingCount(host, token) {
  const url = `${host}/api/collections/pending_games/records?filter=status%3D'pending'&perPage=1`;
  const resp = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } }, 10000);
  if (!resp.ok) return 0;
  const data = await resp.json();
  return data.totalItems ?? 0;
}

/**
 * @param {string} host
 * @param {string} token
 * @param {string} recordId
 * @param {string} reviewerId
 * @returns {Promise<void>}
 */
export async function approveGame(host, token, recordId, reviewerId) {
  const url = `${host}/api/collections/pending_games/records/${recordId}`;
  const resp = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
  }, 15000);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Freischaltung fehlgeschlagen.');
  }
}

/**
 * @param {string} host
 * @param {string} token
 * @param {string} recordId
 * @param {string} reviewerId
 * @param {string} note
 * @returns {Promise<void>}
 */
export async function rejectGame(host, token, recordId, reviewerId, note) {
  const url = `${host}/api/collections/pending_games/records/${recordId}`;
  const resp = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'rejected', admin_note: note.trim(), reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
  }, 15000);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Ablehnung fehlgeschlagen.');
  }
}

/**
 * @param {string} host
 * @param {string} token
 * @param {string} recordId
 * @param {string} reviewerId
 * @param {{ name?: string, description?: string, emoji?: string, accent_color?: string, min_players?: number, max_players?: number, categories?: any[] }} updatedData
 * @returns {Promise<void>}
 */
export async function editAndApproveGame(host, token, recordId, reviewerId, updatedData) {
  const url = `${host}/api/collections/pending_games/records/${recordId}`;
  const resp = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...updatedData, status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
  }, 15000);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Bearbeiten & Freischalten fehlgeschlagen.');
  }
}

/**
 * @param {string} host
 * @param {string} token
 * @param {string} recordId
 * @returns {Promise<void>}
 */
export async function adminDeletePendingGame(host, token, recordId) {
  const url = `${host}/api/collections/pending_games/records/${recordId}`;
  const resp = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  }, 15000);
  if (!resp.ok && resp.status !== 404) {
    throw new Error('Löschen fehlgeschlagen.');
  }
}

/**
 * Reicht ein neues Spiel zur Prüfung ein (multipart/form-data für Cover-Upload).
 * @param {string} host
 * @param {string} token
 * @param {{ name: string, description: string, emoji: string, accentColor: string, minPlayers: number, maxPlayers: number, categories: any[], coverFile?: File | null }} formData
 * @returns {Promise<{id: string, cover: string}>}
 */
export async function submitPendingGame(host, token, formData) {
  const url = `${host}/api/collections/pending_games/records`;
  const body = new FormData();
  body.append('name', formData.name.trim());
  body.append('description', formData.description.trim());
  body.append('emoji', formData.emoji || '🎲');
  body.append('accent_color', formData.accentColor || '#6366f1');
  body.append('min_players', String(formData.minPlayers));
  body.append('max_players', String(formData.maxPlayers));
  body.append('categories', JSON.stringify(formData.categories));
  body.append('status', 'pending');
  if (formData.coverFile) {
    body.append('cover', formData.coverFile);
  }
  const resp = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body
  }, 30000);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Einreichen fehlgeschlagen.');
  }
  return await resp.json();
}

/**
 * Löscht einen eigenen pending_games-Eintrag (nur Author).
 * @param {string} host
 * @param {string} token
 * @param {string} recordId
 * @returns {Promise<void>}
 */
export async function withdrawPendingGame(host, token, recordId) {
  const url = `${host}/api/collections/pending_games/records/${recordId}`;
  const resp = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  }, 15000);
  if (!resp.ok && resp.status !== 404) {
    throw new Error('Einreichung konnte nicht zurückgezogen werden.');
  }
}
