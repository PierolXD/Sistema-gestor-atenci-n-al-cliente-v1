import { withTransaction } from '../../shared/database/connection';
import { AppError } from '../../shared/utils/app-error';
import {
  ActualizarClienteDto,
  ActualizarSuministroDto,
  CrearAutorizadoDto,
  CrearClienteSuministroDto,
  CrearInspeccionDto
} from './cliente.dto';
import { ClienteRepository } from './cliente.repository';

export class ClienteService {
  constructor(private readonly repo = new ClienteRepository()) {}

  async buscar(q: string) {
    return this.repo.buscar(q);
  }

  async listarTablaMaestra(q?: string, estado?: 'todos' | 'activos' | 'inactivos') {
    return this.repo.listarTablaMaestra({ q, estado });
  }

  async exportarMaestroCsv(q?: string, estado?: 'todos' | 'activos' | 'inactivos'): Promise<string> {
    const data = await this.repo.listarTablaMaestra({ q, estado });
    const lines: string[] = [];
    lines.push('REPORTE MAESTRO DE CLIENTES - SIS SEAL');
    lines.push('ID;Tipo Doc;DNI/RUC;Nombres / Razon Social;Telefono;Correo;NIS;Medidor;Tarifa;Categoria;Score;Deuda (S/);Estado');
    for (const c of data.items) {
      lines.push(
        [
          c.id,
          c.tipo_documento,
          c.dni_ruc,
          `"${c.nombres_apellidos.replace(/"/g, '""')}"`,
          `"${c.telefono || ''}"`,
          `"${c.correo || ''}"`,
          `"${c.nis || ''}"`,
          `"${c.numero_medidor || ''}"`,
          `"${c.tarifa || ''}"`,
          c.categoria_crediticia,
          c.score_crediticio,
          c.deuda_total.toFixed(2),
          c.activo ? 'ACTIVO' : 'DESHABILITADO'
        ].join(';')
      );
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  async cambiarEstado(id: number, activo: boolean) {
    const updated = await this.repo.setActivo(id, activo);
    if (!updated) {
      throw new AppError(404, 'Cliente no encontrado.');
    }
    return updated;
  }

  async eliminarCliente(id: number) {
    return withTransaction(async (client) => {
      const deleted = await this.repo.deleteCliente(id, client);
      if (!deleted) {
        throw new AppError(404, 'Cliente no encontrado.');
      }
      return { id, eliminado: true };
    });
  }

  async obtenerFicha360PorCliente(clienteId: number, suministroIdPreferido?: number) {
    const cliente = await this.repo.findClienteById(clienteId);
    if (!cliente) {
      throw new AppError(404, 'Cliente no encontrado en el padrón catastral.');
    }
    const suministros = await this.repo.findSuministrosByClienteId(cliente.id);
    if (suministros.length === 0) {
      throw new AppError(404, 'El cliente no tiene suministros registrados.');
    }
    const suministro =
      (suministroIdPreferido ? suministros.find((s) => s.id === suministroIdPreferido) : null) ?? suministros[0];

    const [deuda, consumos, tickets, inspecciones, autorizados] = await Promise.all([
      this.repo.getDeudaSuministro(suministro.id),
      this.repo.getConsumos(suministro.id),
      this.repo.getTicketsHistorial(cliente.id),
      this.repo.getInspecciones(suministro.id),
      this.repo.getAutorizados(cliente.id)
    ]);

    return {
      cliente,
      suministro,
      suministros,
      deuda_total: deuda.deuda_total,
      recibos_pendientes_count: deuda.recibos_pendientes_count,
      consumos,
      tickets,
      inspecciones,
      autorizados
    };
  }

  async obtenerFicha360PorNis(nis: string) {
    const suministro = await this.repo.findSuministroByNis(nis);
    if (!suministro) {
      throw new AppError(404, `No se encontró el suministro con NIS "${nis}".`);
    }
    return this.obtenerFicha360PorCliente(suministro.cliente_id, suministro.id);
  }

  async crearClienteYSuministro(dto: CrearClienteSuministroDto) {
    return withTransaction((client) => this.repo.createClienteYSuministro(dto, client));
  }

  async actualizarCliente(id: number, dto: ActualizarClienteDto) {
    const updated = await this.repo.updateCliente(id, dto);
    if (!updated) {
      throw new AppError(404, 'Cliente no encontrado.');
    }
    return updated;
  }

  async actualizarSuministro(suministroId: number, dto: ActualizarSuministroDto) {
    const updated = await this.repo.updateSuministro(suministroId, dto);
    if (!updated) {
      throw new AppError(404, 'Suministro no encontrado.');
    }
    return updated;
  }

  async pingTelemedidor(suministroId: number) {
    const sum = await this.repo.findSuministroById(suministroId);
    if (!sum) {
      throw new AppError(404, 'Suministro no encontrado.');
    }
    const tension = sum.estado_servicio === 'CORTADO' ? 0 : Number((220 + (Math.random() * 2.5 - 1.0)).toFixed(1));
    const corriente = sum.estado_servicio === 'CORTADO' ? 0 : Number((4.1 + Math.random() * 1.4).toFixed(2));
    const factorPotencia = sum.estado_servicio === 'CORTADO' ? 0 : Number((0.95 + Math.random() * 0.03).toFixed(2));
    const lecturaActual = Number((sum.lectura_actual_kwh + (sum.estado_servicio === 'CORTADO' ? 0 : 0.4)).toFixed(2));

    const updated = await this.repo.updateSuministro(suministroId, {
      lectura_actual_kwh: lecturaActual,
      tension_rms_v: tension,
      corriente_a: corriente,
      factor_potencia: factorPotencia
    });

    return {
      suministro: updated,
      latencia_ms: Math.floor(24 + Math.random() * 35),
      mensaje:
        sum.estado_servicio === 'CORTADO'
          ? 'Telemedidor en estado CORTADO (0.0 V).'
          : `Telemedidor en línea: ${tension} V • ${corriente} A • Lectura ${lecturaActual} kWh.`
    };
  }

  async programarInspeccion(suministroId: number, dto: CrearInspeccionDto) {
    const sum = await this.repo.findSuministroById(suministroId);
    if (!sum) {
      throw new AppError(404, 'Suministro no encontrado.');
    }
    const prefix = dto.tipo === 'CONTRASTE' ? 'CT' : dto.tipo === 'INSPECCION_PRECINTO' ? 'INS' : 'AC';
    const codigo = `${prefix}-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    return this.repo.createInspeccion(suministroId, codigo, dto);
  }

  async agregarAutorizado(clienteId: number, dto: CrearAutorizadoDto) {
    const cliente = await this.repo.findClienteById(clienteId);
    if (!cliente) {
      throw new AppError(404, 'Cliente no encontrado.');
    }
    return this.repo.createAutorizado(clienteId, dto);
  }
}
