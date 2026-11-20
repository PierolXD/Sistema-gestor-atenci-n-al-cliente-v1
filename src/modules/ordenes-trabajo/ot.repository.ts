import { PoolClient } from 'pg';
import { query } from '../../shared/database/connection';
import {
  CuadrillaEntity,
  OrdenTrabajoDetalle,
  OrdenTrabajoEntity,
  OtEtapa,
  OtEventoEntity,
  OtEventoTipo,
  OtPrioridad,
  OtTipo
} from './ot.entity';

function exec(client?: PoolClient) {
  return client ? client.query.bind(client) : query;
}

export class OtRepository {
  async listCuadrillas(client?: PoolClient): Promise<CuadrillaEntity[]> {
    const run = exec(client);
    const res = await run<CuadrillaEntity>(
      `SELECT id, codigo, nombre, lider_nombre, cip, especialidad, estado, zona,
              latitud::float8 AS latitud, longitud::float8 AS longitud, ubicacion_texto
       FROM cuadrillas
       ORDER BY id ASC`
    );
    return res.rows;
  }

  async findCuadrillaByIdOrCode(idOrCode: number | string, client?: PoolClient): Promise<CuadrillaEntity | null> {
    const run = exec(client);
    const isNum = typeof idOrCode === 'number' || /^\d+$/.test(String(idOrCode));
    const res = await run<CuadrillaEntity>(
      `SELECT id, codigo, nombre, lider_nombre, cip, especialidad, estado, zona,
              latitud::float8 AS latitud, longitud::float8 AS longitud, ubicacion_texto
       FROM cuadrillas
       WHERE ${isNum ? 'id = $1' : 'UPPER(codigo) = UPPER($1)'}
       LIMIT 1`,
      [isNum ? Number(idOrCode) : String(idOrCode)]
    );
    return res.rows[0] ?? null;
  }

  async updateCuadrillaEstado(
    cuadrillaId: number,
    estado: 'DISPONIBLE' | 'EN_RUTA' | 'EN_SITIO' | 'EN_BASE',
    client?: PoolClient
  ): Promise<void> {
    const run = exec(client);
    await run(`UPDATE cuadrillas SET estado = $2 WHERE id = $1`, [cuadrillaId, estado]);
  }

  async listOts(filters: { tipo?: string; etapa?: string; q?: string }): Promise<OrdenTrabajoDetalle[]> {
    const term = filters.q ? `%${filters.q.trim()}%` : null;
    const res = await query<OrdenTrabajoDetalle>(
      `SELECT
         ot.*,
         s.nis,
         s.numero_medidor,
         s.tarifa,
         s.direccion,
         s.subestacion_sed,
         s.alimentador_mt,
         s.latitud::float8 AS latitud,
         s.longitud::float8 AS longitud,
         c.nombres_apellidos AS cliente_nombre,
         cu.codigo AS cuadrilla_codigo,
         cu.nombre AS cuadrilla_nombre,
         cu.lider_nombre AS cuadrilla_lider,
         cu.cip AS cuadrilla_cip,
         cu.ubicacion_texto AS cuadrilla_ubicacion,
         tk.codigo AS ticket_codigo,
         ROUND(EXTRACT(EPOCH FROM (ot.sla_limite_en - NOW())))::INT AS sla_restante_segundos
       FROM ordenes_trabajo ot
       JOIN suministros s ON s.id = ot.suministro_id
       JOIN clientes c ON c.id = s.cliente_id
       LEFT JOIN cuadrillas cu ON cu.id = ot.cuadrilla_id
       LEFT JOIN tickets tk ON tk.id = ot.ticket_id
       WHERE ($1::TEXT IS NULL OR ot.tipo = $1)
         AND ($2::TEXT IS NULL OR ot.etapa = $2)
         AND (
           $3::TEXT IS NULL
           OR ot.codigo ILIKE $3
           OR ot.titulo ILIKE $3
           OR s.nis ILIKE $3
           OR s.direccion ILIKE $3
           OR c.nombres_apellidos ILIKE $3
         )
       ORDER BY
         CASE ot.etapa WHEN 'LIQUIDADA' THEN 1 ELSE 0 END ASC,
         CASE ot.prioridad WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 ELSE 3 END ASC,
         ot.sla_limite_en ASC`,
      [filters.tipo || null, filters.etapa || null, term]
    );
    return res.rows;
  }

  async getContadores() {
    const res = await query<{
      todas: number;
      emergencias: number;
      reconexiones: number;
      inspecciones: number;
    }>(
      `SELECT
         COUNT(*)::INT AS todas,
         COUNT(*) FILTER (WHERE tipo = 'EMERGENCIA')::INT AS emergencias,
         COUNT(*) FILTER (WHERE tipo IN ('RECONEXION', 'CORTE'))::INT AS reconexiones,
         COUNT(*) FILTER (WHERE tipo = 'INSPECCION')::INT AS inspecciones
       FROM ordenes_trabajo`
    );
    return res.rows[0];
  }

  async findOtById(id: number, client?: PoolClient): Promise<OrdenTrabajoDetalle | null> {
    const run = exec(client);
    const res = await run<OrdenTrabajoDetalle>(
      `SELECT
         ot.*,
         s.nis,
         s.numero_medidor,
         s.tarifa,
         s.direccion,
         s.subestacion_sed,
         s.alimentador_mt,
         s.latitud::float8 AS latitud,
         s.longitud::float8 AS longitud,
         c.nombres_apellidos AS cliente_nombre,
         cu.codigo AS cuadrilla_codigo,
         cu.nombre AS cuadrilla_nombre,
         cu.lider_nombre AS cuadrilla_lider,
         cu.cip AS cuadrilla_cip,
         cu.ubicacion_texto AS cuadrilla_ubicacion,
         tk.codigo AS ticket_codigo,
         ROUND(EXTRACT(EPOCH FROM (ot.sla_limite_en - NOW())))::INT AS sla_restante_segundos
       FROM ordenes_trabajo ot
       JOIN suministros s ON s.id = ot.suministro_id
       JOIN clientes c ON c.id = s.cliente_id
       LEFT JOIN cuadrillas cu ON cu.id = ot.cuadrilla_id
       LEFT JOIN tickets tk ON tk.id = ot.ticket_id
       WHERE ot.id = $1
       LIMIT 1`,
      [id]
    );
    const ot = res.rows[0];
    if (!ot) return null;
    ot.eventos = await this.listEventos(ot.id, client);
    return ot;
  }

  async findOtByTicketId(ticketId: number, client?: PoolClient): Promise<OrdenTrabajoEntity | null> {
    const run = exec(client);
    const res = await run<OrdenTrabajoEntity>(
      `SELECT * FROM ordenes_trabajo WHERE ticket_id = $1 ORDER BY id DESC LIMIT 1`,
      [ticketId]
    );
    return res.rows[0] ?? null;
  }

  async listEventos(otId: number, client?: PoolClient): Promise<OtEventoEntity[]> {
    const run = exec(client);
    const res = await run<OtEventoEntity>(
      `SELECT * FROM ot_eventos WHERE ot_id = $1 ORDER BY creado_en DESC, id DESC`,
      [otId]
    );
    return res.rows;
  }

  async createOt(
    params: {
      codigo: string;
      ticket_id: number | null;
      suministro_id: number;
      cuadrilla_id: number | null;
      tipo: OtTipo;
      prioridad: OtPrioridad;
      titulo: string;
      descripcion: string;
      etapa: OtEtapa;
      sla_horas: number;
      sla_limite_en: Date;
      materiales_imputados: string;
      creado_por_id: number;
    },
    client: PoolClient
  ): Promise<OrdenTrabajoEntity> {
    const res = await client.query<OrdenTrabajoEntity>(
      `INSERT INTO ordenes_trabajo (
         codigo, ticket_id, suministro_id, cuadrilla_id, tipo, prioridad, titulo, descripcion,
         etapa, sla_horas, sla_limite_en, materiales_imputados, creado_por_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        params.codigo,
        params.ticket_id,
        params.suministro_id,
        params.cuadrilla_id,
        params.tipo,
        params.prioridad,
        params.titulo,
        params.descripcion,
        params.etapa,
        params.sla_horas,
        params.sla_limite_en,
        params.materiales_imputados,
        params.creado_por_id
      ]
    );
    return res.rows[0];
  }

  async addEvento(
    otId: number,
    tipoEvento: OtEventoTipo,
    descripcion: string,
    reportadoPor: string,
    client?: PoolClient
  ): Promise<OtEventoEntity> {
    const run = exec(client);
    const res = await run<OtEventoEntity>(
      `INSERT INTO ot_eventos (ot_id, tipo_evento, descripcion, reportado_por)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [otId, tipoEvento, descripcion, reportadoPor]
    );
    return res.rows[0];
  }

  async reasignarCuadrilla(
    otId: number,
    cuadrillaId: number,
    nuevaEtapaSiGenerada: OtEtapa,
    client: PoolClient
  ): Promise<OrdenTrabajoEntity> {
    const res = await client.query<OrdenTrabajoEntity>(
      `UPDATE ordenes_trabajo
       SET
         cuadrilla_id = $2,
         etapa = CASE WHEN etapa = 'GENERADA' THEN $3::VARCHAR ELSE etapa END,
         actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [otId, cuadrillaId, nuevaEtapaSiGenerada]
    );
    return res.rows[0];
  }

  async updateEtapa(
    otId: number,
    etapa: OtEtapa,
    materialesImputados: string | undefined,
    validacionCliente: string | undefined,
    actaDigitalHash: string | null,
    client: PoolClient
  ): Promise<OrdenTrabajoEntity> {
    const res = await client.query<OrdenTrabajoEntity>(
      `UPDATE ordenes_trabajo
       SET
         etapa = $2::VARCHAR,
         materiales_imputados = COALESCE($3, materiales_imputados),
         validacion_cliente = COALESCE($4, validacion_cliente),
         acta_digital_hash = COALESCE($5, acta_digital_hash),
         liquidada_en = CASE WHEN $2::VARCHAR = 'LIQUIDADA' THEN NOW() ELSE liquidada_en END,
         actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        otId,
        etapa,
        materialesImputados ?? null,
        validacionCliente ?? null,
        actaDigitalHash
      ]
    );
    return res.rows[0];
  }

  async syncTicketResueltoOnLiquidar(ticketId: number, otCodigo: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE tickets
       SET estado = 'RESUELTO', actualizado_en = NOW(), cerrado_en = COALESCE(cerrado_en, NOW())
       WHERE id = $1 AND estado NOT IN ('RESUELTO', 'CERRADO')`,
      [ticketId]
    );
    await client.query(
      `INSERT INTO ticket_mensajes (ticket_id, autor_tipo, autor_nombre, mensaje)
       VALUES ($1, 'SISTEMA', 'Despacho OTs', $2)`,
      [ticketId, `Orden de Trabajo ${otCodigo} liquidada en campo. Servicio restablecido.`]
    );
  }
}
