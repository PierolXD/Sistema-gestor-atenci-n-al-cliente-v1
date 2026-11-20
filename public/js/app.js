import { apiFetch, clearSession, escapeHtml, fmtDurationHHMMSS, getToken } from './api.js';
import { renderTurnosView } from './views/turnos.view.js';
import { renderTicketsView } from './views/tickets.view.js';
import { renderClientesView } from './views/clientes.view.js';
import { renderComprobantesView } from './views/comprobantes.view.js';
import { renderOtsView } from './views/ots.view.js';
import { renderIndicadoresView } from './views/indicadores.view.js';
import { renderDatosClientesView } from './views/datos-clientes.view.js';

if (!getToken()) {
  window.location.href = '/login.html';
}

const state = {
  user: JSON.parse(localStorage.getItem('sacs_user') || 'null'),
  sucursal: JSON.parse(localStorage.getItem('sacs_sucursal') || 'null'),
  ventanilla: JSON.parse(localStorage.getItem('sacs_ventanilla') || 'null'),
  currentView: 'turnos',
  viewParams: {},
  boxElapsedSeconds: 0
};

const viewsMap = {
  turnos: renderTurnosView,
  tickets: renderTicketsView,
  clientes: renderClientesView,
  comprobantes: renderComprobantesView,
  ots: renderOtsView,
  indicadores: renderIndicadoresView,
  'datos-clientes': renderDatosClientesView
};

export function showToast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  const styles =
    type === 'error'
      ? 'bg-surface-container-high border-error/60 text-red-200'
      : type === 'info'
      ? 'bg-surface-container-high border-primary/60 text-on-surface'
      : 'bg-surface-container-high border-tertiary/60 text-emerald-200';
  const icon = type === 'error' ? 'error' : type === 'info' ? 'info' : 'check_circle';
  const iconColor = type === 'error' ? 'text-error' : type === 'info' ? 'text-primary' : 'text-tertiary';

  el.className = `obsidian-card px-4 py-3 border shadow-xl flex items-start gap-2.5 text-xs animate-fade-in ${styles}`;
  el.innerHTML = `
    <span class="material-symbols-outlined text-[18px] ${iconColor} shrink-0">${icon}</span>
    <span class="leading-relaxed">${escapeHtml(message)}</span>
  `;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

export function showModal(title, bodyHtml, onMount) {
  const root = document.getElementById('modal-root');
  root.classList.remove('hidden');
  root.classList.add('flex');
  root.innerHTML = `
    <div class="obsidian-card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-fade-in">
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-outline-variant">
        <h3 class="text-sm font-bold text-on-surface">${escapeHtml(title)}</h3>
        <button id="modal-close-x" type="button" class="text-secondary hover:text-on-surface cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div id="modal-body">${bodyHtml}</div>
    </div>
  `;
  document.getElementById('modal-close-x').addEventListener('click', closeModal);
  root.onclick = (e) => {
    if (e.target === root) closeModal();
  };
  if (typeof onMount === 'function') {
    onMount(document.getElementById('modal-body'));
  }
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  root.classList.add('hidden');
  root.classList.remove('flex');
  root.innerHTML = '';
}

export function getAppContext() {
  return {
    user: state.user,
    sucursal: state.sucursal,
    ventanilla: state.ventanilla,
    navigate,
    showModal,
    closeModal,
    showToast,
    refreshHeaderAndBadges
  };
}

function updateHeaderUI() {
  const u = state.user;
  const v = state.ventanilla;
  if (u) {
    document.getElementById('header-user-name').textContent = u.nombre_completo;
    document.getElementById('header-user-avatar').textContent = u.iniciales || 'OP';
  }
  const boxName = v ? v.nombre : 'Sin Box';
  const boxEstado = v ? v.estado : 'ACTIVO';
  const metaEl = document.getElementById('header-user-meta');
  metaEl.textContent = `${boxName} • ${boxEstado}`;
  metaEl.className = `text-[11px] ${
    boxEstado === 'OCUPADO' ? 'text-primary' : boxEstado === 'PAUSA' ? 'text-amber-400' : 'text-tertiary'
  }`;

  const sidebarLabel = document.getElementById('sidebar-box-label');
  const sidebarDot = document.getElementById('sidebar-box-dot');
  const toggleBtnText = document.getElementById('btn-toggle-box-text');
  sidebarLabel.textContent = v ? `${v.nombre} (${v.estado})` : 'Sin Box';
  sidebarDot.className = `w-2 h-2 rounded-full ${
    boxEstado === 'OCUPADO' ? 'bg-primary' : boxEstado === 'PAUSA' ? 'bg-amber-400' : 'bg-tertiary'
  }`;
  toggleBtnText.textContent = boxEstado === 'PAUSA' ? 'Reanudar Puesto' : 'Pausar Puesto';
  state.boxElapsedSeconds = v?.segundos_en_estado ?? 0;
  document.getElementById('sidebar-box-timer').textContent = fmtDurationHHMMSS(state.boxElapsedSeconds);
}

export async function refreshHeaderAndBadges() {
  try {
    const [perfil, turnosData, ticketsData] = await Promise.all([
      apiFetch('/api/auth/me'),
      apiFetch(`/api/turnos?sucursal_id=${state.sucursal?.id || 1}`),
      apiFetch('/api/tickets')
    ]);
    state.user = perfil.usuario;
    state.sucursal = perfil.sucursal;
    state.ventanilla = turnosData.miVentanilla || perfil.ventanilla;
    localStorage.setItem('sacs_user', JSON.stringify(state.user));
    localStorage.setItem('sacs_ventanilla', JSON.stringify(state.ventanilla));
    updateHeaderUI();

    document.getElementById('badge-turnos').textContent = String(turnosData.kpis?.en_cola_count ?? 0);
    document.getElementById('badge-tickets').textContent = String(ticketsData.kpis?.en_cola ?? 0);
  } catch {
    // Silencioso en refresh de fondo
  }
}

export async function navigate(viewName, params = {}) {
  if (!viewsMap[viewName]) viewName = 'turnos';
  state.currentView = viewName;
  state.viewParams = params;

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    const active = btn.getAttribute('data-nav') === viewName;
    btn.className = active
      ? 'sidebar-nav-item w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold bg-primary-container text-white shadow-sm cursor-pointer'
      : 'sidebar-nav-item w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer';
  });

  const container = document.getElementById('main-content');
  container.innerHTML = `<div class="py-16 text-center text-xs text-secondary">Cargando ${escapeHtml(viewName)}...</div>`;
  try {
    await viewsMap[viewName](container, getAppContext(), params);
    await refreshHeaderAndBadges();
  } catch (err) {
    container.innerHTML = `
      <div class="obsidian-card p-6 border-error/50 text-center">
        <p class="text-sm font-semibold text-red-300 mb-2">Error al cargar la vista</p>
        <p class="text-xs text-on-surface-variant">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

async function bootstrap() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearSession();
    window.location.href = '/login.html';
  });

  document.getElementById('btn-collapse-sidebar').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
  });

  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const isLight = document.documentElement.classList.toggle('light-mode');
    localStorage.setItem('sacs_theme', isLight ? 'light' : 'dark');
    document.getElementById('theme-icon').textContent = isLight ? 'dark_mode' : 'light_mode';
  });

  try {
    const [perfil, sucursales] = await Promise.all([
      apiFetch('/api/auth/me'),
      apiFetch('/api/usuarios/sucursales')
    ]);
    state.user = perfil.usuario;
    state.sucursal = perfil.sucursal;
    state.ventanilla = perfil.ventanilla;
    updateHeaderUI();

    const sucSelect = document.getElementById('header-sucursal');
    sucSelect.innerHTML = sucursales
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === state.sucursal?.id ? 'selected' : ''} class="bg-surface-container">${escapeHtml(s.nombre)}</option>`
      )
      .join('');
    sucSelect.addEventListener('change', () => {
      const sel = sucursales.find((s) => s.id === Number(sucSelect.value));
      if (sel) {
        state.sucursal = sel;
        localStorage.setItem('sacs_sucursal', JSON.stringify(sel));
        document.getElementById('header-red-status').textContent = `Red Operativa Normal (${sel.estado_red_pct}%)`;
        navigate(state.currentView, state.viewParams);
      }
    });

    if (localStorage.getItem('sacs_theme') === 'light') {
      document.documentElement.classList.add('light-mode');
      document.getElementById('theme-icon').textContent = 'dark_mode';
    }

    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.getAttribute('data-nav')));
    });

    document.getElementById('btn-global-refresh').addEventListener('click', () => {
      navigate(state.currentView, state.viewParams);
      showToast('Datos sincronizados con PostgreSQL.', 'info');
    });

    document.getElementById('btn-toggle-box').addEventListener('click', async () => {
      if (!state.ventanilla) {
        showToast('Tu usuario no tiene un Box físico asignado.', 'info');
        return;
      }
      const nextEstado = state.ventanilla.estado === 'PAUSA' ? 'DISPONIBLE' : 'PAUSA';
      try {
        await apiFetch(`/api/usuarios/ventanillas/${state.ventanilla.id}/estado`, {
          method: 'PATCH',
          body: JSON.stringify({ estado: nextEstado })
        });
        showToast(`Puesto ${state.ventanilla.nombre} marcado como ${nextEstado}.`);
        await refreshHeaderAndBadges();
        if (state.currentView === 'turnos') {
          await navigate('turnos');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    setInterval(() => {
      state.boxElapsedSeconds += 1;
      const boxTimer = document.getElementById('sidebar-box-timer');
      if (boxTimer) boxTimer.textContent = fmtDurationHHMMSS(state.boxElapsedSeconds);

      document.querySelectorAll('[data-live-seconds]').forEach((el) => {
        const next = Number(el.getAttribute('data-live-seconds') || 0) + 1;
        el.setAttribute('data-live-seconds', String(next));
        const mode = el.getAttribute('data-live-format') || 'mmss';
        if (mode === 'espera') {
          const m = Math.floor(next / 60);
          const s = next % 60;
          el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}m espera`;
        } else {
          const m = Math.floor(next / 60);
          const s = next % 60;
          el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
      });
    }, 1000);

    await navigate('turnos');
  } catch (err) {
    clearSession();
    window.location.href = '/login.html';
  }
}

bootstrap();
