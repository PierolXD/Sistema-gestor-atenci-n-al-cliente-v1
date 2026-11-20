import { apiFetch, escapeHtml, fmtDurationMMSS, getToken } from '../api.js';

export async function renderIndicadoresView(container, ctx) {
  let periodo = 'hoy';
  let canal = 'todos';
  let filterOp = '';

  async function loadAndRender() {
    const qs = new URLSearchParams({ periodo, canal });
    const data = await apiFetch(`/api/indicadores/resumen?${qs.toString()}`);
    const { kpis, curvaAfluencia, distribucion, rendimientoOperadores, alertaCongestion } = data;

    const maxEmitidos = Math.max(...curvaAfluencia.map((p) => p.emitidos), 5);
    const maxEspera = Math.max(...curvaAfluencia.map((p) => p.espera_min), 6);

    // Build SVG polyline points for wait times across the 10 slots
    const svgW = 600;
    const svgH = 140;
    const stepX = svgW / Math.max(1, curvaAfluencia.length);
    const linePoints = curvaAfluencia
      .map((p, idx) => {
        const x = Math.round(idx * stepX + stepX / 2);
        const y = Math.round(svgH - 16 - (p.espera_min / maxEspera) * (svgH - 36));
        return `${x},${y}`;
      })
      .join(' ');

    container.innerHTML = `
      <div class="space-y-5">
        <!-- Header & Filters -->
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-tertiary">● Telemetría Operativa 24/7 • ID: SUP-REG-0941</div>
            <h1 class="text-2xl font-bold tracking-tight text-on-surface mt-0.5">Indicadores de Gestión y Control de Atención</h1>
            <p class="text-xs text-secondary mt-0.5">Supervisión continua de rendimiento en sala y cumplimiento normativo Osinergmin.</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap text-xs">
            <div class="flex items-center bg-surface-container border border-outline-variant rounded-lg p-1">
              ${[
                ['hoy', 'Hoy · Tiempo Real'],
                ['semana', 'Esta Semana'],
                ['mes', 'Mes en Curso']
              ]
                .map(
                  ([val, label]) => `
                    <button data-per="${val}" class="per-tab px-3 py-1.5 rounded-md ${
                      periodo === val ? 'bg-primary-container text-white font-semibold' : 'text-on-surface-variant hover:text-on-surface'
                    } cursor-pointer">${label}</button>
                  `
                )
                .join('')}
            </div>

            <select id="ind-canal" class="obsidian-input px-3 py-2 text-xs">
              <option value="todos" ${canal === 'todos' ? 'selected' : ''}>Todos los Canales</option>
              <option value="PRESENCIAL" ${canal === 'PRESENCIAL' ? 'selected' : ''}>Ventanilla Presencial</option>
              <option value="WHATSAPP" ${canal === 'WHATSAPP' ? 'selected' : ''}>WhatsApp Bot</option>
              <option value="PORTAL_WEB" ${canal === 'PORTAL_WEB' ? 'selected' : ''}>Portal Web Clientes</option>
              <option value="CALL_CENTER" ${canal === 'CALL_CENTER' ? 'selected' : ''}>Call Center 24h</option>
            </select>

            <button id="btn-export-csv" type="button" class="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">download</span>
              <span>Exportar Reporte CSV</span>
            </button>
          </div>
        </div>

        <!-- 4 KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="obsidian-card p-5">
            <div class="flex items-center justify-between text-xs text-secondary font-semibold uppercase">
              <span>TMO Promedio</span>
              <span class="material-symbols-outlined text-primary text-[18px]">timer</span>
            </div>
            <div class="mt-2 flex items-baseline gap-1.5">
              <span class="text-3xl font-bold font-mono text-on-surface">${fmtDurationMMSS(kpis.tmo_segundos)}</span>
              <span class="text-xs text-secondary">min</span>
            </div>
            <div class="text-[11px] text-tertiary mt-2">Meta regulatoria: &lt; 06:00 min (${kpis.total_atenciones_turno} turnos cerrados)</div>
          </div>

          <div class="obsidian-card p-5">
            <div class="flex items-center justify-between text-xs text-secondary font-semibold uppercase">
              <span>FCR (Primer Contacto)</span>
              <span class="material-symbols-outlined text-tertiary text-[18px]">verified</span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="text-3xl font-bold font-mono text-on-surface">${Number(kpis.fcr_pct).toFixed(1)}%</span>
              <span class="text-xs font-semibold ${kpis.total_tickets_periodo === 0 ? 'text-secondary' : 'text-tertiary'}">${kpis.total_tickets_periodo === 0 ? 'Sin datos' : Number(kpis.fcr_pct) >= 90 ? 'Cumple' : 'En mejora'}</span>
            </div>
            <div class="text-[11px] text-secondary mt-2">Osinergmin Compliant • Meta &gt; 90.0%</div>
          </div>

          <div class="obsidian-card p-5">
            <div class="flex items-center justify-between text-xs text-secondary font-semibold uppercase">
              <span>CSAT / Satisfacción</span>
              <span class="material-symbols-outlined text-primary text-[18px]">star</span>
            </div>
            <div class="mt-2 flex items-baseline gap-1.5">
              <span class="text-3xl font-bold font-mono text-on-surface">${Number(kpis.csat_promedio).toFixed(1)}</span>
              <span class="text-xs text-secondary">/ 5.0</span>
            </div>
            <div class="text-[11px] text-secondary mt-2">${kpis.csat_evaluaciones} evaluaciones válidas en Tótem</div>
          </div>

          <div class="obsidian-card p-5 border-error/40">
            <div class="flex items-center justify-between text-xs text-error font-semibold uppercase">
              <span>Riesgo Crítico SLA</span>
              <span class="material-symbols-outlined text-error text-[18px]">emergency_home</span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="text-3xl font-bold font-mono text-error">${String(kpis.criticos_sla).padStart(2, '0')}</span>
              <span class="text-xs text-red-300">casos urgentes</span>
            </div>
            <div class="flex items-center justify-between text-[11px] mt-2">
              <span class="text-secondary">&lt; 2h para límite legal</span>
              <button id="btn-auditar-sla" type="button" class="text-primary font-semibold hover:underline cursor-pointer">Auditar →</button>
            </div>
          </div>
        </div>

        <!-- Middle Grid: Curva + Distribución -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <!-- Curva de Afluencia -->
          <div class="xl:col-span-7 obsidian-card p-5 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 class="text-sm font-bold text-on-surface">Curva de Afluencia de Turnos vs Capacidad</h2>
                <p class="text-[11px] text-secondary">Turnos emitidos por hora vs tiempo promedio de espera (min)</p>
              </div>
              <div class="flex items-center gap-4 text-[11px]">
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-primary"></span>Emitidos</span>
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-tertiary"></span>Espera (m)</span>
              </div>
            </div>

            <div class="obsidian-subcard p-4">
              <svg viewBox="0 0 ${svgW} ${svgH + 22}" class="w-full h-48 overflow-visible">
                ${curvaAfluencia
                  .map((p, idx) => {
                    const barW = 24;
                    const x = Math.round(idx * stepX + stepX / 2 - barW / 2);
                    const barH = Math.max(6, Math.round((p.emitidos / maxEmitidos) * (svgH - 34)));
                    const y = svgH - 16 - barH;
                    return `
                      <g>
                        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${p.emitidos >= maxEmitidos && p.emitidos > 0 ? '#ef4444' : '#7c3aed'}" opacity="0.85"></rect>
                        <text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" fill="#a1a1aa" font-size="10" font-family="monospace">${p.emitidos}</text>
                        <text x="${x + barW / 2}" y="${svgH + 10}" text-anchor="middle" fill="#71717a" font-size="10" font-family="monospace">${escapeHtml(p.hora)}</text>
                      </g>
                    `;
                  })
                  .join('')}
                <polyline fill="none" stroke="#34d399" stroke-width="2.5" points="${linePoints}" />
              </svg>
            </div>

            <div class="obsidian-subcard p-3.5 flex items-center justify-between gap-3 ${alertaCongestion.activa ? 'border-amber-500/40' : 'border-tertiary/40'}">
              <div class="flex items-center gap-2.5 text-xs">
                <span class="material-symbols-outlined ${alertaCongestion.activa ? 'text-amber-400' : 'text-tertiary'} text-[18px]">${alertaCongestion.activa ? 'warning' : 'check_circle'}</span>
                <span class="text-on-surface">${escapeHtml(alertaCongestion.mensaje)}</span>
              </div>
              <button id="btn-ir-turnos-ind" type="button" class="btn-secondary px-3 py-1.5 text-[11px] shrink-0 cursor-pointer">Ver Sala</button>
            </div>
          </div>

          <!-- Distribución de Solicitudes -->
          <div class="xl:col-span-5 obsidian-card p-5 flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h2 class="text-sm font-bold text-on-surface">Distribución de Solicitudes</h2>
                  <p class="text-[11px] text-secondary">Categorización por tipo de reclamo y trámite</p>
                </div>
                <span class="px-2.5 py-1 rounded bg-surface-container-high border border-outline-variant text-xs font-mono text-primary font-bold">${distribucion.totalCasos} Casos</span>
              </div>

              <div class="space-y-4">
                ${distribucion.items
                  .map(
                    (it) => `
                      <div class="space-y-1.5 text-xs">
                        <div class="flex items-center justify-between">
                          <span class="text-on-surface flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full" style="background:${it.color}"></span>
                            <span>${escapeHtml(it.categoria)}</span>
                          </span>
                          <span class="font-mono font-semibold text-on-surface">${it.porcentaje}% <span class="text-secondary">(${it.cantidad})</span></span>
                        </div>
                        <div class="h-2 rounded-full bg-surface-container-high overflow-hidden">
                          <div class="h-full rounded-full transition-all" style="width:${it.porcentaje}%;background:${it.color}"></div>
                        </div>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>

            <div class="obsidian-subcard p-3 flex items-center justify-between text-xs">
              <span class="flex items-center gap-2 text-on-surface-variant">
                <span class="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
                <span>Resolución de primera instancia favorable</span>
              </span>
              <strong class="font-mono text-tertiary">${Number(kpis.fcr_pct).toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        <!-- Rendimiento Comparativo por Módulo / Agente -->
        <div class="obsidian-card p-5 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-on-surface">Rendimiento Comparativo por Módulo / Agente en Turno</h2>
              <p class="text-[11px] text-secondary">Consultado directamente desde vista SQL <span class="font-mono text-primary">vw_rendimiento_operadores</span></p>
            </div>
            <div class="relative">
              <span class="material-symbols-outlined text-[16px] text-secondary absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
              <input id="ind-filter-op" type="text" value="${escapeHtml(filterOp)}" placeholder="Filtrar operador..." class="obsidian-input pl-8 pr-3 py-1.5 text-xs w-56" />
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-[10px] uppercase text-secondary border-b border-outline-variant">
                <tr>
                  <th class="py-2 pr-3">Agente / Módulo</th>
                  <th class="py-2 pr-3">Atenciones Totales</th>
                  <th class="py-2 pr-3">TMO Promedio</th>
                  <th class="py-2 pr-3">Índice Conformidad</th>
                  <th class="py-2">Estado Operativo</th>
                </tr>
              </thead>
              <tbody id="ind-op-tbody" class="divide-y divide-outline-variant/60">
                ${renderOperadoresRows(rendimientoOperadores, filterOp)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.per-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        periodo = btn.getAttribute('data-per');
        loadAndRender();
      });
    });

    document.getElementById('ind-canal').addEventListener('change', (e) => {
      canal = e.target.value;
      loadAndRender();
    });

    document.getElementById('btn-auditar-sla').addEventListener('click', () => {
      ctx.navigate('tickets');
    });

    document.getElementById('btn-ir-turnos-ind').addEventListener('click', () => {
      ctx.navigate('turnos');
    });

    document.getElementById('ind-filter-op').addEventListener('input', (e) => {
      filterOp = e.target.value;
      document.getElementById('ind-op-tbody').innerHTML = renderOperadoresRows(rendimientoOperadores, filterOp);
    });

    document.getElementById('btn-export-csv').addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/indicadores/exportar?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error('Error al generar el archivo CSV.');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte_indicadores_sacs.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        ctx.showToast('Reporte CSV descargado correctamente.');
      } catch (err) {
        ctx.showToast(err.message, 'error');
      }
    });
  }

  function renderOperadoresRows(rows, q) {
    const clean = (q || '').trim().toLowerCase();
    const filtered = clean
      ? rows.filter(
          (r) =>
            r.nombre_completo.toLowerCase().includes(clean) ||
            r.codigo_empleado.toLowerCase().includes(clean) ||
            (r.ventanilla_nombre || '').toLowerCase().includes(clean)
        )
      : rows;

    if (filtered.length === 0) {
      return `<tr><td colspan="5" class="py-6 text-center text-secondary">Sin operadores coincidentes.</td></tr>`;
    }

    return filtered
      .map((op) => {
        const estado = op.ventanilla_estado || 'ACTIVO';
        const estadoCls =
          estado === 'DISPONIBLE'
            ? 'bg-tertiary/15 text-tertiary'
            : estado === 'OCUPADO'
            ? 'bg-primary/20 text-primary'
            : 'bg-surface-container-high text-secondary';
        return `
          <tr class="hover:bg-surface-container-low">
            <td class="py-3 pr-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[11px] font-bold text-primary">${escapeHtml(op.iniciales)}</div>
                <div>
                  <div class="font-semibold text-on-surface">${escapeHtml(op.nombre_completo)} <span class="font-mono text-[10px] text-secondary">(${escapeHtml(op.codigo_empleado)})</span></div>
                  <div class="text-[11px] text-secondary">${escapeHtml(op.ventanilla_nombre || 'Supervisión')} • ${escapeHtml(op.cargo || op.rol)}</div>
                </div>
              </div>
            </td>
            <td class="py-3 pr-3 font-mono text-on-surface">${op.atenciones_totales} turnos <span class="text-secondary">/ ${op.tickets_resueltos} tk</span></td>
            <td class="py-3 pr-3 font-mono ${op.tmo_segundos > 360 ? 'text-error' : 'text-tertiary'}">${fmtDurationMMSS(op.tmo_segundos)} min</td>
            <td class="py-3 pr-3">
              <div class="flex items-center gap-2">
                <div class="w-24 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div class="h-full bg-tertiary rounded-full" style="width:${Math.min(100, op.indice_conformidad_pct)}%"></div>
                </div>
                <span class="font-mono text-on-surface">${Number(op.indice_conformidad_pct).toFixed(1)}%</span>
              </div>
            </td>
            <td class="py-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${estadoCls}">${escapeHtml(estado)}</span></td>
          </tr>
        `;
      })
      .join('');
  }

  await loadAndRender();
}
