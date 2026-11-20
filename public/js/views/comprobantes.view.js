import { apiFetch, escapeHtml, fmtCurrency, fmtDateTime } from '../api.js';
import { printActaConvenio, printComprobantePago } from '../print.js';

function calcConvenioLocal(capital, cuotas) {
  const cap = Math.round(Number(capital || 0) * 100) / 100;
  const factor = (1.85 / 100) * (cuotas / 3.27) * 1.84;
  const interes = Math.round(cap * factor * 100) / 100;
  const total = Math.round((cap + interes) * 100) / 100;
  const cuota = Math.round((total / cuotas) * 100) / 100;
  return { cap, interes, cuota };
}

export async function renderComprobantesView(container, ctx, params = {}) {
  let searchQ = params.q || '';
  let tabFiltro = 'todos';
  let expandedReciboId = null;
  let selectedReciboId = null;
  let selectedCuotas = 6;
  let ultimoPagoRealizado = null;

  async function loadAndRender() {
    let data = null;
    let errMsg = null;
    try {
      data = await apiFetch(`/api/comprobantes/consulta?q=${encodeURIComponent(searchQ)}`);
    } catch (err) {
      errMsg = err.message;
    }

    const cliente = data?.cliente;
    const sum = data?.suministro;
    const recibos = data?.recibos || [];
    const convenios = data?.convenios || [];
    const consumos = data?.consumos || [];
    const deudaTotal = data?.deuda_total || 0;
    const pendientes = recibos.filter((r) => r.estado === 'PENDIENTE' || r.estado === 'VENCIDO');

    if (!selectedReciboId || !pendientes.some((r) => r.id === selectedReciboId)) {
      selectedReciboId = pendientes[0]?.id ?? null;
    }
    const reciboACobrar = pendientes.find((r) => r.id === selectedReciboId) || null;

    const recibosFiltrados =
      tabFiltro === 'pendientes'
        ? pendientes
        : tabFiltro === 'fraccionados'
        ? recibos.filter((r) => r.estado === 'FRACCIONADO')
        : recibos;

    const convCalc = calcConvenioLocal(deudaTotal, selectedCuotas);
    const maxKwh = Math.max(...consumos.map((c) => c.consumo_kwh), 180);

    container.innerHTML = `
      <div class="space-y-5">
        <!-- Header & Search -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-primary">Módulo Recaudación • Terminal Caja En Línea</div>
            <h1 class="text-2xl font-bold tracking-tight text-on-surface mt-0.5">Facturación, Comprobantes y Recaudación</h1>
            <p class="text-xs text-secondary mt-0.5">Consulta de consumos históricos, liquidación en ventanilla y convenios de refinanciamiento normativo.</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <form id="form-comp-search" class="flex items-center gap-2">
              <div class="relative">
                <span class="material-symbols-outlined text-[17px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
                <input id="input-comp-search" type="text" value="${escapeHtml(searchQ)}" placeholder="Buscar por NIS, Recibo o DNI..." class="obsidian-input pl-9 pr-4 py-2 text-xs font-mono w-64" />
              </div>
              <button type="submit" class="btn-primary px-4 py-2 text-xs cursor-pointer">Consultar</button>
            </form>
            <button id="btn-emitir-recibo" type="button" class="btn-emerald px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">post_add</span>
              <span>+ Emitir Recibo</span>
            </button>
          </div>
        </div>

        ${
          errMsg
            ? `<div class="obsidian-card p-10 text-center text-xs text-red-300">${escapeHtml(errMsg)}</div>`
            : !data
            ? `<div class="obsidian-card p-12 text-center text-xs text-secondary">No hay suministros ni recibos registrados aún. Registra un cliente en <strong>Clientes &amp; Suministros</strong> y emite su recibo con <strong>+ Emitir Recibo</strong>.</div>`
            : `
              <!-- 4 Summary Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div class="obsidian-card p-4">
                  <div class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Titular Registrado</div>
                  <div class="text-sm font-bold text-on-surface mt-1.5">${escapeHtml(cliente.nombres_apellidos)}</div>
                  <div class="text-[11px] font-mono text-primary mt-0.5">DNI/RUC: ${escapeHtml(cliente.dni_ruc)} • NIS: ${escapeHtml(sum.nis)}</div>
                  <div class="text-[11px] text-secondary mt-2 pt-2 border-t border-outline-variant">Tarifa: ${escapeHtml(sum.tarifa)}</div>
                </div>

                <div class="obsidian-card p-4">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Deuda Total Exigible</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${sum.estado_servicio === 'ACTIVO' ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-red-300'}">${sum.estado_servicio === 'ACTIVO' ? 'SIN CORTE' : sum.estado_servicio}</span>
                  </div>
                  <div class="text-2xl font-bold font-mono ${deudaTotal > 0 ? 'text-on-surface' : 'text-tertiary'} mt-1.5">${fmtCurrency(deudaTotal)}</div>
                  <div class="text-[11px] text-on-surface-variant mt-0.5">${data.recibos_pendientes_count} recibo(s) pendiente(s)</div>
                  <div class="text-[11px] text-secondary mt-2 pt-2 border-t border-outline-variant">Vencimiento: ${escapeHtml(data.proximo_vencimiento || 'Al día')}</div>
                </div>

                <div class="obsidian-card p-4">
                  <div class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Último Pago Registrado</div>
                  <div class="text-2xl font-bold font-mono text-tertiary mt-1.5">${data.ultimo_pago ? fmtCurrency(data.ultimo_pago.monto) : 'S/ 0.00'}</div>
                  <div class="text-[11px] text-on-surface-variant mt-0.5">${data.ultimo_pago ? fmtDateTime(data.ultimo_pago.pagado_en) : 'Sin pagos previos'}</div>
                  <div class="text-[11px] text-primary font-mono mt-2 pt-2 border-t border-outline-variant">${data.ultimo_pago ? `${escapeHtml(data.ultimo_pago.metodo_pago)} • ${escapeHtml(data.ultimo_pago.codigo_operacion)}` : '---'}</div>
                </div>

                <div class="obsidian-card p-4">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Perfil Crediticio</span>
                    <span class="text-[11px] font-mono font-bold text-primary">SCORE: ${cliente.score_crediticio}/100</span>
                  </div>
                  <div class="flex items-center justify-between mt-1.5">
                    <span class="text-base font-bold text-on-surface">${cliente.categoria_crediticia === 'A' ? 'Cliente Puntual' : 'Historial Regular'}</span>
                    <span class="px-2 py-0.5 rounded bg-tertiary/15 text-tertiary text-[10px] font-bold">CAT. ${escapeHtml(cliente.categoria_crediticia)}</span>
                  </div>
                  <div class="text-[11px] text-secondary mt-2">Habilitado para convenios de fraccionamiento.</div>
                </div>
              </div>

              <!-- Main 8/4 Grid -->
              <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <!-- Left 8 cols: Tabla + Consumo -->
                <div class="xl:col-span-8 space-y-5">
                  <div class="obsidian-card p-5 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h2 class="text-sm font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
                        <span>Historial de Facturación y Recibos Digitales</span>
                        <span class="px-2 py-0.5 rounded bg-surface-container-high text-[11px] font-mono text-secondary">${recibos.length} Registros</span>
                      </h2>
                      <div class="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant text-[11px]">
                        <button data-rtab="todos" class="rec-tab px-2.5 py-1 rounded ${tabFiltro === 'todos' ? 'bg-primary text-background font-semibold' : 'text-on-surface-variant'} cursor-pointer">Todos (${recibos.length})</button>
                        <button data-rtab="pendientes" class="rec-tab px-2.5 py-1 rounded ${tabFiltro === 'pendientes' ? 'bg-primary text-background font-semibold' : 'text-on-surface-variant'} cursor-pointer">Pendientes (${pendientes.length})</button>
                        <button data-rtab="fraccionados" class="rec-tab px-2.5 py-1 rounded ${tabFiltro === 'fraccionados' ? 'bg-primary text-background font-semibold' : 'text-on-surface-variant'} cursor-pointer">Convenios (${convenios.length})</button>
                      </div>
                    </div>

                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs">
                        <thead class="text-[10px] uppercase text-secondary border-b border-outline-variant">
                          <tr>
                            <th class="py-2 pr-3">Periodo</th>
                            <th class="py-2 pr-3">N° Recibo Oficial</th>
                            <th class="py-2 pr-3">Consumo</th>
                            <th class="py-2 pr-3">Total (S/)</th>
                            <th class="py-2 pr-3">Vencimiento</th>
                            <th class="py-2 pr-3">Estado</th>
                            <th class="py-2 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-outline-variant/60">
                          ${
                            recibosFiltrados.length === 0
                              ? `<tr><td colspan="7" class="py-6 text-center text-secondary">No hay recibos en esta vista.</td></tr>`
                              : recibosFiltrados
                                  .map((r) => {
                                    const isPending = r.estado === 'PENDIENTE' || r.estado === 'VENCIDO';
                                    const isSel = selectedReciboId === r.id;
                                    const isExp = expandedReciboId === r.id;
                                    const badgeCls =
                                      r.estado === 'PAGADO'
                                        ? 'bg-tertiary/15 text-tertiary'
                                        : r.estado === 'FRACCIONADO'
                                        ? 'bg-primary/20 text-primary'
                                        : r.estado === 'VENCIDO'
                                        ? 'bg-error/15 text-red-300'
                                        : 'bg-amber-500/15 text-amber-300';
                                    return `
                                      <tr class="${isSel ? 'bg-primary/5' : 'hover:bg-surface-container-low'}">
                                        <td class="py-3 pr-3 font-semibold text-on-surface">${escapeHtml(r.periodo)}</td>
                                        <td class="py-3 pr-3 font-mono text-primary">${escapeHtml(r.numero_recibo)}</td>
                                        <td class="py-3 pr-3 font-mono text-on-surface-variant">${r.consumo_kwh} kWh</td>
                                        <td class="py-3 pr-3 font-mono font-bold text-on-surface">${fmtCurrency(r.total)}</td>
                                        <td class="py-3 pr-3 font-mono text-secondary">${escapeHtml(r.fecha_vencimiento)}</td>
                                        <td class="py-3 pr-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeCls}">${escapeHtml(r.estado)}</span></td>
                                        <td class="py-3 text-right space-x-1">
                                          ${
                                            isPending
                                              ? `<button data-pick-rec="${r.id}" type="button" class="px-2 py-1 rounded text-[11px] ${isSel ? 'bg-primary text-background font-bold' : 'bg-surface-container-high text-on-surface border border-outline-variant'} cursor-pointer">Cobrar</button>`
                                              : ''
                                          }
                                          <button data-expand-rec="${r.id}" type="button" title="Ver desglose normativo" class="p-1 rounded bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-on-surface cursor-pointer">
                                            <span class="material-symbols-outlined text-[15px] align-middle">unfold_more</span>
                                          </button>
                                          <button data-print-rec="${r.id}" type="button" title="Imprimir recibo" class="p-1 rounded bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-on-surface cursor-pointer">
                                            <span class="material-symbols-outlined text-[15px] align-middle">picture_as_pdf</span>
                                          </button>
                                        </td>
                                      </tr>
                                      ${
                                        isExp
                                          ? `
                                            <tr class="bg-surface-container-low">
                                              <td colspan="7" class="p-3 text-[11px]">
                                                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                  <div><span class="text-secondary">Energía Activa:</span> <strong class="font-mono text-on-surface">${fmtCurrency(r.energia_activa)}</strong></div>
                                                  <div><span class="text-secondary">Rep. &amp; Mant.:</span> <strong class="font-mono text-on-surface">${fmtCurrency(r.reposicion_mant)}</strong></div>
                                                  <div><span class="text-secondary">Cargo Fijo:</span> <strong class="font-mono text-on-surface">${fmtCurrency(r.cargo_fijo)}</strong></div>
                                                  <div><span class="text-secondary">Alumb. Púb.:</span> <strong class="font-mono text-on-surface">${fmtCurrency(r.alumbrado_publico)}</strong></div>
                                                  <div><span class="text-secondary">IGV Ref (18%):</span> <strong class="font-mono text-primary">${fmtCurrency(r.igv)}</strong></div>
                                                </div>
                                              </td>
                                            </tr>
                                          `
                                          : ''
                                      }
                                    `;
                                  })
                                  .join('')
                          }
                        </tbody>
                      </table>
                    </div>

                    ${
                      convenios.length > 0
                        ? `
                          <div class="pt-3 border-t border-outline-variant space-y-2">
                            <div class="text-[11px] uppercase tracking-wider font-semibold text-primary">Convenios de Fraccionamiento Activos</div>
                            ${convenios
                              .map(
                                (cv) => `
                                  <div class="obsidian-subcard p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div>
                                      <span class="font-mono font-bold text-on-surface">${escapeHtml(cv.codigo_acta)}</span>
                                      <span class="text-secondary ml-2">Capital: ${fmtCurrency(cv.capital_fraccionado)} • ${cv.numero_cuotas} cuotas de <strong class="text-tertiary">${fmtCurrency(cv.cuota_mensual)}</strong></span>
                                    </div>
                                    <button data-print-conv="${cv.id}" type="button" class="btn-secondary px-2.5 py-1 text-[11px] cursor-pointer">Imprimir Acta</button>
                                  </div>
                                `
                              )
                              .join('')}
                          </div>
                        `
                        : ''
                    }
                  </div>

                  <!-- Tendencia de Consumo -->
                  <div class="obsidian-card p-5">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-[18px]">show_chart</span>
                        <span>Tendencia de Consumo (kWh) - Últimos 6 meses</span>
                      </h3>
                      <span class="text-[11px] text-secondary">Suministro ${escapeHtml(sum.nis)}</span>
                    </div>
                    <div class="grid gap-3 items-end h-28 pt-2" style="grid-template-columns: repeat(${Math.max(1, consumos.length)}, minmax(0, 1fr));">
                      ${consumos
                        .map((c, idx) => {
                          const h = Math.max(18, Math.round((c.consumo_kwh / maxKwh) * 100));
                          return `
                            <div class="flex flex-col items-center justify-end h-full gap-1">
                              <span class="text-[10px] font-mono text-secondary">${c.consumo_kwh}</span>
                              <div class="w-full max-w-[40px] rounded-t ${idx === consumos.length - 1 ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant'}" style="height:${h}%"></div>
                              <span class="text-[10px] font-mono text-secondary">${escapeHtml(c.etiqueta_mes)}</span>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>
                  </div>
                </div>

                <!-- Right 4 cols: Cobranza + Convenio -->
                <div class="xl:col-span-4 space-y-5">
                  <!-- Cobranza en Ventanilla -->
                  <form id="form-cobranza" class="obsidian-card p-5 space-y-4">
                    <div class="flex items-center justify-between">
                      <h3 class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-tertiary text-[18px]">payments</span>
                        <span>Cobranza en Ventanilla</span>
                      </h3>
                      <span class="px-2 py-0.5 rounded bg-tertiary/15 text-tertiary text-[10px] font-bold">CAJA DISPONIBLE</span>
                    </div>

                    ${
                      reciboACobrar
                        ? `
                          <div>
                            <label class="block text-[10px] uppercase text-secondary mb-1">Monto a Liquidar (S/)</label>
                            <input id="pay-amount" name="monto" type="number" step="0.01" required value="${Number(reciboACobrar.total).toFixed(2)}" class="w-full obsidian-input px-3 py-2 text-lg font-bold font-mono" />
                            <div class="text-[11px] text-primary mt-1">Cubre: ${escapeHtml(reciboACobrar.numero_recibo)} (${escapeHtml(reciboACobrar.periodo)})</div>
                          </div>

                          <div>
                            <label class="block text-[10px] uppercase text-secondary mb-1.5">Método de Recaudación</label>
                            <div class="grid grid-cols-3 gap-2 text-xs">
                              <label class="cursor-pointer">
                                <input type="radio" name="metodo_pago" value="EFECTIVO" checked class="peer sr-only" />
                                <div class="obsidian-subcard p-2.5 text-center peer-checked:border-primary peer-checked:bg-primary/15">Efectivo</div>
                              </label>
                              <label class="cursor-pointer">
                                <input type="radio" name="metodo_pago" value="POS" class="peer sr-only" />
                                <div class="obsidian-subcard p-2.5 text-center peer-checked:border-primary peer-checked:bg-primary/15">Tarjeta POS</div>
                              </label>
                              <label class="cursor-pointer">
                                <input type="radio" name="metodo_pago" value="BILLETERA" class="peer sr-only" />
                                <div class="obsidian-subcard p-2.5 text-center peer-checked:border-primary peer-checked:bg-primary/15">Billetera</div>
                              </label>
                            </div>
                          </div>

                          <div class="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label class="block text-[10px] uppercase text-secondary mb-1">Comprobante</label>
                              <select name="tipo_comprobante" class="w-full obsidian-input px-2.5 py-2">
                                <option value="BOLETA">Boleta Electrónica</option>
                                <option value="FACTURA">Factura Electrónica</option>
                              </select>
                            </div>
                            <div>
                              <label class="block text-[10px] uppercase text-secondary mb-1">Destino Copia</label>
                              <select name="destino_copia" class="w-full obsidian-input px-2.5 py-2">
                                <option value="IMPRESO">Impreso (Térmico)</option>
                                <option value="EMAIL_SMS">Email + SMS</option>
                              </select>
                            </div>
                          </div>

                          <button type="submit" class="w-full btn-emerald py-2.5 px-4 text-xs flex items-center justify-center gap-2 cursor-pointer">
                            <span class="material-symbols-outlined text-[18px]">check_circle</span>
                            <span>Procesar Pago Inmediato</span>
                          </button>
                        `
                        : `
                          <div class="obsidian-subcard p-5 text-center text-xs text-tertiary">
                            <span class="material-symbols-outlined text-[28px] mb-1">verified</span>
                            <div>No hay recibos pendientes de cobro para este suministro.</div>
                          </div>
                        `
                    }
                    ${
                      ultimoPagoRealizado && ultimoPagoRealizado.suministro?.id === sum.id
                        ? `<button id="btn-print-ultimo-pago" type="button" class="w-full btn-secondary py-2 text-xs cursor-pointer">Imprimir Comprobante ${escapeHtml(ultimoPagoRealizado.pago.numero_comprobante)}</button>`
                        : ''
                    }
                  </form>

                  <!-- Convenio de Fraccionamiento -->
                  <div class="obsidian-card p-5 space-y-4">
                    <div class="flex items-center justify-between">
                      <h3 class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-[18px]">rule_folder</span>
                        <span>Convenio de Fraccionamiento</span>
                      </h3>
                      <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-[10px] font-mono text-primary">TCEA 1.85%</span>
                    </div>

                    <p class="text-[11px] text-secondary">Aplica a deudas consolidadas según resolución OSINERGMIN.</p>

                    <div>
                      <div class="flex items-center justify-between text-xs mb-1.5">
                        <span class="text-secondary">Número de Cuotas Mensuales</span>
                        <span class="font-bold text-primary">${selectedCuotas} Meses</span>
                      </div>
                      <div class="grid grid-cols-3 gap-2 text-xs">
                        ${[3, 6, 12]
                          .map(
                            (n) => `
                              <button data-cuotas="${n}" type="button" class="cuota-btn py-2 rounded-lg border ${
                                selectedCuotas === n
                                  ? 'bg-primary text-background font-bold border-primary'
                                  : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                              } cursor-pointer">${n} Cuotas</button>
                            `
                          )
                          .join('')}
                      </div>
                    </div>

                    <div class="obsidian-subcard p-3 space-y-1.5 text-xs">
                      <div class="flex justify-between"><span class="text-secondary">Capital Fraccionado:</span><span class="font-mono font-semibold text-on-surface">${fmtCurrency(convCalc.cap)}</span></div>
                      <div class="flex justify-between"><span class="text-secondary">Int. Compensatorio Est.:</span><span class="font-mono text-on-surface">${fmtCurrency(convCalc.interes)}</span></div>
                      <div class="flex justify-between pt-1.5 border-t border-outline-variant"><span class="text-on-surface font-semibold">Cuota Mensual Est.:</span><span class="font-mono font-bold text-primary">${fmtCurrency(convCalc.cuota)} / mes</span></div>
                    </div>

                    <button id="btn-crear-convenio" type="button" ${deudaTotal <= 0 ? 'disabled' : ''} class="w-full btn-secondary py-2.5 px-4 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      <span class="material-symbols-outlined text-[16px]">description</span>
                      <span>Generar Acta de Compromiso</span>
                    </button>
                  </div>
                </div>
              </div>
            `
        }
      </div>
    `;

    document.getElementById('form-comp-search').addEventListener('submit', (e) => {
      e.preventDefault();
      searchQ = document.getElementById('input-comp-search').value.trim();
      loadAndRender();
    });

    document.getElementById('btn-emitir-recibo').addEventListener('click', () => {
      const today = new Date();
      const venc = new Date(today.getTime() + 15 * 86400 * 1000).toISOString().slice(0, 10);
      ctx.showModal(
        'Emitir Nuevo Recibo de Facturación',
        `
          <form id="modal-emitir-recibo" class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-secondary mb-1">NIS del Suministro</label>
                <input name="nis" required value="${escapeHtml(sum?.nis || searchQ || '')}" placeholder="Ej: 2049182" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-secondary mb-1">Periodo</label>
                <input name="periodo" required value="Nov 2026" class="w-full obsidian-input px-3 py-2" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-secondary mb-1">Consumo (kWh)</label>
                <input name="consumo_kwh" type="number" step="0.1" required value="150" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-secondary mb-1">Energía Activa (S/)</label>
                <input name="energia_activa" type="number" step="0.01" required value="110.00" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-secondary mb-1">Rep. &amp; Mant.</label>
                <input name="reposicion_mant" type="number" step="0.01" value="4.10" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-secondary mb-1">Cargo Fijo</label>
                <input name="cargo_fijo" type="number" step="0.01" value="5.10" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-secondary mb-1">Alumb. Púb.</label>
                <input name="alumbrado_publico" type="number" step="0.01" value="14.50" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
            </div>
            <div>
              <label class="block text-secondary mb-1">Fecha de Vencimiento</label>
              <input name="fecha_vencimiento" type="date" value="${venc}" class="w-full obsidian-input px-3 py-2 font-mono" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button type="button" id="cancel-recibo" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
              <button type="submit" class="btn-emerald px-4 py-2 cursor-pointer">Emitir Recibo</button>
            </div>
          </form>
        `,
        (body) => {
          body.querySelector('#cancel-recibo').addEventListener('click', ctx.closeModal);
          body.querySelector('#modal-emitir-recibo').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
              const rec = await apiFetch('/api/comprobantes/recibos', {
                method: 'POST',
                body: JSON.stringify(Object.fromEntries(fd.entries()))
              });
              ctx.closeModal();
              searchQ = String(fd.get('nis') || '');
              ctx.showToast(`Recibo ${rec.numero_recibo} emitido (${fmtCurrency(rec.total)}).`);
              await loadAndRender();
            } catch (err) {
              ctx.showToast(err.message, 'error');
            }
          });
        }
      );
    });

    if (data) {
      container.querySelectorAll('.rec-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          tabFiltro = btn.getAttribute('data-rtab');
          loadAndRender();
        });
      });

      container.querySelectorAll('[data-pick-rec]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedReciboId = Number(btn.getAttribute('data-pick-rec'));
          loadAndRender();
        });
      });

      container.querySelectorAll('[data-expand-rec]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rid = Number(btn.getAttribute('data-expand-rec'));
          expandedReciboId = expandedReciboId === rid ? null : rid;
          loadAndRender();
        });
      });

      container.querySelectorAll('[data-print-rec]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rid = Number(btn.getAttribute('data-print-rec'));
          const rec = recibos.find((r) => r.id === rid);
          if (rec) printComprobantePago({ cliente, suministro: sum, recibo: rec, pago: null });
        });
      });

      container.querySelectorAll('[data-print-conv]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = Number(btn.getAttribute('data-print-conv'));
          const cv = convenios.find((c) => c.id === cid);
          if (cv) printActaConvenio({ convenio: cv, cliente, suministro: sum, recibos: ['Convenio registrado'] });
        });
      });

      const btnPrintUltimo = document.getElementById('btn-print-ultimo-pago');
      if (btnPrintUltimo && ultimoPagoRealizado) {
        btnPrintUltimo.addEventListener('click', () => printComprobantePago(ultimoPagoRealizado));
      }

      document.getElementById('form-cobranza').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!reciboACobrar) return;
        const fd = new FormData(e.target);
        try {
          const res = await apiFetch('/api/comprobantes/pagos', {
            method: 'POST',
            body: JSON.stringify({
              recibo_id: reciboACobrar.id,
              monto: Number(fd.get('monto')),
              metodo_pago: fd.get('metodo_pago'),
              tipo_comprobante: fd.get('tipo_comprobante'),
              destino_copia: fd.get('destino_copia')
            })
          });
          ultimoPagoRealizado = res;
          ctx.showToast(`Pago ${res.pago.codigo_operacion} procesado (${res.pago.numero_comprobante}).`);
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });

      container.querySelectorAll('.cuota-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedCuotas = Number(btn.getAttribute('data-cuotas'));
          loadAndRender();
        });
      });

      document.getElementById('btn-crear-convenio').addEventListener('click', async () => {
        try {
          const res = await apiFetch('/api/comprobantes/convenios', {
            method: 'POST',
            body: JSON.stringify({
              suministro_id: sum.id,
              numero_cuotas: selectedCuotas
            })
          });
          ctx.showToast(`Convenio ${res.convenio.codigo_acta} generado (${selectedCuotas} cuotas).`);
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });
    }
  }

  await loadAndRender();
}
