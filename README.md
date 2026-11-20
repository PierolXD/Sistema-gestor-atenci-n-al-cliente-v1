# SACS / SEAL — Sistema de Atención al Cliente y Operaciones

Sistema integral de atención al cliente para el sector eléctrico (SEAL), construido bajo **Arquitectura en Capas (N-Tier)** combinada con **Patrón Repositorio (Repository Pattern)** y organización **Package by Feature**, conectado en tiempo real a **PostgreSQL 14** (`sacs_atencion`).

---

## Credenciales de Acceso

| Usuario / Código | Contraseña | Rol | Ventanilla | Sede |
| :--- | :--- | :--- | :--- | :--- |
| **`ADMIN`** | **`ADMIN`** | Administrador | Box 01 | Sede Lambramani |

*(El sistema inicia completamente limpio sin datos ficticios para que registres clientes, turnos, tickets, recibos y OTs en vivo durante tu atención).*

---

## Cómo Iniciar para Presentación / Exposición

### Opción 1 — Doble clic (Recomendada)
Haz doble clic en **`INICIAR_SISTEMA.bat`**. El script automáticamente:
1. Verifica que el servicio `postgresql-x64-14` esté encendido.
2. Verifica/crea la base de datos `sacs_atencion` (`npm run db:init` es idempotente).
3. Compila e inicia el servidor en `http://localhost:3000`.
4. Abre automáticamente el navegador en la pantalla de inicio de sesión.

### Opción 2 — Por Terminal (PowerShell)
```powershell
cd "C:\Users\Asus\Desktop\sistema de SIA\SISTEMA"
npm run db:init
npm run dev
```
Luego abre: `http://localhost:3000/login.html`

---

## Cómo Ver las Tablas y Vistas en pgAdmin 4

1. Abre **pgAdmin 4**.
2. Conéctate a tu servidor local **PostgreSQL 14** (`localhost`, puerto `5432`, usuario `postgres`).
3. Despliega **Databases → `sacs_atencion` → Schemas → `public`**.
4. En **Tables** encontrarás las **17 tablas relacionales**:
   - `sucursales`, `usuarios`, `ventanillas`
   - `clientes`, `suministros`, `consumos_historicos`, `inspecciones_medidor`, `personas_autorizadas`
   - `turnos`
   - `tickets`, `ticket_mensajes`
   - `cuadrillas`, `ordenes_trabajo`, `ot_eventos`
   - `recibos`, `pagos`, `convenios`
5. En **Views** encontrarás las **4 vistas de solo lectura**:
   - `vw_resumen_cuenta_corriente`
   - `vw_atenciones_sla`
   - `vw_interrupciones_activas`
   - `vw_rendimiento_operadores`

---

## Arquitectura del Proyecto

```text
src/
├── modules/                      # Package by Feature (7 módulos operativos)
│   ├── usuarios/                 # Login JWT, sucursales y ventanillas
│   ├── turnos/                   # Cola presencial, cronómetro y atención en vivo
│   ├── clientes/                 # Catastro 360°, medidores, telemedición, inspecciones
│   ├── tickets/                  # Bandeja multicanal, tipificación NTCSE/Osinergmin
│   ├── comprobantes/             # Recibos, cobranza en ventanilla y convenios TCEA
│   ├── ordenes-trabajo/          # Despacho de cuadrillas, flujo 5 pasos y bitácora
│   └── indicadores/              # KPIs en tiempo real (TMO, FCR, CSAT, SLA) y CSV
├── shared/
│   ├── database/                 # Pool PostgreSQL, transacciones e init idempotente
│   ├── middlewares/              # Auth JWT, validación Zod, manejo central de errores
│   └── utils/                    # SLA, cálculo financiero TCEA, correlativos
└── app.ts                        # Punto de entrada Express + API REST + Frontend
```

Cada módulo separa estrictamente:
- `*.entity.ts` (Entidades del dominio)
- `*.dto.ts` (Validación de entrada con Zod)
- `*.repository.ts` (Consultas SQL parametrizadas a PostgreSQL)
- `*.service.ts` (Reglas de negocio y transacciones ACID)
- `*.controller.ts` (Controlador HTTP)
- `*.routes.ts` (Rutas Express)

---

## Pruebas y Verificación

```powershell
npm run build   # Compilación estricta TypeScript
npm test        # Pruebas E2E automatizadas contra Express + PostgreSQL
```
