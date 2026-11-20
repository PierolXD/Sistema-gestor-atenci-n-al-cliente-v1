import { query } from '../../shared/database/connection';
import {
  DistribucionSolicitud,
  IndicadorKpis,
  PeriodoIndicador,
  PuntoAfluencia,
  RendimientoOperadorRow
} from './indicador.entity';

function getIntervalSql(periodo: PeriodoIndicador): string {
  if (periodo === 'semana') return '7 days';
  if (periodo === 'mes') return '30 days';
  return '24 hours';
}

export class IndicadorRepository {
  async getKpis(periodo: PeriodoIndicador, canal: string): Promise<IndicadorKpis> {
    const interval = getIntervalSql(periodo);
    const canalFilter = canal === 'todos' ? null : canal;

    const [turnosRes, ticketsRes] = await Promise.all([
      query<{
        tmo_segundos: number;
        csat_promedio: number;
        csat_evaluaciones: number;
        total_atenciones_turno: number;
      }>(
        `SELECT
           COALESCE(ROUND(AVG(duracion_segundos) FILTER (WHERE estado = 'FINALIZADO' AND duracion_segundos > 0)), 0)::INT AS tmo_segundos,
           COALESCE(ROUND(AVG(calificacion_csat) FILTER (WHERE calificacion_csat IS NOT NULL), 1), 0)::float8 AS csat_promedio,
           COUNT(*) FILTER (WHERE calificacion_csat IS NOT NULL)::INT AS csat_evaluaciones,
           COUNT(*) FILTER (WHERE estado = 'FINALIZADO')::INT AS total_atenciones_turno
         FROM turnos
         WHERE creado_en >= NOW() - $1::INTERVAL`,
        [interval]
      ),
      query<{
        fcr_pct: number;
        criticos_sla: number;
        total_tickets_periodo: number;
      }>(
        `SELECT
           COALESCE(
             ROUND(
               (COUNT(*) FILTER (WHERE estado IN ('RESUELTO', 'CERRADO') AND resuelto_primer_contacto = TRUE)::NUMERIC * 100.0)
               / NULLIF(COUNT(*) FILTER (WHERE estado IN ('RESUELTO', 'CERRADO')), 0),
               1
             ),
             0
           )::float8 AS fcr_pct,
           COUNT(*) FILTER (
             WHERE estado NOT IN ('RESUELTO', 'CERRADO')
               AND EXTRACT(EPOCH FROM (sla_limite_en - NOW())) <= 7200
           )::INT AS criticos_sla,
           COUNT(*)::INT AS total_tickets_periodo
         FROM tickets
         WHERE creado_en >= NOW() - $1::INTERVAL
           AND ($2::TEXT IS NULL OR canal = $2)`,
        [interval, canalFilter]
      )
    ]);

    return {
      ...turnosRes.rows[0],
      ...ticketsRes.rows[0]
    };
  }

  async getCurvaAfluencia(periodo: PeriodoIndicador): Promise<PuntoAfluencia[]> {
    const interval = getIntervalSql(periodo);
    const res = await query<PuntoAfluencia>(
      `WITH horas AS (
         SELECT generate_series(
           date_trunc('hour', NOW()) - INTERVAL '9 hours',
           date_trunc('hour', NOW()),
           INTERVAL '1 hour'
         ) AS hora_slot
       )
       SELECT
         TO_CHAR(h.hora_slot, 'HH24:00') AS hora,
         COUNT(t.id)::INT AS emitidos,
         COALESCE(
           ROUND(
             AVG(EXTRACT(EPOCH FROM (COALESCE(t.llamado_en, NOW()) - t.creado_en))) / 60.0,
             1
           ),
           0
         )::float8 AS espera_min
       FROM horas h
       LEFT JOIN turnos t
         ON date_trunc('hour', t.creado_en) = h.hora_slot
        AND t.creado_en >= NOW() - $1::INTERVAL
       GROUP BY h.hora_slot
       ORDER BY h.hora_slot ASC`,
      [interval]
    );
    return res.rows;
  }

  async getDistribucionSolicitudes(periodo: PeriodoIndicador, canal: string): Promise<{
    totalCasos: number;
    items: DistribucionSolicitud[];
  }> {
    const interval = getIntervalSql(periodo);
    const canalFilter = canal === 'todos' ? null : canal;

    const res = await query<{
      facturacion: number;
      cortes: number;
      nuevos: number;
      convenios: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE tipificacion_normativa ILIKE '%COM-01%' OR asunto ILIKE '%factur%' OR asunto ILIKE '%consumo%' OR asunto ILIKE '%recibo%')::INT AS facturacion,
         COUNT(*) FILTER (WHERE tipificacion_normativa ILIKE '%ELEC%' OR tipificacion_normativa ILIKE '%VOLT%' OR tipificacion_normativa ILIKE '%SEG%' OR asunto ILIKE '%corte%' OR asunto ILIKE '%energía%' OR asunto ILIKE '%voltaje%' OR asunto ILIKE '%intermitencia%')::INT AS cortes,
         COUNT(*) FILTER (WHERE tipificacion_normativa ILIKE '%TEC%' OR asunto ILIKE '%nuevo suministro%' OR asunto ILIKE '%trifásico%' OR asunto ILIKE '%titular%')::INT AS nuevos,
         (
           COUNT(*) FILTER (WHERE asunto ILIKE '%convenio%' OR asunto ILIKE '%fraccionamiento%' OR tipificacion_normativa ILIKE '%COM-02%')
           + (SELECT COUNT(*)::INT FROM convenios WHERE creado_en >= NOW() - $1::INTERVAL)
         )::INT AS convenios
       FROM tickets
       WHERE creado_en >= NOW() - $1::INTERVAL
         AND ($2::TEXT IS NULL OR canal = $2)`,
      [interval, canalFilter]
    );

    const row = res.rows[0] || { facturacion: 0, cortes: 0, nuevos: 0, convenios: 0 };
    const total = Math.max(1, row.facturacion + row.cortes + row.nuevos + row.convenios);
    const rawTotal = row.facturacion + row.cortes + row.nuevos + row.convenios;

    const items: DistribucionSolicitud[] = [
      {
        categoria: 'Reclamos Facturación / Consumo elevado',
        cantidad: row.facturacion,
        porcentaje: rawTotal === 0 ? 0 : Math.round((row.facturacion * 100) / total),
        color: '#a78bfa'
      },
      {
        categoria: 'Cortes no programados & red eléctrica',
        cantidad: row.cortes,
        porcentaje: rawTotal === 0 ? 0 : Math.round((row.cortes * 100) / total),
        color: '#34d399'
      },
      {
        categoria: 'Nuevos suministros & cambio titular',
        cantidad: row.nuevos,
        porcentaje: rawTotal === 0 ? 0 : Math.round((row.nuevos * 100) / total),
        color: '#c4b5fd'
      },
      {
        categoria: 'Convenios y fraccionamiento / reconexiones',
        cantidad: row.convenios,
        porcentaje: rawTotal === 0 ? 0 : Math.round((row.convenios * 100) / total),
        color: '#71717a'
      }
    ];

    return { totalCasos: rawTotal, items };
  }

  async getRendimientoOperadores(q: string): Promise<RendimientoOperadorRow[]> {
    const term = q.trim() ? `%${q.trim()}%` : null;
    const res = await query<RendimientoOperadorRow>(
      `SELECT
         usuario_id,
         codigo_empleado,
         nombre_completo,
         iniciales,
         rol,
         cargo,
         ventanilla_codigo,
         ventanilla_nombre,
         tipo_modulo,
         ventanilla_estado,
         atenciones_totales,
         tmo_segundos,
         csat_promedio::float8 AS csat_promedio,
         tickets_resueltos,
         indice_conformidad_pct::float8 AS indice_conformidad_pct
       FROM vw_rendimiento_operadores
       WHERE ($1::TEXT IS NULL
         OR nombre_completo ILIKE $1
         OR codigo_empleado ILIKE $1
         OR COALESCE(ventanilla_nombre, '') ILIKE $1)
       ORDER BY atenciones_totales DESC, usuario_id ASC`,
      [term]
    );
    return res.rows;
  }
}
