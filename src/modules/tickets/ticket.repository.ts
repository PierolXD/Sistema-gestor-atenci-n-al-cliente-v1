import { PoolClient } from 'pg';
import { query } from '../../shared/database/connection';
import {
  AccionInmediata,
  TicketCanal,
  TicketDetalle,
  TicketEntity,
  TicketEstado,
  TicketMensajeEntity,
  TicketPrioridad
} from './ticket.entity';

function exec(client?: PoolClient) {
  return client ? client.query.bind(client) : query;
}

export class TicketRepository {
  async listTickets(filters: {
    canal?: string;
    prioridad?: string;
    estado?: string;
    q?: string;
  }): Promise<TicketDetalle[]> {
    const term = filters.q ? `%${filters.q.trim()}%` : null;
    const res = await query<TicketDetalle>(
      `SELECT
         t.*,
         c.nombres_apellidos AS cliente_nombre,
         c.dni_ruc,
         c.telefono,
         s.nis,
         s.numero_medidor,
         s.tarifa,
         s.direccion,
         s.subestacion_sed,
         u.nombre_completo AS operador_nombre,
         ROUND(EXTRACT(EPOCH FROM (t.sla_limite_en - NOW())))::INT AS sla_restante_segundos
       FROM tickets t
       JOIN clientes c ON c.id = t.cliente_id
       JOIN suministros s ON s.id = t.suministro_id
       LEFT JOIN usuarios u ON u.id = t.operador_asignado_id
       WHERE ($1::TEXT IS NULL OR t.canal = $1)
         AND ($2::TEXT IS NULL OR t.prioridad = $2)
         AND ($3::TEXT IS NULL OR t.estado = $3)
         AND (
           $4::TEXT IS NULL
           OR t.codigo ILIKE $4
           OR t.asunto ILIKE $4
           OR s.nis ILIKE $4
           OR c.dni_ruc ILIKE $4
           OR c.nombres_apellidos ILIKE $4
         )
       ORDER BY
         CASE WHEN t.estado IN ('RESUELTO', 'CERRADO') THEN 1 ELSE 0 END ASC,
         CASE t.prioridad WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 ELSE 3 END ASC,
         t.sla_limite_en ASC`,
      [filters.canal || null, filters.prioridad || null, filters.estado || null, term]
    );
    return res.rows;
  }

  async getKpis() {
    const res = await query<{
      en_cola: number;
      criticos_sla: number;
      resueltos_hoy: number;
      efectividad_pct: number;
      tmo_segundos: number;
      total_todos: number;
      total_presencial: number;
      total_whatsapp: number;
      total_portal: number;
      total_call_center: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE estado NOT IN ('RESUELTO', 'CERRADO'))::INT AS en_cola,
         COUNT(*) FILTER (
           WHERE estado NOT IN ('RESUELTO', 'CERRADO')
             AND EXTRACT(EPOCH FROM (sla_limite_en - NOW())) <= 7200
         )::INT AS criticos_sla,
         COUNT(*) FILTER (WHERE estado IN ('RESUELTO', 'CERRADO'))::INT AS resueltos_hoy,
         COALESCE(
           ROUND(
             (COUNT(*) FILTER (WHERE estado IN ('RESUELTO', 'CERRADO') AND resuelto_primer_contacto = TRUE)::NUMERIC * 100.0)
             / NULLIF(COUNT(*) FILTER (WHERE estado IN ('RESUELTO', 'CERRADO')), 0),
             1
           ),
           0
         )::float8 AS efectividad_pct,
         COALESCE(
           ROUND(AVG(EXTRACT(EPOCH FROM (cerrado_en - creado_en))) FILTER (WHERE cerrado_en IS NOT NULL)),
           0
         )::INT AS tmo_segundos,
         COUNT(*)::INT AS total_todos,
         COUNT(*) FILTER (WHERE canal = 'PRESENCIAL')::INT AS total_presencial,
         COUNT(*) FILTER (WHERE canal = 'WHATSAPP')::INT AS total_whatsapp,
         COUNT(*) FILTER (WHERE canal = 'PORTAL_WEB')::INT AS total_portal,
         COUNT(*) FILTER (WHERE canal = 'CALL_CENTER')::INT AS total_call_center
       FROM tickets`
    );
    return res.rows[0];
  }

  async findById(id: number, client?: PoolClient): Promise<TicketDetalle | null> {
    const run = exec(client);
    const res = await run<TicketDetalle>(
      `SELECT
         t.*,
         c.nombres_apellidos AS cliente_nombre,
         c.dni_ruc,
         c.telefono,
         s.nis,
         s.numero_medidor,
         s.tarifa,
         s.direccion,
         s.subestacion_sed,
         u.nombre_completo AS operador_nombre,
         ROUND(EXTRACT(EPOCH FROM (t.sla_limite_en - NOW())))::INT AS sla_restante_segundos
       FROM tickets t
       JOIN clientes c ON c.id = t.cliente_id
       JOIN suministros s ON s.id = t.suministro_id
       LEFT JOIN usuarios u ON u.id = t.operador_asignado_id
       WHERE t.id = $1
       LIMIT 1`,
      [id]
    );
    const ticket = res.rows[0];
    if (!ticket) return null;

    const [mensajesRes, otRes] = await Promise.all([
      run<TicketMensajeEntity>(
        `SELECT * FROM ticket_mensajes WHERE ticket_id = $1 ORDER BY creado_en ASC, id ASC`,
        [id]
      ),
      run<{ id: number; codigo: string; etapa: string; cuadrilla_nombre: string | null }>(
        `SELECT ot.id, ot.codigo, ot.etapa, cu.nombre AS cuadrilla_nombre
         FROM ordenes_trabajo ot
         LEFT JOIN cuadrillas cu ON cu.id = ot.cuadrilla_id
         WHERE ot.ticket_id = $1
         ORDER BY ot.id DESC LIMIT 1`,
        [id]
      )
    ]);

    ticket.mensajes = mensajesRes.rows;
    ticket.ot_vinculada = otRes.rows[0] ?? null;
    return ticket;
  }

  async create(
    params: {
      codigo: string;
      turno_id: number | null;
      cliente_id: number;
      suministro_id: number;
      canal: TicketCanal;
      prioridad: TicketPrioridad;
      asunto: string;
      descripcion: string;
      tipificacion_normativa: string | null;
      estado: TicketEstado;
      es_reclamo_formal: boolean;
      operador_asignado_id: number;
      sla_horas: number;
      sla_limite_en: Date;
    },
    client: PoolClient
  ): Promise<TicketEntity> {
    const res = await client.query<TicketEntity>(
      `INSERT INTO tickets (
         codigo, turno_id, cliente_id, suministro_id, canal, prioridad, asunto, descripcion,
         tipificacion_normativa, estado, es_reclamo_formal, operador_asignado_id, sla_horas, sla_limite_en
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        params.codigo,
        params.turno_id,
        params.cliente_id,
        params.suministro_id,
        params.canal,
        params.prioridad,
        params.asunto,
        params.descripcion,
        params.tipificacion_normativa,
        params.estado,
        params.es_reclamo_formal,
        params.operador_asignado_id,
        params.sla_horas,
        params.sla_limite_en
      ]
    );
    return res.rows[0];
  }

  async addMensaje(
    ticketId: number,
    autorTipo: 'BOT' | 'CLIENTE' | 'SCADA' | 'AGENTE' | 'SISTEMA',
    autorNombre: string,
    mensaje: string,
    evidenciaUrl: string | null,
    client?: PoolClient
  ): Promise<TicketMensajeEntity> {
    const run = exec(client);
    const res = await run<TicketMensajeEntity>(
      `INSERT INTO ticket_mensajes (ticket_id, autor_tipo, autor_nombre, mensaje, evidencia_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ticketId, autorTipo, autorNombre, mensaje, evidenciaUrl]
    );
    return res.rows[0];
  }

  async updateResolucion(
    ticketId: number,
    params: {
      tipificacion_normativa: string;
      accion_inmediata: AccionInmediata;
      dictamen_tecnico: string;
      estado: TicketEstado;
      es_reclamo_formal: boolean;
      sla_horas: number;
      sla_limite_en: Date;
      cerrar: boolean;
    },
    client: PoolClient
  ): Promise<TicketEntity> {
    const res = await client.query<TicketEntity>(
      `UPDATE tickets
       SET
         tipificacion_normativa = $2,
         accion_inmediata = $3,
         dictamen_tecnico = $4,
         estado = $5,
         es_reclamo_formal = $6,
         sla_horas = $7,
         sla_limite_en = $8,
         cerrado_en = CASE WHEN $9 THEN COALESCE(cerrado_en, NOW()) ELSE cerrado_en END,
         actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        ticketId,
        params.tipificacion_normativa,
        params.accion_inmediata,
        params.dictamen_tecnico,
        params.estado,
        params.es_reclamo_formal,
        params.sla_horas,
        params.sla_limite_en,
        params.cerrar && ['RESUELTO', 'CERRADO'].includes(params.estado)
      ]
    );
    return res.rows[0];
  }

  async toggleConflicto(ticketId: number): Promise<TicketEntity | null> {
    const res = await query<TicketEntity>(
      `UPDATE tickets
       SET conflicto_marcado = NOT conflicto_marcado, actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [ticketId]
    );
    return res.rows[0] ?? null;
  }
}
