import { filtroIndicadoresDtoSchema, FiltroIndicadoresDto } from './indicador.dto';
import { IndicadorRepository } from './indicador.repository';

export class IndicadorService {
  constructor(private readonly repo = new IndicadorRepository()) {}

  async obtenerResumen(rawQuery: Record<string, unknown>) {
    const filtro: FiltroIndicadoresDto = filtroIndicadoresDtoSchema.parse({
      periodo: rawQuery.periodo ?? 'hoy',
      canal: rawQuery.canal ?? 'todos',
      q: rawQuery.q ?? ''
    });

    const [kpis, curvaAfluencia, distribucion, rendimientoOperadores] = await Promise.all([
      this.repo.getKpis(filtro.periodo, filtro.canal),
      this.repo.getCurvaAfluencia(filtro.periodo),
      this.repo.getDistribucionSolicitudes(filtro.periodo, filtro.canal),
      this.repo.getRendimientoOperadores(filtro.q)
    ]);

    const maxAfluencia = Math.max(...curvaAfluencia.map((p) => p.emitidos), 0);
    const alertaCongestion =
      maxAfluencia >= 5 || kpis.criticos_sla > 0
        ? {
            activa: true,
            mensaje:
              kpis.criticos_sla > 0
                ? `${kpis.criticos_sla} casos críticos con menos de 2h para límite SLA regulatorio.`
                : `Pico operativo detectado (${maxAfluencia} atenciones en franja horaria).`
          }
        : { activa: false, mensaje: 'Operación dentro de capacidad nominal de sede.' };

    return {
      filtro,
      kpis,
      curvaAfluencia,
      distribucion,
      rendimientoOperadores,
      alertaCongestion
    };
  }

  async generarCsv(rawQuery: Record<string, unknown>): Promise<string> {
    const resumen = await this.obtenerResumen(rawQuery);
    const lines: string[] = [];

    lines.push('REPORTE DE INDICADORES OPERATIVOS SACS / SEAL');
    lines.push(`Periodo;${resumen.filtro.periodo};Canal;${resumen.filtro.canal}`);
    lines.push('');
    lines.push('KPI;Valor');
    lines.push(`TMO Promedio (seg);${resumen.kpis.tmo_segundos}`);
    lines.push(`FCR Primer Contacto (%);${resumen.kpis.fcr_pct}`);
    lines.push(`CSAT Promedio (1-5);${resumen.kpis.csat_promedio}`);
    lines.push(`Casos Criticos SLA;${resumen.kpis.criticos_sla}`);
    lines.push('');
    lines.push('Codigo;Operador;Ventanilla;Estado;Atenciones;TMO (seg);CSAT;Tickets Resueltos;Conformidad (%)');
    for (const op of resumen.rendimientoOperadores) {
      lines.push(
        [
          op.codigo_empleado,
          `"${op.nombre_completo}"`,
          `"${op.ventanilla_nombre || 'Sin asignar'}"`,
          op.ventanilla_estado || 'N/A',
          op.atenciones_totales,
          op.tmo_segundos,
          op.csat_promedio,
          op.tickets_resueltos,
          op.indice_conformidad_pct
        ].join(';')
      );
    }

    return '\uFEFF' + lines.join('\r\n');
  }
}
