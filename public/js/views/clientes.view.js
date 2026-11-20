import { apiFetch, escapeHtml, fmtCurrency, fmtDateTime } from '../api.js';
import { printFicha360 } from '../print.js';

export async function renderClientesView(container, ctx, params = {}) {
  let searchQ = params.q || '';
  let activeTab = 'reclamos';

  async function loadAndRender() {
    const matches = await apiFetch(`/api/clientes?q=${encodeURIComponent(searchQ)}`);
    const firstMatch = matches[0];

    let ficha = null;
    if (firstMatch) {
      ficha = await apiFetch(`/api/clientes/${firstMatch.cliente_id}/ficha-360?suministroId=${firstMatch.suministro_id}`);
    }

    const cliente = ficha?.cliente;
    const sum = ficha?.suministro;
    const consumos = ficha?.consumos || [];
    const tickets = ficha?.tickets || [];
    const inspecciones = ficha?.inspecciones || [];
    const autorizados = ficha?.autorizados || [];
    const deudaTotal = ficha?.deuda_total || 0;

    const maxKwh = Math.max(...consumos.map((c) => Math.max(c.consumo_kwh, c.promedio_sector_kwh)), 200);

    container.innerHTML = `
      <div class="space-y-5">
        <!-- Title & Top Actions -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-tertiary">Catastro Eléctrico v4.2 • Padrón en Línea</div>
            <h1 class="text-2xl font-bold tracking-tight text-on-surface mt-0.5">Directorio de Clientes y Consulta de Suministros</h1>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-nuevo-cliente" type="button" class="btn-emerald px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">person_add</span>
              <span>+ Nuevo Suministro</span>
            </button>
            ${
              ficha
                ? `
                  <button id="btn-editar-titular" type="button" class="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[16px]">edit_document</span>
                    <span>Actualizar Titular</span>
                  </button>
                  <button id="btn-vincular-medidor" type="button" class="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[16px]">add_link</span>
                    <span>Vincular Nuevo Medidor</span>
                  </button>
                  <button id="btn-exportar-ficha" type="button" class="btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
                    <span class="material-symbols-outlined text-[16px]">print</span>
                    <span>Exportar Ficha</span>
                  </button>
                `
                : ''
            }
          </div>
        </div>

        <!-- Search Bar -->
        <div class="obsidian-card p-3 space-y-2.5">
          <form id="form-catastro-search" class="flex flex-col sm:flex-row gap-2">
            <div class="relative flex-1">
              <span class="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
              <input
                id="input-catastro-search"
                type="text"
                value="${escapeHtml(searchQ)}"
                placeholder="Buscar por NIS (ej. 2049182), N° Medidor, DNI/RUC o Nombre..."
                class="w-full obsidian-input pl-10 pr-24 py-2.5 text-xs font-mono"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded ${ficha ? 'bg-tertiary/15 text-tertiary' : 'bg-surface-container-high text-secondary'} text-[10px] font-bold">
                ${ficha ? 'VALIDADO OK' : 'SIN REGISTROS'}
              </span>
            </div>
            <button type="submit" class="btn-primary px-5 py-2.5 text-xs cursor-pointer">Buscar</button>
            <button id="btn-ver-todos-cli" type="button" class="btn-secondary px-4 py-2.5 text-xs cursor-pointer">Ver Padrón</button>
          </form>

          ${
            matches.length > 1
              ? `
                <div class="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                  <span class="text-secondary">Coincidencias (${matches.length}):</span>
                  ${matches
                    .slice(0, 8)
                    .map(
                      (m) => `
                        <button data-pick-nis="${escapeHtml(m.nis)}" type="button" class="px-2.5 py-1 rounded-lg border ${
                          sum && m.nis === sum.nis
                            ? 'bg-primary/20 border-primary text-primary font-semibold'
                            : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:text-on-surface'
                        } font-mono cursor-pointer">
                          ${escapeHtml(m.nis)} • ${escapeHtml(m.nombres_apellidos)}
                        </button>
                      `
                    )
                    .join('')}
                </div>
              `
              : ''
          }
        </div>

        ${
          !ficha
            ? `<div class="obsidian-card p-12 text-center text-xs text-secondary">${
                searchQ
                  ? `No se encontraron suministros para "${escapeHtml(searchQ)}".`
                  : 'El padrón de clientes está limpio (0 suministros registrados). Presiona <strong>+ Nuevo Suministro</strong> para registrar el primer cliente mientras lo atiendes.'
              }</div>`
            : `
              <!-- Main 8/4 Grid -->
              <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <!-- Left 8 cols -->
                <div class="xl:col-span-8 space-y-5">
                  <!-- Header Card Suministro -->
                  <div class="obsidian-card p-5 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div class="flex items-start gap-3.5">
                        <div class="w-11 h-11 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary shrink-0">
                          <span class="material-symbols-outlined">electric_meter</span>
                        </div>
                        <div>
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-bold font-mono text-primary">SUMINISTRO # ${escapeHtml(sum.nis)}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              sum.estado_servicio === 'ACTIVO'
                                ? 'bg-tertiary/15 text-tertiary border border-tertiary/40'
                                : 'bg-error/15 text-red-300 border border-error/40'
                            }">${escapeHtml(sum.estado_servicio)}</span>
                            <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-[10px] text-secondary font-mono">Ciclo Fact. ${escapeHtml(sum.ciclo_facturacion)}</span>
                          </div>
                          <h2 class="text-xl font-bold text-on-surface mt-1">${escapeHtml(cliente.nombres_apellidos)}</h2>
                          <div class="text-xs text-on-surface-variant mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>${escapeHtml(cliente.tipo_documento)}: <strong class="font-mono text-on-surface">${escapeHtml(cliente.dni_ruc)}</strong></span>
                            <span>•</span>
                            <span>Tarifa: <strong class="text-on-surface">${escapeHtml(sum.tarifa)}</strong></span>
                            <span>•</span>
                            <span>Potencia: <strong class="text-on-surface">${sum.potencia_contratada_kw} kW</strong></span>
                          </div>
                        </div>
                      </div>

                      <div class="text-left sm:text-right">
                        <div class="text-[10px] uppercase tracking-wider text-secondary">${deudaTotal > 0 ? 'Deuda Pendiente' : 'Saldo al Día'}</div>
                        <div class="text-2xl font-bold font-mono ${deudaTotal > 0 ? 'text-error' : 'text-tertiary'}">${fmtCurrency(deudaTotal)}</div>
                        <button id="btn-ir-pagos-360" type="button" class="text-[11px] text-primary hover:underline cursor-pointer">
                          ${deudaTotal > 0 ? 'Ir a cobrar / convenios →' : 'Ver comprobantes →'}
                        </button>
                      </div>
                    </div>

                    <div class="pt-3 border-t border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div class="flex items-center gap-1.5 text-on-surface-variant">
                        <span class="material-symbols-outlined text-[16px] text-primary">location_on</span>
                        <span class="font-semibold text-on-surface">${escapeHtml(sum.direccion)}</span>
                        <span>— ${escapeHtml(sum.sector)} (${escapeHtml(sum.distrito)})</span>
                      </div>
                      <div class="text-[11px] font-mono text-secondary">CÓD. RUTA: <strong class="text-on-surface">${escapeHtml(sum.codigo_ruta || 'AQ-001')}</strong></div>
                    </div>
                  </div>

                  <!-- Panel Técnico de Telemedición -->
                  <div class="obsidian-card p-5 space-y-4">
                    <div class="flex items-center justify-between">
                      <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[18px]">sensors</span>
                        <span>Panel Técnico de Telemedición &amp; Red</span>
                      </h3>
                      <span class="px-2.5 py-0.5 rounded-full bg-tertiary/10 border border-tertiary/30 text-[11px] text-tertiary">Sincronizado: ${fmtDateTime(sum.actualizado_en)}</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div class="obsidian-subcard p-3.5">
                        <div class="text-[10px] uppercase text-secondary">Medidor Asignado</div>
                        <div class="text-sm font-bold font-mono text-on-surface mt-1">${escapeHtml(sum.numero_medidor)}</div>
                        <div class="text-[11px] text-primary mt-0.5">${escapeHtml(sum.tipo_medidor)}</div>
                      </div>
                      <div class="obsidian-subcard p-3.5">
                        <div class="text-[10px] uppercase text-secondary">Subestación (SED)</div>
                        <div class="text-sm font-bold font-mono text-on-surface mt-1">${escapeHtml(sum.subestacion_sed || 'SE-041')}</div>
                        <div class="text-[11px] text-secondary mt-0.5">Red de Distribución</div>
                      </div>
                      <div class="obsidian-subcard p-3.5">
                        <div class="text-[10px] uppercase text-secondary">Alimentador MT</div>
                        <div class="text-sm font-bold font-mono text-on-surface mt-1">${escapeHtml(sum.alimentador_mt || 'ALIM-B04')}</div>
                        <div class="text-[11px] text-secondary mt-0.5">Media Tensión</div>
                      </div>
                      <div class="obsidian-subcard p-3.5">
                        <div class="text-[10px] uppercase text-secondary">Lectura Instantánea</div>
                        <div class="text-sm font-bold font-mono text-tertiary mt-1">${Number(sum.lectura_actual_kwh).toLocaleString()} kWh</div>
                        <div class="text-[11px] text-secondary mt-0.5">Fact. Ant: ${Number(sum.lectura_anterior_kwh).toLocaleString()} kWh</div>
                      </div>
                    </div>

                    <div class="grid grid-cols-3 gap-3 text-xs pt-1">
                      <div class="obsidian-subcard px-3.5 py-2.5 flex items-center justify-between">
                        <span class="text-secondary">Tensión RMS:</span>
                        <span class="font-mono font-bold ${sum.tension_rms_v > 0 ? 'text-tertiary' : 'text-error'}">${sum.tension_rms_v} V</span>
                      </div>
                      <div class="obsidian-subcard px-3.5 py-2.5 flex items-center justify-between">
                        <span class="text-secondary">Corriente:</span>
                        <span class="font-mono font-bold text-on-surface">${sum.corriente_a} A</span>
                      </div>
                      <div class="obsidian-subcard px-3.5 py-2.5 flex items-center justify-between">
                        <span class="text-secondary">Factor Potencia:</span>
                        <span class="font-mono font-bold text-on-surface">${sum.factor_potencia} ind</span>
                      </div>
                    </div>
                  </div>

                  <!-- Histórico de Consumo (SVG) -->
                  <div class="obsidian-card p-5 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 class="text-sm font-bold text-on-surface">Histórico de Consumo Mensual (Últimos 6 Meses)</h3>
                        <p class="text-[11px] text-secondary">Comparativa directa con el promedio del clúster sectorial</p>
                      </div>
                      <div class="flex items-center gap-4 text-[11px]">
                        <span class="flex items-center gap-1.5 text-on-surface"><span class="w-2.5 h-2.5 rounded-full bg-primary"></span>Suministro ${escapeHtml(sum.nis)}</span>
                        <span class="flex items-center gap-1.5 text-secondary"><span class="w-3 h-0.5 bg-outline"></span>Promedio Sector</span>
                      </div>
                    </div>

                    <div class="obsidian-subcard p-4">
                      <div class="grid gap-3 items-end h-44 pt-4" style="grid-template-columns: repeat(${Math.max(1, consumos.length)}, minmax(0, 1fr));">
                        ${consumos
                          .map((c, idx) => {
                            const hPct = Math.max(12, Math.round((c.consumo_kwh / maxKwh) * 100));
                            const isLast = idx === consumos.length - 1;
                            return `
                              <div class="flex flex-col items-center justify-end h-full gap-1.5">
                                <span class="text-[11px] font-mono ${isLast ? 'text-primary font-bold' : 'text-on-surface-variant'}">${c.consumo_kwh}</span>
                                <div class="w-full max-w-[44px] rounded-t-md transition-all ${isLast ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant'}" style="height:${hPct}%"></div>
                                <span class="text-[10px] font-mono text-secondary">${escapeHtml(c.etiqueta_mes)}</span>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Right 4 cols -->
                <div class="xl:col-span-4 space-y-5">
                  <!-- Hardware Medidor -->
                  <div class="obsidian-card p-5 space-y-3 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="font-bold font-mono text-on-surface">${escapeHtml(sum.numero_medidor)}</span>
                      <span class="text-[11px] text-tertiary font-mono">Precinto: #${escapeHtml(sum.precinto_bornera || 'PRC-001')}</span>
                    </div>
                    <div class="space-y-2 pt-2 border-t border-outline-variant">
                      <div class="flex justify-between"><span class="text-secondary">Tipo de Acometida:</span><span class="text-on-surface font-medium">${escapeHtml(sum.tipo_acometida)}</span></div>
                      <div class="flex justify-between"><span class="text-secondary">Caja Portamedidor:</span><span class="text-on-surface font-medium">${escapeHtml(sum.caja_portamedidor)}</span></div>
                      <div class="flex justify-between"><span class="text-secondary">Llave Termomagnética:</span><span class="text-on-surface font-medium">${escapeHtml(sum.llave_termomagnetica)}</span></div>
                      <div class="flex justify-between"><span class="text-secondary">Puesta a Tierra (PAT):</span><span class="text-tertiary font-medium">Conforme (${sum.puesta_tierra_ohm} Ω)</span></div>
                    </div>
                  </div>

                  <!-- Ubicación Georreferenciada -->
                  <div class="obsidian-card p-5 space-y-2.5 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-on-surface">Ubicación Georreferenciada</span>
                      <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-[10px] font-mono text-primary">WGS84</span>
                    </div>
                    <div class="obsidian-subcard p-3 font-mono text-primary flex items-center gap-2">
                      <span class="material-symbols-outlined text-[16px]">pin_drop</span>
                      <span>${sum.latitud}, ${sum.longitud}</span>
                    </div>
                    <p class="text-[11px] text-secondary">Punto de entrega ubicado en ${escapeHtml(sum.direccion)}, ${escapeHtml(sum.distrito)}.</p>
                  </div>

                  <!-- Operaciones Rápidas de Campo -->
                  <div class="obsidian-card p-5 space-y-3">
                    <div class="text-xs font-bold uppercase tracking-wider text-secondary">Operaciones Rápidas de Campo</div>
                    <div class="grid grid-cols-2 gap-2.5 text-xs">
                      <button id="btn-toggle-corte" type="button" class="btn-secondary p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:border-error/50">
                        <span class="material-symbols-outlined text-[20px] ${sum.estado_servicio === 'ACTIVO' ? 'text-error' : 'text-tertiary'}">${sum.estado_servicio === 'ACTIVO' ? 'power_off' : 'power'}</span>
                        <span>${sum.estado_servicio === 'ACTIVO' ? 'Corte / Suspensión' : 'Reponer Servicio'}</span>
                      </button>
                      <button id="btn-generar-ot-360" type="button" class="btn-secondary p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:border-primary/50">
                        <span class="material-symbols-outlined text-[20px] text-primary">build_circle</span>
                        <span>Generar OT</span>
                      </button>
                      <button id="btn-ping-medidor" type="button" class="btn-secondary p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:border-tertiary/50">
                        <span class="material-symbols-outlined text-[20px] text-tertiary">speed</span>
                        <span>Ping Telemedidor</span>
                      </button>
                      <button id="btn-crear-ticket-360" type="button" class="btn-secondary p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:border-primary/50">
                        <span class="material-symbols-outlined text-[20px] text-amber-400">history_edu</span>
                        <span>Registrar Ticket</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom 3 Tabs -->
              <div class="obsidian-card p-5 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-3">
                  <div class="flex items-center gap-2 flex-wrap text-xs">
                    <button data-tab="reclamos" class="cli-tab px-3 py-1.5 rounded-lg ${activeTab === 'reclamos' ? 'bg-primary text-background font-semibold' : 'bg-surface-container-low text-on-surface-variant'} cursor-pointer">
                      Historial de Reclamos (${tickets.length})
                    </button>
                    <button data-tab="inspecciones" class="cli-tab px-3 py-1.5 rounded-lg ${activeTab === 'inspecciones' ? 'bg-primary text-background font-semibold' : 'bg-surface-container-low text-on-surface-variant'} cursor-pointer">
                      Inspecciones y Precintos (${inspecciones.length})
                    </button>
                    <button data-tab="autorizados" class="cli-tab px-3 py-1.5 rounded-lg ${activeTab === 'autorizados' ? 'bg-primary text-background font-semibold' : 'bg-surface-container-low text-on-surface-variant'} cursor-pointer">
                      Personas Autorizadas (${autorizados.length})
                    </button>
                  </div>

                  <div>
                    ${
                      activeTab === 'reclamos'
                        ? `<button id="btn-tab-add-ticket" type="button" class="btn-secondary px-3 py-1.5 text-xs cursor-pointer">+ Registrar Incidencia</button>`
                        : activeTab === 'inspecciones'
                        ? `<button id="btn-tab-add-insp" type="button" class="btn-secondary px-3 py-1.5 text-xs cursor-pointer">+ Programar Contraste</button>`
                        : `<button id="btn-tab-add-aut" type="button" class="btn-secondary px-3 py-1.5 text-xs cursor-pointer">+ Añadir Autorizado</button>`
                    }
                  </div>
                </div>

                ${
                  activeTab === 'reclamos'
                    ? `
                      <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                          <thead class="text-[10px] uppercase text-secondary border-b border-outline-variant">
                            <tr>
                              <th class="py-2 pr-3">Fecha / Hora</th>
                              <th class="py-2 pr-3">Código</th>
                              <th class="py-2 pr-3">Tipo / Motivo</th>
                              <th class="py-2 pr-3">Canal</th>
                              <th class="py-2 pr-3">Estado</th>
                              <th class="py-2">Resolución</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-outline-variant/60">
                            ${
                              tickets.length === 0
                                ? `<tr><td colspan="6" class="py-6 text-center text-secondary">Sin reclamos o averías registrados.</td></tr>`
                                : tickets
                                    .map(
                                      (tk) => `
                                        <tr class="hover:bg-surface-container-low">
                                          <td class="py-2.5 pr-3 font-mono text-secondary">${fmtDateTime(tk.creado_en)}</td>
                                          <td class="py-2.5 pr-3 font-mono font-semibold text-primary">${escapeHtml(tk.codigo)}</td>
                                          <td class="py-2.5 pr-3 font-medium text-on-surface">${escapeHtml(tk.asunto)}</td>
                                          <td class="py-2.5 pr-3 text-on-surface-variant">${escapeHtml(tk.canal)}</td>
                                          <td class="py-2.5 pr-3"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-container-high text-tertiary">${escapeHtml(tk.estado)}</span></td>
                                          <td class="py-2.5 text-on-surface-variant">${escapeHtml(tk.dictamen_tecnico || tk.tipificacion_normativa || 'En seguimiento')}</td>
                                        </tr>
                                      `
                                    )
                                    .join('')
                            }
                          </tbody>
                        </table>
                      </div>
                    `
                    : activeTab === 'inspecciones'
                    ? `
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${
                          inspecciones.length === 0
                            ? `<div class="col-span-2 py-6 text-center text-xs text-secondary">No hay inspecciones registradas.</div>`
                            : inspecciones
                                .map(
                                  (ins) => `
                                    <div class="obsidian-subcard p-4 text-xs space-y-2">
                                      <div class="flex items-center justify-between">
                                        <span class="font-bold text-on-surface">${escapeHtml(ins.tipo)} — <span class="font-mono text-primary">${escapeHtml(ins.codigo_certificado)}</span></span>
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/15 text-tertiary">${escapeHtml(ins.estado)}</span>
                                      </div>
                                      <div class="text-secondary">${escapeHtml(ins.laboratorio_o_ot || '')} • Fecha: ${escapeHtml(ins.fecha_ensayo)}</div>
                                      <div class="text-on-surface-variant">Error Medido: <strong class="text-on-surface">${escapeHtml(ins.error_medido_pct || 'N/A')}</strong> • Próx. Venc.: ${escapeHtml(ins.proximo_vencimiento || '-')}</div>
                                    </div>
                                  `
                                )
                                .join('')
                        }
                      </div>
                    `
                    : `
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        ${autorizados
                          .map(
                            (a) => `
                              <div class="obsidian-subcard p-4 text-xs space-y-1.5">
                                <div class="flex items-center justify-between">
                                  <span class="font-bold text-on-surface">${escapeHtml(a.nombre_completo)}</span>
                                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary">${escapeHtml(a.nivel)}</span>
                                </div>
                                <div class="text-secondary">${escapeHtml(a.relacion)}</div>
                                <div class="text-on-surface-variant font-mono pt-1">DNI: ${escapeHtml(a.dni || '-')} • ${escapeHtml(a.telefono || '-')}</div>
                                <div class="text-[11px] text-tertiary">${a.poder_legal ? 'Poder Legal Registrado: Sí' : 'Autorización Operativa'}</div>
                              </div>
                            `
                          )
                          .join('')}
                      </div>
                    `
                }
              </div>
            `
        }
      </div>
    `;

    // Wire events
    document.getElementById('form-catastro-search').addEventListener('submit', (e) => {
      e.preventDefault();
      searchQ = document.getElementById('input-catastro-search').value.trim();
      loadAndRender();
    });

    document.getElementById('btn-ver-todos-cli').addEventListener('click', () => {
      searchQ = '';
      loadAndRender();
    });

    container.querySelectorAll('[data-pick-nis]').forEach((btn) => {
      btn.addEventListener('click', () => {
        searchQ = btn.getAttribute('data-pick-nis');
        loadAndRender();
      });
    });

    document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
      ctx.showModal(
        'Registrar Nuevo Cliente y Suministro (#1 SEAL)',
        `
          <form id="modal-new-cli" class="space-y-3 text-xs">
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-secondary mb-1">Tipo Doc.</label>
                <select name="tipo_documento" class="w-full obsidian-input px-2.5 py-2">
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">CE</option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="block text-secondary mb-1">N° DNI / RUC</label>
                <input name="dni_ruc" required placeholder="Ej: 45128901" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
            </div>
            <div>
              <label class="block text-secondary mb-1">Nombres y Apellidos / Razón Social</label>
              <input name="nombres_apellidos" required placeholder="Ej: Lucía Fernanda Quispe" class="w-full obsidian-input px-3 py-2" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-secondary mb-1">Teléfono</label>
                <input name="telefono" placeholder="+51 959 000 111" class="w-full obsidian-input px-3 py-2" />
              </div>
              <div>
                <label class="block text-secondary mb-1">Correo Electrónico</label>
                <input name="correo" type="email" placeholder="cliente@correo.pe" class="w-full obsidian-input px-3 py-2" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant">
              <div>
                <label class="block text-secondary mb-1">Nuevo NIS Suministro</label>
                <input name="nis" required placeholder="Ej: 2099881" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-secondary mb-1">N° Medidor Asignado</label>
                <input name="numero_medidor" required placeholder="Ej: MED-9988101" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-secondary mb-1">Tarifa</label>
                <input name="tarifa" value="BT5B Residencial" class="w-full obsidian-input px-3 py-2" />
              </div>
              <div>
                <label class="block text-secondary mb-1">Potencia (kW)</label>
                <input name="potencia_contratada_kw" type="number" step="0.1" value="3.5" class="w-full obsidian-input px-3 py-2" />
              </div>
            </div>
            <div>
              <label class="block text-secondary mb-1">Dirección de Instalación</label>
              <input name="direccion" required placeholder="Av. Ejercito 450, Cayma" class="w-full obsidian-input px-3 py-2" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button type="button" id="cancel-new-cli" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
              <button type="submit" class="btn-emerald px-4 py-2 cursor-pointer">Crear Suministro</button>
            </div>
          </form>
        `,
        (body) => {
          body.querySelector('#cancel-new-cli').addEventListener('click', ctx.closeModal);
          body.querySelector('#modal-new-cli').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
              const created = await apiFetch('/api/clientes', {
                method: 'POST',
                body: JSON.stringify(Object.fromEntries(fd.entries()))
              });
              ctx.closeModal();
              searchQ = created.suministro.nis;
              ctx.showToast(`Suministro #${created.suministro.nis} registrado correctamente.`);
              await loadAndRender();
            } catch (err) {
              ctx.showToast(err.message, 'error');
            }
          });
        }
      );
    });

    if (ficha) {
      document.getElementById('btn-exportar-ficha').addEventListener('click', () => printFicha360(ficha));
      document.getElementById('btn-ir-pagos-360').addEventListener('click', () => ctx.navigate('comprobantes', { q: sum.nis }));

      document.getElementById('btn-editar-titular').addEventListener('click', () => {
        ctx.showModal(
          `Actualizar Datos del Titular (${cliente.dni_ruc})`,
          `
            <form id="modal-edit-cli" class="space-y-3 text-xs">
              <div>
                <label class="block text-secondary mb-1">Nombres / Razón Social</label>
                <input name="nombres_apellidos" required value="${escapeHtml(cliente.nombres_apellidos)}" class="w-full obsidian-input px-3 py-2" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-secondary mb-1">Teléfono</label>
                  <input name="telefono" value="${escapeHtml(cliente.telefono || '')}" class="w-full obsidian-input px-3 py-2" />
                </div>
                <div>
                  <label class="block text-secondary mb-1">Correo</label>
                  <input name="correo" type="email" value="${escapeHtml(cliente.correo || '')}" class="w-full obsidian-input px-3 py-2" />
                </div>
              </div>
              <label class="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" name="notificaciones_sms" ${cliente.notificaciones_sms ? 'checked' : ''} class="accent-primary" />
                <span>Notificaciones SMS / WhatsApp Activas</span>
              </label>
              <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button type="button" id="cancel-edit-cli" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
                <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Guardar Cambios</button>
              </div>
            </form>
          `,
          (body) => {
            body.querySelector('#cancel-edit-cli').addEventListener('click', ctx.closeModal);
            body.querySelector('#modal-edit-cli').addEventListener('submit', async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await apiFetch(`/api/clientes/${cliente.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    nombres_apellidos: fd.get('nombres_apellidos'),
                    telefono: fd.get('telefono'),
                    correo: fd.get('correo'),
                    notificaciones_sms: fd.get('notificaciones_sms') === 'on'
                  })
                });
                ctx.closeModal();
                ctx.showToast('Datos del titular actualizados.');
                await loadAndRender();
              } catch (err) {
                ctx.showToast(err.message, 'error');
              }
            });
          }
        );
      });

      document.getElementById('btn-vincular-medidor').addEventListener('click', () => {
        ctx.showModal(
          `Vincular / Actualizar Medidor — Suministro ${sum.nis}`,
          `
            <form id="modal-edit-med" class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-secondary mb-1">Número de Medidor</label>
                  <input name="numero_medidor" required value="${escapeHtml(sum.numero_medidor)}" class="w-full obsidian-input px-3 py-2 font-mono" />
                </div>
                <div>
                  <label class="block text-secondary mb-1">Tipo de Medidor</label>
                  <input name="tipo_medidor" required value="${escapeHtml(sum.tipo_medidor)}" class="w-full obsidian-input px-3 py-2" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-secondary mb-1">Precinto Bornera</label>
                  <input name="precinto_bornera" value="${escapeHtml(sum.precinto_bornera || '')}" class="w-full obsidian-input px-3 py-2 font-mono" />
                </div>
                <div>
                  <label class="block text-secondary mb-1">Precinto Caja</label>
                  <input name="precinto_caja" value="${escapeHtml(sum.precinto_caja || '')}" class="w-full obsidian-input px-3 py-2 font-mono" />
                </div>
              </div>
              <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button type="button" id="cancel-edit-med" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
                <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Actualizar Medidor</button>
              </div>
            </form>
          `,
          (body) => {
            body.querySelector('#cancel-edit-med').addEventListener('click', ctx.closeModal);
            body.querySelector('#modal-edit-med').addEventListener('submit', async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await apiFetch(`/api/clientes/suministros/${sum.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify(Object.fromEntries(fd.entries()))
                });
                ctx.closeModal();
                ctx.showToast('Medidor y precintos actualizados.');
                await loadAndRender();
              } catch (err) {
                ctx.showToast(err.message, 'error');
              }
            });
          }
        );
      });

      document.getElementById('btn-toggle-corte').addEventListener('click', async () => {
        const nextEstado = sum.estado_servicio === 'ACTIVO' ? 'CORTADO' : 'ACTIVO';
        try {
          await apiFetch(`/api/clientes/suministros/${sum.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              estado_servicio: nextEstado,
              tension_rms_v: nextEstado === 'ACTIVO' ? 221.4 : 0,
              corriente_a: nextEstado === 'ACTIVO' ? 4.8 : 0
            })
          });
          ctx.showToast(`Suministro ${sum.nis} cambiado a ${nextEstado}.`);
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      document.getElementById('btn-ping-medidor').addEventListener('click', async () => {
        try {
          const ping = await apiFetch(`/api/clientes/suministros/${sum.id}/ping`, { method: 'POST' });
          ctx.showToast(`${ping.mensaje} (${ping.latencia_ms} ms)`);
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      document.getElementById('btn-generar-ot-360').addEventListener('click', () => {
        ctx.navigate('ots', { openCreateModal: true, nis: sum.nis });
      });

      const goTicketCreate = () =>
        ctx.navigate('tickets', { openCreateModal: true, nis_o_dni: sum.nis, asunto: `Incidencia en Suministro ${sum.nis}` });

      document.getElementById('btn-crear-ticket-360').addEventListener('click', goTicketCreate);

      container.querySelectorAll('.cli-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.getAttribute('data-tab');
          loadAndRender();
        });
      });

      const addTkBtn = document.getElementById('btn-tab-add-ticket');
      if (addTkBtn) addTkBtn.addEventListener('click', goTicketCreate);

      const addInspBtn = document.getElementById('btn-tab-add-insp');
      if (addInspBtn) {
        addInspBtn.addEventListener('click', () => {
          ctx.showModal(
            `Programar Contraste / Inspección — NIS ${sum.nis}`,
            `
              <form id="modal-insp" class="space-y-3 text-xs">
                <div>
                  <label class="block text-secondary mb-1">Tipo de Inspección</label>
                  <select name="tipo" class="w-full obsidian-input px-3 py-2">
                    <option value="CONTRASTE">Contraste Metrológico INACAL</option>
                    <option value="INSPECCION_PRECINTO">Inspección de Precintos</option>
                    <option value="RENOVACION_ACOMETIDA">Renovación de Acometida</option>
                  </select>
                </div>
                <div>
                  <label class="block text-secondary mb-1">Laboratorio / Unidad Ejecutora</label>
                  <input name="laboratorio_o_ot" value="Laboratorio Móvil LAB-02" class="w-full obsidian-input px-3 py-2" />
                </div>
                <div>
                  <label class="block text-secondary mb-1">Observaciones</label>
                  <textarea name="observaciones" rows="2" class="w-full obsidian-input p-2.5" placeholder="Motivo de programación..."></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                  <button type="button" id="cancel-insp" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
                  <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Programar</button>
                </div>
              </form>
            `,
            (body) => {
              body.querySelector('#cancel-insp').addEventListener('click', ctx.closeModal);
              body.querySelector('#modal-insp').addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                try {
                  const created = await apiFetch(`/api/clientes/suministros/${sum.id}/inspecciones`, {
                    method: 'POST',
                    body: JSON.stringify(Object.fromEntries(fd.entries()))
                  });
                  ctx.closeModal();
                  ctx.showToast(`Inspección ${created.codigo_certificado} programada.`);
                  await loadAndRender();
                } catch (err) {
                  ctx.showToast(err.message, 'error');
                }
              });
            }
          );
        });
      }

      const addAutBtn = document.getElementById('btn-tab-add-aut');
      if (addAutBtn) {
        addAutBtn.addEventListener('click', () => {
          ctx.showModal(
            `Añadir Persona Autorizada — ${cliente.nombres_apellidos}`,
            `
              <form id="modal-aut" class="space-y-3 text-xs">
                <div>
                  <label class="block text-secondary mb-1">Nombre Completo</label>
                  <input name="nombre_completo" required class="w-full obsidian-input px-3 py-2" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-secondary mb-1">Relación / Cargo</label>
                    <input name="relacion" required placeholder="Ej: Familiar / Electricista" class="w-full obsidian-input px-3 py-2" />
                  </div>
                  <div>
                    <label class="block text-secondary mb-1">Nivel</label>
                    <select name="nivel" class="w-full obsidian-input px-3 py-2">
                      <option value="SECUNDARIO">Secundario</option>
                      <option value="TECNICO">Técnico Certificado</option>
                      <option value="PRINCIPAL">Principal</option>
                    </select>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-secondary mb-1">DNI</label>
                    <input name="dni" class="w-full obsidian-input px-3 py-2 font-mono" />
                  </div>
                  <div>
                    <label class="block text-secondary mb-1">Teléfono</label>
                    <input name="telefono" class="w-full obsidian-input px-3 py-2" />
                  </div>
                </div>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="poder_legal" class="accent-primary" />
                  <span>Cuenta con Poder Legal registrado</span>
                </label>
                <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                  <button type="button" id="cancel-aut" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
                  <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Guardar Autorizado</button>
                </div>
              </form>
            `,
            (body) => {
              body.querySelector('#cancel-aut').addEventListener('click', ctx.closeModal);
              body.querySelector('#modal-aut').addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                try {
                  await apiFetch(`/api/clientes/${cliente.id}/autorizados`, {
                    method: 'POST',
                    body: JSON.stringify({
                      ...Object.fromEntries(fd.entries()),
                      poder_legal: fd.get('poder_legal') === 'on'
                    })
                  });
                  ctx.closeModal();
                  ctx.showToast('Persona autorizada registrada.');
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
  }

  await loadAndRender();
}
