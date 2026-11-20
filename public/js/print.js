import { escapeHtml, fmtCurrency, fmtDateTime } from './api.js';

export function printHtmlDocument(html) {
  const sheet = document.getElementById('print-sheet');
  sheet.innerHTML = html;
  window.print();
}

export function printComprobantePago({ cliente, suministro, recibo, pago }) {
  printHtmlDocument(`
    <div style="max-width:720px;margin:0 auto;border:1px solid #d1d5db;padding:28px;border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:18px;">
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:700;">SEAL / SACS SUMINISTROS ELÉCTRICOS</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#4b5563;">Sociedad Eléctrica del Sur Oeste S.A. — RUC 20100188628</p>
        </div>
        <div style="text-align:right;border:1px solid #111827;padding:8px 14px;border-radius:6px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;">${escapeHtml(pago?.tipo_comprobante || 'RECIBO DE ENERGÍA')}</div>
          <div style="font-size:15px;font-weight:700;font-family:monospace;">${escapeHtml(pago?.numero_comprobante || recibo.numero_recibo)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;margin-bottom:18px;">
        <div><strong>Titular:</strong> ${escapeHtml(cliente.nombres_apellidos)}</div>
        <div><strong>DNI / RUC:</strong> ${escapeHtml(cliente.dni_ruc)}</div>
        <div><strong>N° Suministro (NIS):</strong> ${escapeHtml(suministro.nis)}</div>
        <div><strong>N° Medidor:</strong> ${escapeHtml(suministro.numero_medidor)}</div>
        <div><strong>Dirección:</strong> ${escapeHtml(suministro.direccion)}</div>
        <div><strong>Periodo Facturado:</strong> ${escapeHtml(recibo.periodo)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:8px;border:1px solid #d1d5db;">Concepto Normativo</th>
            <th style="text-align:right;padding:8px;border:1px solid #d1d5db;">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px;border:1px solid #d1d5db;">Energía Activa (${recibo.consumo_kwh} kWh)</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${fmtCurrency(recibo.energia_activa)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #d1d5db;">Reposición y Mantenimiento</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${fmtCurrency(recibo.reposicion_mant)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #d1d5db;">Cargo Fijo Regulado</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${fmtCurrency(recibo.cargo_fijo)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #d1d5db;">Alumbrado Público</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${fmtCurrency(recibo.alumbrado_publico)}</td></tr>
          <tr style="font-weight:700;background:#f9fafb;"><td style="padding:10px;border:1px solid #d1d5db;">TOTAL (${escapeHtml(recibo.estado)})</td><td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${fmtCurrency(recibo.total)}</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#4b5563;">IGV Referencial (18%): ${fmtCurrency(recibo.igv)} | Recibo: ${escapeHtml(recibo.numero_recibo)}${pago ? ` | Operación: ${escapeHtml(pago.codigo_operacion)} (${escapeHtml(pago.metodo_pago)})` : ''}</p>
      <p style="font-size:11px;color:#6b7280;margin-top:20px;">Emitido desde SACS Ventanilla el ${fmtDateTime(new Date().toISOString())}</p>
    </div>
  `);
}

export function printHojaReclamacion(ticket) {
  printHtmlDocument(`
    <div style="max-width:740px;margin:0 auto;border:1px solid #111827;padding:28px;">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:16px;">
        <div>
          <h1 style="margin:0;font-size:18px;font-weight:700;">HOJA DE RECLAMACIÓN / CONSTANCIA DE ATENCIÓN</h1>
          <p style="margin:4px 0 0;font-size:12px;">Normativa Osinergmin / NTCSE — Sistema SACS SEAL</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px;font-weight:700;font-family:monospace;">${escapeHtml(ticket.codigo)}</div>
          <div style="font-size:11px;">Canal: ${escapeHtml(ticket.canal)} | Estado: ${escapeHtml(ticket.estado)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:16px;">
        <div><strong>Titular:</strong> ${escapeHtml(ticket.cliente_nombre)}</div>
        <div><strong>DNI / RUC:</strong> ${escapeHtml(ticket.dni_ruc)}</div>
        <div><strong>N° Suministro (NIS):</strong> ${escapeHtml(ticket.nis)}</div>
        <div><strong>Medidor / Tarifa:</strong> ${escapeHtml(ticket.numero_medidor)} / ${escapeHtml(ticket.tarifa)}</div>
        <div><strong>Dirección:</strong> ${escapeHtml(ticket.direccion)}</div>
        <div><strong>Fecha Registro:</strong> ${fmtDateTime(ticket.creado_en)}</div>
      </div>
      <div style="border:1px solid #d1d5db;padding:12px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#4b5563;">Asunto y Descripción del Caso</div>
        <p style="margin:6px 0 4px;font-weight:700;">${escapeHtml(ticket.asunto)}</p>
        <p style="margin:0;font-size:13px;">${escapeHtml(ticket.descripcion)}</p>
      </div>
      <div style="border:1px solid #d1d5db;padding:12px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#4b5563;">Tipificación y Dictamen Técnico</div>
        <p style="margin:6px 0 4px;font-size:13px;"><strong>Tipificación:</strong> ${escapeHtml(ticket.tipificacion_normativa || 'En evaluación')}</p>
        <p style="margin:0 0 4px;font-size:13px;"><strong>Acción Inmediata:</strong> ${escapeHtml(ticket.accion_inmediata || 'Pendiente')}</p>
        <p style="margin:0;font-size:13px;"><strong>Dictamen:</strong> ${escapeHtml(ticket.dictamen_tecnico || 'Sin dictamen final aún')}</p>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:44px;font-size:12px;">
        <div style="border-top:1px solid #111827;width:42%;text-align:center;padding-top:6px;">Firma del Cliente / Solicitante</div>
        <div style="border-top:1px solid #111827;width:42%;text-align:center;padding-top:6px;">Operador: ${escapeHtml(ticket.operador_nombre || 'Ventanilla SACS')}</div>
      </div>
    </div>
  `);
}

export function printActaConvenio({ convenio, cliente, suministro, recibos }) {
  printHtmlDocument(`
    <div style="max-width:720px;margin:0 auto;border:1px solid #111827;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:18px;">ACTA DE COMPROMISO — CONVENIO DE FRACCIONAMIENTO</h1>
      <p style="margin:0 0 18px;font-size:12px;color:#4b5563;">Código de Acta: <strong>${escapeHtml(convenio.codigo_acta)}</strong> | Fecha: ${fmtDateTime(convenio.creado_en)}</p>
      <p style="font-size:13px;">Titular: <strong>${escapeHtml(cliente.nombres_apellidos)}</strong> (DNI/RUC: ${escapeHtml(cliente.dni_ruc)}) — Suministro NIS: <strong>${escapeHtml(suministro.nis)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #d1d5db;">Capital Fraccionado</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;font-weight:700;">${fmtCurrency(convenio.capital_fraccionado)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #d1d5db;">TCEA Aplicada</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${convenio.tcea_pct}%</td></tr>
        <tr><td style="padding:8px;border:1px solid #d1d5db;">Interés Compensatorio Estimado</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${fmtCurrency(convenio.interes_estimado)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #d1d5db;">Número de Cuotas Mensuales</td><td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${convenio.numero_cuotas} cuotas</td></tr>
        <tr style="background:#f3f4f6;font-weight:700;"><td style="padding:10px;border:1px solid #d1d5db;">Cuota Mensual Comprometida</td><td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${fmtCurrency(convenio.cuota_mensual)} / mes</td></tr>
      </table>
      <p style="font-size:12px;">Recibos incluidos: ${escapeHtml(Array.isArray(recibos) ? recibos.join(', ') : '')}</p>
      <div style="display:flex;justify-content:space-between;margin-top:48px;font-size:12px;">
        <div style="border-top:1px solid #111827;width:42%;text-align:center;padding-top:6px;">Firma / Huella del Titular</div>
        <div style="border-top:1px solid #111827;width:42%;text-align:center;padding-top:6px;">Ventanilla de Recaudación SACS</div>
      </div>
    </div>
  `);
}

export function printFicha360(ficha) {
  const { cliente, suministro, deuda_total, inspecciones, autorizados } = ficha;
  printHtmlDocument(`
    <div style="max-width:740px;margin:0 auto;border:1px solid #111827;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:18px;">FICHA CATASTRAL 360° DE SUMINISTRO #${escapeHtml(suministro.nis)}</h1>
      <p style="margin:0 0 16px;font-size:12px;color:#4b5563;">SACS Catastro Eléctrico | Impreso el ${fmtDateTime(new Date().toISOString())}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-bottom:16px;">
        <div><strong>Titular:</strong> ${escapeHtml(cliente.nombres_apellidos)}</div>
        <div><strong>DNI / RUC:</strong> ${escapeHtml(cliente.dni_ruc)}</div>
        <div><strong>Dirección:</strong> ${escapeHtml(suministro.direccion)} (${escapeHtml(suministro.sector)})</div>
        <div><strong>Estado Servicio:</strong> ${escapeHtml(suministro.estado_servicio)}</div>
        <div><strong>Medidor:</strong> ${escapeHtml(suministro.numero_medidor)} (${escapeHtml(suministro.tipo_medidor)})</div>
        <div><strong>Tarifa / Potencia:</strong> ${escapeHtml(suministro.tarifa)} • ${suministro.potencia_contratada_kw} kW</div>
        <div><strong>Subestación / Alimentador:</strong> ${escapeHtml(suministro.subestacion_sed)} / ${escapeHtml(suministro.alimentador_mt)}</div>
        <div><strong>Saldo Deudor:</strong> ${fmtCurrency(deuda_total)}</div>
      </div>
      <h3 style="font-size:13px;border-bottom:1px solid #d1d5db;padding-bottom:4px;">Inspecciones y Certificaciones (${inspecciones.length})</h3>
      <ul style="font-size:12px;padding-left:18px;">
        ${inspecciones.map((i) => `<li>${escapeHtml(i.codigo_certificado)} (${escapeHtml(i.tipo)}) — ${escapeHtml(i.estado)} (${escapeHtml(i.fecha_ensayo)})</li>`).join('') || '<li>Sin inspecciones registradas</li>'}
      </ul>
      <h3 style="font-size:13px;border-bottom:1px solid #d1d5db;padding-bottom:4px;margin-top:12px;">Personas Autorizadas (${autorizados.length})</h3>
      <ul style="font-size:12px;padding-left:18px;">
        ${autorizados.map((a) => `<li>${escapeHtml(a.nombre_completo)} — ${escapeHtml(a.relacion)} (DNI: ${escapeHtml(a.dni || '-')}, Tel: ${escapeHtml(a.telefono || '-')})</li>`).join('')}
      </ul>
    </div>
  `);
}
