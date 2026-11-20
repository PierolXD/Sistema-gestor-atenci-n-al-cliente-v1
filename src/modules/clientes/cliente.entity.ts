export interface ClienteEntity {
  id: number;
  dni_ruc: string;
  tipo_documento: 'DNI' | 'RUC' | 'CE';
  nombres_apellidos: string;
  telefono: string | null;
  correo: string | null;
  score_crediticio: number;
  categoria_crediticia: 'A' | 'B' | 'C';
  notificaciones_sms: boolean;
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
}

export interface SuministroEntity {
  id: number;
  nis: string;
  cliente_id: number;
  numero_medidor: string;
  tipo_medidor: string;
  tarifa: string;
  potencia_contratada_kw: number;
  ciclo_facturacion: string;
  estado_servicio: 'ACTIVO' | 'CORTADO' | 'SUSPENDIDO';
  direccion: string;
  distrito: string;
  sector: string;
  codigo_ruta: string | null;
  subestacion_sed: string | null;
  alimentador_mt: string | null;
  lectura_actual_kwh: number;
  lectura_anterior_kwh: number;
  tension_rms_v: number;
  corriente_a: number;
  factor_potencia: number;
  tipo_acometida: string;
  caja_portamedidor: string;
  llave_termomagnetica: string;
  puesta_tierra_ohm: number;
  precinto_bornera: string | null;
  precinto_caja: string | null;
  latitud: number;
  longitud: number;
  actualizado_en: Date;
}

export interface ConsumoHistoricoEntity {
  id: number;
  suministro_id: number;
  periodo: string;
  etiqueta_mes: string;
  consumo_kwh: number;
  promedio_sector_kwh: number;
}

export interface InspeccionMedidorEntity {
  id: number;
  suministro_id: number;
  tipo: 'CONTRASTE' | 'RENOVACION_ACOMETIDA' | 'INSPECCION_PRECINTO';
  codigo_certificado: string;
  laboratorio_o_ot: string | null;
  estado: 'PROGRAMADO' | 'APROBADO' | 'OBSERVADO' | 'EJECUTADO';
  fecha_ensayo: string;
  error_medido_pct: string | null;
  proximo_vencimiento: string | null;
  precinto_bornera: string | null;
  precinto_caja: string | null;
  observaciones: string | null;
  creado_en: Date;
}

export interface PersonaAutorizadaEntity {
  id: number;
  cliente_id: number;
  nombre_completo: string;
  relacion: string;
  dni: string | null;
  telefono: string | null;
  correo: string | null;
  poder_legal: boolean;
  nivel: 'PRINCIPAL' | 'SECUNDARIO' | 'TECNICO';
  activo: boolean;
  creado_en: Date;
}

export interface ClienteBusquedaRow {
  cliente_id: number;
  dni_ruc: string;
  tipo_documento: string;
  nombres_apellidos: string;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  suministro_id: number;
  nis: string;
  numero_medidor: string;
  tarifa: string;
  estado_servicio: string;
  direccion: string;
  sector: string;
  deuda_total: number;
}

export interface ClienteMaestroRow {
  id: number;
  dni_ruc: string;
  tipo_documento: 'DNI' | 'RUC' | 'CE';
  nombres_apellidos: string;
  telefono: string | null;
  correo: string | null;
  score_crediticio: number;
  categoria_crediticia: 'A' | 'B' | 'C';
  notificaciones_sms: boolean;
  activo: boolean;
  creado_en: Date;
  suministro_id: number | null;
  nis: string | null;
  numero_medidor: string | null;
  tarifa: string | null;
  estado_servicio: string | null;
  direccion: string | null;
  deuda_total: number;
  total_tickets: number;
}
