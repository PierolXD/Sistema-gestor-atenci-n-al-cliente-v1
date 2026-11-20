import { withTransaction } from '../../shared/database/connection';
import { AppError } from '../../shared/utils/app-error';
import { generateActaDigitalHash, generateOtCode } from '../../shared/utils/codes.util';
import { calcularSlaOtHoras, sumarHorasIso } from '../../shared/utils/sla.util';
import { ClienteRepository } from '../clientes/cliente.repository';
import { AgregarEventoOtDto, AvanzarEtapaOtDto, CrearOtDto, ReasignarOtDto } from './ot.dto';
import { OtEtapa, OtEventoTipo } from './ot.entity';
import { OtRepository } from './ot.repository';

export class OtService {
  constructor(
    private readonly repo = new OtRepository(),
    private readonly clienteRepo = new ClienteRepository()
  ) {}

  async listar(filters: { tipo?: string; etapa?: string; q?: string }) {
    const [items, contadores, cuadrillas] = await Promise.all([
      this.repo.listOts(filters),
      this.repo.getContadores(),
      this.repo.listCuadrillas()
    ]);

    const enRuta = cuadrillas.filter((c) => c.estado === 'EN_RUTA' || c.estado === 'EN_SITIO').length;
    const disponibles = cuadrillas.filter((c) => c.estado === 'DISPONIBLE' || c.estado === 'EN_BASE').length;

    return {
      contadores,
      cuadrillasResumen: {
        total: cuadrillas.length,
        enRuta,
        disponibles
      },
      cuadrillas,
      items
    };
  }

  async listarCuadrillas() {
    return this.repo.listCuadrillas();
  }

  async obtenerDetalle(id: number) {
    const ot = await this.repo.findOtById(id);
    if (!ot) {
      throw new AppError(404, 'Orden de Trabajo no encontrada.');
    }
    return ot;
  }

  async crear(dto: CrearOtDto, usuarioId: number, usuarioNombre: string) {
    return withTransaction(async (client) => {
      const encontrado = await this.clienteRepo.findClienteByDniOrNis(dto.nis, client);
      if (!encontrado) {
        throw new AppError(404, `No existe un suministro con NIS/DNI "${dto.nis}".`);
      }

      let cuadrillaId: number | null = dto.cuadrilla_id ?? null;
      let cuadrillaNombre = 'Cola de despacho automática';
      if (cuadrillaId) {
        const cuadrilla = await this.repo.findCuadrillaByIdOrCode(cuadrillaId, client);
        if (!cuadrilla) {
          throw new AppError(404, 'La cuadrilla seleccionada no existe.');
        }
        cuadrillaNombre = `${cuadrilla.nombre} (${cuadrilla.lider_nombre})`;
        await this.repo.updateCuadrillaEstado(cuadrilla.id, 'EN_RUTA', client);
      }

      const codigo = generateOtCode();
      const slaHoras = calcularSlaOtHoras(dto.tipo, dto.prioridad);
      const slaLimite = sumarHorasIso(slaHoras);
      const etapaInicial: OtEtapa = cuadrillaId ? 'ASIGNADA' : 'GENERADA';

      const ot = await this.repo.createOt(
        {
          codigo,
          ticket_id: dto.ticket_id ?? null,
          suministro_id: encontrado.suministro.id,
          cuadrilla_id: cuadrillaId,
          tipo: dto.tipo,
          prioridad: dto.prioridad,
          titulo: dto.titulo,
          descripcion: dto.descripcion,
          etapa: etapaInicial,
          sla_horas: slaHoras,
          sla_limite_en: slaLimite,
          materiales_imputados: dto.materiales_imputados,
          creado_por_id: usuarioId
        },
        client
      );

      await this.repo.addEvento(
        ot.id,
        'DESPACHO',
        `[Despacho] Orden ${codigo} creada para suministro ${encontrado.suministro.nis}. Asignada a: ${cuadrillaNombre}.`,
        `Dispatcher: ${usuarioNombre}`,
        client
      );

      return this.repo.findOtById(ot.id, client);
    });
  }

  async reasignar(otId: number, dto: ReasignarOtDto, usuarioNombre: string) {
    return withTransaction(async (client) => {
      const ot = await this.repo.findOtById(otId, client);
      if (!ot) {
        throw new AppError(404, 'Orden de Trabajo no encontrada.');
      }
      if (ot.etapa === 'LIQUIDADA') {
        throw new AppError(409, 'No se puede reasignar una OT ya liquidada.');
      }

      const nuevaCuadrilla = await this.repo.findCuadrillaByIdOrCode(dto.cuadrilla_id, client);
      if (!nuevaCuadrilla) {
        throw new AppError(404, 'Cuadrilla no encontrada.');
      }

      if (ot.cuadrilla_id && ot.cuadrilla_id !== nuevaCuadrilla.id) {
        await this.repo.updateCuadrillaEstado(ot.cuadrilla_id, 'DISPONIBLE', client);
      }
      await this.repo.updateCuadrillaEstado(nuevaCuadrilla.id, 'EN_RUTA', client);

      await this.repo.reasignarCuadrilla(otId, nuevaCuadrilla.id, 'ASIGNADA', client);
      await this.repo.addEvento(
        otId,
        'REASIGNACION',
        `[Reasignación] Orden asignada a ${nuevaCuadrilla.nombre} (${nuevaCuadrilla.lider_nombre})${
          dto.motivo ? `. Motivo: ${dto.motivo}` : ''
        }`,
        `Dispatcher: ${usuarioNombre}`,
        client
      );

      return this.repo.findOtById(otId, client);
    });
  }

  async agregarEvento(otId: number, dto: AgregarEventoOtDto, usuarioNombre: string) {
    const ot = await this.repo.findOtById(otId);
    if (!ot) {
      throw new AppError(404, 'Orden de Trabajo no encontrada.');
    }
    return this.repo.addEvento(otId, dto.tipo_evento, dto.descripcion, usuarioNombre);
  }

  async avanzarEtapa(otId: number, dto: AvanzarEtapaOtDto, usuarioNombre: string) {
    return withTransaction(async (client) => {
      const ot = await this.repo.findOtById(otId, client);
      if (!ot) {
        throw new AppError(404, 'Orden de Trabajo no encontrada.');
      }

      const actaHash = dto.etapa === 'LIQUIDADA' ? generateActaDigitalHash(ot.codigo) : null;
      const validacion =
        dto.etapa === 'LIQUIDADA' ? dto.validacion_cliente || 'Conforme en Sitio' : dto.validacion_cliente;

      await this.repo.updateEtapa(
        otId,
        dto.etapa,
        dto.materiales_imputados,
        validacion,
        actaHash,
        client
      );

      if (ot.cuadrilla_id) {
        if (dto.etapa === 'EN_SITIO' || dto.etapa === 'PRUEBAS') {
          await this.repo.updateCuadrillaEstado(ot.cuadrilla_id, 'EN_SITIO', client);
        } else if (dto.etapa === 'LIQUIDADA') {
          await this.repo.updateCuadrillaEstado(ot.cuadrilla_id, 'DISPONIBLE', client);
        }
      }

      const eventoTipoMap: Record<OtEtapa, OtEventoTipo> = {
        GENERADA: 'NOTA',
        ASIGNADA: 'TRANSITO',
        EN_SITIO: 'ARRIBO',
        PRUEBAS: 'PRUEBA',
        LIQUIDADA: 'CIERRE'
      };

      const desc =
        dto.nota ||
        (dto.etapa === 'LIQUIDADA'
          ? `[Liquidada] Reposición confirmada y acta digital firmada (${actaHash}).`
          : `[Etapa: ${dto.etapa}] Actualización operativa de orden ${ot.codigo}.`);

      await this.repo.addEvento(otId, eventoTipoMap[dto.etapa], desc, usuarioNombre, client);

      if (dto.etapa === 'LIQUIDADA' && ot.ticket_id) {
        await this.repo.syncTicketResueltoOnLiquidar(ot.ticket_id, ot.codigo, client);
      }

      return this.repo.findOtById(otId, client);
    });
  }
}
