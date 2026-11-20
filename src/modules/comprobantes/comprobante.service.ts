import { withTransaction } from '../../shared/database/connection';
import { AppError } from '../../shared/utils/app-error';
import {
  generateActaConvenioCode,
  generateComprobanteCode,
  generateOperacionCode,
  generateReciboCode
} from '../../shared/utils/codes.util';
import { calcularConvenioFraccionamiento, calcularDesgloseIgv } from '../../shared/utils/finance.util';
import { ClienteRepository } from '../clientes/cliente.repository';
import { CrearConvenioDto, EmitirReciboDto, RegistrarPagoDto } from './comprobante.dto';
import { ComprobanteRepository } from './comprobante.repository';

export class ComprobanteService {
  constructor(
    private readonly repo = new ComprobanteRepository(),
    private readonly clienteRepo = new ClienteRepository()
  ) {}

  async consultar(q: string) {
    const suministroId = await this.repo.findSuministroIdByQuery(q);
    if (!suministroId) {
      if (!q.trim()) {
        return null;
      }
      throw new AppError(404, `No se encontraron comprobantes ni suministros para "${q}".`);
    }

    const suministro = await this.clienteRepo.findSuministroById(suministroId);
    if (!suministro) {
      throw new AppError(404, 'Suministro no encontrado.');
    }

    const [cliente, recibos, ultimoPago, consumos, convenios] = await Promise.all([
      this.clienteRepo.findClienteById(suministro.cliente_id),
      this.repo.listRecibosBySuministro(suministro.id),
      this.repo.findLastPagoBySuministro(suministro.id),
      this.clienteRepo.getConsumos(suministro.id),
      this.repo.listConveniosBySuministro(suministro.id)
    ]);

    const pendientes = recibos.filter((r) => r.estado === 'PENDIENTE' || r.estado === 'VENCIDO');
    const deudaTotal = Math.round(pendientes.reduce((acc, r) => acc + Number(r.total), 0) * 100) / 100;

    return {
      cliente,
      suministro,
      deuda_total: deudaTotal,
      recibos_pendientes_count: pendientes.length,
      proximo_vencimiento: pendientes[0]?.fecha_vencimiento ?? null,
      ultimo_pago: ultimoPago,
      recibos,
      consumos,
      convenios
    };
  }

  async registrarPago(dto: RegistrarPagoDto, operadorId: number) {
    return withTransaction(async (client) => {
      const recibo = await this.repo.findReciboForUpdate(dto.recibo_id, client);
      if (!recibo) {
        throw new AppError(404, 'Recibo no encontrado.');
      }
      if (!['PENDIENTE', 'VENCIDO'].includes(recibo.estado)) {
        throw new AppError(
          409,
          `El recibo ${recibo.numero_recibo} no se puede cobrar porque su estado es ${recibo.estado}.`
        );
      }
      if (dto.monto + 0.01 < Number(recibo.total)) {
        throw new AppError(
          400,
          `El monto a liquidar (S/ ${dto.monto.toFixed(2)}) es menor al total del recibo (S/ ${Number(recibo.total).toFixed(2)}).`
        );
      }

      const reciboActualizado = await this.repo.markReciboPagado(recibo.id, client);
      const pago = await this.repo.createPago(
        {
          codigo_operacion: generateOperacionCode(),
          recibo_id: recibo.id,
          suministro_id: recibo.suministro_id,
          operador_id: operadorId,
          monto: Number(recibo.total),
          metodo_pago: dto.metodo_pago,
          tipo_comprobante: dto.tipo_comprobante,
          numero_comprobante: generateComprobanteCode(dto.tipo_comprobante),
          destino_copia: dto.destino_copia
        },
        client
      );

      const suministro = await this.clienteRepo.findSuministroById(recibo.suministro_id, client);
      const cliente = suministro ? await this.clienteRepo.findClienteById(suministro.cliente_id, client) : null;

      return {
        pago,
        recibo: reciboActualizado,
        suministro,
        cliente
      };
    });
  }

  async crearConvenio(dto: CrearConvenioDto, operadorId: number) {
    return withTransaction(async (client) => {
      const suministro = await this.clienteRepo.findSuministroById(dto.suministro_id, client);
      if (!suministro) {
        throw new AppError(404, 'Suministro no encontrado.');
      }

      const pendientes = await this.repo.findRecibosPendientesForUpdate(
        suministro.id,
        dto.recibo_ids,
        client
      );
      if (pendientes.length === 0) {
        throw new AppError(409, 'No existen recibos pendientes para fraccionar en este suministro.');
      }

      const capital = pendientes.reduce((acc, r) => acc + Number(r.total), 0);
      const calculo = calcularConvenioFraccionamiento(capital, dto.numero_cuotas, 1.85);

      const convenio = await this.repo.createConvenio(
        {
          codigo_acta: generateActaConvenioCode(),
          cliente_id: suministro.cliente_id,
          suministro_id: suministro.id,
          operador_id: operadorId,
          capital_fraccionado: calculo.capitalFraccionado,
          tcea_pct: calculo.tceaPct,
          numero_cuotas: calculo.numeroCuotas,
          interes_estimado: calculo.interesEstimado,
          cuota_mensual: calculo.cuotaMensual
        },
        client
      );

      await this.repo.markRecibosFraccionados(
        pendientes.map((r) => r.id),
        convenio.id,
        client
      );

      const cliente = await this.clienteRepo.findClienteById(suministro.cliente_id, client);
      return {
        convenio,
        recibos_fraccionados: pendientes.map((r) => r.numero_recibo),
        suministro,
        cliente
      };
    });
  }

  async emitirRecibo(dto: EmitirReciboDto) {
    const suministro = await this.clienteRepo.findSuministroByNis(dto.nis);
    if (!suministro) {
      throw new AppError(404, `No existe un suministro con NIS "${dto.nis}".`);
    }
    const total =
      Math.round(
        (dto.energia_activa + dto.reposicion_mant + dto.cargo_fijo + dto.alumbrado_publico) * 100
      ) / 100;
    const { igv } = calcularDesgloseIgv(total);
    const hoy = new Date();
    const vence = dto.fecha_vencimiento || new Date(hoy.getTime() + 15 * 86400 * 1000).toISOString().slice(0, 10);

    return this.repo.createRecibo({
      numero_recibo: generateReciboCode(),
      suministro_id: suministro.id,
      periodo: dto.periodo,
      consumo_kwh: dto.consumo_kwh,
      energia_activa: dto.energia_activa,
      reposicion_mant: dto.reposicion_mant,
      cargo_fijo: dto.cargo_fijo,
      alumbrado_publico: dto.alumbrado_publico,
      igv,
      total,
      fecha_emision: hoy.toISOString().slice(0, 10),
      fecha_vencimiento: vence
    });
  }
}
