import { apiFetch, escapeHtml, fmtCurrency, getToken } from '../api.js';

export async function renderDatosClientesView(container, ctx) {
  let searchQ = '';
  let estadoFiltro = 'todos';

  async function loadAndRender() {
    const qs = new URLSearchParams();
    if (searchQ) qs.set('q', searchQ);
    if (estadoFiltro) qs.set('estado', estadoFiltro);

    const data = await apiFetch(`/api/clientes/maestro?${qs.toString()}`);
    const { kpis, items } = data;

    container.innerHTML = `
      <div class="space-y-5">
        <!-- Header -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-primary">Datos Maestros • Administración de Padrón</div>
            <h1 class="text-2xl font-bold tracking-tight text-on-surface mt-0.5">Tabla Maestra de Clientes</h1>
            <p class="text-xs text-secondary mt-0.5">Agrega, edita, deshabilita, consulta o elimina clientes registrados en PostgreSQL.</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-maestro-csv" type="button" class="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">download</span>
              <span>Exportar CSV</span>
            </button>
            <button id="btn-maestro-agregar" type="button" class="btn-emerald px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">person_add</span>
              <span>+ Agregar Cliente</span>
            </button>
          </div>
        </div>

        <!-- 4 KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Total Clientes</div>
              <div class="text-2xl font-bold font-mono text-on-surface mt-1">${kpis.total}</div>
            </div>
            <div class="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>

          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Activos</div>
              <div class="text-2xl font-bold font-mono text-tertiary mt-1">${kpis.activos}</div>
            </div>
            <div class="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>

          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Deshabilitados</div>
              <div class="text-2xl font-bold font-mono text-amber-400 mt-1">${kpis.inactivos}</div>
            </div>
            <div class="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-amber-400">
              <span class="material-symbols-outlined text-[18px]">person_off</span>
            </div>
          </div>

          <div class="obsidian-card p-4 flex items-center justify-between">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-secondary font-semibold">Deuda Total Cartera</div>
              <div class="text-2xl font-bold font-mono ${kpis.deuda_total_cartera > 0 ? 'text-error' : 'text-on-surface'} mt-1">${fmtCurrency(kpis.deuda_total_cartera)}</div>
            </div>
            <div class="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-on-surface-variant">
              <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="obsidian-card p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 text-xs">
            ${[
              ['todos', `Todos (${kpis.total})`],
              ['activos', `Activos (${kpis.activos})`],
              ['inactivos', `Deshabilitados (${kpis.inactivos})`]
            ]
              .map(
                ([val, label]) => `
                  <button data-est="${val}" class="maestro-est-tab px-3 py-1.5 rounded-lg ${
                    estadoFiltro === val
                      ? 'bg-primary-container text-white font-semibold'
                      : 'bg-surface-container-low text-on-surface-variant border border-outline-variant hover:text-on-surface'
                  } cursor-pointer">${label}</button>
                `
              )
              .join('')}
          </div>

          <form id="form-maestro-search" class="flex items-center gap-2">
            <div class="relative">
              <span class="material-symbols-outlined text-[16px] text-secondary absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
              <input
                id="input-maestro-search"
                type="text"
                value="${escapeHtml(searchQ)}"
                placeholder="Buscar por DNI/RUC, nombre, NIS o correo..."
                class="obsidian-input pl-8 pr-3 py-1.5 text-xs w-72 font-mono"
              />
            </div>
            <button type="submit" class="btn-primary px-4 py-1.5 text-xs cursor-pointer">Filtrar</button>
          </form>
        </div>

        <!-- Clients Table -->
        <div class="obsidian-card p-5">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-[10px] uppercase text-secondary border-b border-outline-variant">
                <tr>
                  <th class="py-2.5 pr-3">Cliente / Documento</th>
                  <th class="py-2.5 pr-3">Contacto</th>
                  <th class="py-2.5 pr-3">Suministro / NIS</th>
                  <th class="py-2.5 pr-3">Cat. / Score</th>
                  <th class="py-2.5 pr-3">Deuda</th>
                  <th class="py-2.5 pr-3">Estado</th>
                  <th class="py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/60">
                ${
                  items.length === 0
                    ? `<tr><td colspan="7" class="py-12 text-center text-secondary">No hay clientes registrados para este filtro. Haz clic en <strong>+ Agregar Cliente</strong> para registrar uno.</td></tr>`
                    : items
                        .map((c) => {
                          const badgeEstado = c.activo
                            ? 'bg-tertiary/15 text-tertiary border border-tertiary/40'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/40';
                          return `
                            <tr class="hover:bg-surface-container-low ${!c.activo ? 'opacity-75' : ''}">
                              <td class="py-3 pr-3">
                                <div class="font-semibold text-on-surface">${escapeHtml(c.nombres_apellidos)}</div>
                                <div class="text-[11px] font-mono text-primary mt-0.5">${escapeHtml(c.tipo_documento)}: ${escapeHtml(c.dni_ruc)}</div>
                              </td>
                              <td class="py-3 pr-3">
                                <div class="text-on-surface-variant font-mono">${escapeHtml(c.telefono || 'Sin teléfono')}</div>
                                <div class="text-[11px] text-secondary truncate max-w-[190px]">${escapeHtml(c.correo || 'Sin correo')}</div>
                              </td>
                              <td class="py-3 pr-3">
                                <div class="font-mono font-semibold text-on-surface">${escapeHtml(c.nis || 'Sin NIS')}</div>
                                <div class="text-[11px] text-secondary">${escapeHtml(c.numero_medidor || '-')} • ${escapeHtml(c.tarifa || '-')}</div>
                              </td>
                              <td class="py-3 pr-3">
                                <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant font-mono text-[10px] font-bold text-primary">CAT. ${escapeHtml(c.categoria_crediticia)}</span>
                                <span class="text-[11px] font-mono text-secondary ml-1">${c.score_crediticio}/100</span>
                              </td>
                              <td class="py-3 pr-3 font-mono font-semibold ${c.deuda_total > 0 ? 'text-error' : 'text-tertiary'}">${fmtCurrency(c.deuda_total)}</td>
                              <td class="py-3 pr-3">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeEstado}">${c.activo ? 'ACTIVO' : 'DESHABILITADO'}</span>
                              </td>
                              <td class="py-3 text-right">
                                <div class="flex flex-wrap items-center justify-end gap-1">
                                  ${
                                    c.nis
                                      ? `<button data-ver-360="${escapeHtml(c.nis)}" type="button" title="Ver Ficha 360°" class="btn-secondary px-2 py-1 text-[11px] flex items-center gap-1 cursor-pointer">
                                           <span class="material-symbols-outlined text-[14px] text-primary">visibility</span>
                                           <span>360°</span>
                                         </button>`
                                      : ''
                                  }
                                  <button data-edit-cli="${c.id}" type="button" title="Editar cliente" class="btn-secondary px-2 py-1 text-[11px] flex items-center gap-1 cursor-pointer">
                                    <span class="material-symbols-outlined text-[14px]">edit</span>
                                    <span>Editar</span>
                                  </button>
                                  <button data-toggle-cli="${c.id}" data-next-activo="${!c.activo}" type="button" title="${c.activo ? 'Deshabilitar cliente' : 'Habilitar cliente'}" class="btn-secondary px-2 py-1 text-[11px] flex items-center gap-1 cursor-pointer ${c.activo ? 'hover:border-amber-500/50 text-amber-300' : 'hover:border-tertiary/50 text-tertiary'}">
                                    <span class="material-symbols-outlined text-[14px]">${c.activo ? 'block' : 'check_circle'}</span>
                                    <span>${c.activo ? 'Deshabilitar' : 'Habilitar'}</span>
                                  </button>
                                  <button data-del-cli="${c.id}" data-del-name="${escapeHtml(c.nombres_apellidos)}" type="button" title="Eliminar cliente" class="btn-secondary px-2 py-1 text-[11px] flex items-center gap-1 cursor-pointer hover:border-error/50 text-red-300">
                                    <span class="material-symbols-outlined text-[14px]">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Listeners
    container.querySelectorAll('.maestro-est-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        estadoFiltro = btn.getAttribute('data-est') || 'todos';
        loadAndRender();
      });
    });

    document.getElementById('form-maestro-search').addEventListener('submit', (e) => {
      e.preventDefault();
      searchQ = document.getElementById('input-maestro-search').value.trim();
      loadAndRender();
    });

    document.getElementById('btn-maestro-csv').addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/clientes/maestro/exportar?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error('Error al exportar clientes.');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'maestro_clientes_seal.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        ctx.showToast('Listado de clientes exportado en CSV.');
      } catch (err) {
        ctx.showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-maestro-agregar').addEventListener('click', () => {
      ctx.showModal(
        'Agregar Nuevo Cliente y Suministro',
        `
          <form id="modal-maestro-add" class="space-y-3 text-xs">
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
                <label class="block text-secondary mb-1">NIS Suministro</label>
                <input name="nis" required placeholder="Ej: 2099881" class="w-full obsidian-input px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block text-secondary mb-1">N° Medidor</label>
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
              <input name="direccion" required placeholder="Av. Lambramani 320, Arequipa" class="w-full obsidian-input px-3 py-2" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button type="button" id="cancel-m-add" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
              <button type="submit" class="btn-emerald px-4 py-2 cursor-pointer">Guardar Cliente</button>
            </div>
          </form>
        `,
        (body) => {
          body.querySelector('#cancel-m-add').addEventListener('click', ctx.closeModal);
          body.querySelector('#modal-maestro-add').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
              const created = await apiFetch('/api/clientes', {
                method: 'POST',
                body: JSON.stringify(Object.fromEntries(fd.entries()))
              });
              ctx.closeModal();
              ctx.showToast(`Cliente ${created.cliente.nombres_apellidos} registrado.`);
              await loadAndRender();
            } catch (err) {
              ctx.showToast(err.message, 'error');
            }
          });
        }
      );
    });

    container.querySelectorAll('[data-ver-360]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.navigate('clientes', { q: btn.getAttribute('data-ver-360') });
      });
    });

    container.querySelectorAll('[data-edit-cli]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = Number(btn.getAttribute('data-edit-cli'));
        const row = items.find((i) => i.id === cid);
        if (!row) return;
        ctx.showModal(
          `Editar Cliente — ${row.nombres_apellidos}`,
          `
            <form id="modal-maestro-edit" class="space-y-3 text-xs">
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-secondary mb-1">Tipo Doc.</label>
                  <select name="tipo_documento" class="w-full obsidian-input px-2.5 py-2">
                    <option value="DNI" ${row.tipo_documento === 'DNI' ? 'selected' : ''}>DNI</option>
                    <option value="RUC" ${row.tipo_documento === 'RUC' ? 'selected' : ''}>RUC</option>
                    <option value="CE" ${row.tipo_documento === 'CE' ? 'selected' : ''}>CE</option>
                  </select>
                </div>
                <div class="col-span-2">
                  <label class="block text-secondary mb-1">DNI / RUC</label>
                  <input name="dni_ruc" required value="${escapeHtml(row.dni_ruc)}" class="w-full obsidian-input px-3 py-2 font-mono" />
                </div>
              </div>
              <div>
                <label class="block text-secondary mb-1">Nombres / Razón Social</label>
                <input name="nombres_apellidos" required value="${escapeHtml(row.nombres_apellidos)}" class="w-full obsidian-input px-3 py-2" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-secondary mb-1">Teléfono</label>
                  <input name="telefono" value="${escapeHtml(row.telefono || '')}" class="w-full obsidian-input px-3 py-2" />
                </div>
                <div>
                  <label class="block text-secondary mb-1">Correo</label>
                  <input name="correo" type="email" value="${escapeHtml(row.correo || '')}" class="w-full obsidian-input px-3 py-2" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-secondary mb-1">Categoría Crediticia</label>
                  <select name="categoria_crediticia" class="w-full obsidian-input px-3 py-2">
                    <option value="A" ${row.categoria_crediticia === 'A' ? 'selected' : ''}>Categoría A</option>
                    <option value="B" ${row.categoria_crediticia === 'B' ? 'selected' : ''}>Categoría B</option>
                    <option value="C" ${row.categoria_crediticia === 'C' ? 'selected' : ''}>Categoría C</option>
                  </select>
                </div>
                <div>
                  <label class="block text-secondary mb-1">Score (0 - 100)</label>
                  <input name="score_crediticio" type="number" min="0" max="100" value="${row.score_crediticio}" class="w-full obsidian-input px-3 py-2 font-mono" />
                </div>
              </div>
              <label class="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" name="notificaciones_sms" ${row.notificaciones_sms ? 'checked' : ''} class="accent-primary" />
                <span>Notificaciones SMS / WhatsApp Activas</span>
              </label>
              <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button type="button" id="cancel-m-edit" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
                <button type="submit" class="btn-primary px-4 py-2 cursor-pointer">Actualizar Cliente</button>
              </div>
            </form>
          `,
          (body) => {
            body.querySelector('#cancel-m-edit').addEventListener('click', ctx.closeModal);
            body.querySelector('#modal-maestro-edit').addEventListener('submit', async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await apiFetch(`/api/clientes/${row.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    tipo_documento: fd.get('tipo_documento'),
                    dni_ruc: fd.get('dni_ruc'),
                    nombres_apellidos: fd.get('nombres_apellidos'),
                    telefono: fd.get('telefono'),
                    correo: fd.get('correo'),
                    categoria_crediticia: fd.get('categoria_crediticia'),
                    score_crediticio: Number(fd.get('score_crediticio')),
                    notificaciones_sms: fd.get('notificaciones_sms') === 'on'
                  })
                });
                ctx.closeModal();
                ctx.showToast('Datos del cliente actualizados.');
                await loadAndRender();
              } catch (err) {
                ctx.showToast(err.message, 'error');
              }
            });
          }
        );
      });
    });

    container.querySelectorAll('[data-toggle-cli]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cid = Number(btn.getAttribute('data-toggle-cli'));
        const nextActivo = btn.getAttribute('data-next-activo') === 'true';
        try {
          await apiFetch(`/api/clientes/${cid}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ activo: nextActivo })
          });
          ctx.showToast(nextActivo ? 'Cliente habilitado.' : 'Cliente deshabilitado.', 'info');
          await loadAndRender();
        } catch (err) {
          ctx.showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-del-cli]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = Number(btn.getAttribute('data-del-cli'));
        const nombre = btn.getAttribute('data-del-name');
        ctx.showModal(
          'Confirmar Eliminación de Cliente',
          `
            <div class="space-y-4 text-xs">
              <p class="text-on-surface-variant">¿Deseas eliminar permanentemente a <strong class="text-on-surface">${escapeHtml(nombre)}</strong> junto con sus suministros, recibos y tickets asociados?</p>
              <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant">
                <button type="button" id="cancel-m-del" class="btn-secondary px-4 py-2 cursor-pointer">Cancelar</button>
                <button type="button" id="confirm-m-del" class="px-4 py-2 rounded-lg bg-error text-white font-semibold cursor-pointer">Eliminar Definitivamente</button>
              </div>
            </div>
          `,
          (body) => {
            body.querySelector('#cancel-m-del').addEventListener('click', ctx.closeModal);
            body.querySelector('#confirm-m-del').addEventListener('click', async () => {
              try {
                await apiFetch(`/api/clientes/${cid}`, { method: 'DELETE' });
                ctx.closeModal();
                ctx.showToast(`Cliente ${nombre} eliminado.`);
                await loadAndRender();
              } catch (err) {
                ctx.showToast(err.message, 'error');
              }
            });
          }
        );
      });
    });
  }

  await loadAndRender();
}
