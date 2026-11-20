import { RolUsuario } from '../../shared/middlewares/auth.middleware';

export interface SucursalEntity {
  id: number;
  codigo: string;
  nombre: string;
  direccion: string | null;
  estado_red_pct: number;
  activa: boolean;
}

export interface UsuarioEntity {
  id: number;
  codigo_empleado: string;
  nombre_completo: string;
  iniciales: string;
  password_hash: string;
  rol: RolUsuario;
  cargo: string | null;
  sucursal_id: number | null;
  activo: boolean;
  creado_en: Date;
}

export type UsuarioPublico = Omit<UsuarioEntity, 'password_hash'>;

export interface VentanillaEntity {
  id: number;
  sucursal_id: number;
  codigo: string;
  nombre: string;
  tipo_modulo: 'GENERAL' | 'PREFERENCIAL' | 'TECNICO' | 'COMPLEJOS' | 'ADMIN';
  operador_id: number | null;
  estado: 'DISPONIBLE' | 'OCUPADO' | 'PAUSA' | 'INACTIVO';
  turno_actual_id: number | null;
  ultimo_cambio_estado: Date;
}

export interface VentanillaDetalle extends VentanillaEntity {
  operador_nombre: string | null;
  operador_codigo: string | null;
  operador_iniciales: string | null;
  turno_actual_codigo: string | null;
  segundos_en_estado: number;
}
