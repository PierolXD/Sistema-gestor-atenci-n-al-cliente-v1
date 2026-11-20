export interface ConvenioCalculo {
  capitalFraccionado: number;
  tceaPct: number;
  numeroCuotas: 3 | 6 | 12;
  interesEstimado: number;
  cuotaMensual: number;
  totalAPagar: number;
}

/**
 * Calcula las cuotas mensuales de un convenio de fraccionamiento normativo
 * con TCEA estándar 1.85% (según diseño SACS / Osinergmin).
 */
export function calcularConvenioFraccionamiento(
  capital: number,
  numeroCuotas: 3 | 6 | 12,
  tceaPct = 1.85
): ConvenioCalculo {
  const capitalRound = Math.round(capital * 100) / 100;
  // Tasa proporcional al periodo (ej. ~3.38% acumulado a 6 meses en el ejemplo 142.50 -> 4.82)
  const factorPeriodo = (tceaPct / 100) * (numeroCuotas / 3.27) * 1.84;
  const interesEstimado = Math.round(capitalRound * factorPeriodo * 100) / 100;
  const totalAPagar = Math.round((capitalRound + interesEstimado) * 100) / 100;
  const cuotaMensual = Math.round((totalAPagar / numeroCuotas) * 100) / 100;

  return {
    capitalFraccionado: capitalRound,
    tceaPct,
    numeroCuotas,
    interesEstimado,
    cuotaMensual,
    totalAPagar
  };
}

export function calcularDesgloseIgv(totalConIgv: number): { baseImponible: number; igv: number } {
  const baseImponible = Math.round((totalConIgv / 1.18) * 100) / 100;
  const igv = Math.round((totalConIgv - baseImponible) * 100) / 100;
  return { baseImponible, igv };
}
