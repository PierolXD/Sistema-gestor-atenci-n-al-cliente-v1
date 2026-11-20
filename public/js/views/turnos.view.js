import { apiFetch, escapeHtml, fmtDurationMMSS } from '../api.js';

export async function renderTurnosView(container, ctx, params = {}) {
  let moduloFiltro = params.modulo || '';

  async function loadAndRender() {
    const query = moduloFiltro ? `?modulo=${encodeURIComponent(moduloFiltro)}&sucursal_id=${ctx.sucursal?.id || 1}` : `?sucursal_id=${ctx.sucursal?.id || 1}`;
    const data = await apiFetch(`/api/turnos${query}`);
    const { kpis, cola, turnoActual, miVentanilla, ventanillas } = data;
    const prox = kpis.proximoEnCola;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Top Puesto Banner -->
        <div class="obsidian-card p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="w-2.5 h-2.5 rounded-full ${miVentanilla?.estado === 'OCUPADO' ? 'bg-primary' : miVentanilla?.estado === 'PAUSA' ? 'bg-amber-400' : 'bg-tertiary'}"></span>
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary">Puesto de Atención</span>
              <span class="text-sm font-bold text-on-surface">${escapeHtml(miVentanilla ? `${miVentanilla.nombre} / Ventanilla` : 'Mesa Operativa')}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                miVentanilla?.estado === 'OCUPADO'
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : miVentanilla?.estado === 'PAUSA'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                  : 'bg-tertiary/15 text-tertiary border border-tertiary/40'
              }">${escapeHtml(miVentanilla?.estado || 'DISPONIBLE')}</span>
            </div>
            <div class="text-xs text-on-surface-variant flex items-center gap-2 flex-wrap">
              <span class="text-[11px] uppercase tracking-wider text-secondary">Próximo en cola:</span>
              ${
                prox
                  ? `<span class="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono font-semibold">${escapeHtml(prox.codigo_turno)}</span>
                     <span class="font-medium text-on-surface">${escapeHtml(prox.nombre_visitante)}</span>
                     <span class="text-secondary font-mono">(NIS: ${escapeHtml(prox.nis_visitante || 'Sin NIS')})</span>`
                  : `<span class="text-secondary">Sin clientes en espera</span>`
              }
            </div>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap">
            <button id="btn-llamar-siguiente" type="button" ${!prox || turnoActual ? 'disabled' : ''} class="btn-primary px-4 py-2.5 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed">
              <span class="material-symbols-outlined text-[18px]">campaign</span>
              <span>Llamar Siguiente Turno ${prox ? escapeHtml(prox.codigo_turno) : ''}</span>
            </button>
            <button id="btn-emitir-turno" type="button" class="btn-secondary px-3.5 py-2.5 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[17px]">confirmation_number</span>
              <span>+ Emitir Nuevo Turno</span>
            </button>
            ${
              miVentanilla
                ? `<button id="btn-pausar-box-top" type="button" class="btn-secondary px-3.5 py-2.5 text-xs flex items-center gap-1.5 cursor-pointer">
                     <span class="material-symbols-outlined text-[17px]">${miVentanilla.estado === 'PAUSA' ? 'play_circle' : 'pause_circle'}</span>
                     <span>${miVentanilla.estado === 'PAUSA' ? 'Reanudar Box' : 'Pausar Box'}</span>
                   </button>`
                : ''
            }
          </div>
        </div>

        <!-- 4 KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-secondary font-semibold">T. Espera Promedio</div>
              <div class="mt-1.5 flex items-baseline gap-1.5">
                <span class="text-2xl font-bold font-mono text-tertiary">${fmtDurationMMSS(kpis.espera_promedio_segundos)}</span>
                <span class="text-xs text-secondary">min</span>
              </div>
              <div class="text-[11px] text-tertiary mt-1">Meta sala: &lt; 06:00 min</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined">hourglass_top</span>
            </div>
          </div>

          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-secondary font-semibold">En Cola Presencial</div>
              <div class="mt-1.5 flex items-baseline gap-1.5">
                <span class="text-2xl font-bold font-mono text-on-surface">${kpis.en_cola_count}</span>
                <span class="text-xs text-secondary">personas</span>
              </div>
              <div class="text-[11px] text-tertiary mt-1">Aforo de sala normal (${Math.min(95, kpis.en_cola_count * 7)}%)</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary">
              <span class="material-symbols-outlined">groups</span>
            </div>
          </div>

          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-secondary font-semibold">Atendidos Hoy (Sede)</div>
              <div class="mt-1.5 flex items-baseline gap-1.5">
                <span class="text-2xl font-bold font-mono text-on-surface">${kpis.atendidos_hoy_sede}</span>
                <span class="text-xs text-secondary">turnos</span>
              </div>
              <div class="text-[11px] text-primary mt-1">${kpis.atendidos_hoy_operador} en tu puesto</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-on-surface-variant">
              <span class="material-symbols-outlined">task_alt</span>
            </div>
          </div>

          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-secondary font-semibold">Satisfacción Tótem</div>
              <div class="mt-1.5 flex items-baseline gap-1.5">
                <span class="text-2xl font-bold font-mono text-tertiary">${Number(kpis.satisfaccion_pct).toFixed(1)}%</span>
              </div>
              <div class="text-[11px] text-secondary mt-1">${kpis.opiniones_registradas} opiniones registradas</div>
            </div>
            <div class="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined">sentiment_satisfied</span>
            </div>
          </div>
        </div>

        <!-- Main 7/5 Grid: Cola + Turno en Atención -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <!-- Cola de Espera Activa -->
          <div class="xl:col-span-7 obsidian-card p-5 flex flex-col">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 class="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-[19px]">format_list_numbered</span>
                  <span>Cola de Espera Activa en Sala</span>
                </h2>
                <p class="text-[11px] text-secondary mt-0.5">Organizada según prioridad normativa y tiempo transcurrido</p>
              </div>
              <div class="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant text-[11px]">
                <button data-mod="" class="mod-filter px-2.5 py-1 rounded ${moduloFiltro === '' ? 'bg-primary text-background font-semibold' : 'text-on-surface-variant hover:text-on-surface'} cursor-pointer">
                  Todos (${kpis.conteoPorModulo.todos})
                </button>
                <button data-mod="A" class="mod-filter px-2.5 py-1 rounded ${moduloFiltro === 'A' ? 'bg-primary text-background font-semibold' : 'text-on-surface-variant hover:text-on-surface'} cursor-pointer">
                  A - Gral (${kpis.conteoPorModulo.A})
                </button>
                <button data-mod="B" class="mod-filter px-2.5 py-1 rounded ${moduloFiltro === 'B' ? 'bg-primary text-background font-semibold' : 'text-on-surface-variant hover:text-on-surface'} cursor-pointer">
                  B - Pref (${kpis.conteoPorModulo.B})
                </button>
                <button data-mod="C" class="mod-filter px-2.5 py-1 rounded ${moduloFiltro === 'C' ? 'bg-primary text-background font-semibold' : 'text-on-surface-variant hover:text-on-surface'} cursor-pointer">
                  C - Téc (${kpis.conteoPorModulo.C})
                </button>
              </div>
            </div>

            <div class="space-y-2.5 flex-1">
              ${
                cola.length === 0
                  ? `<div class="py-12 text-center text-xs text-secondary obsidian-subcard">No hay turnos en espera para este filtro.</div>`
                  : cola
                      .map((t, idx) => {
                        const isPref = t.modulo_cola === 'B';
                        const isTec = t.modulo_cola === 'C';
                        const waitWarning = t.espera_segundos >= 300;
                        const badgeColor = isPref
                          ? 'bg-tertiary/20 text-tertiary border-tertiary/40'
                          : isTec
                          ? 'bg-surface-container-high text-on-surface border-outline-variant'
                          : idx === 0
                          ? 'bg-primary text-background border-primary'
                          : 'bg-surface-container-high text-on-surface border-outline-variant';
                        return `
                          <div class="obsidian-subcard p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${idx === 0 ? 'border-l-2 border-l-primary' : isPref ? 'border-l-2 border-l-tertiary' : ''}">
                            <div class="flex items-center gap-3 min-w-0">
                              <div class="w-14 h-12 rounded-lg border flex flex-col items-center justify-center shrink-0 ${badgeColor}">
                                <span class="text-[9px] uppercase font-bold tracking-wider">${isPref ? 'PREF' : isTec ? 'TÉC' : 'TURNO'}</span>
                                <span class="text-sm font-bold font-mono">${escapeHtml(t.codigo_turno)}</span>
                              </div>
                              <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                  <span class="text-xs font-bold text-on-surface truncate">${escapeHtml(t.nombre_visitante)}</span>
                                  <span class="text-[11px] font-mono text-secondary">DNI: ${escapeHtml(t.dni_visitante)}</span>
                                  ${t.nis_visitante ? `<span class="text-[11px] font-mono text-primary">NIS: ${escapeHtml(t.nis_visitante)}</span>` : ''}
                                </div>
                                <div class="flex items-center gap-2 text-[11px] text-on-surface-variant mt-1 flex-wrap">
                                  <span class="truncate">${escapeHtml(t.motivo_visita)}</span>
                                  <span>•</span>
                                  <span class="font-mono ${waitWarning ? 'text-error font-semibold' : 'text-tertiary'}" data-live-seconds="${t.espera_segundos}" data-live-format="espera">
                                    ${fmtDurationMMSS(t.espera_segundos)}m espera
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                              <button data-atender="${t.id}" type="button" ${turnoActual ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg text-xs font-semibold ${idx === 0 && !turnoActual ? 'bg-primary text-background' : 'bg-surface-container-high text-on-surface border border-outline-variant hover:border-primary'} cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
                                <span class="material-symbols-outlined text-[15px]">call</span>
                                <span>Atender</span>
                              </button>
                              <button data-derivar="${t.id}" data-codigo="${escapeHtml(t.codigo_turno)}" type="button" title="Derivar a otro módulo" class="p-1.5 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-on-surface cursor-pointer">
                                <span class="material-symbols-outlined text-[16px]">swap_horiz</span>
                              </button>
                              <button data-ausente="${t.id}" data-codigo="${escapeHtml(t.codigo_turno)}" type="button" title="Marcar ausente" class="p-1.5 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-error cursor-pointer">
                                <span class="material-symbols-outlined text-[16px]">person_off</span>
                              </button>
                            </div>
                          </div>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>

          <!-- Turno en Atención Actual -->
          <div class="xl:col-span-5 obsidian-card p-5 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-tertiary text-[19px]">person_check</span>
                  <span>Turno en Atención Actual</span>
                </h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  turnoActual
                    ? 'bg-tertiary/15 text-tertiary border border-tertiary/40'
                    : 'bg-surface-container-high text-secondary border border-outline-variant'
                }">${turnoActual ? 'EN VENTANILLA' : 'SIN TURNO ACTIVO'}</span>
              </div>

              ${
                turnoActual
                  ? `
                    <div class="obsidian-subcard p-4 space-y-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <div class="text-[10px] uppercase tracking-wider text-secondary">Ticket Asignado</div>
                          <div class="text-2xl font-bold font-mono text-primary mt-0.5">${escapeHtml(turnoActual.codigo_turno)}</div>
                          <div class="text-sm font-bold text-on-surface mt-1">${escapeHtml(turnoActual.nombre_visitante)}</div>
                        </div>
                        <div class="text-right text-[11px] font-mono">
                          <div class="text-secondary uppercase text-[10px]">Identificación</div>
                          <div class="text-on-surface mt-0.5">DNI: ${escapeHtml(turnoActual.dni_visitante)}</div>
                          <div class="text-primary">Suministro: ${escapeHtml(turnoActual.nis_visitante || 'Por validar')}</div>
                        </div>
                      </div>

                      <div class="flex items-center justify-between pt-3 border-t border-outline-variant">
                        <div>
                          <div class="text-[10px] uppercase tracking-wider text-secondary">Cronómetro de Box</div>
                          <div class="text-xl font-bold font-mono text-tertiary mt-0.5" data-live-seconds="${turnoActual.transcurrido_segundos}" data-live-format="mmss">
                            ${fmtDurationMMSS(turnoActual.transcurrido_segundos)}
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="text-[10px] uppercase tracking-wider text-secondary">Meta SLA</div>
                          <div class="text-xs font-medium text-on-surface mt-0.5">06:00 min</div>
                        </div>
                      </div>

                      <div class="pt-3 border-t border-outline-variant">
                        <div class="text-[10px] uppercase tracking-wider text-secondary mb-1">Motivo de Visita Declarado</div>
                        <p class="text-xs text-on-surface bg-surface-container p-2.5 rounded border border-outline-variant">"${escapeHtml(turnoActual.motivo_visita)}"</p>
                      </div>

                      <div>
                        <div class="text-[10px] uppercase tracking-wider text-secondary mb-2">Acciones Directas de Ventanilla</div>
                        <div class="grid grid-cols-2 gap-2">
                          <button id="act-ficha-360" type="button" class="btn-secondary p-2.5 text-xs flex items-center gap-2 cursor-pointer">
                            <span class="material-symbols-outlined text-[16px] text-primary">contact_page</span>
                            <span>Ficha 360° Suministro</span>
                          </button>
                          <button id="act-boleta" type="button" class="btn-secondary p-2.5 text-xs flex items-center gap-2 cursor-pointer">
                            <span class="material-symbols-outlined text-[16px] text-tertiary">receipt</span>
                            <span>Emitir Duplicado / Pago</span>
                          </button>
                          <button id="act-crear-ticket" type="button" class="btn-secondary p-2.5 text-xs flex items-center gap-2 cursor-pointer">
                            <span class="material-symbols-outlined text-[16px] text-amber-400">report_problem</span>
                            <span>Crear Ticket Reclamo</span>
                          </button>
                          <button id="act-derivar-actual" type="button" class="btn-secondary p-2.5 text-xs flex items-center gap-2 cursor-pointer">
                            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">swap_horiz</span>
                            <span>Derivar a Módulo</span>
                          </button>
                        </div>
                      </div>

                      <!-- Bitácora en vivo mientras atiende -->
                      <div class="pt-3 border-t border-outline-variant space-y-2">
                        <div class="text-[10px] uppercase tracking-wider text-secondary">Bitácora de Atención (En vivo)</div>
                        <div class="max-h-24 overflow-y-auto text-[11px] font-mono bg-background p-2.5 rounded border border-outline-variant text-on-surface-variant whitespace-pre-wrap">${escapeHtml(turnoActual.notas_atencion || 'Sin notas registradas aún.')}</div>
                        <form id="form-nota-turno" class="flex gap-2">
                          <input id="input-nota-turno" type="text" placeholder="Registrar nota mientras atiende al cliente..." class="flex-1 obsidian-input px-3 py-1.5 text-xs" required />
                          <button type="submit" class="btn-secondary px-3 py-1.5 text-xs font-medium cursor-pointer">Guardar Nota</button>
                        </form>
                      </div>
                    </div>
                  `
                  : `
                    <div class="obsidian-subcard p-8 text-center space-y-3 my-4">
                      <span class="material-symbols-outlined text-[36px] text-secondary">support_agent</span>
                      <div class="text-xs font-semibold text-on-surface">Ventanilla disponible para atención</div>
                      <p class="text-[11px] text-secondary">Presione "Llamar Siguiente Turno" o seleccione un cliente de la cola para iniciar el cronómetro y registrar su atención.</p>
                    </div>
                  `
              }
            </div>

            ${
              turnoActual
                ? `<button id="btn-finalizar-turno" type="button" class="mt-4 w-full btn-emerald py-3 px-4 text-xs flex items-center justify-center gap-2 cursor-pointer">
                     <span class="material-symbols-outlined text-[18px]">check_circle</span>
                     <span>Finalizar Turno y Liberar Ventanilla</span>
                   </button>`
                : ''
            }
          </div>
        </div>

        <!-- Bottom Row: Estado de Módulos y Ventanillas -->
        <div class="obsidian-card p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 class="text-sm font-bold text-on-surface">Estado de Módulos y Ventanillas de la Sede</h3>
              <p class="text-[11px] text-secondary">Monitoreo simultáneo en tiempo real (${escapeHtml(ctx.sucursal?.nombre || 'Sede Matriz')})</p>
            </div>
            <div class="flex items-center gap-4 text-[11px] text-on-surface-variant">
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-tertiary"></span>Disponible</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-primary"></span>En Atención</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-secondary"></span>En Pausa</span>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            ${ventanillas
              .map((v) => {
                const isMine = miVentanilla && v.id === miVentanilla.id;
                const badgeCls =
                  v.estado === 'OCUPADO'
                    ? 'bg-primary/20 text-primary'
                    : v.estado === 'PAUSA'
                    ? 'bg-surface-container-high text-secondary'
                    : 'bg-tertiary/20 text-tertiary';
                return `
                  <div class="obsidian-subcard p-3.5 ${isMine ? 'border-primary/60' : ''}">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        ${escapeHtml(v.nombre)}
                        ${isMine ? '<span class="px-1.5 py-0.2 rounded bg-primary/20 text-primary text-[9px] uppercase">TÚ</span>' : ''}
                      </span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${badgeCls}">${escapeHtml(v.estado)}</span>
                    </div>
                    <div class="text-xs font-medium text-on-surface">${escapeHtml(v.operador_nombre || 'Sin asignar')}</div>
                    <div class="flex items-center justify-between text-[11px] text-secondary mt-2">
                      <span>${v.turno_actual_codigo ? `Ticket: <strong class="font-mono text-on-surface">${escapeHtml(v.turno_actual_codigo)}</strong>` : escapeHtml(v.tipo_modulo)}</span>
                      <span class="font-mono">${fmtDurationMMSS(v.segundos_en_estado)}m</span>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;

    // Listeners
    container.querySelectorAll('.mod-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        moduloFiltro = btn.getAttribute('data-mod') || '';
        loadAndRender();
      });
    });

    const btnLlamar = document.getElementById('btn-llamar-siguiente');
    if (btnLlamar) {
      btnLlamar.addEventListener('click', async () => {
        try {
          const llamado = await apiFetch('/api/turnos/llamar-siguiente', { method: 'POST' });
          ctx.showToast(`Llamando turno ${llamado.codigo_turno} (${llamado.nombre_visitante}).`);
          await ctx.refreshHeaderAndBadges();
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });
    }

    const btnPausarTop = document.getElementById('btn-pausar-box-top');
    if (btnPausarTop && miVentanilla) {
      btnPausarTop.addEventListener('click', async () => {
        const nextEstado = miVentanilla.estado === 'PAUSA' ? 'DISPONIBLE' : 'PAUSA';
        try {
          await apiFetch(`/api/usuarios/ventanillas/${miVentanilla.id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: nextEstado })
          });
          ctx.showToast(`Ventanilla ${miVentanilla.nombre} -> ${nextEstado}.`);
          await ctx.refreshHeaderAndBadges();
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });
    }

    document.getElementById('btn-emitir-turno').addEventListener('click', () => {
      ctx.showModal(
        'Emitir Nuevo Turno en Sala / Tótem',
        `
          <form id="modal-emitir-form" class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-on-surface-variant mb-1">DNI / RUC (Obligatorio)</label>
                <input name="dni_visitante" required placeholder="Ej: 29584712" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-on-surface-variant mb-1">N° Suministro (NIS - Opcional)</label>
                <input name="nis_visitante" placeholder="Ej: 2049182" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
            </div>
            <div>
              <label class="block text-on-surface-variant mb-1">Nombre Completo / Razón Social</label>
              <input name="nombre_visitante" required placeholder="Ej: Guillermo Paredes Arce" class="w-full obsidian-input px-3 py-2" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-on-surface-variant mb-1">Módulo de Cola</label>
                <select name="modulo_cola" class="w-full obsidian-input px-3 py-2">
                  <option value="A">A - General</option>
                  <option value="B">B - Preferencial (Adulto Mayor)</option>
                  <option value="C">C - Trámite Técnico</option>
                </select>
              </div>
              <div>
                <label class="block text-on-surface-variant mb-1">Canal de Emisión</label>
                <select name="canal_emision" class="w-full obsidian-input px-3 py-2">
                  <option value="SALA">Ventanilla / Recepción</option>
                  <option value="TOTEM">Tótem Autoservicio</option>
                  <option value="CITA_WEB">Cita Web</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-on-surface-variant mb-1">Motivo de Contacto (Top 5 SEAL)</label>
              <select name="motivo_visita" class="w-full obsidian-input px-3 py-2">
                <option value="Nuevo suministro / cambio de titular">#1 Nuevo suministro / cambio de titular</option>
                <option value="Consulta de deuda / recibo">#2 Consulta de deuda / recibo</option>
                <option value="Corte de luz / emergencia (Interrupciones)">#3 Corte de luz / emergencia</option>
                <option value="Cortes y reconexiones">#4 Cortes y reconexiones</option>
                <option value="Reclamo por consumo elevado">#5 Reclamo por consumo elevado</option>
              </select>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button type="button" id="cancel-emitir" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
              <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Emitir Ticket</button>
            </div>
          </form>
        `,
        (body) => {
          body.querySelector('#cancel-emitir').addEventListener('click', ctx.closeModal);
          body.querySelector('#modal-emitir-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
              const creado = await apiFetch('/api/turnos', {
                method: 'POST',
                body: JSON.stringify(Object.fromEntries(fd.entries()))
              });
              ctx.closeModal();
              ctx.showToast(`Turno ${creado.codigo_turno} emitido a cola.`);
              await ctx.refreshHeaderAndBadges();
              await loadAndRender();
            } catch (err) {
              ctx.showToast(err.message, 'error');
            }
          });
        }
      );
    });

    container.querySelectorAll('[data-atender]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-atender');
        try {
          const t = await apiFetch(`/api/turnos/${id}/atender`, { method: 'PATCH' });
          ctx.showToast(`Atendiendo turno ${t.codigo_turno}.`);
          await ctx.refreshHeaderAndBadges();
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-derivar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openDerivarModal(btn.getAttribute('data-derivar'), btn.getAttribute('data-codigo'));
      });
    });

    container.querySelectorAll('[data-ausente]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-ausente');
        const cod = btn.getAttribute('data-codigo');
        try {
          await apiFetch(`/api/turnos/${id}/ausente`, { method: 'PATCH' });
          ctx.showToast(`Turno ${cod} marcado como ausente.`, 'info');
          await ctx.refreshHeaderAndBadges();
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });
    });

    if (turnoActual) {
      document.getElementById('act-ficha-360').addEventListener('click', () => {
        ctx.navigate('clientes', { q: turnoActual.nis_visitante || turnoActual.dni_visitante });
      });
      document.getElementById('act-boleta').addEventListener('click', () => {
        ctx.navigate('comprobantes', { q: turnoActual.nis_visitante || turnoActual.dni_visitante });
      });
      document.getElementById('act-crear-ticket').addEventListener('click', () => {
        ctx.navigate('tickets', {
          openCreateModal: true,
          nis_o_dni: turnoActual.nis_visitante || turnoActual.dni_visitante,
          turno_id: turnoActual.id,
          asunto: turnoActual.motivo_visita
        });
      });
      document.getElementById('act-derivar-actual').addEventListener('click', () => {
        openDerivarModal(turnoActual.id, turnoActual.codigo_turno);
      });

      document.getElementById('form-nota-turno').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('input-nota-turno');
        try {
          await apiFetch(`/api/turnos/${turnoActual.id}/notas`, {
            method: 'POST',
            body: JSON.stringify({ nota: input.value.trim() })
          });
          ctx.showToast('Nota registrada en la bitácora del turno.');
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      document.getElementById('btn-finalizar-turno').addEventListener('click', () => {
        ctx.showModal(
          `Finalizar Atención — Turno ${turnoActual.codigo_turno}`,
          `
            <form id="modal-finalizar-form" class="space-y-4 text-xs">
              <div class="obsidian-subcard p-3">
                <div class="text-on-surface font-semibold">${escapeHtml(turnoActual.nombre_visitante)}</div>
                <div class="text-secondary mt-0.5">DNI: ${escapeHtml(turnoActual.dni_visitante)} ${turnoActual.nis_visitante ? `• NIS: ${escapeHtml(turnoActual.nis_visitante)}` : ''}</div>
              </div>
              <div>
                <label class="block text-on-surface-variant mb-1">Resumen de Resolución en Ventanilla</label>
                <textarea name="resolucion_resumen" rows="3" required class="w-full obsidian-input p-2.5" placeholder="Describa la atención brindada al cliente..."></textarea>
              </div>
              <div>
                <label class="block text-on-surface-variant mb-1">Encuesta Rápida CSAT (Tótem / Cliente)</label>
                <select name="calificacion_csat" class="w-full obsidian-input px-3 py-2">
                  <option value="5">★★★★★ (5 - Muy Satisfecho)</option>
                  <option value="4">★★★★☆ (4 - Satisfecho)</option>
                  <option value="3">★★★☆☆ (3 - Regular)</option>
                  <option value="2">★★☆☆☆ (2 - Insatisfecho)</option>
                  <option value="1">★☆☆☆☆ (1 - Crítico)</option>
                </select>
              </div>
              <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button type="button" id="cancel-fin" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
                <button type="submit" class="btn-emerald px-4 py-2 cursor-pointer">Finalizar y Liberar Box</button>
              </div>
            </form>
          `,
          (body) => {
            body.querySelector('#cancel-fin').addEventListener('click', ctx.closeModal);
            body.querySelector('#modal-finalizar-form').addEventListener('submit', async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await apiFetch(`/api/turnos/${turnoActual.id}/finalizar`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    resolucion_resumen: fd.get('resolucion_resumen'),
                    calificacion_csat: Number(fd.get('calificacion_csat'))
                  })
                });
                ctx.closeModal();
                ctx.showToast(`Turno ${turnoActual.codigo_turno} finalizado. Ventanilla liberada.`);
                await ctx.refreshHeaderAndBadges();
                await loadAndRender();
              } catch (err) {
                ctx.showToast(err.message, 'error');
              }
            });
          }
        );
      });
    }
  }

  function openDerivarModal(turnoId, codigo) {
    ctx.showModal(
      `Derivar Turno ${codigo}`,
      `
        <form id="modal-derivar-form" class="space-y-3 text-xs">
          <div>
            <label class="block text-on-surface-variant mb-1">Módulo Destino</label>
            <select name="modulo_cola" class="w-full obsidian-input px-3 py-2">
              <option value="A">Módulo A - General</option>
              <option value="B">Módulo B - Preferencial</option>
              <option value="C">Módulo C - Técnico / Complejos</option>
            </select>
          </div>
          <div>
            <label class="block text-on-surface-variant mb-1">Motivo de Derivación</label>
            <input name="motivo_derivacion" placeholder="Ej: Requiere evaluación técnica trifásica" class="w-full obsidian-input px-3 py-2" />
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
            <button type="button" id="cancel-der" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
            <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Confirmar Derivación</button>
          </div>
        </form>
      `,
      (body) => {
        body.querySelector('#cancel-der').addEventListener('click', ctx.closeModal);
        body.querySelector('#modal-derivar-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await apiFetch(`/api/turnos/${turnoId}/derivar`, {
              method: 'PATCH',
              body: JSON.stringify(Object.fromEntries(fd.entries()))
            });
            ctx.closeModal();
            ctx.showToast(`Turno ${codigo} derivado correctamente.`);
            await ctx.refreshHeaderAndBadges();
            await loadAndRender();
          } catch (err) {
            ctx.showToast(err.message, 'error');
          }
        });
      }
    );
  }

  await loadAndRender();
}
