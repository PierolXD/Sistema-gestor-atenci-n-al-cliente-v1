import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app';
import { pool, query } from '../src/shared/database/connection';
import { initializeDatabase } from '../src/shared/database/init';

async function requestJson(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function runTests() {
  await initializeDatabase();

  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  assert(addr && typeof addr === 'object', 'Servidor de pruebas no expuso puerto');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const createdTurnoIds: number[] = [];
  const createdClienteIds: number[] = [];
  let touchedTurnoId: number | null = null;
  let adminVentanillaId: number | null = null;

  try {
    console.log('1. Verificando /api/health y seguridad JWT...');
    const health = await requestJson(baseUrl, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.db, 'postgresql');

    const unauth = await requestJson(baseUrl, '/api/turnos');
    assert.equal(unauth.status, 401);

    console.log('2. Verificando Login ADMIN/ADMIN y estado inicial limpio...');
    const loginAdmin = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { codigo_empleado: 'ADMIN', password: 'ADMIN' }
    });
    assert.equal(loginAdmin.status, 200);
    assert.equal(loginAdmin.body.data.usuario.codigo_empleado, 'ADMIN');
    const adminToken: string = loginAdmin.body.data.token;
    adminVentanillaId = loginAdmin.body.data.ventanilla?.id ?? null;

    const meRes = await requestJson(baseUrl, '/api/auth/me', { token: adminToken });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.usuario.rol, 'ADMIN');

    const turnosInit = await requestJson(baseUrl, '/api/turnos', { token: adminToken });
    assert.equal(turnosInit.status, 200);
    assert(Array.isArray(turnosInit.body.data.cola));

    const compInit = await requestJson(baseUrl, '/api/comprobantes/consulta?q=', { token: adminToken });
    assert.equal(compInit.status, 200);

    console.log('3. Verificando Módulo Clientes 360° (alta + consulta + edición + ping + inspección + autorizado)...');
    const suffix = String(Date.now()).slice(-6);
    const nuevoCli = await requestJson(baseUrl, '/api/clientes', {
      method: 'POST',
      token: adminToken,
      body: {
        dni_ruc: `79${suffix}`,
        tipo_documento: 'DNI',
        nombres_apellidos: 'Prueba Automatizada SACS',
        telefono: '+51 999 111 222',
        correo: 'test@sacs.pe',
        nis: `99${suffix}`,
        numero_medidor: `MED-T-${suffix}`,
        direccion: 'Av. Pruebas 123, Arequipa'
      }
    });
    assert.equal(nuevoCli.status, 201);
    const testClienteId: number = nuevoCli.body.data.cliente.id;
    const testSuministroId: number = nuevoCli.body.data.suministro.id;
    const testNis: string = nuevoCli.body.data.suministro.nis;
    createdClienteIds.push(testClienteId);

    const updCli = await requestJson(baseUrl, `/api/clientes/${testClienteId}`, {
      method: 'PUT',
      token: adminToken,
      body: { telefono: '+51 999 333 444' }
    });
    assert.equal(updCli.status, 200);
    assert.equal(updCli.body.data.telefono, '+51 999 333 444');

    const pingRes = await requestJson(baseUrl, `/api/clientes/suministros/${testSuministroId}/ping`, {
      method: 'POST',
      token: adminToken
    });
    assert.equal(pingRes.status, 200);
    assert(pingRes.body.data.latencia_ms > 0);

    const inspRes = await requestJson(baseUrl, `/api/clientes/suministros/${testSuministroId}/inspecciones`, {
      method: 'POST',
      token: adminToken,
      body: { tipo: 'CONTRASTE', laboratorio_o_ot: 'LAB Test' }
    });
    assert.equal(inspRes.status, 201);

    const autRes = await requestJson(baseUrl, `/api/clientes/${testClienteId}/autorizados`, {
      method: 'POST',
      token: adminToken,
      body: { nombre_completo: 'Contacto Test', relacion: 'Apoderado', dni: '44556677', poder_legal: true }
    });
    assert.equal(autRes.status, 201);

    console.log('3b. Verificando Datos -> Tabla Maestra de Clientes (maestro, deshabilitar, habilitar, CSV)...');
    const maestroRes = await requestJson(baseUrl, '/api/clientes/maestro?estado=todos', { token: adminToken });
    assert.equal(maestroRes.status, 200);
    assert(maestroRes.body.data.items.some((c: any) => c.id === testClienteId && c.activo === true));

    const deshabRes = await requestJson(baseUrl, `/api/clientes/${testClienteId}/estado`, {
      method: 'PATCH',
      token: adminToken,
      body: { activo: false }
    });
    assert.equal(deshabRes.status, 200);
    assert.equal(deshabRes.body.data.activo, false);

    const habRes = await requestJson(baseUrl, `/api/clientes/${testClienteId}/estado`, {
      method: 'PATCH',
      token: adminToken,
      body: { activo: true }
    });
    assert.equal(habRes.status, 200);
    assert.equal(habRes.body.data.activo, true);

    const maestroCsvRes = await fetch(`${baseUrl}/api/clientes/maestro/exportar`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(maestroCsvRes.status, 200);
    const maestroCsv = await maestroCsvRes.text();
    assert(maestroCsv.includes('REPORTE MAESTRO DE CLIENTES'));

    console.log('4. Verificando Módulo Turnos (emitir -> llamarSiguiente -> nota -> finalizar)...');
    const emitTurno = await requestJson(baseUrl, '/api/turnos', {
      method: 'POST',
      token: adminToken,
      body: {
        nombre_visitante: 'Prueba Automatizada SACS',
        dni_visitante: `79${suffix}`,
        nis_visitante: testNis,
        modulo_cola: 'A',
        motivo_visita: 'Consulta de deuda / recibo'
      }
    });
    assert.equal(emitTurno.status, 201);
    const testTurnoId: number = emitTurno.body.data.id;
    createdTurnoIds.push(testTurnoId);

    const callNext = await requestJson(baseUrl, `/api/turnos/${testTurnoId}/atender`, {
      method: 'PATCH',
      token: adminToken
    });
    assert.equal(callNext.status, 200);
    touchedTurnoId = callNext.body.data.id;
    assert.equal(callNext.body.data.estado, 'EN_ATENCION');

    const notaRes = await requestJson(baseUrl, `/api/turnos/${touchedTurnoId}/notas`, {
      method: 'POST',
      token: adminToken,
      body: { nota: 'Nota en vivo durante atención de prueba' }
    });
    assert.equal(notaRes.status, 200);
    assert(notaRes.body.data.notas_atencion.includes('Nota en vivo'));

    const finRes = await requestJson(baseUrl, `/api/turnos/${touchedTurnoId}/finalizar`, {
      method: 'PATCH',
      token: adminToken,
      body: { resolucion_resumen: 'Atención de prueba finalizada OK', calificacion_csat: 5 }
    });
    assert.equal(finRes.status, 200);
    assert.equal(finRes.body.data.estado, 'FINALIZADO');

    console.log('5. Verificando Tickets + Despacho automático de OT + Liquidación + Escalamiento Reclamo...');
    const createTk = await requestJson(baseUrl, '/api/tickets', {
      method: 'POST',
      token: adminToken,
      body: {
        nis_o_dni: testNis,
        canal: 'PRESENCIAL',
        prioridad: 'URGENTE',
        asunto: 'Corte de luz de prueba',
        descripcion: 'Falla simulada en acometida de prueba.'
      }
    });
    assert.equal(createTk.status, 201);
    const tkId: number = createTk.body.data.id;

    const msgTk = await requestJson(baseUrl, `/api/tickets/${tkId}/mensajes`, {
      method: 'POST',
      token: adminToken,
      body: { autor_tipo: 'AGENTE', mensaje: 'Verificando incidencia' }
    });
    assert.equal(msgTk.status, 201);

    const resolverTkOt = await requestJson(baseUrl, `/api/tickets/${tkId}/resolver`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        tipificacion_normativa: 'REC-ELEC-04: Falla Media Tensión',
        accion_inmediata: 'DESPACHAR_CUADRILLA',
        dictamen_tecnico: 'Se despacha cuadrilla de emergencia.',
        cerrar: true
      }
    });
    assert.equal(resolverTkOt.status, 200);
    assert.equal(resolverTkOt.body.data.estado, 'EN_CUADRILLA');
    assert(resolverTkOt.body.data.ot_vinculada?.id, 'Debe generar OT vinculada automáticamente');
    const otId: number = resolverTkOt.body.data.ot_vinculada.id;

    const eventoOt = await requestJson(baseUrl, `/api/ordenes-trabajo/${otId}/eventos`, {
      method: 'POST',
      token: adminToken,
      body: { tipo_evento: 'ARRIBO', descripcion: 'Cuadrilla llegó al suministro de prueba.' }
    });
    assert.equal(eventoOt.status, 201);

    const liquidarOt = await requestJson(baseUrl, `/api/ordenes-trabajo/${otId}/etapa`, {
      method: 'PATCH',
      token: adminToken,
      body: { etapa: 'LIQUIDADA', materiales_imputados: '1x Fusible Test', validacion_cliente: 'Conforme' }
    });
    assert.equal(liquidarOt.status, 200);
    assert.equal(liquidarOt.body.data.etapa, 'LIQUIDADA');
    assert(liquidarOt.body.data.acta_digital_hash);

    const tkAfterOt = await requestJson(baseUrl, `/api/tickets/${tkId}`, { token: adminToken });
    assert.equal(tkAfterOt.body.data.estado, 'RESUELTO');

    // Escalamiento a reclamo formal
    const createTk2 = await requestJson(baseUrl, '/api/tickets', {
      method: 'POST',
      token: adminToken,
      body: {
        nis_o_dni: testNis,
        canal: 'PORTAL_WEB',
        prioridad: 'NORMAL',
        asunto: 'Reclamo consumo test',
        descripcion: 'Disconformidad de prueba.'
      }
    });
    const tk2Id: number = createTk2.body.data.id;
    const escRes = await requestJson(baseUrl, `/api/tickets/${tk2Id}/resolver`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        tipificacion_normativa: 'REC-COM-01: Inconformidad Medición',
        accion_inmediata: 'ESCALAR_RECLAMO',
        dictamen_tecnico: 'Escalado a instancia 1.',
        cerrar: true
      }
    });
    assert.equal(escRes.status, 200);
    assert.equal(escRes.body.data.es_reclamo_formal, true);
    assert.equal(escRes.body.data.sla_horas, 360);

    console.log('6. Verificando Comprobantes (Emitir Recibos + Pago en Ventanilla + Convenio de Fraccionamiento)...');
    const rec1Res = await requestJson(baseUrl, '/api/comprobantes/recibos', {
      method: 'POST',
      token: adminToken,
      body: {
        nis: testNis,
        periodo: 'Oct 2026',
        consumo_kwh: 150,
        energia_activa: 100.0,
        reposicion_mant: 4.1,
        cargo_fijo: 5.1,
        alumbrado_publico: 14.5
      }
    });
    assert.equal(rec1Res.status, 201);
    const rec1Id: number = rec1Res.body.data.id;

    const rec2Res = await requestJson(baseUrl, '/api/comprobantes/recibos', {
      method: 'POST',
      token: adminToken,
      body: {
        nis: testNis,
        periodo: 'Nov 2026',
        consumo_kwh: 160,
        energia_activa: 110.0,
        reposicion_mant: 4.1,
        cargo_fijo: 5.1,
        alumbrado_publico: 14.5
      }
    });
    assert.equal(rec2Res.status, 201);
    const rec2Id: number = rec2Res.body.data.id;

    const pagoRes = await requestJson(baseUrl, '/api/comprobantes/pagos', {
      method: 'POST',
      token: adminToken,
      body: {
        recibo_id: rec1Id,
        monto: 123.7,
        metodo_pago: 'EFECTIVO',
        tipo_comprobante: 'BOLETA',
        destino_copia: 'IMPRESO'
      }
    });
    assert.equal(pagoRes.status, 201);
    assert.equal(pagoRes.body.data.recibo.estado, 'PAGADO');

    const convRes = await requestJson(baseUrl, '/api/comprobantes/convenios', {
      method: 'POST',
      token: adminToken,
      body: {
        suministro_id: testSuministroId,
        numero_cuotas: 6,
        recibo_ids: [rec2Id]
      }
    });
    assert.equal(convRes.status, 201);
    assert.equal(convRes.body.data.convenio.numero_cuotas, 6);

    const consultaDespues = await requestJson(baseUrl, `/api/comprobantes/consulta?q=${encodeURIComponent(testNis)}`, {
      token: adminToken
    });
    assert.equal(consultaDespues.status, 200);
    assert.equal(consultaDespues.body.data.deuda_total, 0);

    console.log('7. Verificando Indicadores (Resumen JSON + Exportación CSV)...');
    const indRes = await requestJson(baseUrl, '/api/indicadores/resumen?periodo=hoy&canal=todos', {
      token: adminToken
    });
    assert.equal(indRes.status, 200);
    assert(indRes.body.data.curvaAfluencia.length === 10);
    assert(indRes.body.data.rendimientoOperadores.length >= 1);

    const csvRes = await fetch(`${baseUrl}/api/indicadores/exportar?periodo=hoy`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert(csvText.includes('REPORTE DE INDICADORES OPERATIVOS SACS / SEAL'));

    console.log('8. Verificando eliminación de cliente desde Tabla Maestra (DELETE /api/clientes/:id)...');
    if (createdTurnoIds.length > 0) {
      await query(`DELETE FROM turnos WHERE id = ANY($1)`, [createdTurnoIds]);
      createdTurnoIds.length = 0;
    }
    const delCliRes = await requestJson(baseUrl, `/api/clientes/${testClienteId}`, {
      method: 'DELETE',
      token: adminToken
    });
    assert.equal(delCliRes.status, 200);
    assert.equal(delCliRes.body.data.eliminado, true);

    console.log('✅ TODAS LAS PRUEBAS E2E DE API + POSTGRESQL PASARON EXITOSAMENTE.');
  } finally {
    // Limpiar registros sintéticos para dejar la BD limpia para la presentación
    if (touchedTurnoId && !createdTurnoIds.includes(touchedTurnoId)) {
      await query(
        `UPDATE turnos
         SET estado = 'EN_ESPERA', ventanilla_id = NULL, operador_id = NULL, llamado_en = NULL,
             finalizado_en = NULL, notas_atencion = '', resolucion_resumen = NULL, calificacion_csat = NULL, duracion_segundos = 0
         WHERE id = $1`,
        [touchedTurnoId]
      );
    }
    if (adminVentanillaId) {
      await query(
        `UPDATE ventanillas SET estado = 'DISPONIBLE', turno_actual_id = NULL WHERE id = $1`,
        [adminVentanillaId]
      );
    }
    if (createdTurnoIds.length > 0) {
      await query(`DELETE FROM turnos WHERE id = ANY($1)`, [createdTurnoIds]);
    }
    if (createdClienteIds.length > 0) {
      // Eliminar OTs y convenios vinculados primero si no tienen CASCADE en ticket_id
      await query(`DELETE FROM ordenes_trabajo WHERE suministro_id IN (SELECT id FROM suministros WHERE cliente_id = ANY($1))`, [createdClienteIds]);
      await query(`DELETE FROM convenios WHERE cliente_id = ANY($1)`, [createdClienteIds]);
      await query(`DELETE FROM clientes WHERE id = ANY($1)`, [createdClienteIds]);
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('❌ ERROR EN PRUEBAS E2E:', err);
  process.exit(1);
});
