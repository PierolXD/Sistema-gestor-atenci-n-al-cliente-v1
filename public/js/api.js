export function getToken() {
  return localStorage.getItem('sacs_token');
}

export function clearSession() {
  localStorage.removeItem('sacs_token');
  localStorage.removeItem('sacs_user');
  localStorage.removeItem('sacs_sucursal');
  localStorage.removeItem('sacs_ventanilla');
}

export async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    window.location.href = '/login.html';
    throw new Error('Sesión expirada.');
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!res.ok) throw new Error('Error al exportar reporte.');
    return res.text();
  }

  const body = await res.json();
  if (!res.ok || !body.ok) {
    const detail = Array.isArray(body.details) && body.details[0]?.mensaje
      ? ` (${body.details[0].mensaje})`
      : '';
    throw new Error((body.error || 'Error en la operación.') + detail);
  }
  return body.data;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtCurrency(val) {
  const num = Number(val || 0);
  return `S/ ${num.toFixed(2)}`;
}

export function fmtDurationMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function fmtDurationHHMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const hrs = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function fmtSlaRestante(seconds) {
  const s = Number(seconds || 0);
  if (s <= 0) return 'Vencido';
  const days = Math.floor(s / 86400);
  if (days >= 2) return `${days}d restantes`;
  const hrs = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  return `${String(hrs).padStart(2, '0')}h ${String(min).padStart(2, '0')}m`;
}

export function fmtTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
