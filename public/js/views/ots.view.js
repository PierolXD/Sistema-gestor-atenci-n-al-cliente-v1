import { apiFetch, escapeHtml, fmtDateTime, fmtSlaRestante, fmtTime } from '../api.js';

const ETAPAS = ['GENERADA', 'ASIGNADA', 'EN_SITIO', 'PRUEBAS', 'LIQUIDADA'];

export async function renderOtsView(container, ctx, params = {}) {
  let tipoFiltro = '';
  let selectedId = params.otId || null;

  async function loadAndRender() {
    const qs = tipoFiltro ? `?tipo=${encodeURIComponent(tipoFiltro)}` : '';
    const data = await apiFetch(`/api/ordenes-trabajo${qs}`);
    const { contadores, cuadrillasResumen, cuadrillas, items } = data;

    if (!selectedId || !items.some((i) => i.id === Number(selectedId))) {
      selectedId = items[0]?.id ?? null;
    }
    const detail = selectedId ? await apiFetch(`/api/ordenes-trabajo/${selectedId}`) : null;
    const etapaIdx = detail ? ETAPAS.indexOf(detail.etapa) : 0;
    const nextEtapa = detail && etapaIdx >= 0 && etapaIdx < ETAPAS.length - 1 ? ETAPAS[etapaIdx + 1] : null;

    container.innerHTML = `
      <div class="space-y-5">
        <!-- Header -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-primary">SCADA Grid Command • GPS Sync Online</div>
            <h1 class="text-2xl font-bold tracking-tight text-on-surface mt-0.5">Centro de Despacho y Órdenes de Trabajo (OTs)</h1>
            <div class="flex items-center gap-4 text-xs text-on-surface-variant mt-1.5 flex-wrap">
              <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-primary">local_shipping</span><strong class="text-on-surface">${cuadrillasResumen.enRuta} / ${cuadrillasResumen.total}</strong> Cuadrillas en ruta/sitio</span>
              <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-tertiary">garage_home</span><strong class="text-tertiary">${cuadrillasResumen.disponibles}</strong> En base disponibles</span>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <button id="btn-sync-ots" type="button" class="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">sync</span>
              <span>Actualizar Telemetría GPS</span>
            </button>
            <button id="btn-crear-ot" type="button" class="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">add_alert</span>
              <span>+ Crear Nueva OT de Emergencia</span>
            </button>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="flex items-center gap-2 flex-wrap text-xs">
          ${[
            ['', `Todas las OTs (${contadores.todas})`],
            ['EMERGENCIA', `Cortes No Previstos / Emergencia (${contadores.emergencias})`],
            ['RECONEXION', `Reconexiones Pendientes (${contadores.reconexiones})`],
            ['INSPECCION', `Inspección & Contraste (${contadores.inspecciones})`]
          ]
            .map(
              ([val, label]) => `
                <button data-ot-tipo="${val}" class="ot-tipo-tab px-3.5 py-2 rounded-lg border ${
                  tipoFiltro === val
                    ? 'bg-primary-container text-white border-primary font-semibold'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant hover:text-on-surface'
                } cursor-pointer">${label}</button>
              `
            )
            .join('')}
        </div>

        <!-- Split 5 / 7 -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <!-- Left Dispatch Queue -->
          <div class="xl:col-span-5 space-y-2.5">
            <div class="flex items-center justify-between text-xs px-1">
              <span class="font-semibold uppercase tracking-wider text-secondary">Cola de Despacho Priorizada</span>
              <span class="text-[11px] text-secondary">${items.length} órdenes</span>
            </div>

            <div class="space-y-2.5 max-h-[740px] overflow-y-auto pr-1">
              ${
                items.length === 0
                  ? `<div class="obsidian-card p-8 text-center text-xs text-secondary">No hay órdenes de trabajo en esta categoría.</div>`
                  : items
                      .map((ot) => {
                        const active = detail && ot.id === detail.id;
                        const isCrit = ot.prioridad === 'CRITICA' && ot.etapa !== 'LIQUIDADA';
                        return `
                          <button data-select-ot="${ot.id}" type="button" class="w-full text-left obsidian-card p-4 transition-colors cursor-pointer ${
                            active ? 'border-primary bg-surface-container-high' : 'hover:border-outline'
                          } ${isCrit ? 'border-l-2 border-l-error' : ''}">
                            <div class="flex items-center justify-between gap-2 mb-1">
                              <div class="flex items-center gap-2">
                                <span class="text-xs font-bold font-mono text-on-surface">${escapeHtml(ot.codigo)}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  ot.prioridad === 'CRITICA'
                                    ? 'bg-error/15 text-red-300'
                                    : ot.prioridad === 'ALTA'
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-surface-container-low text-tertiary'
                                }">${escapeHtml(ot.prioridad)}</span>
                              </div>
                              <div class="text-right">
                                <div class="text-[9px] uppercase text-secondary">SLA Restante</div>
                                <div class="text-xs font-mono font-bold ${ot.etapa === 'LIQUIDADA' ? 'text-tertiary' : isCrit ? 'text-error' : 'text-on-surface'}">${ot.etapa === 'LIQUIDADA' ? 'Liquidada' : fmtSlaRestante(ot.sla_restante_segundos)}</div>
                              </div>
                            </div>
                            <div class="text-xs font-semibold text-primary mt-0.5">${escapeHtml(ot.titulo)}</div>
                            <div class="text-[11px] text-secondary mt-1 flex items-center gap-1">
                              <span class="material-symbols-outlined text-[13px]">pin_drop</span>
                              <span class="truncate">${escapeHtml(ot.direccion)}</span>
                            </div>
                            <div class="flex items-center justify-between text-[11px] mt-2.5 pt-2 border-t border-outline-variant/60">
                              <span class="text-on-surface-variant">${ot.cuadrilla_nombre ? `${escapeHtml(ot.cuadrilla_nombre)} - ${escapeHtml(ot.cuadrilla_lider || '')}` : 'Por despachar (En espera)'}</span>
                              <span class="font-semibold ${ot.etapa === 'LIQUIDADA' ? 'text-tertiary' : 'text-primary'}">${escapeHtml(ot.etapa)}</span>
                            </div>
                          </button>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>

          <!-- Right Detail -->
          <div class="xl:col-span-7">
            ${
              !detail
                ? `<div class="obsidian-card p-12 text-center text-xs text-secondary">Seleccione una Orden de Trabajo para gestionar su despacho.</div>`
                : `
                  <div class="obsidian-card p-5 space-y-5">
                    <!-- OT Header -->
                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-xl font-bold font-mono text-on-surface">${escapeHtml(detail.codigo)}</span>
                          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            detail.prioridad === 'CRITICA'
                              ? 'bg-error/15 text-red-300 border border-error/40'
                              : 'bg-primary/15 text-primary border border-primary/40'
                          }">${escapeHtml(detail.prioridad)} • ${escapeHtml(detail.tipo)}</span>
                          ${detail.ticket_codigo ? `<span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-[10px] font-mono text-tertiary">Ticket ${escapeHtml(detail.ticket_codigo)}</span>` : ''}
                        </div>
                        <p class="text-xs text-on-surface-variant mt-1">${escapeHtml(detail.titulo)} ${detail.descripcion ? `— ${escapeHtml(detail.descripcion)}` : ''}</p>
                      </div>
                      <div class="text-right text-[11px] shrink-0">
                        <div class="text-secondary">Apertura:</div>
                        <div class="font-mono text-on-surface">${fmtDateTime(detail.creado_en)}</div>
                      </div>
                    </div>

                    <!-- 5-Step Flow -->
                    <div>
                      <div class="flex items-center justify-between text-xs mb-2">
                        <span class="text-[10px] uppercase tracking-wider font-semibold text-secondary">Flujo Operativo de la Orden</span>
                        <span class="text-primary font-semibold">Paso ${etapaIdx + 1} de 5 (${escapeHtml(detail.etapa)})</span>
                      </div>
                      <div class="grid grid-cols-5 gap-2">
                        ${ETAPAS.map((st, idx) => {
                          const done = idx <= etapaIdx;
                          return `
                            <div>
                              <div class="h-1.5 rounded-full ${done ? (idx === etapaIdx && st !== 'LIQUIDADA' ? 'bg-primary' : 'bg-tertiary') : 'bg-surface-container-high'} mb-1"></div>
                              <div class="text-[11px] truncate ${done ? 'text-on-surface font-medium' : 'text-secondary'}">${escapeHtml(st)}</div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>

                    <!-- Technical Grid -->
                    <div class="obsidian-subcard p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div class="text-[10px] uppercase text-secondary">Suministro / NIS</div>
                        <div class="font-mono font-bold text-on-surface mt-0.5">${escapeHtml(detail.nis)}</div>
                        <div class="text-[11px] text-secondary truncate">${escapeHtml(detail.cliente_nombre)}</div>
                      </div>
                      <div>
                        <div class="text-[10px] uppercase text-secondary">N° de Medidor</div>
                        <div class="font-mono font-bold text-primary mt-0.5">${escapeHtml(detail.numero_medidor)}</div>
                        <div class="text-[11px] text-secondary truncate">${escapeHtml(detail.tarifa)}</div>
                      </div>
                      <div>
                        <div class="text-[10px] uppercase text-secondary">Subestación / SET</div>
                        <div class="font-mono font-bold text-on-surface mt-0.5 truncate">${escapeHtml(detail.subestacion_sed || 'SET Centro')}</div>
                        <div class="text-[11px] text-secondary truncate">${escapeHtml(detail.alimentador_mt || '')}</div>
                      </div>
                      <div>
                        <div class="text-[10px] uppercase text-secondary">Coordenadas GPS</div>
                        <div class="font-mono text-tertiary mt-0.5">${detail.latitud}, ${detail.longitud}</div>
                        <div class="text-[11px] text-secondary">WGS84</div>
                      </div>
                    </div>

                    <!-- Bitácora de Campo en Tiempo Real -->
                    <div class="obsidian-subcard p-4 space-y-3">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span class="material-symbols-outlined text-primary text-[16px]">history_edu</span>
                          <span>Bitácora de Campo en Tiempo Real</span>
                        </span>
                        <span class="text-[11px] text-tertiary">${(detail.eventos || []).length} eventos registrados</span>
                      </div>
                      <div class="space-y-2.5 max-h-44 overflow-y-auto pr-1 text-xs">
                        ${(detail.eventos || [])
                          .map(
                            (ev) => `
                              <div class="border-l-2 border-primary/50 pl-3 py-0.5">
                                <div class="text-on-surface"><span class="font-mono text-secondary mr-2">${fmtTime(ev.creado_en)}</span>${escapeHtml(ev.descripcion)}</div>
                                <div class="text-[11px] text-secondary mt-0.5">${escapeHtml(ev.reportado_por)}</div>
                              </div>
                            `
                          )
                          .join('')}
                      </div>
                      <form id="form-ot-evento" class="flex gap-2 pt-2 border-t border-outline-variant">
                        <input id="input-ot-evento" required type="text" placeholder="Registrar evento o avance de cuadrilla..." class="flex-1 obsidian-input px-3 py-1.5 text-xs" />
                        <button type="submit" class="btn-secondary px-3 py-1.5 text-xs cursor-pointer">Registrar Evento</button>
                      </form>
                    </div>

                    <!-- Reasignar Cuadrilla -->
                    <form id="form-reasignar-cuad" class="obsidian-subcard p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span class="material-symbols-outlined text-[16px] text-primary">alt_route</span>
                          <span>Reasignar Cuadrilla Técnica</span>
                        </div>
                        <div class="text-[11px] text-secondary">Actual: ${escapeHtml(detail.cuadrilla_nombre || 'Sin cuadrilla asignada')}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <select name="cuadrilla_id" class="obsidian-input px-3 py-2 text-xs">
                          ${cuadrillas
                            .map(
                              (c) =>
                                `<option value="${c.id}" ${detail.cuadrilla_id === c.id ? 'selected' : ''}>${escapeHtml(c.nombre)} (${escapeHtml(c.estado)} - ${escapeHtml(c.lider_nombre)})</option>`
                            )
                            .join('')}
                        </select>
                        <button type="submit" ${detail.etapa === 'LIQUIDADA' ? 'disabled' : ''} class="btn-secondary px-3.5 py-2 text-xs cursor-pointer disabled:opacity-40">Reasignar</button>
                      </div>
                    </form>

                    <!-- Materiales, Acta & Acciones -->
                    <div class="obsidian-subcard p-4 space-y-3 text-xs">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-[10px] uppercase text-secondary mb-1">Materiales Imputados</label>
                          <input id="input-ot-materiales" type="text" value="${escapeHtml(detail.materiales_imputados || '')}" placeholder="Ej: 1x Fusible APR 100A, 4m Conductor" class="w-full obsidian-input px-3 py-2 text-xs" />
                        </div>
                        <div>
                          <label class="block text-[10px] uppercase text-secondary mb-1">Acta Digital / Validación</label>
                          <div class="obsidian-input px-3 py-2 text-xs font-mono text-tertiary">
                            ${detail.acta_digital_hash ? `Firmada • Hash: ${escapeHtml(detail.acta_digital_hash)}` : 'Pendiente de liquidación'}
                          </div>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center justify-end gap-2 pt-2">
                        ${
                          nextEtapa && nextEtapa !== 'LIQUIDADA'
                            ? `<button id="btn-avanzar-etapa" data-next="${nextEtapa}" type="button" class="btn-emerald px-4 py-2 text-xs cursor-pointer">Avanzar a ${escapeHtml(nextEtapa)}</button>`
                            : ''
                        }
                        ${
                          detail.etapa !== 'LIQUIDADA'
                            ? `<button id="btn-liquidar-ot" type="button" class="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
                                 <span class="material-symbols-outlined text-[16px]">task_alt</span>
                                 <span>Cerrar y Liquidar OT</span>
                               </button>`
                            : `<span class="px-3 py-1.5 rounded bg-tertiary/15 text-tertiary font-bold">OT LIQUIDADA CONFORME</span>`
                        }
                      </div>
                    </div>
                  </div>
                `
            }
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.ot-tipo-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        tipoFiltro = btn.getAttribute('data-ot-tipo') || '';
        loadAndRender();
      });
    });

    container.querySelectorAll('[data-select-ot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedId = Number(btn.getAttribute('data-select-ot'));
        loadAndRender();
      });
    });

    document.getElementById('btn-sync-ots').addEventListener('click', () => {
      loadAndRender();
      ctx.showToast('Telemetría GPS y estados de cuadrillas actualizados.', 'info');
    });

    document.getElementById('btn-crear-ot').addEventListener('click', () => openCrearOtModal(cuadrillas));

    if (detail) {
      document.getElementById('form-ot-evento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const desc = document.getElementById('input-ot-evento').value.trim();
        try {
          await apiFetch(`/api/ordenes-trabajo/${detail.id}/eventos`, {
            method: 'POST',
            body: JSON.stringify({ tipo_evento: 'NOTA', descripcion: desc })
          });
          ctx.showToast('Evento registrado en bitácora.');
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      document.getElementById('form-reasignar-cuad').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await apiFetch(`/api/ordenes-trabajo/${detail.id}/reasignar`, {
            method: 'PATCH',
            body: JSON.stringify({ cuadrilla_id: Number(fd.get('cuadrilla_id')) })
          });
          ctx.showToast('Cuadrilla reasignada correctamente.');
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      const btnAvanzar = document.getElementById('btn-avanzar-etapa');
      if (btnAvanzar) {
        btnAvanzar.addEventListener('click', async () => {
          const next = btnAvanzar.getAttribute('data-next');
          const materiales = document.getElementById('input-ot-materiales').value.trim();
          try {
            await apiFetch(`/api/ordenes-trabajo/${detail.id}/etapa`, {
              method: 'PATCH',
              body: JSON.stringify({ etapa: next, materiales_imputados: materiales })
            });
            ctx.showToast(`Orden ${detail.codigo} avanzó a ${next}.`);
            await loadAndRender();
          } catch (err) {
            ctx.showToast(err.message, 'error');
          }
        });
      }

      const btnLiquidar = document.getElementById('btn-liquidar-ot');
      if (btnLiquidar) {
        btnLiquidar.addEventListener('click', async () => {
          const materiales = document.getElementById('input-ot-materiales').value.trim();
          try {
            await apiFetch(`/api/ordenes-trabajo/${detail.id}/etapa`, {
              method: 'PATCH',
              body: JSON.stringify({
                etapa: 'LIQUIDADA',
                materiales_imputados: materiales,
                validacion_cliente: 'Conforme en Sitio'
              })
            });
            ctx.showToast(`Orden ${detail.codigo} liquidada y acta digital generada.`);
            await ctx.refreshHeaderAndBadges();
            await loadAndRender();
          } catch (err) {
            ctx.showToast(err.message, 'error');
          }
        });
      }
    }

    function openCrearOtModal(cuadrillasList, prefillNis = '') {
      ctx.showModal(
        'Crear Nueva Orden de Trabajo (Despacho Cuadrilla)',
        `
          <form id="modal-crear-ot" class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-secondary mb-1">NIS del Suministro</label>
                <input name="nis" required value="${escapeHtml(prefillNis)}" placeholder="Ej: 2049102 o 2049182" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-secondary mb-1">Tipo de Orden</label>
                <select name="tipo" class="w-full obsidian-input px-3 py-2">
                  <option value="EMERGENCIA">Emergencia / Corte</option>
                  <option value="RECONEXION">Reconexión</option>
                  <option value="INSPECCION">Inspección &amp; Contraste</option>
                  <option value="CORTE">Corte Programado</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-secondary mb-1">Prioridad</label>
                <select name="prioridad" class="w-full obsidian-input px-3 py-2">
                  <option value="CRITICA">Crítica (2h)</option>
                  <option value="ALTA" selected>Alta (5h)</option>
                  <option value="NORMAL">Normal (24h)</option>
                </select>
              </div>
              <div>
                <label class="block text-secondary mb-1">Asignar Cuadrilla</label>
                <select name="cuadrilla_id" class="w-full obsidian-input px-3 py-2">
                  <option value="">Dejar en Cola de Despacho</option>
                  ${cuadrillasList
                    .map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)} (${escapeHtml(c.estado)})</option>`)
                    .join('')}
                </select>
              </div>
            </div>
            <div>
              <label class="block text-secondary mb-1">Título de la Intervención</label>
              <input name="titulo" required placeholder="Ej: Reposición de fusible BT en poste" class="w-full obsidian-input px-3 py-2" />
            </div>
            <div>
              <label class="block text-secondary mb-1">Descripción / Instrucciones</label>
              <textarea name="descripcion" rows="2" class="w-full obsidian-input p-2.5" placeholder="Detalle para el personal en campo..."></textarea>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button type="button" id="cancel-ot" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
              <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Generar Orden</button>
            </div>
          </form>
        `,
        (body) => {
          body.querySelector('#cancel-ot').addEventListener('click', ctx.closeModal);
          body.querySelector('#modal-crear-ot').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
              const created = await apiFetch('/api/ordenes-trabajo', {
                method: 'POST',
                body: JSON.stringify({
                  nis: fd.get('nis'),
                  tipo: fd.get('tipo'),
                  prioridad: fd.get('prioridad'),
                  cuadrilla_id: fd.get('cuadrilla_id') ? Number(fd.get('cuadrilla_id')) : null,
                  titulo: fd.get('titulo'),
                  descripcion: fd.get('descripcion')
                })
              });
              ctx.closeModal();
              selectedId = created.id;
              ctx.showToast(`Orden ${created.codigo} generada en despacho.`);
              await loadAndRender();
            } catch (err) {
              ctx.showToast(err.message, 'error');
            }
          });
        }
      );
    }

    if (params.openCreateModal) {
      params.openCreateModal = false;
      openCrearOtModal(cuadrillas, params.nis || '');
    }
  }

  await loadAndRender();
}
