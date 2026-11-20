-- ============================================================================
-- SACS / SEAL - Configuración Base Limpia (PostgreSQL)
-- Nota: El comando `npm run db:init` ejecuta src/shared/database/init.ts, el cual
-- crea la BD si no existe, aplica schema.sql y deja únicamente la sucursal
-- Sede Lambramani, el usuario ADMIN/ADMIN, Box 01 y el catálogo de cuadrillas.
-- Todas las tablas operativas del menú inician limpias en 0 registros.
-- ============================================================================

INSERT INTO sucursales (codigo, nombre, direccion, estado_red_pct)
VALUES ('01-L', 'Sede Lambramani', 'Av. Lambramani, Cercado - Arequipa', 99.10)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cuadrillas (codigo, nombre, lider_nombre, cip, especialidad, estado, zona, latitud, longitud, ubicacion_texto)
VALUES
  ('CUAD-EMERG-04', 'Móvil Bravo 04', 'Ing. R. Ramos', 'CIP 84920', 'EMERGENCIA', 'DISPONIBLE', 'Sede Lambramani / Centro', -16.409047, -71.537451, 'Disponible en Base Lambramani'),
  ('CUAD-MT-01', 'Móvil Alfa 02', 'Téc. Delgado', 'CIP 71204', 'MEDIA_TENSION', 'DISPONIBLE', 'Zona Industrial Norte', -16.379100, -71.558200, 'Disponible en Base Norte'),
  ('CUAD-INSP-03', 'Móvil Delta 01', 'Téc. Quispe', 'CIP 69311', 'INSPECCION', 'DISPONIBLE', 'Cayma / Yanahuara', -16.386510, -71.549800, 'Disponible en Base Cayma'),
  ('CUAD-REC-02', 'Móvil Eco 03', 'Téc. Mamani', 'CIP 75410', 'RECONEXION', 'DISPONIBLE', 'Paucarpata / Bustamante', -16.429481, -71.503921, 'Disponible en Base Sur')
ON CONFLICT (codigo) DO NOTHING;
