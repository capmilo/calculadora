import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AmortizationResult,
  LoanInputs,
  LoanSummary,
  buildAmortizationTable,
  validateInputs,
} from './amortization';

const defaultInputs: LoanInputs = {
  precioPropiedadUf: 4000,
  piePorcentaje: 20,
  pieUf: 800,
  usarPieUf: false,
  tasaAnual: 4.6,
  plazoAnios: 25,
  seguroModo: 'simple',
  seguroDesgravamenUfMensual: 0.12,
  seguroIncendioSismoUfMensual: 0.08,
  seguroDesgravamenRateMensual: 0.0009,
  seguroIncendioSismoRateMensual: 0.0006,
  baseSeguro: 'saldo',
};

type Theme = 'dark' | 'light';

function formatUf(value: number, decimals = 2): string {
  return Number.isFinite(value) ? `UF ${value.toFixed(decimals)}` : '—';
}

function formatNumber(value: number, decimals = 2): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—';
}

function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('hipotecario-theme') as Theme | null;
    return stored ?? ((document.body.getAttribute('data-theme') as Theme) || 'dark');
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('hipotecario-theme', theme);
  }, [theme]);

  return [theme, setTheme];
}

function SummaryCards({ summary }: { summary: LoanSummary | null }) {
  if (!summary) {
    return (
      <div className="summary-card">
        <div className="summary-main">
          <p className="summary-label">Simulador de crédito</p>
          <p className="summary-value">Ingresa datos y calcula para ver el detalle.</p>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: 'Monto crédito', value: formatUf(summary.monto_credito_uf) },
    { label: 'Dividendo base', value: formatUf(summary.dividendo_base_uf) },
    { label: 'Dividendo con seguros', value: formatUf(summary.dividendo_total_uf) },
    { label: 'Interés total', value: formatUf(summary.interes_total_uf) },
    { label: 'Seguros total', value: formatUf(summary.seguros_total_uf) },
    { label: 'Costo total pagado', value: formatUf(summary.costo_total_pagado_uf) },
  ];

  return (
    <div className="summary-card">
      <div className="summary-main">
        <p className="summary-label">Resumen</p>
        <p className="summary-value">{formatUf(summary.dividendo_total_uf)} / mes</p>
        <p className="summary-sub">Cuota inicial con seguros incluidos</p>
      </div>
      <div className="summary-side">
        {metrics.map((metric) => (
          <div key={metric.label} className="mini-card">
            <p className="mini-label">{metric.label}</p>
            <p className="mini-value">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSection({
  amortization,
  onExport,
  plazoMeses,
}: {
  amortization: AmortizationResult | null;
  onExport: () => void;
  plazoMeses: number;
}) {
  if (!amortization) {
    return (
      <div className="card table-card">
        <p className="summary-label">Tabla de amortización</p>
        <p className="summary-sub">Sin datos aún. Completa el formulario y calcula.</p>
      </div>
    );
  }

  const { rows, totals } = amortization;

  return (
    <div className="card table-card">
      <div className="table-head">
        <div>
          <p className="summary-label">Tabla de amortización</p>
          <p className="summary-sub">{plazoMeses} cuotas · sistema francés</p>
        </div>
        <div className="table-actions">
          <button type="button" className="ghost-btn" onClick={onExport}>
            Exportar CSV
          </button>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="amort-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Saldo inicial</th>
              <th>Interés</th>
              <th>Amortización</th>
              <th>Saldo final</th>
              <th>Seguros</th>
              <th>Pago total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cuota}>
                <td>{row.cuota}</td>
                <td>{formatNumber(row.saldo_inicial)}</td>
                <td>{formatNumber(row.interes)}</td>
                <td>{formatNumber(row.amortizacion)}</td>
                <td>{formatNumber(row.saldo_final)}</td>
                <td>{formatNumber(row.seguros)}</td>
                <td>{formatNumber(row.pago_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Totales</th>
              <th>-</th>
              <th>{formatNumber(totals.interes_total_uf)}</th>
              <th>{formatNumber(totals.capital_total_uf)}</th>
              <th>-</th>
              <th>{formatNumber(totals.seguros_total_uf)}</th>
              <th>{formatNumber(totals.costo_total_pagado_uf)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function App() {
  const [inputs, setInputs] = useState<LoanInputs>(defaultInputs);
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [amortization, setAmortization] = useState<AmortizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();

  const plazoMeses = useMemo(() => Math.round(inputs.plazoAnios * 12), [inputs.plazoAnios]);

  const handleNumberChange = (field: keyof LoanInputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    setInputs((prev) => ({ ...prev, [field]: Number.isNaN(next) ? 0 : next }));
    setError(null);
  };

  const handleSelectChange = (field: keyof LoanInputs) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setInputs((prev) => ({ ...prev, [field]: e.target.value as LoanInputs[keyof LoanInputs] }));
    setError(null);
  };

  const handleCalculate = (evt?: React.FormEvent) => {
    evt?.preventDefault();
    try {
      const validationErrors = validateInputs(inputs);
      const pieUf = inputs.usarPieUf ? inputs.pieUf ?? 0 : inputs.precioPropiedadUf * (inputs.piePorcentaje / 100);
      if (pieUf >= inputs.precioPropiedadUf) {
        validationErrors.push('El pie debe ser menor que el precio de la propiedad.');
      }
      if (validationErrors.length) {
        throw new Error(validationErrors.join(' '));
      }
      const amort = buildAmortizationTable(inputs);
      const summaryData: LoanSummary = {
        monto_credito_uf: amort.monto_credito_uf,
        dividendo_base_uf: amort.dividendo_base_uf,
        dividendo_total_uf: amort.dividendo_total_uf,
        interes_total_uf: amort.totals.interes_total_uf,
        seguros_total_uf: amort.totals.seguros_total_uf,
        costo_total_pagado_uf: amort.totals.costo_total_pagado_uf,
      };
      setSummary(summaryData);
      setAmortization(amort);
      setError(null);
    } catch (err) {
      setSummary(null);
      setAmortization(null);
      setError(err instanceof Error ? err.message : 'Revisa los datos ingresados.');
    }
  };

  useEffect(() => {
    handleCalculate();
  }, []);

  const exportCsv = () => {
    if (!amortization) return;
    const headers = ['cuota', 'saldo_inicial', 'interes', 'amortizacion', 'saldo_final', 'seguros', 'pago_total'];
    const lines = amortization.rows.map((row) => (
      [
        row.cuota,
        row.saldo_inicial.toFixed(6),
        row.interes.toFixed(6),
        row.amortizacion.toFixed(6),
        row.saldo_final.toFixed(6),
        row.seguros.toFixed(6),
        row.pago_total.toFixed(6),
      ].join(',')
    ));
    const content = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'amortizacion_hipotecario.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const [valorUf, setValorUf] = useState(() => {
    const stored = localStorage.getItem('valor-uf');
    return stored ? parseFloat(stored) : 39600;
  });

  useEffect(() => {
    localStorage.setItem('valor-uf', valorUf.toString());
  }, [valorUf]);

  return (
    <>
      <div className="topbar">
        <div className="topbar__section">
          <div className="tab-nav">
            <a className="tab-nav__link" href="index.html">Flipping inmobiliario</a>
            <a className="tab-nav__link tab-nav__link--active" href="hipotecario.html">Simulador crédito hipotecario</a>
          </div>
          <div className="tab-nav-dropdown">
            <select 
              id="tab_dropdown" 
              aria-label="Seleccionar herramienta"
              value="hipotecario.html"
              onChange={(e) => {
                window.location.href = e.target.value;
              }}
            >
              <option value="index.html">Flipping inmobiliario</option>
              <option value="hipotecario.html">Simulador crédito hipotecario</option>
            </select>
          </div>
          <span className="topbar__title">Valor UF (CLP) <span className="help-icon" data-tooltip="Valor de referencia de la UF en CLP para convertir entre pesos y UF.">?</span></span>
          <input 
            type="number" 
            id="valor_uf_input" 
            value={valorUf} 
            min="0" 
            step="any"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) {
                setValorUf(val);
              }
            }}
          />
        </div>
        <div className="topbar__actions">
          <button
            type="button"
          id="theme_toggle"
          className={`theme-toggle ${theme === 'dark' ? 'dark' : ''}`}
          aria-label="Cambiar tema"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span className="theme-toggle__icon" aria-hidden>{theme === 'dark' ? '◐' : '◑'}</span>
          <span className="theme-toggle__text">
            <span className="theme-current">{theme === 'dark' ? 'Dark' : 'Light'}</span> / {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>
        </div>
      </div>

      <div className="page">
        <header className="hero">
          <div>
            <p className="eyebrow">Financiamiento en UF</p>
            <h1>Simulador de Crédito Hipotecario</h1>
            <p className="subhead">
              Sistema de amortización francés (cuota fija). Calcula dividendo, seguros y tabla completa de pagos en UF.
            </p>
          </div>
        </header>

        <main className="layout main-grid">
          <section className="card form-card">
            <form className="form" onSubmit={handleCalculate}>
              <div className="block">
                <div className="block__header">
                  <p className="block__eyebrow">A) Datos base</p>
                  <p className="block__title">Propiedad y pie</p>
                </div>
                <div className="grid two">
                  <label className="field">
                    <span>Precio propiedad (UF)</span>
                    <input type="number" min="0" step="any" value={inputs.precioPropiedadUf} onChange={handleNumberChange('precioPropiedadUf')} required />
                  </label>
                  <label className="field">
                    <span>Tasa anual (%)</span>
                    <input type="number" min="0" step="any" value={inputs.tasaAnual} onChange={handleNumberChange('tasaAnual')} required />
                  </label>
                  <label className="field">
                    <span>Plazo (años)</span>
                    <input type="number" min="0.1" step="any" value={inputs.plazoAnios} onChange={handleNumberChange('plazoAnios')} required />
                    <p className="hint">Equivalente a {plazoMeses} meses.</p>
                  </label>
                  <div className="field">
                    <span>Modo de pie</span>
                    <div className="toggle">
                      <label>
                        <input type="radio" name="modo_pie" checked={!inputs.usarPieUf} onChange={() => setInputs((prev) => ({ ...prev, usarPieUf: false }))} />
                        <span>Pie (%)</span>
                      </label>
                      <label>
                        <input type="radio" name="modo_pie" checked={inputs.usarPieUf} onChange={() => setInputs((prev) => ({ ...prev, usarPieUf: true }))} />
                        <span>Pie en UF</span>
                      </label>
                    </div>
                  </div>
                  {!inputs.usarPieUf && (
                    <label className="field">
                      <span>Pie (%)</span>
                      <input type="number" min="0" step="any" value={inputs.piePorcentaje} onChange={handleNumberChange('piePorcentaje')} />
                    </label>
                  )}
                  {inputs.usarPieUf && (
                    <label className="field">
                      <span>Pie (UF)</span>
                      <input type="number" min="0" step="any" value={inputs.pieUf ?? 0} onChange={handleNumberChange('pieUf')} />
                    </label>
                  )}
                </div>
              </div>

              <div className="block">
                <div className="block__header">
                  <p className="block__eyebrow">B) Seguros</p>
                  <p className="block__title">Incluye desgravamen e incendio/sismo</p>
                </div>

                <div className="grid two">
                  <div className="field">
                    <span>Modo</span>
                    <div className="toggle">
                      <label>
                        <input type="radio" name="modo_seguro" checked={inputs.seguroModo === 'simple'} onChange={() => setInputs((prev) => ({ ...prev, seguroModo: 'simple' }))} />
                        <span>Simple (UF fijos)</span>
                      </label>
                      <label>
                        <input type="radio" name="modo_seguro" checked={inputs.seguroModo === 'avanzado'} onChange={() => setInputs((prev) => ({ ...prev, seguroModo: 'avanzado' }))} />
                        <span>Avanzado (tasa mensual)</span>
                      </label>
                    </div>
                  </div>

                  {inputs.seguroModo === 'avanzado' && (
                    <label className="field">
                      <span>Base de seguro</span>
                      <select value={inputs.baseSeguro} onChange={handleSelectChange('baseSeguro')}>
                        <option value="saldo">Saldo insoluto</option>
                        <option value="capital_inicial">Capital inicial</option>
                      </select>
                    </label>
                  )}

                  {inputs.seguroModo === 'simple' ? (
                    <>
                      <label className="field">
                        <span>Seguro desgravamen (UF mensual)</span>
                        <input type="number" min="0" step="any" value={inputs.seguroDesgravamenUfMensual} onChange={handleNumberChange('seguroDesgravamenUfMensual')} />
                      </label>
                      <label className="field">
                        <span>Seguro incendio + sismo (UF mensual)</span>
                        <input type="number" min="0" step="any" value={inputs.seguroIncendioSismoUfMensual} onChange={handleNumberChange('seguroIncendioSismoUfMensual')} />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="field">
                        <span>Seguro desgravamen (tasa mensual)</span>
                        <input type="number" min="0" step="any" value={inputs.seguroDesgravamenRateMensual} onChange={handleNumberChange('seguroDesgravamenRateMensual')} />
                        <p className="hint">Ej: 0.0009 = 0.09% mensual</p>
                      </label>
                      <label className="field">
                        <span>Seguro incendio + sismo (tasa mensual)</span>
                        <input type="number" min="0" step="any" value={inputs.seguroIncendioSismoRateMensual} onChange={handleNumberChange('seguroIncendioSismoRateMensual')} />
                        <p className="hint">Ej: 0.0006 = 0.06% mensual</p>
                      </label>
                    </>
                  )}
                </div>
              </div>

              <button type="submit" className="btn">Calcular crédito</button>
              {error && <div className="error-banner">{error}</div>}
            </form>
          </section>

          <section className="results-stack">
            <SummaryCards summary={summary} />
            <TableSection amortization={amortization} onExport={exportCsv} plazoMeses={plazoMeses} />
          </section>
        </main>
      </div>
    </>
  );
}

const rootEl = document.getElementById('hipotecario-root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
