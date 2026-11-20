import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_NAME = process.env.DB_NAME || 'sacs_atencion';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';

async function ensureDatabaseExists(): Promise<void> {
  const adminClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: 'postgres',
    user: DB_USER,
    password: DB_PASSWORD
  });
  await adminClient.connect();
  try {
    const res = await adminClient.query<{ exists: number }>(
      'SELECT 1 AS exists FROM pg_database WHERE datname = $1',
      [DB_NAME]
    );
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`[DB] Base de datos "${DB_NAME}" creada en PostgreSQL.`);
    } else {
      console.log(`[DB] Base de datos "${DB_NAME}" ya existe.`);
    }
  } finally {
    await adminClient.end();
  }
}

async function seedDatabase(client: Client): Promise<void> {
  const { rows: existing } = await client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM sucursales'
  );
  if (Number(existing[0]?.count || 0) > 0) {
    console.log('[DB] Configuración base ya presente. Omitiendo inserción inicial (idempotente).');
    return;
  }

  console.log('[DB] Cargando configuración base limpia (Sede Lambramani + ADMIN + Box 01 + Cuadrillas)...');
  await client.query('BEGIN');
  try {
    // 1. Sucursal única
    const sucRes = await client.query<{ id: number }>(
      `INSERT INTO sucursales (codigo, nombre, direccion, estado_red_pct)
       VALUES ('01-L', 'Sede Lambramani', 'Av. Lambramani, Cercado - Arequipa', 99.10)
       RETURNING id`
    );
    const sucId = sucRes.rows[0].id;

    // 2. Usuario administrador único inicial: ADMIN / ADMIN
    const hashAdmin = await bcrypt.hash('ADMIN', 10);
    const usrRes = await client.query<{ id: number }>(
      `INSERT INTO usuarios (codigo_empleado, nombre_completo, iniciales, password_hash, rol, cargo, sucursal_id)
       VALUES ('ADMIN', 'Administrador SACS', 'AD', $1, 'ADMIN', 'Administrador del Sistema', $2)
       RETURNING id`,
      [hashAdmin, sucId]
    );
    const adminId = usrRes.rows[0].id;

    // 3. Ventanilla operativa limpia para ADMIN
    await client.query(
      `INSERT INTO ventanillas (sucursal_id, codigo, nombre, tipo_modulo, operador_id, estado)
       VALUES ($1, 'BOX-01', 'Box 01', 'GENERAL', $2, 'DISPONIBLE')`,
      [sucId, adminId]
    );

    // 4. Catálogo de cuadrillas disponibles (0 en ruta inicialmente)
    await client.query(
      `INSERT INTO cuadrillas (codigo, nombre, lider_nombre, cip, especialidad, estado, zona, latitud, longitud, ubicacion_texto)
       VALUES
         ('CUAD-EMERG-04', 'Móvil Bravo 04', 'Ing. R. Ramos', 'CIP 84920', 'EMERGENCIA', 'DISPONIBLE', 'Sede Lambramani / Centro', -16.409047, -71.537451, 'Disponible en Base Lambramani'),
         ('CUAD-MT-01', 'Móvil Alfa 02', 'Téc. Delgado', 'CIP 71204', 'MEDIA_TENSION', 'DISPONIBLE', 'Zona Industrial Norte', -16.379100, -71.558200, 'Disponible en Base Norte'),
         ('CUAD-INSP-03', 'Móvil Delta 01', 'Téc. Quispe', 'CIP 69311', 'INSPECCION', 'DISPONIBLE', 'Cayma / Yanahuara', -16.386510, -71.549800, 'Disponible en Base Cayma'),
         ('CUAD-REC-02', 'Móvil Eco 03', 'Téc. Mamani', 'CIP 75410', 'RECONEXION', 'DISPONIBLE', 'Paucarpata / Bustamante', -16.429481, -71.503921, 'Disponible en Base Sur')`
    );

    await client.query('COMMIT');
    console.log('[DB] Configuración base limpia aplicada (0 registros operativos en el menú).');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

export async function initializeDatabase(): Promise<void> {
  await ensureDatabaseExists();
  const dbClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD
  });
  await dbClient.connect();
  try {
    const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await dbClient.query(schemaSql);
    console.log('[DB] Esquema de 17 tablas, índices y 4 vistas aplicado.');
    await seedDatabase(dbClient);
  } finally {
    await dbClient.end();
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('[DB] Inicialización completa.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB] Error al inicializar la base de datos:', err);
      process.exit(1);
    });
}
