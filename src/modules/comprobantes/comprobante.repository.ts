import { PoolClient } from 'pg';
import { query } from '../../shared/database/connection';
import { ConvenioEntity, DestinoCopia, MetodoPago, PagoEntity, ReciboEntity, TipoComprobante } from './comprobante.entity';

function exec(client?: PoolClient) {
  return client ? client.query.bind(client) : query;
}

export class ComprobanteRepository {
  async findSuministroIdByQuery(q: string): Promise<number | null> {
    const clean = q.trim();
    if (!clean) {
      const def = await query<{ id: number }>(
        `SELECT id FROM suministros WHERE nis = '20491823' LIMIT 1`
      );
      if (def.rows[0]) return def.rows[0].id;
      const first = await query<{ id: number }>(`SELECT id FROM suministros ORDER BY id ASC LIMIT 1`);
      return first.rows[0]?.id ?? null;
    }

    const res = await query<{ suministro_id: number }>(
      `SELECT s.id AS suministro_id
       FROM suministros s
       JOIN clientes c ON c.id = s.cliente_id
       LEFT JOIN recibos r ON r.suministro_id = s.id
       WHERE s.nis ILIKE $1
          OR c.dni_ruc ILIKE $1
          OR r.numero_recibo ILIKE $1
          OR c.nombres_apellidos ILIKE $1
       ORDER BY
         CASE WHEN UPPER(s.nis) = UPPER($2) OR UPPER(c.dni_ruc) = UPPER($2) THEN 0 ELSE 1 END ASC,
         s.id ASC
       LIMIT 1`,
      [`%${clean}%`, clean]
    );
    return res.rows[0]?.suministro_id ?? null;
  }

  async listRecibosBySuministro(suministroId: number, client?: PoolClient): Promise<ReciboEntity[]> {
    const run = exec(client);
    const res = await run<ReciboEntity>(
      `SELECT
         id, numero_recibo, suministro_id, periodo,
         consumo_kwh::float8 AS consumo_kwh,
         energia_activa::float8 AS energia_activa,
         reposicion_mant::float8 AS reposicion_mant,
         cargo_fijo::float8 AS cargo_fijo,
         alumbrado_publico::float8 AS alumbrado_publico,
         igv::float8 AS igv,
         total::float8 AS total,
         fecha_emision::text AS fecha_emision,
         fecha_vencimiento::text AS fecha_vencimiento,
         estado, convenio_id
       FROM recibos
       WHERE suministro_id = $1
       ORDER BY fecha_emision DESC, id DESC`,
      [suministroId]
    );
    return res.rows;
  }

  async findLastPagoBySuministro(suministroId: number): Promise<PagoEntity | null> {
    const res = await query<PagoEntity>(
      `SELECT id, codigo_operacion, recibo_id, suministro_id, operador_id,
              monto::float8 AS monto, metodo_pago, tipo_comprobante, numero_comprobante, destino_copia, pagado_en
       FROM pagos
       WHERE suministro_id = $1
       ORDER BY pagado_en DESC, id DESC
       LIMIT 1`,
      [suministroId]
    );
    return res.rows[0] ?? null;
  }

  async listConveniosBySuministro(suministroId: number): Promise<ConvenioEntity[]> {
    const res = await query<ConvenioEntity>(
      `SELECT id, codigo_acta, cliente_id, suministro_id, operador_id,
              capital_fraccionado::float8 AS capital_fraccionado,
              tcea_pct::float8 AS tcea_pct,
              numero_cuotas,
              interes_estimado::float8 AS interes_estimado,
              cuota_mensual::float8 AS cuota_mensual,
              estado, creado_en
       FROM convenios
       WHERE suministro_id = $1
       ORDER BY creado_en DESC`,
      [suministroId]
    );
    return res.rows;
  }

  async findReciboForUpdate(reciboId: number, client: PoolClient): Promise<ReciboEntity | null> {
    const res = await client.query<ReciboEntity>(
      `SELECT
         id, numero_recibo, suministro_id, periodo,
         consumo_kwh::float8 AS consumo_kwh,
         energia_activa::float8 AS energia_activa,
         reposicion_mant::float8 AS reposicion_mant,
         cargo_fijo::float8 AS cargo_fijo,
         alumbrado_publico::float8 AS alumbrado_publico,
         igv::float8 AS igv,
         total::float8 AS total,
         fecha_emision::text AS fecha_emision,
         fecha_vencimiento::text AS fecha_vencimiento,
         estado, convenio_id
       FROM recibos
       WHERE id = $1
       FOR UPDATE`,
      [reciboId]
    );
    return res.rows[0] ?? null;
  }

  async markReciboPagado(reciboId: number, client: PoolClient): Promise<ReciboEntity> {
    const res = await client.query<ReciboEntity>(
      `UPDATE recibos SET estado = 'PAGADO' WHERE id = $1
       RETURNING id, numero_recibo, suministro_id, periodo,
                 consumo_kwh::float8 AS consumo_kwh,
                 energia_activa::float8 AS energia_activa,
                 reposicion_mant::float8 AS reposicion_mant,
                 cargo_fijo::float8 AS cargo_fijo,
                 alumbrado_publico::float8 AS alumbrado_publico,
                 igv::float8 AS igv,
                 total::float8 AS total,
                 fecha_emision::text AS fecha_emision,
                 fecha_vencimiento::text AS fecha_vencimiento,
                 estado, convenio_id`,
      [reciboId]
    );
    return res.rows[0];
  }

  async createPago(
    params: {
      codigo_operacion: string;
      recibo_id: number;
      suministro_id: number;
      operador_id: number;
      monto: number;
      metodo_pago: MetodoPago;
      tipo_comprobante: TipoComprobante;
      numero_comprobante: string;
      destino_copia: DestinoCopia;
    },
    client: PoolClient
  ): Promise<PagoEntity> {
    const res = await client.query<PagoEntity>(
      `INSERT INTO pagos (
         codigo_operacion, recibo_id, suministro_id, operador_id, monto,
         metodo_pago, tipo_comprobante, numero_comprobante, destino_copia
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, codigo_operacion, recibo_id, suministro_id, operador_id,
                 monto::float8 AS monto, metodo_pago, tipo_comprobante, numero_comprobante, destino_copia, pagado_en`,
      [
        params.codigo_operacion,
        params.recibo_id,
        params.suministro_id,
        params.operador_id,
        params.monto,
        params.metodo_pago,
        params.tipo_comprobante,
        params.numero_comprobante,
        params.destino_copia
      ]
    );
    return res.rows[0];
  }

  async findRecibosPendientesForUpdate(
    suministroId: number,
    reciboIds: number[] | undefined,
    client: PoolClient
  ): Promise<ReciboEntity[]> {
    const hasIds = reciboIds && reciboIds.length > 0;
    const res = await client.query<ReciboEntity>(
      `SELECT
         id, numero_recibo, suministro_id, periodo,
         consumo_kwh::float8 AS consumo_kwh,
         energia_activa::float8 AS energia_activa,
         reposicion_mant::float8 AS reposicion_mant,
         cargo_fijo::float8 AS cargo_fijo,
         alumbrado_publico::float8 AS alumbrado_publico,
         igv::float8 AS igv,
         total::float8 AS total,
         fecha_emision::text AS fecha_emision,
         fecha_vencimiento::text AS fecha_vencimiento,
         estado, convenio_id
       FROM recibos
       WHERE suministro_id = $1
         AND estado IN ('PENDIENTE', 'VENCIDO')
         AND ($2::INT[] IS NULL OR id = ANY($2))
       ORDER BY fecha_vencimiento ASC
       FOR UPDATE`,
      [suministroId, hasIds ? reciboIds : null]
    );
    return res.rows;
  }

  async createConvenio(
    params: {
      codigo_acta: string;
      cliente_id: number;
      suministro_id: number;
      operador_id: number;
      capital_fraccionado: number;
      tcea_pct: number;
      numero_cuotas: 3 | 6 | 12;
      interes_estimado: number;
      cuota_mensual: number;
    },
    client: PoolClient
  ): Promise<ConvenioEntity> {
    const res = await client.query<ConvenioEntity>(
      `INSERT INTO convenios (
         codigo_acta, cliente_id, suministro_id, operador_id,
         capital_fraccionado, tcea_pct, numero_cuotas, interes_estimado, cuota_mensual
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, codigo_acta, cliente_id, suministro_id, operador_id,
                 capital_fraccionado::float8 AS capital_fraccionado,
                 tcea_pct::float8 AS tcea_pct,
                 numero_cuotas,
                 interes_estimado::float8 AS interes_estimado,
                 cuota_mensual::float8 AS cuota_mensual,
                 estado, creado_en`,
      [
        params.codigo_acta,
        params.cliente_id,
        params.suministro_id,
        params.operador_id,
        params.capital_fraccionado,
        params.tcea_pct,
        params.numero_cuotas,
        params.interes_estimado,
        params.cuota_mensual
      ]
    );
    return res.rows[0];
  }

  async markRecibosFraccionados(reciboIds: number[], convenioId: number, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE recibos
       SET estado = 'FRACCIONADO', convenio_id = $2
       WHERE id = ANY($1)`,
      [reciboIds, convenioId]
    );
  }

  async createRecibo(params: {
    numero_recibo: string;
    suministro_id: number;
    periodo: string;
    consumo_kwh: number;
    energia_activa: number;
    reposicion_mant: number;
    cargo_fijo: number;
    alumbrado_publico: number;
    igv: number;
    total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
  }): Promise<ReciboEntity> {
    const res = await query<ReciboEntity>(
      `INSERT INTO recibos (
         numero_recibo, suministro_id, periodo, consumo_kwh, energia_activa,
         reposicion_mant, cargo_fijo, alumbrado_publico, igv, total,
         fecha_emision, fecha_vencimiento, estado
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDIENTE')
       RETURNING id, numero_recibo, suministro_id, periodo,
                 consumo_kwh::float8 AS consumo_kwh,
                 energia_activa::float8 AS energia_activa,
                 reposicion_mant::float8 AS reposicion_mant,
                 cargo_fijo::float8 AS cargo_fijo,
                 alumbrado_publico::float8 AS alumbrado_publico,
                 igv::float8 AS igv,
                 total::float8 AS total,
                 fecha_emision::text AS fecha_emision,
                 fecha_vencimiento::text AS fecha_vencimiento,
                 estado, convenio_id`,
      [
        params.numero_recibo,
        params.suministro_id,
        params.periodo,
        params.consumo_kwh,
        params.energia_activa,
        params.reposicion_mant,
        params.cargo_fijo,
        params.alumbrado_publico,
        params.igv,
        params.total,
        params.fecha_emision,
        params.fecha_vencimiento
      ]
    );
    return res.rows[0];
  }
}
