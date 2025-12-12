import React, { useEffect, useMemo, useState, useRef } from 'react';
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

const HIPOTECARIO_FORM_STORAGE_KEY = 'hipotecario-form-state';

type Theme = 'dark' | 'light';
type ResultUnit = 'uf' | 'clp';

function formatUf(value: number, decimals = 2): string {
  return Number.isFinite(value) ? `UF ${value.toFixed(decimals)}` : '—';
}

function formatClp(value: number, valorUf: number, decimals = 0): string {
  if (!Number.isFinite(value) || !Number.isFinite(valorUf) || valorUf <= 0) return '—';
  const clp = value * valorUf;
  return clp.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function formatTableValue(value: number, unit: ResultUnit, valorUf: number): string {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'uf') {
    return value.toFixed(2);
  }
  if (!Number.isFinite(valorUf) || valorUf <= 0) return '—';
  const clp = value * valorUf;
  return clp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

function formatUnitValue(value: number, unit: ResultUnit, valorUf: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'uf') {
    return `UF ${value.toFixed(decimals)}`;
  }
  return formatClp(value, valorUf, 0);
}

function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('hipotecario-theme') as Theme | null;
    return stored ?? ((document.body.getAttribute('data-theme') as Theme) || 'dark');
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    document.body.classList.add('simulador-hipotecario');
    localStorage.setItem('hipotecario-theme', theme);
    return () => {
      document.body.classList.remove('simulador-hipotecario');
    };
  }, [theme]);

  return [theme, setTheme];
}

function SummaryCards({
  summary,
  unit,
  valorUf,
  onUnitChange,
  canShowClp,
}: {
  summary: LoanSummary | null;
  unit: ResultUnit;
  valorUf: number;
  onUnitChange: (next: ResultUnit) => void;
  canShowClp: boolean;
}) {
  const unitToggle = (
    <div className="result-unit-toggle summary-card__toggle">
      <span>Ver resultados en:</span>
      <div className="result-unit-toggle__buttons">
        <button
          type="button"
          className={`result-unit-toggle__button ${unit === 'uf' ? 'active' : ''}`}
          onClick={() => onUnitChange('uf')}
        >
          UF
        </button>
        <button
          type="button"
          className={`result-unit-toggle__button ${unit === 'clp' ? 'active' : ''}`}
          onClick={() => canShowClp && onUnitChange('clp')}
          disabled={!canShowClp}
        >
          CLP
        </button>
      </div>
      {!canShowClp && <span className="result-unit-toggle__hint">Ingresa un valor UF válido para ver CLP</span>}
    </div>
  );

  if (!summary) {
    return (
      <div className="summary-card">
        <div className="summary-card__top">
          <div className="summary-main">
            <p className="summary-label">Simulador de crédito</p>
            <p className="summary-value">Ingresa datos y calcula para ver el detalle.</p>
          </div>
          {unitToggle}
        </div>
      </div>
    );
  }

  const formatter = unit === 'uf'
    ? (value: number) => formatUf(value)
    : (value: number) => formatClp(value, valorUf);

  const metrics = [
    { label: 'Monto crédito', value: formatter(summary.monto_credito_uf) },
    { label: 'Dividendo base', value: formatter(summary.dividendo_base_uf) },
    { label: 'Dividendo con seguros', value: formatter(summary.dividendo_total_uf) },
    { label: 'Interés total', value: formatter(summary.interes_total_uf) },
    { label: 'Seguros total', value: formatter(summary.seguros_total_uf) },
    { label: 'Costo total pagado', value: formatter(summary.costo_total_pagado_uf) },
  ];

  return (
    <div className="summary-card">
      <div className="summary-card__top">
        <div className="summary-main">
          <p className="summary-label">Resumen</p>
          <p className="summary-value">{formatter(summary.dividendo_total_uf)} / mes</p>
          <p className="summary-sub">
            Cuota inicial con seguros incluidos · Valores en {unit === 'uf' ? 'UF' : 'CLP'}
          </p>
        </div>
        {unitToggle}
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

function AmortizationChart({
  amortization,
  unit,
  valorUf,
}: {
  amortization: AmortizationResult;
  unit: ResultUnit;
  valorUf: number;
}) {
  const rows = amortization.rows;
  const denominator = rows.length > 1 ? rows.length - 1 : 1;
  const maxSaldo = Math.max(...rows.map((row) => row.saldo_inicial));
  const minSaldo = Math.min(...rows.map((row) => row.saldo_final));
  const range = Math.max(maxSaldo - minSaldo, 1);
  const pathPoints = rows.map((row, idx) => {
    const x = (idx / denominator) * 100;
    const y = 95 - ((row.saldo_inicial - minSaldo) / range) * 80;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  const saldoInicio = rows.length ? formatUnitValue(rows[0].saldo_inicial, unit, valorUf, 2) : '—';
  const saldoFinal = rows.length
    ? formatUnitValue(rows[rows.length - 1].saldo_final, unit, valorUf, 2)
    : '—';

  return (
    <div className="amort-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polyline
          className="amort-chart__line"
          points={pathPoints}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
        />
        <polygon
          className="amort-chart__area"
          points={`${pathPoints} 100,100 0,100`}
          fill="url(#saldoGradient)"
          stroke="none"
        />
      </svg>
      <div className="amort-chart__footer">
        <div>
          <p>Saldo inicial</p>
          <strong>{saldoInicio}</strong>
        </div>
        <div>
          <p>Saldo final</p>
          <strong>{saldoFinal}</strong>
        </div>
      </div>
    </div>
  );
}

function TableSection({
  amortization,
  onExport,
  plazoMeses,
  unit,
  valorUf,
  viewMode,
  onViewModeChange,
}: {
  amortization: AmortizationResult | null;
  onExport: () => void;
  plazoMeses: number;
  unit: ResultUnit;
  valorUf: number;
  viewMode: 'tabla' | 'grafico';
  onViewModeChange: (mode: 'tabla' | 'grafico') => void;
}) {
  const hasData = Boolean(amortization && amortization.rows.length);
  const rows = amortization?.rows ?? [];
  const totals = amortization?.totals;

  const viewToggle = (
    <div className="view-toggle">
      <button
        type="button"
        className={`view-toggle__button ${viewMode === 'tabla' ? 'active' : ''}`}
        onClick={() => onViewModeChange('tabla')}
      >
        Tabla
      </button>
      <button
        type="button"
        className={`view-toggle__button ${viewMode === 'grafico' ? 'active' : ''}`}
        onClick={() => hasData && onViewModeChange('grafico')}
        disabled={!hasData}
      >
        Gráfico
      </button>
    </div>
  );

  return (
    <div className="card table-card">
      <div className="table-head">
        <div>
          <p className="summary-label">Tabla de amortización</p>
          <p className="summary-sub">{plazoMeses} cuotas · sistema francés</p>
        </div>
        <div className="table-actions">
          {viewToggle}
          <button type="button" className="ghost-btn" onClick={onExport} disabled={!hasData}>
            Exportar CSV
          </button>
        </div>
      </div>
      {!hasData || !amortization ? (
        <p className="summary-sub">Sin datos aún. Completa el formulario y calcula.</p>
      ) : viewMode === 'tabla' ? (
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
                  <td>{formatTableValue(row.saldo_inicial, unit, valorUf)}</td>
                  <td>{formatTableValue(row.interes, unit, valorUf)}</td>
                  <td>{formatTableValue(row.amortizacion, unit, valorUf)}</td>
                  <td>{formatTableValue(row.saldo_final, unit, valorUf)}</td>
                  <td>{formatTableValue(row.seguros, unit, valorUf)}</td>
                  <td>{formatTableValue(row.pago_total, unit, valorUf)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Totales</th>
                <th>-</th>
                <th>{formatTableValue(amortization!.totals.interes_total_uf, unit, valorUf)}</th>
                <th>{formatTableValue(amortization!.totals.capital_total_uf, unit, valorUf)}</th>
                <th>-</th>
                <th>{formatTableValue(amortization!.totals.seguros_total_uf, unit, valorUf)}</th>
                <th>{formatTableValue(amortization!.totals.costo_total_pagado_uf, unit, valorUf)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <AmortizationChart amortization={amortization} unit={unit} valorUf={valorUf} />
      )}
    </div>
  );
}

function getStoredHipotecarioInputs(): LoanInputs {
  if (typeof window === 'undefined') return defaultInputs;
  const raw = window.localStorage.getItem(HIPOTECARIO_FORM_STORAGE_KEY);
  let stored: Partial<LoanInputs> = {};
  if (raw) {
    try {
      stored = JSON.parse(raw) as Partial<LoanInputs>;
    } catch {
      // Ignore parse errors
    }
  }
  
  // Leer datos compartidos desde flipping
  const sharedRaw = window.localStorage.getItem('flipping-shared-data');
  if (sharedRaw) {
    try {
      const shared = JSON.parse(sharedRaw) as Partial<{
        precioPropiedadUf: number;
        piePorcentaje: number;
        tasaAnual: number;
        plazoAnios: number;
      }>;
      // Aplicar datos compartidos solo si no hay valores guardados específicamente en el simulador
      if (shared.precioPropiedadUf && !stored.precioPropiedadUf) {
        stored.precioPropiedadUf = shared.precioPropiedadUf;
      }
      if (shared.piePorcentaje !== undefined && stored.piePorcentaje === undefined) {
        stored.piePorcentaje = shared.piePorcentaje;
      }
      if (shared.tasaAnual !== undefined && stored.tasaAnual === undefined) {
        stored.tasaAnual = shared.tasaAnual;
      }
      if (shared.plazoAnios !== undefined && stored.plazoAnios === undefined) {
        stored.plazoAnios = shared.plazoAnios;
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  return { ...defaultInputs, ...stored };
}

function App() {
  const [inputs, setInputs] = useState<LoanInputs>(() => getStoredHipotecarioInputs());
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [amortization, setAmortization] = useState<AmortizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const [valorUf, setValorUf] = useState(() => {
    const stored = localStorage.getItem('valor-uf');
    return stored ? parseFloat(stored) : 39600;
  });
  const [resultUnit, setResultUnit] = useState<ResultUnit>('uf');
  const [amortViewMode, setAmortViewMode] = useState<'tabla' | 'grafico'>('tabla');

  const plazoMeses = useMemo(() => Math.round(inputs.plazoAnios * 12), [inputs.plazoAnios]);
  const pieUfEquivalente = useMemo(
    () => inputs.precioPropiedadUf * (inputs.piePorcentaje / 100),
    [inputs.precioPropiedadUf, inputs.piePorcentaje],
  );
  const canShowClp = Number.isFinite(valorUf) && valorUf > 0;

  useEffect(() => {
    if (resultUnit === 'clp' && !canShowClp) {
      setResultUnit('uf');
    }
  }, [resultUnit, canShowClp]);

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

  // Recalcular automáticamente cuando cambien los inputs principales (pero no en el primer render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (inputs.precioPropiedadUf > 0) {
      handleCalculate();
    }
  }, [inputs.precioPropiedadUf, inputs.piePorcentaje, inputs.pieUf, inputs.usarPieUf, inputs.tasaAnual, inputs.plazoAnios]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HIPOTECARIO_FORM_STORAGE_KEY, JSON.stringify(inputs));
  }, [inputs]);

  // Escuchar cambios en datos compartidos desde flipping
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const applySharedData = (shared: Partial<{
      precioPropiedadUf: number;
      piePorcentaje: number;
      tasaAnual: number;
      plazoAnios: number;
    }>) => {
      const updates: Partial<LoanInputs> = {};
      if (shared.precioPropiedadUf && shared.precioPropiedadUf > 0) {
        updates.precioPropiedadUf = shared.precioPropiedadUf;
      }
      if (shared.piePorcentaje !== undefined && shared.piePorcentaje >= 0) {
        updates.piePorcentaje = shared.piePorcentaje;
        updates.usarPieUf = false; // Asegurar que use porcentaje
      }
      if (shared.tasaAnual !== undefined && shared.tasaAnual >= 0) {
        updates.tasaAnual = shared.tasaAnual;
      }
      if (shared.plazoAnios !== undefined && shared.plazoAnios > 0) {
        updates.plazoAnios = shared.plazoAnios;
      }
      if (Object.keys(updates).length > 0) {
        setInputs((prev) => ({ ...prev, ...updates }));
        // Calcular automáticamente después de actualizar
        setTimeout(() => {
          handleCalculate();
        }, 100);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'flipping-shared-data' && e.newValue) {
        try {
          const shared = JSON.parse(e.newValue);
          applySharedData(shared);
        } catch {
          // Ignore parse errors
        }
      }
    };

    const handleCustomEvent = (e: CustomEvent) => {
      applySharedData(e.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('flipping-data-synced', handleCustomEvent as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('flipping-data-synced', handleCustomEvent as EventListener);
    };
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

  useEffect(() => {
    localStorage.setItem('valor-uf', valorUf.toString());
  }, [valorUf]);

  useEffect(() => {
    if (!amortization && amortViewMode !== 'tabla') {
      setAmortViewMode('tabla');
    }
  }, [amortization, amortViewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 720px)');
    if (!mq.matches) {
      document.body.classList.remove('cta-hidden');
      return undefined;
    }
    const body = document.body;
    let lastScroll = window.scrollY;
    let ticking = false;

    const update = () => {
      const current = window.scrollY;
      if (current > lastScroll + 10) {
        body.classList.add('cta-hidden');
      } else if (current < lastScroll - 10) {
        body.classList.remove('cta-hidden');
      }
      lastScroll = current;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      body.classList.remove('cta-hidden');
    };
  }, []);

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
        </div>
        <div className="topbar__actions">
          <label className="topbar__uf" htmlFor="valor_uf_input">
            <span className="topbar__uf-label">
              Valor UF (CLP) <span className="help-icon" data-tooltip="Valor de referencia de la UF en CLP para convertir entre pesos y UF.">?</span>
            </span>
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
          </label>
          <button
            type="button"
            id="theme_toggle"
            className={`theme-toggle ${theme === 'dark' ? 'dark' : ''}`}
            aria-label="Cambiar tema"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span className="theme-toggle__icon" aria-hidden>{theme === 'dark' ? '◐' : '◑'}</span>
            <span id="theme_label" className="sr-only">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
          <button
            type="submit"
            form="form_hipotecario"
            className="btn topbar-btn"
          >
            Calcular
          </button>
        </div>
      </div>

      <div className="page page--hipotecario">
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
            <form id="form_hipotecario" className="form" onSubmit={handleCalculate}>
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
                      <p className="hint">
                        Equivale a {formatUf(pieUfEquivalente)}
                        {canShowClp ? ` (${formatClp(pieUfEquivalente, valorUf)})` : ''}
                      </p>
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
                        {canShowClp && (
                          <p className="hint">≈ {formatClp(inputs.seguroDesgravamenUfMensual, valorUf)} / mes</p>
                        )}
                      </label>
                      <label className="field">
                        <span>Seguro incendio + sismo (UF mensual)</span>
                        <input type="number" min="0" step="any" value={inputs.seguroIncendioSismoUfMensual} onChange={handleNumberChange('seguroIncendioSismoUfMensual')} />
                        {canShowClp && (
                          <p className="hint">≈ {formatClp(inputs.seguroIncendioSismoUfMensual, valorUf)} / mes</p>
                        )}
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

              {error && <div className="error-banner">{error}</div>}
            </form>
          </section>

          <section className="results-stack">
            <SummaryCards
              summary={summary}
              unit={resultUnit}
              valorUf={valorUf}
              onUnitChange={setResultUnit}
              canShowClp={canShowClp}
            />
            <TableSection
              amortization={amortization}
              onExport={exportCsv}
              plazoMeses={plazoMeses}
              unit={resultUnit}
              valorUf={valorUf}
              viewMode={amortViewMode}
              onViewModeChange={setAmortViewMode}
            />
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
