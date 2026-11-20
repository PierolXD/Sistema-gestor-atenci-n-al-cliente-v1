import { PoolClient } from 'pg';
import { query } from '../../shared/database/connection';
import { EmitirTurnoDto } from './turno.dto';
import { TurnoConEspera, TurnoEntity } from './turno.entity';

function exec(client?: PoolClient) {
  return client ? client.query.bind(client) : query;
}

export class TurnoRepository {
  async listColaEspera(sucursalId: number, modulo?: string): Promise<TurnoConEspera[]> {
    const res = await query<TurnoConEspera>(
      `SELECT
         t.*,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - t.creado_en))))::INT AS espera_segundos,
         0::INT AS transcurrido_segundos
       FROM turnos t
       WHERE t.sucursal_id = $1
         AND t.estado = 'EN_ESPERA'
         AND ($2::TEXT IS NULL OR t.modulo_cola = $2)
       ORDER BY t.creado_en ASC`,
      [sucursalId, modulo && ['A', 'B', 'C'].includes(modulo) ? modulo : null]
    );
    return res.rows;
  }

  async findTurnoEnAtencionPorOperador(operadorId: number, client?: PoolClient): Promise<TurnoConEspera | null> {
    const run = exec(client);
    const res = await run<TurnoConEspera>(
      `SELECT
         t.*,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (COALESCE(t.llamado_en, NOW()) - t.creado_en))))::INT AS espera_segundos,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(t.llamado_en, NOW())))))::INT AS transcurrido_segundos,
         v.nombre AS ventanilla_nombre
       FROM turnos t
       LEFT JOIN ventanillas v ON v.id = t.ventanilla_id
       WHERE t.operador_id = $1 AND t.estado = 'EN_ATENCION'
       ORDER BY t.llamado_en DESC
       LIMIT 1`,
      [operadorId]
    );
    return res.rows[0] ?? null;
  }

  async findById(id: number, client?: PoolClient): Promise<TurnoConEspera | null> {
    const run = exec(client);
    const res = await run<TurnoConEspera>(
      `SELECT
         t.*,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (COALESCE(t.llamado_en, NOW()) - t.creado_en))))::INT AS espera_segundos,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(t.llamado_en, NOW())))))::INT AS transcurrido_segundos
       FROM turnos t
       WHERE t.id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async getKpisSala(sucursalId: number, operadorId: number) {
    const res = await query<{
      espera_promedio_segundos: number;
      en_cola_count: number;
      atendidos_hoy_sede: number;
      atendidos_hoy_operador: number;
      satisfaccion_pct: number;
      opiniones_registradas: number;
    }>(
      `SELECT
         COALESCE(
           ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(llamado_en, NOW()) - creado_en)))
           FILTER (WHERE estado IN ('EN_ESPERA', 'EN_ATENCION', 'FINALIZADO') AND creado_en >= CURRENT_DATE)),
           0
         )::INT AS espera_promedio_segundos,
         COUNT(*) FILTER (WHERE estado = 'EN_ESPERA')::INT AS en_cola_count,
         COUNT(*) FILTER (WHERE estado = 'FINALIZADO' AND finalizado_en >= CURRENT_DATE)::INT AS atendidos_hoy_sede,
         COUNT(*) FILTER (WHERE estado = 'FINALIZADO' AND finalizado_en >= CURRENT_DATE AND operador_id = $2)::INT AS atendidos_hoy_operador,
         COALESCE(
           ROUND((AVG(calificacion_csat) FILTER (WHERE calificacion_csat IS NOT NULL) / 5.0) * 100.0, 1),
           0
         )::float8 AS satisfaccion_pct,
         COUNT(*) FILTER (WHERE calificacion_csat IS NOT NULL)::INT AS opiniones_registradas
       FROM turnos
       WHERE sucursal_id = $1`,
      [sucursalId, operadorId]
    );
    return res.rows[0];
  }

  async getNextCodigoTurno(moduloCola: 'A' | 'B' | 'C'): Promise<string> {
    const res = await query<{ max_num: number | null }>(
      `SELECT MAX(NULLIF(regexp_replace(codigo_turno, '[^0-9]', '', 'g'), '')::INT) AS max_num
       FROM turnos
       WHERE modulo_cola = $1`,
      [moduloCola]
    );
    const nextNum = (res.rows[0]?.max_num ?? 0) + 1;
    return `${moduloCola}-${String(nextNum).padStart(3, '0')}`;
  }

  async create(
    dto: EmitirTurnoDto,
    sucursalId: number,
    codigoTurno: string,
    clienteId: number | null,
    suministroId: number | null
  ): Promise<TurnoEntity> {
    const prioridad = dto.modulo_cola === 'B' ? 'PREFERENCIAL' : dto.modulo_cola === 'C' ? 'TECNICO' : 'NORMAL';
    const res = await query<TurnoEntity>(
      `INSERT INTO turnos (
         codigo_turno, sucursal_id, cliente_id, suministro_id, nombre_visitante, dni_visitante,
         nis_visitante, modulo_cola, prioridad, motivo_visita, canal_emision, estado
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EN_ESPERA')
       RETURNING *`,
      [
        codigoTurno,
        sucursalId,
        clienteId,
        suministroId,
        dto.nombre_visitante,
        dto.dni_visitante,
        dto.nis_visitante ?? null,
        dto.modulo_cola,
        prioridad,
        dto.motivo_visita,
        dto.canal_emision
      ]
    );
    return res.rows[0];
  }

  async pickNextWaitingTurno(sucursalId: number, client: PoolClient): Promise<TurnoEntity | null> {
    const res = await client.query<TurnoEntity>(
      `SELECT *
       FROM turnos
       WHERE sucursal_id = $1 AND estado = 'EN_ESPERA'
       ORDER BY
         CASE WHEN prioridad = 'PREFERENCIAL' AND EXTRACT(EPOCH FROM (NOW() - creado_en)) >= 240 THEN 0 ELSE 1 END ASC,
         creado_en ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [sucursalId]
    );
    return res.rows[0] ?? null;
  }

  async markEnAtencion(
    turnoId: number,
    ventanillaId: number,
    operadorId: number,
    client: PoolClient
  ): Promise<TurnoEntity> {
    const res = await client.query<TurnoEntity>(
      `UPDATE turnos
       SET estado = 'EN_ATENCION', ventanilla_id = $2, operador_id = $3, llamado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [turnoId, ventanillaId, operadorId]
    );
    return res.rows[0];
  }

  async appendNota(turnoId: number, notaFormateada: string): Promise<TurnoEntity | null> {
    const res = await query<TurnoEntity>(
      `UPDATE turnos
       SET notas_atencion = CASE
         WHEN notas_atencion = '' THEN $2
         ELSE notas_atencion || E'\n' || $2
       END
       WHERE id = $1
       RETURNING *`,
      [turnoId, notaFormateada]
    );
    return res.rows[0] ?? null;
  }

  async derivar(
    turnoId: number,
    moduloCola: 'A' | 'B' | 'C',
    nota: string | null,
    client: PoolClient
  ): Promise<TurnoEntity> {
    const prioridad = moduloCola === 'B' ? 'PREFERENCIAL' : moduloCola === 'C' ? 'TECNICO' : 'NORMAL';
    const res = await client.query<TurnoEntity>(
      `UPDATE turnos
       SET
         modulo_cola = $2,
         prioridad = $3,
         estado = 'EN_ESPERA',
         ventanilla_id = NULL,
         operador_id = NULL,
         llamado_en = NULL,
         notas_atencion = CASE
           WHEN $4::TEXT IS NULL THEN notas_atencion
           WHEN notas_atencion = '' THEN $4
           ELSE notas_atencion || E'\n' || $4
         END
       WHERE id = $1
       RETURNING *`,
      [turnoId, moduloCola, prioridad, nota]
    );
    return res.rows[0];
  }

  async markAusente(turnoId: number, client: PoolClient): Promise<TurnoEntity> {
    const res = await client.query<TurnoEntity>(
      `UPDATE turnos
       SET estado = 'AUSENTE', finalizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [turnoId]
    );
    return res.rows[0];
  }

  async finalizar(
    turnoId: number,
    resolucionResumen: string,
    csat: number | null,
    client: PoolClient
  ): Promise<TurnoEntity> {
    const res = await client.query<TurnoEntity>(
      `UPDATE turnos
       SET
         estado = 'FINALIZADO',
         resolucion_resumen = $2,
         calificacion_csat = $3,
         finalizado_en = NOW(),
         duracion_segundos = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(llamado_en, creado_en)))))::INT
       WHERE id = $1
       RETURNING *`,
      [turnoId, resolucionResumen, csat]
    );
    return res.rows[0];
  }
}
