import { apiFetch, escapeHtml, fmtDateTime, fmtDurationMMSS, fmtSlaRestante, fmtTime } from '../api.js';
import { printHojaReclamacion } from '../print.js';

export async function renderTicketsView(container, ctx, params = {}) {
  let canalFiltro = '';
  let prioridadFiltro = '';
  let searchQ = '';
  let selectedId = params.ticketId || null;

  async function loadAndRender() {
    const qs = new URLSearchParams();
    if (canalFiltro) qs.set('canal', canalFiltro);
    if (prioridadFiltro) qs.set('prioridad', prioridadFiltro);
    if (searchQ) qs.set('q', searchQ);

    const [listData, cuadrillas] = await Promise.all([
      apiFetch(`/api/tickets?${qs.toString()}`),
      apiFetch('/api/ordenes-trabajo/cuadrillas')
    ]);

    const { kpis, items } = listData;
    if (!selectedId || !items.some((i) => i.id === Number(selectedId))) {
      selectedId = items[0]?.id ?? null;
    }
    const detail = selectedId ? await apiFetch(`/api/tickets/${selectedId}`) : null;

    const faseIndex = !detail
      ? 1
      : detail.estado === 'REGISTRADO'
      ? 1
      : detail.estado === 'EN_ATENCION' || detail.estado === 'ESCALADO_RECLAMO'
      ? 2
      : detail.estado === 'EN_CUADRILLA'
      ? 3
      : 4;

    container.innerHTML = `
      <div class="space-y-5">
        <!-- Header & 4 KPIs -->
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-primary">Ventanilla &amp; Mesa de Ayuda</div>
            <h1 class="text-2xl font-bold tracking-tight text-on-surface mt-0.5">Bandeja de Atención y Gestión de Tickets</h1>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="obsidian-card px-4 py-3">
              <div class="text-[10px] uppercase text-secondary font-semibold">En Cola</div>
              <div class="text-xl font-bold font-mono text-on-surface mt-0.5">${kpis.en_cola} <span class="text-[11px] font-sans text-primary font-normal">activos</span></div>
            </div>
            <div class="obsidian-card px-4 py-3">
              <div class="text-[10px] uppercase text-error font-semibold">● Críticos SLA</div>
              <div class="text-xl font-bold font-mono text-error mt-0.5">${kpis.criticos_sla} <span class="text-[11px] font-sans text-secondary font-normal">&lt;2h rest.</span></div>
            </div>
            <div class="obsidian-card px-4 py-3">
              <div class="text-[10px] uppercase text-secondary font-semibold">Resueltos Hoy</div>
              <div class="text-xl font-bold font-mono text-tertiary mt-0.5">${kpis.resueltos_hoy} <span class="text-[11px] font-sans text-tertiary font-normal">${kpis.efectividad_pct}%</span></div>
            </div>
            <div class="obsidian-card px-4 py-3">
              <div class="text-[10px] uppercase text-secondary font-semibold">TMO Promedio</div>
              <div class="text-xl font-bold font-mono text-on-surface mt-0.5">${fmtDurationMMSS(kpis.tmo_segundos)}</div>
            </div>
          </div>
        </div>

        <!-- Filter Toolbar -->
        <div class="obsidian-card p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 flex-wrap text-xs">
            ${[
              ['', `Todos (${kpis.total_todos})`],
              ['PRESENCIAL', `Presencial (${kpis.total_presencial})`],
              ['WHATSAPP', `WhatsApp (${kpis.total_whatsapp})`],
              ['PORTAL_WEB', `Portal Web (${kpis.total_portal})`],
              ['CALL_CENTER', `Call Center (${kpis.total_call_center})`]
            ]
              .map(
                ([val, label]) => `
                  <button data-canal="${val}" class="canal-tab px-3 py-1.5 rounded-lg ${
                    canalFiltro === val ? 'bg-primary-container text-white font-semibold' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant'
                  } cursor-pointer">${label}</button>
                `
              )
              .join('')}
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative">
              <span class="material-symbols-outlined text-[16px] text-secondary absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
              <input id="ticket-search" type="text" value="${escapeHtml(searchQ)}" placeholder="Buscar ticket, NIS o DNI..." class="obsidian-input pl-8 pr-3 py-1.5 text-xs w-52 font-mono" />
            </div>
            <div class="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant text-[11px]">
              ${['', 'URGENTE', 'ALTA', 'NORMAL']
                .map(
                  (p) => `
                    <button data-prio="${p}" class="prio-tab px-2 py-1 rounded ${
                      prioridadFiltro === p ? 'bg-surface-container-highest text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'
                    } cursor-pointer">${p || 'Todas'}</button>
                  `
                )
                .join('')}
            </div>
            <button id="btn-nuevo-ticket" type="button" class="btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">add_task</span>
              <span>Nuevo Ticket</span>
            </button>
          </div>
        </div>

        <!-- Split Workspace: Left List + Right Detail -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <!-- Left List -->
          <div class="xl:col-span-5 space-y-2.5">
            <div class="flex items-center justify-between text-xs px-1">
              <span class="font-semibold uppercase tracking-wider text-secondary">Bandeja Activa <span class="ml-1 px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-mono">${items.length} Casos</span></span>
              <span class="text-[11px] text-secondary">Orden: SLA Urgente</span>
            </div>
            <div class="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              ${
                items.length === 0
                  ? `<div class="obsidian-card p-8 text-center text-xs text-secondary">No se encontraron tickets con esos filtros.</div>`
                  : items
                      .map((tk) => {
                        const active = detail && tk.id === detail.id;
                        const isCrit = tk.sla_restante_segundos <= 7200 && !['RESUELTO', 'CERRADO'].includes(tk.estado);
                        return `
                          <button data-select-tk="${tk.id}" type="button" class="w-full text-left obsidian-card p-4 transition-colors cursor-pointer ${
                            active ? 'border-primary bg-surface-container-high' : 'hover:border-outline'
                          }">
                            <div class="flex items-center justify-between gap-2 mb-1.5">
                              <div class="flex items-center gap-2">
                                <span class="text-xs font-bold font-mono text-primary">${escapeHtml(tk.codigo)}</span>
                                <span class="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant text-[10px] text-tertiary">${escapeHtml(tk.canal)}</span>
                              </div>
                              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                ['RESUELTO', 'CERRADO'].includes(tk.estado)
                                  ? 'bg-tertiary/15 text-tertiary'
                                  : isCrit
                                  ? 'bg-error/15 text-red-300 border border-error/40'
                                  : 'bg-surface-container-low text-on-surface-variant'
                              }">${['RESUELTO', 'CERRADO'].includes(tk.estado) ? tk.estado : fmtSlaRestante(tk.sla_restante_segundos)}</span>
                            </div>
                            <div class="text-xs font-bold text-on-surface">${escapeHtml(tk.cliente_nombre)}</div>
                            <p class="text-[11px] text-on-surface-variant mt-1 line-clamp-2">${escapeHtml(tk.asunto)}</p>
                            <div class="flex items-center justify-between text-[11px] mt-2.5 pt-2 border-t border-outline-variant/60">
                              <span class="font-mono text-secondary">NIS: <strong class="text-on-surface">${escapeHtml(tk.nis)}</strong></span>
                              <span class="text-primary font-medium">${escapeHtml(tk.estado)}</span>
                            </div>
                          </button>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>

          <!-- Right Detail & Resolution Form -->
          <div class="xl:col-span-7">
            ${
              !detail
                ? `<div class="obsidian-card p-12 text-center text-xs text-secondary">Seleccione un ticket de la bandeja para gestionar su expediente.</div>`
                : `
                  <div class="obsidian-card p-5 space-y-5">
                    <!-- Ticket Header -->
                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div class="flex items-start gap-3">
                        <div class="px-2.5 py-2 rounded-lg bg-primary text-background font-mono font-bold text-xs text-center leading-tight">
                          ${escapeHtml(detail.codigo)}
                        </div>
                        <div>
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-[11px] text-secondary">Creado: ${fmtDateTime(detail.creado_en)}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              detail.prioridad === 'URGENTE' ? 'bg-error/20 text-red-300 border border-error/40' : 'bg-primary/20 text-primary'
                            }">Prioridad ${escapeHtml(detail.prioridad)}</span>
                            ${detail.conflicto_marcado ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">CONFLICTO</span>` : ''}
                          </div>
                          <h2 class="text-lg font-bold text-on-surface mt-1">${escapeHtml(detail.cliente_nombre)}</h2>
                          <div class="text-xs text-on-surface-variant">${escapeHtml(detail.asunto)}</div>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <button id="btn-print-comprobante" type="button" class="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer">
                          <span class="material-symbols-outlined text-[15px]">print</span>
                          <span>Comprobante</span>
                        </button>
                        <button id="btn-print-hoja" type="button" class="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer">
                          <span class="material-symbols-outlined text-[15px]">picture_as_pdf</span>
                          <span>Hoja Reclamación</span>
                        </button>
                      </div>
                    </div>

                    <!-- Suministro Bar -->
                    <div class="obsidian-subcard p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <div class="text-[10px] uppercase text-secondary">NIS Suministro</div>
                        <button id="link-nis-360" type="button" class="font-mono font-bold text-primary hover:underline mt-0.5 cursor-pointer">${escapeHtml(detail.nis)}</button>
                      </div>
                      <div>
                        <div class="text-[10px] uppercase text-secondary">Medidor / Tarifa</div>
                        <div class="font-mono text-on-surface mt-0.5">${escapeHtml(detail.numero_medidor)} / ${escapeHtml(detail.tarifa)}</div>
                      </div>
                      <div>
                        <div class="text-[10px] uppercase text-secondary">Dirección &amp; Subestación</div>
                        <div class="text-on-surface mt-0.5 truncate">${escapeHtml(detail.direccion)} • ${escapeHtml(detail.subestacion_sed || 'N/A')}</div>
                      </div>
                    </div>

                    <!-- 4-Step Progress -->
                    <div>
                      <div class="flex items-center justify-between text-xs mb-2">
                        <span class="text-[10px] uppercase tracking-wider font-semibold text-secondary">Progreso de Resolución</span>
                        <span class="text-primary font-semibold">Fase ${faseIndex} de 4: ${escapeHtml(detail.estado)}</span>
                      </div>
                      <div class="grid grid-cols-4 gap-2">
                        ${['1. Registrado', '2. En Atención', '3. Cuadrilla / ODT', '4. Resuelto']
                          .map((step, i) => {
                            const done = i + 1 <= faseIndex;
                            return `
                              <div>
                                <div class="h-1.5 rounded-full ${done ? (i + 1 === faseIndex ? 'bg-primary' : 'bg-tertiary') : 'bg-surface-container-high'} mb-1"></div>
                                <div class="text-[11px] ${done ? 'text-on-surface font-medium' : 'text-secondary'}">${step}</div>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                    </div>

                    ${
                      detail.ot_vinculada
                        ? `<div class="obsidian-subcard p-3 border-tertiary/40 flex items-center justify-between text-xs">
                             <div class="flex items-center gap-2">
                               <span class="material-symbols-outlined text-tertiary text-[18px]">engineering</span>
                               <span>Orden de Trabajo vinculada: <strong class="font-mono text-tertiary">${escapeHtml(detail.ot_vinculada.codigo)}</strong> (${escapeHtml(detail.ot_vinculada.etapa)})</span>
                             </div>
                             <button id="btn-ver-ot" type="button" class="text-primary font-semibold hover:underline cursor-pointer">Ver en Despacho →</button>
                           </div>`
                        : ''
                    }

                    <!-- Transcripción & Bitácora -->
                    <div class="obsidian-subcard p-4 space-y-3">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span class="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
                          <span>Transcripción &amp; Bitácora del Expediente</span>
                        </span>
                        <span class="text-[11px] text-tertiary">${(detail.mensajes || []).length} registros</span>
                      </div>
                      <div class="space-y-2 max-h-44 overflow-y-auto pr-1 text-xs font-mono">
                        ${(detail.mensajes || [])
                          .map((m) => {
                            const tagColor =
                              m.autor_tipo === 'SCADA'
                                ? 'text-error'
                                : m.autor_tipo === 'BOT'
                                ? 'text-tertiary'
                                : m.autor_tipo === 'AGENTE'
                                ? 'text-primary'
                                : 'text-on-surface';
                            return `
                              <div class="leading-relaxed">
                                <span class="text-secondary">${fmtTime(m.creado_en)}</span>
                                <span class="font-bold ${tagColor}">[${escapeHtml(m.autor_tipo)} - ${escapeHtml(m.autor_nombre)}]:</span>
                                <span class="text-on-surface-variant">${escapeHtml(m.mensaje)}</span>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                      <form id="form-msg-ticket" class="flex gap-2 pt-2 border-t border-outline-variant">
                        <input id="input-msg-ticket" required type="text" placeholder="Agregar nota o comunicación al expediente..." class="flex-1 obsidian-input px-3 py-1.5 text-xs" />
                        <button type="submit" class="btn-secondary px-3 py-1.5 text-xs cursor-pointer">Añadir Nota</button>
                      </form>
                    </div>

                    <!-- Resolución y Tipificación Operativa -->
                    <form id="form-resolver-ticket" class="obsidian-subcard p-4 space-y-3.5">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span class="material-symbols-outlined text-[16px] text-primary">gavel</span>
                          <span>Resolución y Tipificación Operativa</span>
                        </span>
                        <span class="text-[11px] text-secondary">Osinergmin / Normativa NTCSE</span>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label class="block text-[11px] text-secondary mb-1">Tipificación Normativa</label>
                          <select name="tipificacion_normativa" class="w-full obsidian-input px-2.5 py-2 text-xs">
                            ${[
                              'REC-ELEC-04: Falla Media Tensión',
                              'REC-VOLT-02: Variación no tolerable',
                              'REC-COM-01: Inconformidad Medición',
                              'REC-COM-02: Reconexión / Cortes',
                              'REC-SEG-09: Riesgo Eléctrico Vía Pública',
                              'REC-TEC-01: Nuevo Suministro'
                            ]
                              .map(
                                (op) =>
                                  `<option value="${op}" ${detail.tipificacion_normativa === op ? 'selected' : ''}>${op}</option>`
                              )
                              .join('')}
                          </select>
                        </div>

                        <div>
                          <label class="block text-[11px] text-secondary mb-1">Acción Inmediata</label>
                          <select name="accion_inmediata" class="w-full obsidian-input px-2.5 py-2 text-xs">
                            <option value="DESPACHAR_CUADRILLA" ${detail.accion_inmediata === 'DESPACHAR_CUADRILLA' ? 'selected' : ''}>Despachar Cuadrilla (Generar OT)</option>
                            <option value="ESCALAR_RECLAMO" ${detail.accion_inmediata === 'ESCALAR_RECLAMO' ? 'selected' : ''}>Escalar a Reclamo Formal (15 días)</option>
                            <option value="ATENCION_INFORMATIVA" ${detail.accion_inmediata === 'ATENCION_INFORMATIVA' ? 'selected' : ''}>Atención Informativa Directa</option>
                            <option value="DERIVAR_LABORATORIO" ${detail.accion_inmediata === 'DERIVAR_LABORATORIO' ? 'selected' : ''}>Derivar a Laboratorio Medición</option>
                          </select>
                        </div>

                        <div>
                          <label class="block text-[11px] text-secondary mb-1">Cuadrilla Asignada</label>
                          <select name="cuadrilla_id" class="w-full obsidian-input px-2.5 py-2 text-xs">
                            <option value="">Auto-asignar en Despacho</option>
                            ${cuadrillas
                              .map((c) => `<option value="${c.id}">${escapeHtml(c.codigo)} (${escapeHtml(c.nombre)})</option>`)
                              .join('')}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label class="block text-[11px] text-secondary mb-1">Dictamen / Nota del Agente para Notificación al Cliente</label>
                        <textarea name="dictamen_tecnico" rows="2" required class="w-full obsidian-input p-2.5 text-xs" placeholder="Escriba el dictamen técnico que se notificará y constará en el expediente...">${escapeHtml(detail.dictamen_tecnico || '')}</textarea>
                      </div>

                      <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div class="flex items-center gap-2">
                          <button id="btn-conflicto" type="button" class="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
                            <span class="material-symbols-outlined text-[15px]">flag</span>
                            <span>${detail.conflicto_marcado ? 'Quitar Conflicto' : 'Marcar Conflicto'}</span>
                          </button>
                        </div>
                        <div class="flex items-center gap-2">
                          <button id="btn-guardar-borrador" type="button" class="btn-secondary px-3.5 py-2 text-xs cursor-pointer">Guardar Borrador</button>
                          <button type="submit" class="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
                            <span class="material-symbols-outlined text-[16px]">send_and_archive</span>
                            <span>Ejecutar Acción / Notificar</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                `
            }
          </div>
        </div>
      </div>
    `;

    // Wire events
    container.querySelectorAll('.canal-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        canalFiltro = btn.getAttribute('data-canal') || '';
        loadAndRender();
      });
    });

    container.querySelectorAll('.prio-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        prioridadFiltro = btn.getAttribute('data-prio') || '';
        loadAndRender();
      });
    });

    const searchInput = document.getElementById('ticket-search');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchQ = searchInput.value.trim();
        loadAndRender();
      }
    });

    container.querySelectorAll('[data-select-tk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedId = Number(btn.getAttribute('data-select-tk'));
        loadAndRender();
      });
    });

    document.getElementById('btn-nuevo-ticket').addEventListener('click', () => openCrearTicketModal());

    if (detail) {
      document.getElementById('link-nis-360').addEventListener('click', () => {
        ctx.navigate('clientes', { q: detail.nis });
      });

      const btnVerOt = document.getElementById('btn-ver-ot');
      if (btnVerOt && detail.ot_vinculada) {
        btnVerOt.addEventListener('click', () => ctx.navigate('ots', { otId: detail.ot_vinculada.id }));
      }

      document.getElementById('btn-print-comprobante').addEventListener('click', () => printHojaReclamacion(detail));
      document.getElementById('btn-print-hoja').addEventListener('click', () => printHojaReclamacion(detail));

      document.getElementById('form-msg-ticket').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('input-msg-ticket');
        try {
          await apiFetch(`/api/tickets/${detail.id}/mensajes`, {
            method: 'POST',
            body: JSON.stringify({ autor_tipo: 'AGENTE', mensaje: input.value.trim() })
          });
          ctx.showToast('Nota agregada al expediente.');
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      document.getElementById('btn-conflicto').addEventListener('click', async () => {
        try {
          await apiFetch(`/api/tickets/${detail.id}/conflicto`, { method: 'PATCH' });
          ctx.showToast('Estado de conflicto actualizado.', 'info');
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      const resForm = document.getElementById('form-resolver-ticket');
      async function submitResolucion(cerrar) {
        const fd = new FormData(resForm);
        try {
          const updated = await apiFetch(`/api/tickets/${detail.id}/resolver`, {
            method: 'PATCH',
            body: JSON.stringify({
              tipificacion_normativa: fd.get('tipificacion_normativa'),
              accion_inmediata: fd.get('accion_inmediata'),
              cuadrilla_id: fd.get('cuadrilla_id') || null,
              dictamen_tecnico: fd.get('dictamen_tecnico'),
              cerrar
            })
          });
          ctx.showToast(
            !cerrar
              ? 'Borrador guardado en PostgreSQL.'
              : updated.ot_vinculada
              ? `Ticket actualizado y OT ${updated.ot_vinculada.codigo} despachada a cuadrilla.`
              : `Resolución aplicada (${updated.estado}).`
          );
          await ctx.refreshHeaderAndBadges();
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      }

      document.getElementById('btn-guardar-borrador').addEventListener('click', () => submitResolucion(false));
      resForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitResolucion(true);
      });
    }
  }

  function openCrearTicketModal(prefill = {}) {
    ctx.showModal(
      'Registrar Nuevo Ticket / Reclamo de Atención',
      `
        <form id="modal-crear-tk" class="space-y-3 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-on-surface-variant mb-1">NIS o DNI/RUC del Titular</label>
              <input name="nis_o_dni" required value="${escapeHtml(prefill.nis_o_dni || '')}" placeholder="Ej: 2049182 o 29584712" class="w-full obsidian-input px-3 py-2 font-mono" />
            </div>
            <div>
              <label class="block text-on-surface-variant mb-1">Canal de Ingreso</label>
              <select name="canal" class="w-full obsidian-input px-3 py-2">
                <option value="PRESENCIAL">Presencial Ventanilla</option>
                <option value="WHATSAPP">WhatsApp Bot</option>
                <option value="PORTAL_WEB">Portal Web</option>
                <option value="CALL_CENTER">Call Center</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-on-surface-variant mb-1">Prioridad SLA</label>
              <select name="prioridad" class="w-full obsidian-input px-3 py-2">
                <option value="URGENTE">Urgente (5h Emergencia)</option>
                <option value="ALTA">Alta (5h)</option>
                <option value="NORMAL" selected>Normal (24h / 15d Reclamo)</option>
              </select>
            </div>
            <div class="flex items-end pb-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="es_reclamo_formal" class="rounded accent-primary" />
                <span>Reclamo Formal Osinergmin (15 días)</span>
              </label>
            </div>
          </div>
          <div>
            <label class="block text-on-surface-variant mb-1">Asunto del Caso</label>
            <input name="asunto" required value="${escapeHtml(prefill.asunto || '')}" placeholder="Ej: Corte de luz intempestivo o reclamo consumo elevado" class="w-full obsidian-input px-3 py-2" />
          </div>
          <div>
            <label class="block text-on-surface-variant mb-1">Descripción Detallada</label>
            <textarea name="descripcion" rows="3" required class="w-full obsidian-input p-2.5" placeholder="Detalle reportado por el cliente en atención..."></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
            <button type="button" id="cancel-tk" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
            <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Crear Ticket</button>
          </div>
        </form>
      `,
      (body) => {
        body.querySelector('#cancel-tk').addEventListener('click', ctx.closeModal);
        body.querySelector('#modal-crear-tk').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            const creado = await apiFetch('/api/tickets', {
              method: 'POST',
              body: JSON.stringify({
                nis_o_dni: fd.get('nis_o_dni'),
                turno_id: prefill.turno_id || null,
                canal: fd.get('canal'),
                prioridad: fd.get('prioridad'),
                asunto: fd.get('asunto'),
                descripcion: fd.get('descripcion'),
                es_reclamo_formal: fd.get('es_reclamo_formal') === 'on'
              })
            });
            ctx.closeModal();
            selectedId = creado.id;
            ctx.showToast(`Ticket ${creado.codigo} creado.`);
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
  if (params.openCreateModal) {
    openCrearTicketModal(params);
  }
}
