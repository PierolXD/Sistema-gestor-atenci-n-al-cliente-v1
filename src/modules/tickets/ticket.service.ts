import { withTransaction } from '../../shared/database/connection';
import { AppError } from '../../shared/utils/app-error';
import { generateOtCode, generateTicketCode } from '../../shared/utils/codes.util';
import { calcularSlaOtHoras, calcularSlaTicketHoras, sumarHorasIso } from '../../shared/utils/sla.util';
import { ClienteRepository } from '../clientes/cliente.repository';
import { OtRepository } from '../ordenes-trabajo/ot.repository';
import { AgregarMensajeTicketDto, CrearTicketDto, ResolverTicketDto } from './ticket.dto';
import { TicketEstado } from './ticket.entity';
import { TicketRepository } from './ticket.repository';

export class TicketService {
  constructor(
    private readonly repo = new TicketRepository(),
    private readonly clienteRepo = new ClienteRepository(),
    private readonly otRepo = new OtRepository()
  ) {}

  async listar(filters: { canal?: string; prioridad?: string; estado?: string; q?: string }) {
    const [kpis, items] = await Promise.all([this.repo.getKpis(), this.repo.listTickets(filters)]);
    return { kpis, items };
  }

  async obtenerDetalle(id: number) {
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      throw new AppError(404, 'Ticket o reclamo no encontrado.');
    }
    return ticket;
  }

  async crear(dto: CrearTicketDto, operadorId: number, operadorNombre: string) {
    return withTransaction(async (client) => {
      const encontrado = await this.clienteRepo.findClienteByDniOrNis(dto.nis_o_dni, client);
      if (!encontrado) {
        throw new AppError(
          404,
          `No existe un cliente o suministro registrado con NIS/DNI "${dto.nis_o_dni}". Regístrelo primero en Clientes & Suministros.`
        );
      }

      const slaHoras = calcularSlaTicketHoras(dto.prioridad, dto.es_reclamo_formal, dto.tipificacion_normativa);
      const slaLimite = sumarHorasIso(slaHoras);
      const codigo = generateTicketCode();
      const estadoInicial: TicketEstado = dto.es_reclamo_formal ? 'ESCALADO_RECLAMO' : 'EN_ATENCION';

      const ticket = await this.repo.create(
        {
          codigo,
          turno_id: dto.turno_id ?? null,
          cliente_id: encontrado.cliente.id,
          suministro_id: encontrado.suministro.id,
          canal: dto.canal,
          prioridad: dto.prioridad,
          asunto: dto.asunto,
          descripcion: dto.descripcion,
          tipificacion_normativa: dto.tipificacion_normativa ?? null,
          estado: estadoInicial,
          es_reclamo_formal: dto.es_reclamo_formal,
          operador_asignado_id: operadorId,
          sla_horas: slaHoras,
          sla_limite_en: slaLimite
        },
        client
      );

      await this.repo.addMensaje(
        ticket.id,
        'CLIENTE',
        encontrado.cliente.nombres_apellidos,
        dto.descripcion,
        null,
        client
      );
      await this.repo.addMensaje(
        ticket.id,
        'AGENTE',
        operadorNombre,
        `Ticket ${codigo} registrado por canal ${dto.canal} (Suministro ${encontrado.suministro.nis}).`,
        null,
        client
      );

      return this.repo.findById(ticket.id, client);
    });
  }

  async agregarMensaje(ticketId: number, operadorNombre: string, dto: AgregarMensajeTicketDto) {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) {
      throw new AppError(404, 'Ticket no encontrado.');
    }
    const autorNombre = dto.autor_tipo === 'AGENTE' ? operadorNombre : dto.autor_tipo;
    return this.repo.addMensaje(
      ticketId,
      dto.autor_tipo,
      autorNombre,
      dto.mensaje,
      dto.evidencia_url ?? null
    );
  }

  async resolver(ticketId: number, operadorId: number, operadorNombre: string, dto: ResolverTicketDto) {
    return withTransaction(async (client) => {
      const ticket = await this.repo.findById(ticketId, client);
      if (!ticket) {
        throw new AppError(404, 'Ticket no encontrado.');
      }

      let nuevoEstado: TicketEstado = ticket.estado === 'REGISTRADO' ? 'EN_ATENCION' : ticket.estado;
      let esReclamoFormal = ticket.es_reclamo_formal;
      let slaHoras = ticket.sla_horas;
      let slaLimite = ticket.sla_limite_en;
      let otCreadaCodigo: string | null = null;

      if (!dto.cerrar) {
        nuevoEstado = 'EN_ATENCION';
      } else if (dto.accion_inmediata === 'DESPACHAR_CUADRILLA') {
        nuevoEstado = 'EN_CUADRILLA';
        const otExistente = await this.otRepo.findOtByTicketId(ticket.id, client);
        if (!otExistente) {
          let cuadrillaId: number | null = null;
          let cuadrillaNombre = 'Por asignar en Cola de Despacho';
          if (dto.cuadrilla_id) {
            const cua = await this.otRepo.findCuadrillaByIdOrCode(dto.cuadrilla_id, client);
            if (cua) {
              cuadrillaId = cua.id;
              cuadrillaNombre = `${cua.nombre} (${cua.lider_nombre})`;
              await this.otRepo.updateCuadrillaEstado(cua.id, 'EN_RUTA', client);
            }
          }

          const otPrioridad = ticket.prioridad === 'URGENTE' ? 'CRITICA' : 'ALTA';
          const otTipo = dto.tipificacion_normativa.includes('REC-COM') ? 'INSPECCION' : 'EMERGENCIA';
          const otSlaHoras = calcularSlaOtHoras(otTipo, otPrioridad);
          const otCodigo = generateOtCode();

          const nuevaOt = await this.otRepo.createOt(
            {
              codigo: otCodigo,
              ticket_id: ticket.id,
              suministro_id: ticket.suministro_id,
              cuadrilla_id: cuadrillaId,
              tipo: otTipo,
              prioridad: otPrioridad,
              titulo: ticket.asunto,
              descripcion: `${dto.dictamen_tecnico} (${dto.tipificacion_normativa})`,
              etapa: cuadrillaId ? 'ASIGNADA' : 'GENERADA',
              sla_horas: otSlaHoras,
              sla_limite_en: sumarHorasIso(otSlaHoras),
              materiales_imputados: '',
              creado_por_id: operadorId
            },
            client
          );

          await this.otRepo.addEvento(
            nuevaOt.id,
            'DESPACHO',
            `[Despacho desde Ticket ${ticket.codigo}] ${dto.dictamen_tecnico}. Cuadrilla: ${cuadrillaNombre}.`,
            `Agente: ${operadorNombre}`,
            client
          );
          otCreadaCodigo = nuevaOt.codigo;
        }
      } else if (dto.accion_inmediata === 'ESCALAR_RECLAMO') {
        esReclamoFormal = true;
        slaHoras = 360;
        slaLimite = sumarHorasIso(360, new Date(ticket.creado_en));
        nuevoEstado = 'ESCALADO_RECLAMO';
      } else if (dto.accion_inmediata === 'DERIVAR_LABORATORIO') {
        nuevoEstado = 'EN_ATENCION';
      } else {
        nuevoEstado = 'CERRADO';
      }

      await this.repo.updateResolucion(
        ticket.id,
        {
          tipificacion_normativa: dto.tipificacion_normativa,
          accion_inmediata: dto.accion_inmediata,
          dictamen_tecnico: dto.dictamen_tecnico,
          estado: nuevoEstado,
          es_reclamo_formal: esReclamoFormal,
          sla_horas: slaHoras,
          sla_limite_en: slaLimite,
          cerrar: dto.cerrar
        },
        client
      );

      const resumenAccion = !dto.cerrar
        ? `[Borrador guardado] ${dto.dictamen_tecnico}`
        : otCreadaCodigo
        ? `[OT Generada: ${otCreadaCodigo}] ${dto.dictamen_tecnico}`
        : dto.accion_inmediata === 'ESCALAR_RECLAMO'
        ? `[Escalado a Reclamo Formal Osinergmin - SLA 15 días] ${dto.dictamen_tecnico}`
        : `[Notificado al Cliente / Cerrado] ${dto.dictamen_tecnico}`;

      await this.repo.addMensaje(ticket.id, 'AGENTE', operadorNombre, resumenAccion, null, client);

      return this.repo.findById(ticket.id, client);
    });
  }

  async toggleConflicto(ticketId: number) {
    const updated = await this.repo.toggleConflicto(ticketId);
    if (!updated) {
      throw new AppError(404, 'Ticket no encontrado.');
    }
    return updated;
  }
}
