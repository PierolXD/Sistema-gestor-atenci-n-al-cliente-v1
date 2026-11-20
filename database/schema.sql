-- ============================================================================
-- SACS / SEAL - Sistema de Atención al Cliente y Operaciones
-- Esquema Relacional PostgreSQL (17 Tablas + Índices + 4 Vistas de Solo Lectura)
-- ============================================================================

-- 1. Sucursales Operativas
CREATE TABLE IF NOT EXISTS sucursales (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    direccion VARCHAR(200),
    estado_red_pct NUMERIC(5,2) NOT NULL DEFAULT 99.10,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Usuarios (Operadores, Supervisores y Administradores)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    codigo_empleado VARCHAR(40) UNIQUE NOT NULL,
    nombre_completo VARCHAR(120) NOT NULL,
    iniciales VARCHAR(4) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('ADMIN', 'SUPERVISOR', 'OPERADOR')),
    cargo VARCHAR(80),
    sucursal_id INT REFERENCES sucursales(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ventanillas / Boxes de Atención
CREATE TABLE IF NOT EXISTS ventanillas (
    id SERIAL PRIMARY KEY,
    sucursal_id INT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    tipo_modulo VARCHAR(30) NOT NULL CHECK (tipo_modulo IN ('GENERAL', 'PREFERENCIAL', 'TECNICO', 'COMPLEJOS', 'ADMIN')),
    operador_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE', 'OCUPADO', 'PAUSA', 'INACTIVO')),
    turno_actual_id INT,
    ultimo_cambio_estado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Clientes (Titulares y Contribuyentes)
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    dni_ruc VARCHAR(15) UNIQUE NOT NULL,
    tipo_documento VARCHAR(10) NOT NULL DEFAULT 'DNI' CHECK (tipo_documento IN ('DNI', 'RUC', 'CE')),
    nombres_apellidos VARCHAR(150) NOT NULL,
    telefono VARCHAR(30),
    correo VARCHAR(120),
    score_crediticio INT NOT NULL DEFAULT 90 CHECK (score_crediticio BETWEEN 0 AND 100),
    categoria_crediticia VARCHAR(5) NOT NULL DEFAULT 'A' CHECK (categoria_crediticia IN ('A', 'B', 'C')),
    notificaciones_sms BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- 5. Suministros Eléctricos (Catastro y Telemedición)
CREATE TABLE IF NOT EXISTS suministros (
    id SERIAL PRIMARY KEY,
    nis VARCHAR(25) UNIQUE NOT NULL,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    numero_medidor VARCHAR(40) UNIQUE NOT NULL,
    tipo_medidor VARCHAR(80) NOT NULL DEFAULT 'Monofásico Inteligente',
    tarifa VARCHAR(40) NOT NULL DEFAULT 'BT5B Residencial',
    potencia_contratada_kw NUMERIC(6,2) NOT NULL DEFAULT 3.50,
    ciclo_facturacion VARCHAR(10) NOT NULL DEFAULT '08',
    estado_servicio VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado_servicio IN ('ACTIVO', 'CORTADO', 'SUSPENDIDO')),
    direccion VARCHAR(200) NOT NULL,
    distrito VARCHAR(80) NOT NULL DEFAULT 'Arequipa',
    sector VARCHAR(120) NOT NULL DEFAULT 'Sector Centro',
    codigo_ruta VARCHAR(40),
    subestacion_sed VARCHAR(80),
    alimentador_mt VARCHAR(80),
    lectura_actual_kwh NUMERIC(10,2) NOT NULL DEFAULT 0,
    lectura_anterior_kwh NUMERIC(10,2) NOT NULL DEFAULT 0,
    tension_rms_v NUMERIC(6,2) NOT NULL DEFAULT 221.4,
    corriente_a NUMERIC(6,2) NOT NULL DEFAULT 4.82,
    factor_potencia NUMERIC(4,2) NOT NULL DEFAULT 0.96,
    tipo_acometida VARCHAR(100) NOT NULL DEFAULT 'Aérea Concéntrica 4mm²',
    caja_portamedidor VARCHAR(100) NOT NULL DEFAULT 'Poliéster Reforzado (LT)',
    llave_termomagnetica VARCHAR(80) NOT NULL DEFAULT '2x25A 6kA Curva C',
    puesta_tierra_ohm NUMERIC(6,2) NOT NULL DEFAULT 12.4,
    precinto_bornera VARCHAR(40),
    precinto_caja VARCHAR(40),
    latitud NUMERIC(10,6) NOT NULL DEFAULT -16.409047,
    longitud NUMERIC(10,6) NOT NULL DEFAULT -71.537451,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Consumos Históricos (6+ meses para comparativas)
CREATE TABLE IF NOT EXISTS consumos_historicos (
    id SERIAL PRIMARY KEY,
    suministro_id INT NOT NULL REFERENCES suministros(id) ON DELETE CASCADE,
    periodo VARCHAR(10) NOT NULL,
    etiqueta_mes VARCHAR(10) NOT NULL,
    consumo_kwh NUMERIC(10,2) NOT NULL,
    promedio_sector_kwh NUMERIC(10,2) NOT NULL DEFAULT 145.00,
    UNIQUE (suministro_id, periodo)
);

-- 7. Inspecciones Técnicas y Contrastes Metrológicos
CREATE TABLE IF NOT EXISTS inspecciones_medidor (
    id SERIAL PRIMARY KEY,
    suministro_id INT NOT NULL REFERENCES suministros(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('CONTRASTE', 'RENOVACION_ACOMETIDA', 'INSPECCION_PRECINTO')),
    codigo_certificado VARCHAR(60) NOT NULL,
    laboratorio_o_ot VARCHAR(120),
    estado VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADO' CHECK (estado IN ('PROGRAMADO', 'APROBADO', 'OBSERVADO', 'EJECUTADO')),
    fecha_ensayo DATE NOT NULL,
    error_medido_pct VARCHAR(30),
    proximo_vencimiento VARCHAR(30),
    precinto_bornera VARCHAR(40),
    precinto_caja VARCHAR(40),
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Personas Autorizadas por Cliente
CREATE TABLE IF NOT EXISTS personas_autorizadas (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(140) NOT NULL,
    relacion VARCHAR(80) NOT NULL,
    dni VARCHAR(20),
    telefono VARCHAR(30),
    correo VARCHAR(120),
    poder_legal BOOLEAN NOT NULL DEFAULT FALSE,
    nivel VARCHAR(20) NOT NULL DEFAULT 'SECUNDARIO' CHECK (nivel IN ('PRINCIPAL', 'SECUNDARIO', 'TECNICO')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Turnos Presenciales y Cola de Ventanilla
CREATE TABLE IF NOT EXISTS turnos (
    id SERIAL PRIMARY KEY,
    codigo_turno VARCHAR(20) NOT NULL,
    sucursal_id INT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
    suministro_id INT REFERENCES suministros(id) ON DELETE SET NULL,
    nombre_visitante VARCHAR(150) NOT NULL,
    dni_visitante VARCHAR(20) NOT NULL,
    nis_visitante VARCHAR(30),
    modulo_cola CHAR(1) NOT NULL CHECK (modulo_cola IN ('A', 'B', 'C')),
    prioridad VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('NORMAL', 'PREFERENCIAL', 'TECNICO')),
    motivo_visita TEXT NOT NULL,
    canal_emision VARCHAR(20) NOT NULL DEFAULT 'SALA' CHECK (canal_emision IN ('SALA', 'TOTEM', 'CITA_WEB')),
    estado VARCHAR(20) NOT NULL DEFAULT 'EN_ESPERA' CHECK (estado IN ('EN_ESPERA', 'EN_ATENCION', 'DERIVADO', 'FINALIZADO', 'AUSENTE')),
    ventanilla_id INT REFERENCES ventanillas(id) ON DELETE SET NULL,
    operador_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    notas_atencion TEXT NOT NULL DEFAULT '',
    resolucion_resumen TEXT,
    calificacion_csat INT CHECK (calificacion_csat BETWEEN 1 AND 5),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    llamado_en TIMESTAMPTZ,
    finalizado_en TIMESTAMPTZ,
    duracion_segundos INT NOT NULL DEFAULT 0
);

-- 10. Tickets de Atención y Reclamos Normativos (Osinergmin / NTCSE)
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    turno_id INT REFERENCES turnos(id) ON DELETE SET NULL,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    suministro_id INT NOT NULL REFERENCES suministros(id) ON DELETE CASCADE,
    canal VARCHAR(20) NOT NULL DEFAULT 'PRESENCIAL' CHECK (canal IN ('PRESENCIAL', 'WHATSAPP', 'PORTAL_WEB', 'CALL_CENTER')),
    prioridad VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('URGENTE', 'ALTA', 'NORMAL')),
    asunto VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    tipificacion_normativa VARCHAR(80),
    accion_inmediata VARCHAR(60),
    estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO' CHECK (estado IN ('REGISTRADO', 'EN_ATENCION', 'EN_CUADRILLA', 'ESCALADO_RECLAMO', 'RESUELTO', 'CERRADO')),
    es_reclamo_formal BOOLEAN NOT NULL DEFAULT FALSE,
    operador_asignado_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    sla_horas INT NOT NULL DEFAULT 5,
    sla_limite_en TIMESTAMPTZ NOT NULL,
    dictamen_tecnico TEXT,
    conflicto_marcado BOOLEAN NOT NULL DEFAULT FALSE,
    resuelto_primer_contacto BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en TIMESTAMPTZ
);

-- 11. Mensajes, Transcripción Bot y Bitácora de Ticket
CREATE TABLE IF NOT EXISTS ticket_mensajes (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    autor_tipo VARCHAR(20) NOT NULL CHECK (autor_tipo IN ('BOT', 'CLIENTE', 'SCADA', 'AGENTE', 'SISTEMA')),
    autor_nombre VARCHAR(120) NOT NULL,
    mensaje TEXT NOT NULL,
    evidencia_url VARCHAR(255),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Cuadrillas Técnicas en Campo
CREATE TABLE IF NOT EXISTS cuadrillas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    lider_nombre VARCHAR(120) NOT NULL,
    cip VARCHAR(30),
    especialidad VARCHAR(30) NOT NULL CHECK (especialidad IN ('EMERGENCIA', 'MEDIA_TENSION', 'INSPECCION', 'RECONEXION')),
    estado VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE', 'EN_RUTA', 'EN_SITIO', 'EN_BASE')),
    zona VARCHAR(100),
    latitud NUMERIC(10,6),
    longitud NUMERIC(10,6),
    ubicacion_texto VARCHAR(150)
);

-- 13. Órdenes de Trabajo (OTs)
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    ticket_id INT REFERENCES tickets(id) ON DELETE SET NULL,
    suministro_id INT NOT NULL REFERENCES suministros(id) ON DELETE CASCADE,
    cuadrilla_id INT REFERENCES cuadrillas(id) ON DELETE SET NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('EMERGENCIA', 'RECONEXION', 'INSPECCION', 'CORTE')),
    prioridad VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('CRITICA', 'ALTA', 'NORMAL')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    etapa VARCHAR(20) NOT NULL DEFAULT 'GENERADA' CHECK (etapa IN ('GENERADA', 'ASIGNADA', 'EN_SITIO', 'PRUEBAS', 'LIQUIDADA')),
    sla_horas INT NOT NULL DEFAULT 5,
    sla_limite_en TIMESTAMPTZ NOT NULL,
    materiales_imputados TEXT NOT NULL DEFAULT '',
    acta_digital_hash VARCHAR(80),
    validacion_cliente VARCHAR(80),
    creado_por_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    liquidada_en TIMESTAMPTZ
);

-- 14. Bitácora de Eventos de Campo en OTs
CREATE TABLE IF NOT EXISTS ot_eventos (
    id SERIAL PRIMARY KEY,
    ot_id INT NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    tipo_evento VARCHAR(30) NOT NULL CHECK (tipo_evento IN ('DESPACHO', 'TRANSITO', 'ARRIBO', 'PRUEBA', 'REASIGNACION', 'CIERRE', 'NOTA')),
    descripcion TEXT NOT NULL,
    reportado_por VARCHAR(120) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Convenios de Fraccionamiento (TCEA 1.85%)
CREATE TABLE IF NOT EXISTS convenios (
    id SERIAL PRIMARY KEY,
    codigo_acta VARCHAR(40) UNIQUE NOT NULL,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    suministro_id INT NOT NULL REFERENCES suministros(id) ON DELETE CASCADE,
    operador_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    capital_fraccionado NUMERIC(10,2) NOT NULL,
    tcea_pct NUMERIC(5,2) NOT NULL DEFAULT 1.85,
    numero_cuotas INT NOT NULL CHECK (numero_cuotas IN (3, 6, 12)),
    interes_estimado NUMERIC(10,2) NOT NULL,
    cuota_mensual NUMERIC(10,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'CANCELADO', 'ANULADO')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Recibos / Comprobantes de Facturación
CREATE TABLE IF NOT EXISTS recibos (
    id SERIAL PRIMARY KEY,
    numero_recibo VARCHAR(30) UNIQUE NOT NULL,
    suministro_id INT NOT NULL REFERENCES suministros(id) ON DELETE CASCADE,
    periodo VARCHAR(20) NOT NULL,
    consumo_kwh NUMERIC(10,2) NOT NULL,
    energia_activa NUMERIC(10,2) NOT NULL,
    reposicion_mant NUMERIC(10,2) NOT NULL DEFAULT 4.10,
    cargo_fijo NUMERIC(10,2) NOT NULL DEFAULT 5.10,
    alumbrado_publico NUMERIC(10,2) NOT NULL DEFAULT 14.50,
    igv NUMERIC(10,2) NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADO', 'VENCIDO', 'FRACCIONADO')),
    convenio_id INT REFERENCES convenios(id) ON DELETE SET NULL
);

-- 17. Pagos Registrados en Ventanilla / Pasarela
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    codigo_operacion VARCHAR(40) UNIQUE NOT NULL,
    recibo_id INT NOT NULL REFERENCES recibos(id) ON DELETE CASCADE,
    suministro_id INT NOT NULL REFERENCES suministros(id) ON DELETE CASCADE,
    operador_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    monto NUMERIC(10,2) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'POS', 'BILLETERA', 'TRANSFERENCIA')),
    tipo_comprobante VARCHAR(20) NOT NULL CHECK (tipo_comprobante IN ('BOLETA', 'FACTURA')),
    numero_comprobante VARCHAR(40) NOT NULL,
    destino_copia VARCHAR(20) NOT NULL DEFAULT 'IMPRESO' CHECK (destino_copia IN ('IMPRESO', 'EMAIL_SMS')),
    pagado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES DE RENDIMIENTO PARA BÚSQUEDAS EN VENTANILLA
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clientes_dni_ruc ON clientes(dni_ruc);
CREATE INDEX IF NOT EXISTS idx_suministros_nis ON suministros(nis);
CREATE INDEX IF NOT EXISTS idx_suministros_medidor ON suministros(numero_medidor);
CREATE INDEX IF NOT EXISTS idx_turnos_estado_modulo ON turnos(estado, modulo_cola);
CREATE INDEX IF NOT EXISTS idx_tickets_estado_canal_prio ON tickets(estado, canal, prioridad);
CREATE INDEX IF NOT EXISTS idx_recibos_suministro_estado ON recibos(suministro_id, estado);
CREATE INDEX IF NOT EXISTS idx_ots_etapa_tipo ON ordenes_trabajo(etapa, tipo);

-- ============================================================================
-- VISTAS DE SOLO LECTURA (Requerimiento SEAL / Auditoría pgAdmin 4)
-- ============================================================================

-- Vista 1: Resumen de Cuenta Corriente por Suministro
CREATE OR REPLACE VIEW vw_resumen_cuenta_corriente AS
SELECT
    s.id AS suministro_id,
    s.nis,
    c.id AS cliente_id,
    c.dni_ruc,
    c.nombres_apellidos AS titular,
    c.score_crediticio,
    c.categoria_crediticia,
    s.estado_servicio,
    COALESCE(SUM(CASE WHEN r.estado IN ('PENDIENTE', 'VENCIDO') THEN r.total ELSE 0 END), 0)::NUMERIC(10,2) AS deuda_exigible,
    COUNT(CASE WHEN r.estado IN ('PENDIENTE', 'VENCIDO') THEN 1 END)::INT AS recibos_pendientes,
    (SELECT MAX(p.pagado_en) FROM pagos p WHERE p.suministro_id = s.id) AS fecha_ultimo_pago
FROM suministros s
JOIN clientes c ON c.id = s.cliente_id
LEFT JOIN recibos r ON r.suministro_id = s.id
GROUP BY s.id, s.nis, c.id, c.dni_ruc, c.nombres_apellidos, c.score_crediticio, c.categoria_crediticia, s.estado_servicio;

-- Vista 2: Atenciones / Tickets y Control SLA Osinergmin
CREATE OR REPLACE VIEW vw_atenciones_sla AS
SELECT
    t.id AS ticket_id,
    t.codigo,
    t.canal,
    t.prioridad,
    t.estado,
    t.es_reclamo_formal,
    t.tipificacion_normativa,
    s.nis,
    c.dni_ruc,
    c.nombres_apellidos AS cliente,
    t.sla_horas,
    t.sla_limite_en,
    ROUND(EXTRACT(EPOCH FROM (t.sla_limite_en - NOW())) / 3600.0, 2) AS horas_restantes,
    (t.estado NOT IN ('RESUELTO', 'CERRADO') AND EXTRACT(EPOCH FROM (t.sla_limite_en - NOW())) <= 7200) AS en_riesgo_sla,
    u.codigo_empleado AS operador_codigo,
    t.creado_en
FROM tickets t
JOIN clientes c ON c.id = t.cliente_id
JOIN suministros s ON s.id = t.suministro_id
LEFT JOIN usuarios u ON u.id = t.operador_asignado_id;

-- Vista 3: Interrupciones y Cortes Activos (Despacho SCADA / OTs)
CREATE OR REPLACE VIEW vw_interrupciones_activas AS
SELECT
    ot.id AS ot_id,
    ot.codigo AS ot_codigo,
    ot.tipo,
    ot.prioridad,
    ot.etapa,
    ot.titulo,
    s.nis,
    s.subestacion_sed,
    s.alimentador_mt,
    s.direccion,
    cu.codigo AS cuadrilla_codigo,
    cu.nombre AS cuadrilla_nombre,
    cu.estado AS cuadrilla_estado,
    tk.codigo AS ticket_codigo,
    ot.sla_limite_en,
    ot.creado_en
FROM ordenes_trabajo ot
JOIN suministros s ON s.id = ot.suministro_id
LEFT JOIN cuadrillas cu ON cu.id = ot.cuadrilla_id
LEFT JOIN tickets tk ON tk.id = ot.ticket_id
WHERE ot.etapa <> 'LIQUIDADA';

-- Vista 4: Rendimiento Operativo por Agente y Ventanilla
CREATE OR REPLACE VIEW vw_rendimiento_operadores AS
SELECT
    u.id AS usuario_id,
    u.codigo_empleado,
    u.nombre_completo,
    u.iniciales,
    u.rol,
    u.cargo,
    v.codigo AS ventanilla_codigo,
    v.nombre AS ventanilla_nombre,
    v.tipo_modulo,
    v.estado AS ventanilla_estado,
    COUNT(DISTINCT tr.id) FILTER (WHERE tr.estado = 'FINALIZADO')::INT AS atenciones_totales,
    COALESCE(ROUND(AVG(tr.duracion_segundos) FILTER (WHERE tr.estado = 'FINALIZADO' AND tr.duracion_segundos > 0)), 0)::INT AS tmo_segundos,
    COALESCE(ROUND(AVG(tr.calificacion_csat) FILTER (WHERE tr.calificacion_csat IS NOT NULL), 2), 0.00)::NUMERIC(4,2) AS csat_promedio,
    COUNT(DISTINCT tk.id) FILTER (WHERE tk.estado IN ('RESUELTO', 'CERRADO'))::INT AS tickets_resueltos,
    COALESCE(
        ROUND(
            (COUNT(DISTINCT tk.id) FILTER (WHERE tk.estado IN ('RESUELTO', 'CERRADO') AND tk.resuelto_primer_contacto = TRUE)::NUMERIC * 100.0)
            / NULLIF(COUNT(DISTINCT tk.id) FILTER (WHERE tk.estado IN ('RESUELTO', 'CERRADO')), 0),
            1
        ),
        0.0
    )::NUMERIC(5,1) AS indice_conformidad_pct
FROM usuarios u
LEFT JOIN ventanillas v ON v.operador_id = u.id
LEFT JOIN turnos tr ON tr.operador_id = u.id
LEFT JOIN tickets tk ON tk.operador_asignado_id = u.id
GROUP BY u.id, u.codigo_empleado, u.nombre_completo, u.iniciales, u.rol, u.cargo, v.codigo, v.nombre, v.tipo_modulo, v.estado;
