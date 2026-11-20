import { withTransaction } from '../../shared/database/connection';
import { AppError } from '../../shared/utils/app-error';
import { ClienteRepository } from '../clientes/cliente.repository';
import { UsuarioRepository } from '../usuarios/usuario.repository';
import {
  AgregarNotaTurnoDto,
  DerivarTurnoDto,
  EmitirTurnoDto,
  FinalizarTurnoDto
} from './turno.dto';
import { TurnoRepository } from './turno.repository';

export class TurnoService {
  constructor(
    private readonly repo = new TurnoRepository(),
    private readonly usuarioRepo = new UsuarioRepository(),
    private readonly clienteRepo = new ClienteRepository()
  ) {}

  async obtenerTablero(sucursalId: number, operadorId: number, modulo?: string) {
    const [kpisBase, cola, turnoActual, miVentanilla, ventanillas] = await Promise.all([
      this.repo.getKpisSala(sucursalId, operadorId),
      this.repo.listColaEspera(sucursalId, modulo),
      this.repo.findTurnoEnAtencionPorOperador(operadorId),
      this.usuarioRepo.findVentanillaByOperadorId(operadorId),
      this.usuarioRepo.listVentanillas(sucursalId)
    ]);

    const allWaiting = modulo ? await this.repo.listColaEspera(sucursalId) : cola;
    const proximoEnCola = allWaiting[0] ?? null;

    return {
      kpis: {
        ...kpisBase,
        proximoEnCola,
        conteoPorModulo: {
          todos: allWaiting.length,
          A: allWaiting.filter((t) => t.modulo_cola === 'A').length,
          B: allWaiting.filter((t) => t.modulo_cola === 'B').length,
          C: allWaiting.filter((t) => t.modulo_cola === 'C').length
        }
      },
      cola,
      turnoActual,
      miVentanilla,
      ventanillas
    };
  }

  async emitirTurno(sucursalId: number, dto: EmitirTurnoDto) {
    let clienteId: number | null = null;
    let suministroId: number | null = null;
    let nisFinal = dto.nis_visitante || null;

    const lookupKey = dto.nis_visitante || dto.dni_visitante;
    const encontrado = await this.clienteRepo.findClienteByDniOrNis(lookupKey);
    if (encontrado) {
      clienteId = encontrado.cliente.id;
      suministroId = encontrado.suministro.id;
      nisFinal = nisFinal || encontrado.suministro.nis;
    }

    const codigoTurno = await this.repo.getNextCodigoTurno(dto.modulo_cola);
    return this.repo.create(
      { ...dto, nis_visitante: nisFinal },
      sucursalId,
      codigoTurno,
      clienteId,
      suministroId
    );
  }

  async llamarSiguiente(sucursalId: number, operadorId: number) {
    return withTransaction(async (client) => {
      const activo = await this.repo.findTurnoEnAtencionPorOperador(operadorId, client);
      if (activo) {
        throw new AppError(
          409,
          `Ya tiene el turno ${activo.codigo_turno} en atención. Finalícelo antes de llamar otro.`
        );
      }

      const ventanilla = await this.usuarioRepo.ensureVentanillaForUser(operadorId, sucursalId, client);
      if (!ventanilla) {
        throw new AppError(409, 'No hay una ventanilla disponible asignada a este usuario.');
      }

      const siguiente = await this.repo.pickNextWaitingTurno(sucursalId, client);
      if (!siguiente) {
        throw new AppError(404, 'No hay clientes en espera en la cola actual.');
      }

      const actualizado = await this.repo.markEnAtencion(siguiente.id, ventanilla.id, operadorId, client);
      await this.usuarioRepo.updateVentanillaEstado(ventanilla.id, 'OCUPADO', actualizado.id, client);
      return actualizado;
    });
  }

  async atenderTurnoEspecifico(turnoId: number, sucursalId: number, operadorId: number) {
    return withTransaction(async (client) => {
      const activo = await this.repo.findTurnoEnAtencionPorOperador(operadorId, client);
      if (activo) {
        throw new AppError(
          409,
          `Ya tiene el turno ${activo.codigo_turno} en atención. Finalícelo antes de tomar otro.`
        );
      }

      const turno = await this.repo.findById(turnoId, client);
      if (!turno) {
        throw new AppError(404, 'Turno no encontrado.');
      }
      if (turno.estado !== 'EN_ESPERA') {
        throw new AppError(409, `El turno ${turno.codigo_turno} ya no está en espera (estado: ${turno.estado}).`);
      }

      const ventanilla = await this.usuarioRepo.ensureVentanillaForUser(operadorId, sucursalId, client);
      if (!ventanilla) {
        throw new AppError(409, 'No hay una ventanilla disponible asignada a este usuario.');
      }

      const actualizado = await this.repo.markEnAtencion(turno.id, ventanilla.id, operadorId, client);
      await this.usuarioRepo.updateVentanillaEstado(ventanilla.id, 'OCUPADO', actualizado.id, client);
      return actualizado;
    });
  }

  async derivarTurno(turnoId: number, operadorNombre: string, dto: DerivarTurnoDto) {
    return withTransaction(async (client) => {
      const turno = await this.repo.findById(turnoId, client);
      if (!turno) {
        throw new AppError(404, 'Turno no encontrado.');
      }
      if (!['EN_ESPERA', 'EN_ATENCION'].includes(turno.estado)) {
        throw new AppError(409, 'Solo se pueden derivar turnos en espera o en atención.');
      }

      if (turno.ventanilla_id) {
        await this.usuarioRepo.updateVentanillaEstado(turno.ventanilla_id, 'DISPONIBLE', null, client);
      }

      const hora = new Date().toTimeString().slice(0, 5);
      const nota = `[${hora}] Derivado a Módulo ${dto.modulo_cola} por ${operadorNombre}${
        dto.motivo_derivacion ? `: ${dto.motivo_derivacion}` : ''
      }`;
      return this.repo.derivar(turno.id, dto.modulo_cola, nota, client);
    });
  }

  async marcarAusente(turnoId: number) {
    return withTransaction(async (client) => {
      const turno = await this.repo.findById(turnoId, client);
      if (!turno) {
        throw new AppError(404, 'Turno no encontrado.');
      }
      if (turno.ventanilla_id && turno.estado === 'EN_ATENCION') {
        await this.usuarioRepo.updateVentanillaEstado(turno.ventanilla_id, 'DISPONIBLE', null, client);
      }
      return this.repo.markAusente(turno.id, client);
    });
  }

  async agregarNota(turnoId: number, operadorNombre: string, dto: AgregarNotaTurnoDto) {
    const hora = new Date().toTimeString().slice(0, 5);
    const notaFormateada = `[${hora} - ${operadorNombre}] ${dto.nota}`;
    const updated = await this.repo.appendNota(turnoId, notaFormateada);
    if (!updated) {
      throw new AppError(404, 'Turno no encontrado.');
    }
    return updated;
  }

  async finalizarTurno(turnoId: number, dto: FinalizarTurnoDto) {
    return withTransaction(async (client) => {
      const turno = await this.repo.findById(turnoId, client);
      if (!turno) {
        throw new AppError(404, 'Turno no encontrado.');
      }
      if (turno.estado !== 'EN_ATENCION') {
        throw new AppError(409, 'El turno debe estar en atención para poder finalizarlo.');
      }
      const finalizado = await this.repo.finalizar(
        turno.id,
        dto.resolucion_resumen,
        dto.calificacion_csat ?? null,
        client
      );
      if (turno.ventanilla_id) {
        await this.usuarioRepo.updateVentanillaEstado(turno.ventanilla_id, 'DISPONIBLE', null, client);
      }
      return finalizado;
    });
  }
}
