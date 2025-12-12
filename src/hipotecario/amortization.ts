export type SeguroMode = 'simple' | 'avanzado';
export type SeguroBase = 'saldo' | 'capital_inicial';

export interface LoanInputs {
  precioPropiedadUf: number;
  piePorcentaje: number;
  pieUf?: number;
  usarPieUf: boolean;
  tasaAnual: number;
  plazoAnios: number;
  seguroModo: SeguroMode;
  seguroDesgravamenUfMensual: number;
  seguroIncendioSismoUfMensual: number;
  seguroDesgravamenRateMensual: number;
  seguroIncendioSismoRateMensual: number;
  baseSeguro: SeguroBase;
}

export interface AmortizationRow {
  cuota: number;
  saldo_inicial: number;
  interes: number;
  amortizacion: number;
  saldo_final: number;
  seguros: number;
  pago_total: number;
}

export interface AmortizationTotals {
  interes_total_uf: number;
  seguros_total_uf: number;
  costo_total_pagado_uf: number;
  capital_total_uf: number;
}

export interface AmortizationResult {
  rows: AmortizationRow[];
  totals: AmortizationTotals;
  monto_credito_uf: number;
  dividendo_base_uf: number;
  dividendo_total_uf: number;
}

export interface LoanSummary {
  monto_credito_uf: number;
  dividendo_base_uf: number;
  dividendo_total_uf: number;
  interes_total_uf: number;
  seguros_total_uf: number;
  costo_total_pagado_uf: number;
}

export function validateInputs(inputs: LoanInputs): string[] {
  const errors: string[] = [];

  if (!isFinite(inputs.precioPropiedadUf) || inputs.precioPropiedadUf <= 0) {
    errors.push('El precio de la propiedad debe ser mayor a 0.');
  }
  if (inputs.usarPieUf) {
    if (!isFinite(inputs.pieUf ?? NaN) || (inputs.pieUf ?? 0) < 0) {
      errors.push('El pie en UF debe ser un número válido y no negativo.');
    }
  } else if (!isFinite(inputs.piePorcentaje) || inputs.piePorcentaje < 0) {
    errors.push('El porcentaje de pie no puede ser negativo.');
  }

  if (!isFinite(inputs.tasaAnual) || inputs.tasaAnual < 0) {
    errors.push('La tasa anual no puede ser negativa.');
  }
  if (!isFinite(inputs.plazoAnios) || inputs.plazoAnios <= 0) {
    errors.push('El plazo en años debe ser mayor a 0.');
  }

  if (inputs.seguroModo === 'simple') {
    if (inputs.seguroDesgravamenUfMensual < 0 || inputs.seguroIncendioSismoUfMensual < 0) {
      errors.push('Los seguros mensuales no pueden ser negativos.');
    }
  } else {
    if (inputs.seguroDesgravamenRateMensual < 0 || inputs.seguroIncendioSismoRateMensual < 0) {
      errors.push('Las tasas de seguro no pueden ser negativas.');
    }
  }

  return errors;
}

function computePieUf(inputs: LoanInputs): number {
  if (inputs.usarPieUf) {
    return inputs.pieUf ?? 0;
  }
  return inputs.precioPropiedadUf * (inputs.piePorcentaje / 100);
}

function assertValidLoan(inputs: LoanInputs): void {
  const errors = validateInputs(inputs);
  if (!isFinite(inputs.precioPropiedadUf) || inputs.precioPropiedadUf <= 0) {
    errors.push('Falta definir el precio de la propiedad en UF.');
  }

  const pieUf = computePieUf(inputs);
  if (isFinite(pieUf) && pieUf >= inputs.precioPropiedadUf) {
    errors.push('El pie debe ser menor que el precio de la propiedad.');
  }

  if (errors.length) {
    throw new Error(errors.join(' '));
  }
}

export function buildAmortizationTable(inputs: LoanInputs): AmortizationResult {
  assertValidLoan(inputs);

  const pieUf = computePieUf(inputs);
  const principal = inputs.precioPropiedadUf - pieUf;
  const months = Math.round(inputs.plazoAnios * 12);
  const monthlyRate = (inputs.tasaAnual / 100) / 12;

  const basePayment = monthlyRate > 0
    ? (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
    : principal / months;

  const rows: AmortizationRow[] = [];
  let saldo = principal;
  let interesTotal = 0;
  let segurosTotal = 0;
  let costoTotal = 0;
  let capitalTotal = 0;

  for (let t = 1; t <= months; t += 1) {
    const saldo_inicial = saldo;
    const interes = saldo_inicial * monthlyRate;
    let amortizacion = basePayment - interes;
    let cuota = basePayment;

    if (t === months) {
      amortizacion = saldo_inicial;
      cuota = interes + amortizacion;
    }

    const saldo_final = Math.max(0, saldo_inicial - amortizacion);

    let seguros = 0;
    if (inputs.seguroModo === 'simple') {
      seguros = inputs.seguroDesgravamenUfMensual + inputs.seguroIncendioSismoUfMensual;
    } else {
      const baseSeguro = inputs.baseSeguro === 'saldo' ? saldo_inicial : principal;
      seguros = (baseSeguro * inputs.seguroDesgravamenRateMensual) +
        (baseSeguro * inputs.seguroIncendioSismoRateMensual);
    }

    const pago_total = cuota + seguros;

    rows.push({ cuota: t, saldo_inicial, interes, amortizacion, saldo_final, seguros, pago_total });

    saldo = saldo_final;
    interesTotal += interes;
    segurosTotal += seguros;
    costoTotal += pago_total;
    capitalTotal += amortizacion;
  }

  const dividendo_total_uf = rows.length ? rows[0].pago_total : basePayment;

  return {
    rows,
    totals: {
      interes_total_uf: interesTotal,
      seguros_total_uf: segurosTotal,
      costo_total_pagado_uf: costoTotal,
      capital_total_uf: capitalTotal,
    },
    monto_credito_uf: principal,
    dividendo_base_uf: basePayment,
    dividendo_total_uf,
  };
}

export function computeLoanSummary(inputs: LoanInputs): LoanSummary {
  const amortization = buildAmortizationTable(inputs);

  return {
    monto_credito_uf: amortization.monto_credito_uf,
    dividendo_base_uf: amortization.dividendo_base_uf,
    dividendo_total_uf: amortization.dividendo_total_uf,
    interes_total_uf: amortization.totals.interes_total_uf,
    seguros_total_uf: amortization.totals.seguros_total_uf,
    costo_total_pagado_uf: amortization.totals.costo_total_pagado_uf,
  };
}
