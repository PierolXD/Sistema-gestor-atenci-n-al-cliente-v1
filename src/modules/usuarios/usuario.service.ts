import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from '../../shared/utils/app-error';
import { AuthUserPayload, getJwtSecret } from '../../shared/middlewares/auth.middleware';
import { CambiarEstadoVentanillaDto, LoginDto } from './usuario.dto';
import { UsuarioRepository } from './usuario.repository';

export class UsuarioService {
  constructor(private readonly repo = new UsuarioRepository()) {}

  async login(dto: LoginDto) {
    const usuario = await this.repo.findByCodigo(dto.codigo_empleado);
    if (!usuario || !usuario.activo) {
      throw new AppError(401, 'Credenciales incorrectas o usuario inactivo.');
    }

    const validPassword = await bcrypt.compare(dto.password, usuario.password_hash);
    if (!validPassword) {
      throw new AppError(401, 'Credenciales incorrectas. Verifique su usuario y contraseña.');
    }

    const sucursalId = dto.sucursal_id ?? usuario.sucursal_id ?? 1;
    let sucursal = await this.repo.findSucursalById(sucursalId);
    if (!sucursal && usuario.sucursal_id) {
      sucursal = await this.repo.findSucursalById(usuario.sucursal_id);
    }
    if (!sucursal) {
      sucursal = (await this.repo.listSucursales())[0] ?? null;
    }
    if (!sucursal) {
      throw new AppError(404, 'No hay sucursales activas configuradas.');
    }

    const ventanilla = await this.repo.findVentanillaByOperadorId(usuario.id);

    const payload: AuthUserPayload = {
      id: usuario.id,
      codigo_empleado: usuario.codigo_empleado,
      nombre_completo: usuario.nombre_completo,
      iniciales: usuario.iniciales,
      rol: usuario.rol,
      sucursal_id: sucursal.id
    };

    const signOpts: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '12h') as SignOptions['expiresIn']
    };
    const token = jwt.sign(payload, getJwtSecret(), signOpts);

    const { password_hash: _ignored, ...usuarioPublico } = usuario;
    return {
      token,
      usuario: { ...usuarioPublico, sucursal_id: sucursal.id },
      sucursal,
      ventanilla
    };
  }

  async getPerfilActual(userId: number, sucursalIdOverride?: number | null) {
    const usuario = await this.repo.findPublicById(userId);
    if (!usuario || !usuario.activo) {
      throw new AppError(401, 'Sesión inválida o operador inactivo. Inicie sesión nuevamente.');
    }
    const sucursal =
      (await this.repo.findSucursalById(sucursalIdOverride ?? usuario.sucursal_id ?? 1)) ??
      (await this.repo.listSucursales())[0] ??
      null;
    const ventanilla = await this.repo.findVentanillaByOperadorId(usuario.id);
    return { usuario, sucursal, ventanilla };
  }

  async listarSucursales() {
    return this.repo.listSucursales();
  }

  async listarUsuarios() {
    return this.repo.listUsuariosPublicos();
  }

  async listarVentanillas(sucursalId?: number) {
    return this.repo.listVentanillas(sucursalId);
  }

  async cambiarEstadoVentanilla(ventanillaId: number, dto: CambiarEstadoVentanillaDto) {
    const ventanilla = await this.repo.findVentanillaById(ventanillaId);
    if (!ventanilla) {
      throw new AppError(404, 'Ventanilla no encontrada.');
    }
    if (ventanilla.estado === 'OCUPADO' && ventanilla.turno_actual_id) {
      throw new AppError(
        409,
        'La ventanilla tiene un turno en atención activa. Finalice o derive el turno antes de pausar el puesto.'
      );
    }
    return this.repo.updateVentanillaEstado(ventanillaId, dto.estado, null);
  }
}
