import { buildAmortizationTable, computeLoanSummary, LoanInputs } from './amortization';

const baseInputs: LoanInputs = {
  precioPropiedadUf: 4000,
  piePorcentaje: 20,
  pieUf: undefined,
  usarPieUf: false,
  tasaAnual: 4.6,
  plazoAnios: 20,
  seguroModo: 'simple',
  seguroDesgravamenUfMensual: 0.12,
  seguroIncendioSismoUfMensual: 0.08,
  seguroDesgravamenRateMensual: 0,
  seguroIncendioSismoRateMensual: 0,
  baseSeguro: 'saldo',
};

function principalFrom(inputs: LoanInputs): number {
  const pie = inputs.usarPieUf
    ? inputs.pieUf ?? 0
    : inputs.precioPropiedadUf * (inputs.piePorcentaje / 100);
  return inputs.precioPropiedadUf - pie;
}

describe('Simulador hipotecario', () => {
  it('cierra el saldo final cercano a 0', () => {
    const result = buildAmortizationTable(baseInputs);
    const lastRow = result.rows[result.rows.length - 1];

    expect(lastRow.saldo_final).toBeLessThan(1e-6);
    expect(result.totals.capital_total_uf).toBeCloseTo(result.monto_credito_uf, 4);
  });

  it('soporta tasa 0% con cuota lineal', () => {
    const inputs: LoanInputs = {
      ...baseInputs,
      tasaAnual: 0,
      plazoAnios: 1,
      seguroModo: 'simple',
      seguroDesgravamenUfMensual: 0,
      seguroIncendioSismoUfMensual: 0,
    };

    const result = buildAmortizationTable(inputs);
    const expectedCuota = principalFrom(inputs) / 12;

    expect(result.dividendo_base_uf).toBeCloseTo(expectedCuota, 6);
    expect(result.rows.every((r) => Math.abs(r.interes) < 1e-10)).toBe(true);
    expect(result.rows[result.rows.length - 1].saldo_final).toBeLessThan(1e-6);
  });

  it('calcula seguros fijos y por tasa', () => {
    const simple = computeLoanSummary(baseInputs);
    const expectedSimpleSeguro = baseInputs.seguroDesgravamenUfMensual + baseInputs.seguroIncendioSismoUfMensual;
    expect(simple.dividendo_total_uf).toBeCloseTo(simple.dividendo_base_uf + expectedSimpleSeguro, 6);

    const rateInputs: LoanInputs = {
      ...baseInputs,
      seguroModo: 'avanzado',
      seguroDesgravamenRateMensual: 0.0012,
      seguroIncendioSismoRateMensual: 0.0008,
      seguroDesgravamenUfMensual: 0,
      seguroIncendioSismoUfMensual: 0,
      baseSeguro: 'saldo',
    };

    const table = buildAmortizationTable(rateInputs);
    const firstRow = table.rows[0];
    const principal = principalFrom(rateInputs);
    const expectedFirstSeguros = principal * (rateInputs.seguroDesgravamenRateMensual + rateInputs.seguroIncendioSismoRateMensual);

    expect(firstRow.seguros).toBeCloseTo(expectedFirstSeguros, 6);
    expect(table.totals.seguros_total_uf).toBeGreaterThan(0);
  });
});
