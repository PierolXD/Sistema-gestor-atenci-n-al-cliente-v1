import { PoolClient } from 'pg';
import { query } from '../../shared/database/connection';
import {
  SucursalEntity,
  UsuarioEntity,
  UsuarioPublico,
  VentanillaDetalle,
  VentanillaEntity
} from './usuario.entity';

function exec(client?: PoolClient) {
  return client ? client.query.bind(client) : query;
}

export class UsuarioRepository {
  async findByCodigo(codigoEmpleado: string): Promise<UsuarioEntity | null> {
    const res = await query<UsuarioEntity>(
      `SELECT id, codigo_empleado, nombre_completo, iniciales, password_hash, rol, cargo, sucursal_id, activo, creado_en
       FROM usuarios
       WHERE UPPER(codigo_empleado) = UPPER($1)
       LIMIT 1`,
      [codigoEmpleado]
    );
    return res.rows[0] ?? null;
  }

  async findPublicById(id: number): Promise<UsuarioPublico | null> {
    const res = await query<UsuarioPublico>(
      `SELECT id, codigo_empleado, nombre_completo, iniciales, rol, cargo, sucursal_id, activo, creado_en
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async listUsuariosPublicos(): Promise<UsuarioPublico[]> {
    const res = await query<UsuarioPublico>(
      `SELECT id, codigo_empleado, nombre_completo, iniciales, rol, cargo, sucursal_id, activo, creado_en
       FROM usuarios
       WHERE activo = TRUE
       ORDER BY id ASC`
    );
    return res.rows;
  }

  async listSucursales(): Promise<SucursalEntity[]> {
    const res = await query<SucursalEntity>(
      `SELECT id, codigo, nombre, direccion, estado_red_pct::float8 AS estado_red_pct, activa
       FROM sucursales
       WHERE activa = TRUE
       ORDER BY id ASC`
    );
    return res.rows;
  }

  async findSucursalById(id: number): Promise<SucursalEntity | null> {
    const res = await query<SucursalEntity>(
      `SELECT id, codigo, nombre, direccion, estado_red_pct::float8 AS estado_red_pct, activa
       FROM sucursales
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findVentanillaByOperadorId(operadorId: number, client?: PoolClient): Promise<VentanillaDetalle | null> {
    const run = exec(client);
    const res = await run<VentanillaDetalle>(
      `SELECT
         v.id, v.sucursal_id, v.codigo, v.nombre, v.tipo_modulo, v.operador_id, v.estado,
         v.turno_actual_id, v.ultimo_cambio_estado,
         u.nombre_completo AS operador_nombre,
         u.codigo_empleado AS operador_codigo,
         u.iniciales AS operador_iniciales,
         t.codigo_turno AS turno_actual_codigo,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(t.llamado_en, v.ultimo_cambio_estado)))))::INT AS segundos_en_estado
       FROM ventanillas v
       LEFT JOIN usuarios u ON u.id = v.operador_id
       LEFT JOIN turnos t ON t.id = v.turno_actual_id
       WHERE v.operador_id = $1
       ORDER BY v.id ASC
       LIMIT 1`,
      [operadorId]
    );
    return res.rows[0] ?? null;
  }

  async findVentanillaById(id: number, client?: PoolClient): Promise<VentanillaEntity | null> {
    const run = exec(client);
    const res = await run<VentanillaEntity>(
      `SELECT id, sucursal_id, codigo, nombre, tipo_modulo, operador_id, estado, turno_actual_id, ultimo_cambio_estado
       FROM ventanillas
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async listVentanillas(sucursalId?: number, client?: PoolClient): Promise<VentanillaDetalle[]> {
    const run = exec(client);
    const res = await run<VentanillaDetalle>(
      `SELECT
         v.id, v.sucursal_id, v.codigo, v.nombre, v.tipo_modulo, v.operador_id, v.estado,
         v.turno_actual_id, v.ultimo_cambio_estado,
         u.nombre_completo AS operador_nombre,
         u.codigo_empleado AS operador_codigo,
         u.iniciales AS operador_iniciales,
         t.codigo_turno AS turno_actual_codigo,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(t.llamado_en, v.ultimo_cambio_estado)))))::INT AS segundos_en_estado
       FROM ventanillas v
       LEFT JOIN usuarios u ON u.id = v.operador_id
       LEFT JOIN turnos t ON t.id = v.turno_actual_id
       WHERE ($1::INT IS NULL OR v.sucursal_id = $1)
       ORDER BY v.codigo ASC`,
      [sucursalId ?? null]
    );
    return res.rows;
  }

  async updateVentanillaEstado(
    ventanillaId: number,
    estado: 'DISPONIBLE' | 'OCUPADO' | 'PAUSA' | 'INACTIVO',
    turnoActualId: number | null,
    client?: PoolClient
  ): Promise<VentanillaEntity | null> {
    const run = exec(client);
    const res = await run<VentanillaEntity>(
      `UPDATE ventanillas
       SET estado = $2, turno_actual_id = $3, ultimo_cambio_estado = NOW()
       WHERE id = $1
       RETURNING id, sucursal_id, codigo, nombre, tipo_modulo, operador_id, estado, turno_actual_id, ultimo_cambio_estado`,
      [ventanillaId, estado, turnoActualId]
    );
    return res.rows[0] ?? null;
  }

  async ensureVentanillaForUser(operadorId: number, sucursalId: number, client?: PoolClient): Promise<VentanillaDetalle | null> {
    const existing = await this.findVentanillaByOperadorId(operadorId, client);
    if (existing) return existing;

    const run = exec(client);
    const freeRes = await run<{ id: number }>(
      `SELECT id FROM ventanillas
       WHERE sucursal_id = $1 AND estado = 'DISPONIBLE' AND turno_actual_id IS NULL
       ORDER BY id DESC LIMIT 1`,
      [sucursalId]
    );
    if (freeRes.rows[0]) {
      await run(
        `UPDATE ventanillas SET operador_id = $1 WHERE id = $2`,
        [operadorId, freeRes.rows[0].id]
      );
      return this.findVentanillaByOperadorId(operadorId, client);
    }
    return null;
  }
}
