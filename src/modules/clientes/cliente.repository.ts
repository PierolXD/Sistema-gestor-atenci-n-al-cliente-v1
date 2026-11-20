import { PoolClient } from 'pg';
import { query } from '../../shared/database/connection';
import {
  ActualizarClienteDto,
  ActualizarSuministroDto,
  CrearAutorizadoDto,
  CrearClienteSuministroDto,
  CrearInspeccionDto
} from './cliente.dto';
import {
  ClienteBusquedaRow,
  ClienteEntity,
  ClienteMaestroRow,
  ConsumoHistoricoEntity,
  InspeccionMedidorEntity,
  PersonaAutorizadaEntity,
  SuministroEntity
} from './cliente.entity';

function exec(client?: PoolClient) {
  return client ? client.query.bind(client) : query;
}

export class ClienteRepository {
  async buscar(q: string): Promise<ClienteBusquedaRow[]> {
    const term = `%${q.trim()}%`;
    const res = await query<ClienteBusquedaRow>(
      `SELECT
         c.id AS cliente_id,
         c.dni_ruc,
         c.tipo_documento,
         c.nombres_apellidos,
         c.telefono,
         c.correo,
         c.activo,
         s.id AS suministro_id,
         s.nis,
         s.numero_medidor,
         s.tarifa,
         s.estado_servicio,
         s.direccion,
         s.sector,
         COALESCE(SUM(CASE WHEN r.estado IN ('PENDIENTE', 'VENCIDO') THEN r.total ELSE 0 END), 0)::float8 AS deuda_total
       FROM suministros s
       JOIN clientes c ON c.id = s.cliente_id
       LEFT JOIN recibos r ON r.suministro_id = s.id
       WHERE
         $1 = '%%'
         OR s.nis ILIKE $1
         OR c.dni_ruc ILIKE $1
         OR s.numero_medidor ILIKE $1
         OR c.nombres_apellidos ILIKE $1
         OR s.direccion ILIKE $1
       GROUP BY c.id, s.id
       ORDER BY c.id ASC
       LIMIT 25`,
      [term]
    );
    return res.rows;
  }

  async listarTablaMaestra(filters: { q?: string; estado?: 'todos' | 'activos' | 'inactivos' }): Promise<{
    kpis: { total: number; activos: number; inactivos: number; deuda_total_cartera: number };
    items: ClienteMaestroRow[];
  }> {
    const term = filters.q && filters.q.trim() ? `%${filters.q.trim()}%` : null;
    const estadoFiltro = filters.estado || 'todos';

    const [kpiRes, rowsRes] = await Promise.all([
      query<{ total: number; activos: number; inactivos: number; deuda_total_cartera: number }>(
        `SELECT
           COUNT(DISTINCT c.id)::INT AS total,
           COUNT(DISTINCT c.id) FILTER (WHERE c.activo = TRUE)::INT AS activos,
           COUNT(DISTINCT c.id) FILTER (WHERE c.activo = FALSE)::INT AS inactivos,
           COALESCE(SUM(CASE WHEN r.estado IN ('PENDIENTE', 'VENCIDO') THEN r.total ELSE 0 END), 0)::float8 AS deuda_total_cartera
         FROM clientes c
         LEFT JOIN suministros s ON s.cliente_id = c.id
         LEFT JOIN recibos r ON r.suministro_id = s.id`
      ),
      query<ClienteMaestroRow>(
        `SELECT
           c.id,
           c.dni_ruc,
           c.tipo_documento,
           c.nombres_apellidos,
           c.telefono,
           c.correo,
           c.score_crediticio,
           c.categoria_crediticia,
           c.notificaciones_sms,
           c.activo,
           c.creado_en,
           sum_p.id AS suministro_id,
           sum_p.nis,
           sum_p.numero_medidor,
           sum_p.tarifa,
           sum_p.estado_servicio,
           sum_p.direccion,
           COALESCE((
             SELECT SUM(r.total)
             FROM recibos r
             JOIN suministros s2 ON s2.id = r.suministro_id
             WHERE s2.cliente_id = c.id AND r.estado IN ('PENDIENTE', 'VENCIDO')
           ), 0)::float8 AS deuda_total,
           COALESCE((SELECT COUNT(*) FROM tickets tk WHERE tk.cliente_id = c.id), 0)::INT AS total_tickets
         FROM clientes c
         LEFT JOIN LATERAL (
           SELECT id, nis, numero_medidor, tarifa, estado_servicio, direccion
           FROM suministros
           WHERE cliente_id = c.id
           ORDER BY id ASC
           LIMIT 1
         ) sum_p ON TRUE
         WHERE (
           $1::TEXT IS NULL
           OR c.dni_ruc ILIKE $1
           OR c.nombres_apellidos ILIKE $1
           OR COALESCE(c.correo, '') ILIKE $1
           OR COALESCE(sum_p.nis, '') ILIKE $1
           OR COALESCE(sum_p.numero_medidor, '') ILIKE $1
           OR COALESCE(sum_p.direccion, '') ILIKE $1
         )
         AND (
           $2::TEXT = 'todos'
           OR ($2::TEXT = 'activos' AND c.activo = TRUE)
           OR ($2::TEXT = 'inactivos' AND c.activo = FALSE)
         )
         ORDER BY c.id DESC`,
        [term, estadoFiltro]
      )
    ]);

    return {
      kpis: kpiRes.rows[0] ?? { total: 0, activos: 0, inactivos: 0, deuda_total_cartera: 0 },
      items: rowsRes.rows
    };
  }

  async findClienteById(id: number, client?: PoolClient): Promise<ClienteEntity | null> {
    const run = exec(client);
    const res = await run<ClienteEntity>(
      `SELECT id, dni_ruc, tipo_documento, nombres_apellidos, telefono, correo,
              score_crediticio, categoria_crediticia, notificaciones_sms, activo, creado_en, actualizado_en
       FROM clientes WHERE id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findClienteByDniOrNis(dniOrNis: string, client?: PoolClient): Promise<{ cliente: ClienteEntity; suministro: SuministroEntity } | null> {
    const run = exec(client);
    const res = await run<SuministroEntity>(
      `SELECT s.*,
              s.potencia_contratada_kw::float8 AS potencia_contratada_kw,
              s.lectura_actual_kwh::float8 AS lectura_actual_kwh,
              s.lectura_anterior_kwh::float8 AS lectura_anterior_kwh,
              s.tension_rms_v::float8 AS tension_rms_v,
              s.corriente_a::float8 AS corriente_a,
              s.factor_potencia::float8 AS factor_potencia,
              s.puesta_tierra_ohm::float8 AS puesta_tierra_ohm,
              s.latitud::float8 AS latitud,
              s.longitud::float8 AS longitud
       FROM suministros s
       JOIN clientes c ON c.id = s.cliente_id
       WHERE UPPER(s.nis) = UPPER($1) OR UPPER(c.dni_ruc) = UPPER($1) OR UPPER(s.numero_medidor) = UPPER($1)
       LIMIT 1`,
      [dniOrNis.trim()]
    );
    const suministro = res.rows[0];
    if (!suministro) return null;
    const cliente = await this.findClienteById(suministro.cliente_id, client);
    if (!cliente) return null;
    return { cliente, suministro };
  }

  async findSuministroById(suministroId: number, client?: PoolClient): Promise<SuministroEntity | null> {
    const run = exec(client);
    const res = await run<SuministroEntity>(
      `SELECT *,
              potencia_contratada_kw::float8 AS potencia_contratada_kw,
              lectura_actual_kwh::float8 AS lectura_actual_kwh,
              lectura_anterior_kwh::float8 AS lectura_anterior_kwh,
              tension_rms_v::float8 AS tension_rms_v,
              corriente_a::float8 AS corriente_a,
              factor_potencia::float8 AS factor_potencia,
              puesta_tierra_ohm::float8 AS puesta_tierra_ohm,
              latitud::float8 AS latitud,
              longitud::float8 AS longitud
       FROM suministros WHERE id = $1 LIMIT 1`,
      [suministroId]
    );
    return res.rows[0] ?? null;
  }

  async findSuministroByNis(nis: string, client?: PoolClient): Promise<SuministroEntity | null> {
    const run = exec(client);
    const res = await run<SuministroEntity>(
      `SELECT *,
              potencia_contratada_kw::float8 AS potencia_contratada_kw,
              lectura_actual_kwh::float8 AS lectura_actual_kwh,
              lectura_anterior_kwh::float8 AS lectura_anterior_kwh,
              tension_rms_v::float8 AS tension_rms_v,
              corriente_a::float8 AS corriente_a,
              factor_potencia::float8 AS factor_potencia,
              puesta_tierra_ohm::float8 AS puesta_tierra_ohm,
              latitud::float8 AS latitud,
              longitud::float8 AS longitud
       FROM suministros WHERE UPPER(nis) = UPPER($1) LIMIT 1`,
      [nis.trim()]
    );
    return res.rows[0] ?? null;
  }

  async findSuministrosByClienteId(clienteId: number, client?: PoolClient): Promise<SuministroEntity[]> {
    const run = exec(client);
    const res = await run<SuministroEntity>(
      `SELECT *,
              potencia_contratada_kw::float8 AS potencia_contratada_kw,
              lectura_actual_kwh::float8 AS lectura_actual_kwh,
              lectura_anterior_kwh::float8 AS lectura_anterior_kwh,
              tension_rms_v::float8 AS tension_rms_v,
              corriente_a::float8 AS corriente_a,
              factor_potencia::float8 AS factor_potencia,
              puesta_tierra_ohm::float8 AS puesta_tierra_ohm,
              latitud::float8 AS latitud,
              longitud::float8 AS longitud
       FROM suministros WHERE cliente_id = $1 ORDER BY id ASC`,
      [clienteId]
    );
    return res.rows;
  }

  async getDeudaSuministro(suministroId: number): Promise<{ deuda_total: number; recibos_pendientes_count: number }> {
    const res = await query<{ deuda_total: number; recibos_pendientes_count: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN estado IN ('PENDIENTE', 'VENCIDO') THEN total ELSE 0 END), 0)::float8 AS deuda_total,
         COUNT(CASE WHEN estado IN ('PENDIENTE', 'VENCIDO') THEN 1 END)::INT AS recibos_pendientes_count
       FROM recibos
       WHERE suministro_id = $1`,
      [suministroId]
    );
    return res.rows[0] ?? { deuda_total: 0, recibos_pendientes_count: 0 };
  }

  async getConsumos(suministroId: number): Promise<ConsumoHistoricoEntity[]> {
    const res = await query<ConsumoHistoricoEntity>(
      `SELECT id, suministro_id, periodo, etiqueta_mes,
              consumo_kwh::float8 AS consumo_kwh,
              promedio_sector_kwh::float8 AS promedio_sector_kwh
       FROM consumos_historicos
       WHERE suministro_id = $1
       ORDER BY periodo ASC`,
      [suministroId]
    );
    return res.rows;
  }

  async getTicketsHistorial(clienteId: number) {
    const res = await query(
      `SELECT id, codigo, asunto, descripcion, tipificacion_normativa, canal, prioridad, estado,
              dictamen_tecnico, creado_en, cerrado_en,
              COALESCE(
                ROUND(EXTRACT(EPOCH FROM (COALESCE(cerrado_en, NOW()) - creado_en)) / 3600.0, 1),
                0
              )::float8 AS horas_atencion
       FROM tickets
       WHERE cliente_id = $1
       ORDER BY creado_en DESC`,
      [clienteId]
    );
    return res.rows;
  }

  async getInspecciones(suministroId: number): Promise<InspeccionMedidorEntity[]> {
    const res = await query<InspeccionMedidorEntity>(
      `SELECT id, suministro_id, tipo, codigo_certificado, laboratorio_o_ot, estado,
              fecha_ensayo::text AS fecha_ensayo, error_medido_pct, proximo_vencimiento,
              precinto_bornera, precinto_caja, observaciones, creado_en
       FROM inspecciones_medidor
       WHERE suministro_id = $1
       ORDER BY fecha_ensayo DESC, id DESC`,
      [suministroId]
    );
    return res.rows;
  }

  async getAutorizados(clienteId: number): Promise<PersonaAutorizadaEntity[]> {
    const res = await query<PersonaAutorizadaEntity>(
      `SELECT id, cliente_id, nombre_completo, relacion, dni, telefono, correo, poder_legal, nivel, activo, creado_en
       FROM personas_autorizadas
       WHERE cliente_id = $1 AND activo = TRUE
       ORDER BY CASE nivel WHEN 'PRINCIPAL' THEN 1 WHEN 'SECUNDARIO' THEN 2 ELSE 3 END, id ASC`,
      [clienteId]
    );
    return res.rows;
  }

  async createClienteYSuministro(dto: CrearClienteSuministroDto, client: PoolClient) {
    const cliRes = await client.query<ClienteEntity>(
      `INSERT INTO clientes (dni_ruc, tipo_documento, nombres_apellidos, telefono, correo, notificaciones_sms)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.dni_ruc,
        dto.tipo_documento,
        dto.nombres_apellidos,
        dto.telefono ?? null,
        dto.correo || null,
        dto.notificaciones_sms
      ]
    );
    const cliente = cliRes.rows[0];

    const sumRes = await client.query<SuministroEntity>(
      `INSERT INTO suministros (
         nis, cliente_id, numero_medidor, tipo_medidor, tarifa, potencia_contratada_kw,
         direccion, distrito, sector, codigo_ruta, subestacion_sed, alimentador_mt,
         lectura_actual_kwh, lectura_anterior_kwh, precinto_bornera, precinto_caja
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 0, $13, $14)
       RETURNING *`,
      [
        dto.nis,
        cliente.id,
        dto.numero_medidor,
        dto.tipo_medidor,
        dto.tarifa,
        dto.potencia_contratada_kw,
        dto.direccion,
        dto.distrito,
        dto.sector,
        `AQ-NEW-${cliente.id}`,
        dto.subestacion_sed,
        dto.alimentador_mt,
        `PRC-${dto.nis.slice(-4)}1`,
        `PRC-${dto.nis.slice(-4)}2`
      ]
    );
    const suministro = sumRes.rows[0];

    await client.query(
      `INSERT INTO consumos_historicos (suministro_id, periodo, etiqueta_mes, consumo_kwh, promedio_sector_kwh)
       VALUES ($1, '2026-11', 'NOV', 120, 145)`,
      [suministro.id]
    );

    await client.query(
      `INSERT INTO personas_autorizadas (cliente_id, nombre_completo, relacion, dni, telefono, correo, poder_legal, nivel)
       VALUES ($1, $2, 'Titular del Contrato', $3, $4, $5, TRUE, 'PRINCIPAL')`,
      [cliente.id, cliente.nombres_apellidos, cliente.dni_ruc, cliente.telefono, cliente.correo]
    );

    return { cliente, suministro };
  }

  async updateCliente(id: number, dto: ActualizarClienteDto): Promise<ClienteEntity | null> {
    const res = await query<ClienteEntity>(
      `UPDATE clientes
       SET
         dni_ruc = COALESCE($2, dni_ruc),
         tipo_documento = COALESCE($3, tipo_documento),
         nombres_apellidos = COALESCE($4, nombres_apellidos),
         telefono = COALESCE($5, telefono),
         correo = COALESCE($6, correo),
         notificaciones_sms = COALESCE($7, notificaciones_sms),
         categoria_crediticia = COALESCE($8, categoria_crediticia),
         score_crediticio = COALESCE($9, score_crediticio),
         activo = COALESCE($10, activo),
         actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        dto.dni_ruc ?? null,
        dto.tipo_documento ?? null,
        dto.nombres_apellidos ?? null,
        dto.telefono === undefined ? null : dto.telefono,
        dto.correo === undefined ? null : dto.correo || null,
        dto.notificaciones_sms ?? null,
        dto.categoria_crediticia ?? null,
        dto.score_crediticio ?? null,
        dto.activo ?? null
      ]
    );
    return res.rows[0] ?? null;
  }

  async setActivo(id: number, activo: boolean): Promise<ClienteEntity | null> {
    const res = await query<ClienteEntity>(
      `UPDATE clientes
       SET activo = $2, actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, activo]
    );
    return res.rows[0] ?? null;
  }

  async deleteCliente(id: number, client: PoolClient): Promise<boolean> {
    await client.query(
      `DELETE FROM ordenes_trabajo WHERE suministro_id IN (SELECT id FROM suministros WHERE cliente_id = $1)`,
      [id]
    );
    await client.query(`DELETE FROM convenios WHERE cliente_id = $1`, [id]);
    const res = await client.query(`DELETE FROM clientes WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async updateSuministro(suministroId: number, dto: ActualizarSuministroDto, client?: PoolClient): Promise<SuministroEntity | null> {
    const run = exec(client);
    const res = await run<SuministroEntity>(
      `UPDATE suministros
       SET
         numero_medidor = COALESCE($2, numero_medidor),
         tipo_medidor = COALESCE($3, tipo_medidor),
         tarifa = COALESCE($4, tarifa),
         potencia_contratada_kw = COALESCE($5, potencia_contratada_kw),
         estado_servicio = COALESCE($6, estado_servicio),
         precinto_bornera = COALESCE($7, precinto_bornera),
         precinto_caja = COALESCE($8, precinto_caja),
         lectura_actual_kwh = COALESCE($9, lectura_actual_kwh),
         tension_rms_v = COALESCE($10, tension_rms_v),
         corriente_a = COALESCE($11, corriente_a),
         factor_potencia = COALESCE($12, factor_potencia),
         actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        suministroId,
        dto.numero_medidor ?? null,
        dto.tipo_medidor ?? null,
        dto.tarifa ?? null,
        dto.potencia_contratada_kw ?? null,
        dto.estado_servicio ?? null,
        dto.precinto_bornera ?? null,
        dto.precinto_caja ?? null,
        dto.lectura_actual_kwh ?? null,
        dto.tension_rms_v ?? null,
        dto.corriente_a ?? null,
        dto.factor_potencia ?? null
      ]
    );
    return res.rows[0] ?? null;
  }

  async createInspeccion(
    suministroId: number,
    codigoCertificado: string,
    dto: CrearInspeccionDto
  ): Promise<InspeccionMedidorEntity> {
    const fecha = dto.fecha_ensayo || new Date().toISOString().slice(0, 10);
    const res = await query<InspeccionMedidorEntity>(
      `INSERT INTO inspecciones_medidor (
         suministro_id, tipo, codigo_certificado, laboratorio_o_ot, estado,
         fecha_ensayo, error_medido_pct, proximo_vencimiento, precinto_bornera, precinto_caja, observaciones
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Nov-2031', $8, $9, $10)
       RETURNING id, suministro_id, tipo, codigo_certificado, laboratorio_o_ot, estado,
                 fecha_ensayo::text AS fecha_ensayo, error_medido_pct, proximo_vencimiento,
                 precinto_bornera, precinto_caja, observaciones, creado_en`,
      [
        suministroId,
        dto.tipo,
        codigoCertificado,
        dto.laboratorio_o_ot,
        dto.estado,
        fecha,
        dto.error_medido_pct,
        dto.precinto_bornera ?? null,
        dto.precinto_caja ?? null,
        dto.observaciones ?? null
      ]
    );
    return res.rows[0];
  }

  async createAutorizado(clienteId: number, dto: CrearAutorizadoDto): Promise<PersonaAutorizadaEntity> {
    const res = await query<PersonaAutorizadaEntity>(
      `INSERT INTO personas_autorizadas (cliente_id, nombre_completo, relacion, dni, telefono, correo, poder_legal, nivel)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        clienteId,
        dto.nombre_completo,
        dto.relacion,
        dto.dni ?? null,
        dto.telefono ?? null,
        dto.correo || null,
        dto.poder_legal,
        dto.nivel
      ]
    );
    return res.rows[0];
  }
}
