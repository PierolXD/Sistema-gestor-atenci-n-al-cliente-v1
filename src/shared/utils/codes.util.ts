import crypto from 'crypto';

function randomDigits(len: number): string {
  const max = Math.pow(10, len);
  const min = Math.pow(10, len - 1);
  return String(Math.floor(min + Math.random() * (max - min)));
}

export function generateTicketCode(): string {
  return `TK-2026-${randomDigits(4)}`;
}

export function generateOtCode(): string {
  return `OT-2026-${randomDigits(4)}`;
}

export function generateReciboCode(): string {
  return `REC-01-${randomDigits(6)}`;
}

export function generateComprobanteCode(tipo: 'BOLETA' | 'FACTURA'): string {
  const serie = tipo === 'FACTURA' ? 'F001' : 'B001';
  return `${serie}-${randomDigits(6)}`;
}

export function generateOperacionCode(): string {
  return `OP-${randomDigits(6)}`;
}

export function generateActaConvenioCode(): string {
  return `ACT-2026-${randomDigits(4)}`;
}

export function generateActaDigitalHash(otCodigo: string): string {
  return crypto
    .createHash('sha256')
    .update(`${otCodigo}-${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 16);
}
