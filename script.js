const form = document.getElementById('form_calculo');
const unitRadios = document.querySelectorAll('input[name="unidad"]');
const valorUfInput = document.getElementById('valor_uf_input');
const historialBody = document.getElementById('historial_body');
const statusCard = document.getElementById('status_card');
const statusMsg = document.getElementById('status_msg');
const statusChip = document.getElementById('status_chip');
const themeToggle = document.getElementById('theme_toggle');
const themeIcon = document.getElementById('theme_icon');
const themeLabel = document.getElementById('theme_label');
const maoValorEl = document.getElementById('mao_valor');
const maoDiferenciaEl = document.getElementById('mao_diferencia_valor');

const FLIPPING_STORAGE_KEY = 'flipping-form-state';
const FLIPPING_FIELD_IDS = [
  'precio_compra',
  'metros',
  'precio_sector_m2',
  'factor_seguridad',
  'costo_remodelacion',
  'imprevistos_pct',
  'gastos_compra_pct',
  'comision_corredor_pct',
  'notaria_conservador',
  'pie_pct',
  'tasa_anual_pct',
  'plazo_credito_meses',
  'duracion_proyecto_meses',
  'meses_pagando_div',
  'margen_objetivo_pct',
];

const labels = {
  precioCompra: document.getElementById('label_precio_compra'),
  precioSector: document.getElementById('label_precio_sector_m2'),
  costoRemodelacion: document.getElementById('label_costo_remodelacion'),
  notaria: document.getElementById('label_notaria_conservador'),
};

const outputs = {
  arv: document.getElementById('resultado_arv'),
  adquisicion: document.getElementById('resultado_adquisicion'),
  remodelacion: document.getElementById('resultado_remodelacion'),
  financiamiento: document.getElementById('resultado_financiamiento'),
  venta: document.getElementById('resultado_venta'),
  total: document.getElementById('resultado_total'),
  dividendo: document.getElementById('resultado_dividendo'),
  ganancia: document.getElementById('resultado_ganancia'),
  roi: document.getElementById('resultado_roi'),
  roiAnual: document.getElementById('resultado_roi_anual'),
  margen: document.getElementById('resultado_margen'),
  seguridad: document.getElementById('resultado_seguridad'),
};

let historial = [];
let lastUnit = currentUnit();

function canUseStorage() {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window && window.localStorage != null;
  } catch {
    return false;
  }
}

function currentUnit() {
  const selected = document.querySelector('input[name="unidad"]:checked');
  return selected ? selected.value : 'clp';
}

function getUfValue() {
  const v = parseFloat(valorUfInput.value);
  return isFinite(v) && v > 0 ? v : 0;
}

function updateLabels() {
  const unit = currentUnit() === 'uf' ? 'UF' : 'CLP';
  labels.precioCompra.textContent = `Precio Compra (${unit})`;
  labels.precioSector.textContent = `Precio Sector/m² (${unit}/m²)`;
  labels.costoRemodelacion.textContent = `Costo Remodelación (${unit})`;
  labels.notaria.textContent = `Notaría y Conservador (${unit})`;
}

function formatMoney(clpValue) {
  const unit = currentUnit();
  const uf = getUfValue();
  if (unit === 'uf' && uf > 0) {
    const ufVal = clpValue / uf;
    return `UF ${ufVal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$ ${Math.round(clpValue).toLocaleString('es-CL')}`;
}

function formatPercent(value) {
  if (!isFinite(value)) return '—';
  return `${value.toFixed(1)} %`;
}

function formatearMonto(valor) {
  if (isNaN(valor)) return '—';
  return valor.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseNumber(id) {
  const val = parseFloat(document.getElementById(id).value);
  return isFinite(val) ? val : NaN;
}

function toCLP(raw) {
  if (currentUnit() === 'uf') {
    return raw * getUfValue();
  }
  return raw;
}

function validateInputs(values) {
  return Object.values(values).every((v) => isFinite(v) && v >= 0);
}

function convertInputs(prevUnit, nextUnit) {
  if (prevUnit === nextUnit) return;
  const ufVal = getUfValue();
  if (ufVal <= 0) return;
  const moneyFields = ['precio_compra', 'precio_sector_m2', 'costo_remodelacion', 'notaria_conservador'];
  const factor = nextUnit === 'uf' ? 1 / ufVal : ufVal;
  moneyFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = parseFloat(el.value);
    if (!isFinite(val)) return;
    el.value = (val * factor).toFixed(2);
  });
}

function calcularIndicadores(inputs) {
  const {
    precioCompra,
    metros,
    precioSectorM2,
    factorSeguridad,
    costoRemodelacion,
    imprevistosPct,
    gastosCompraPct,
    comisionCorredorPct,
    notariaConservador,
    piePct,
    tasaAnualPct,
    plazoCreditoMeses,
    duracionProyectoMeses,
    mesesPagandoDiv,
    margenObjetivoPct,
  } = inputs;

  const valorMercadoTeorico = precioSectorM2 * metros;
  const arv = valorMercadoTeorico * factorSeguridad;

  const pieMonto = precioCompra * (piePct / 100);
  const montoCredito = precioCompra - pieMonto;
  const tasaMensual = (tasaAnualPct / 100) / 12;
  const n = plazoCreditoMeses;
  const dividendoMensual = (tasaMensual > 0)
    ? montoCredito * (tasaMensual * Math.pow(1 + tasaMensual, n)) / (Math.pow(1 + tasaMensual, n) - 1)
    : montoCredito / n;

  const costosFinanciamiento = dividendoMensual * mesesPagandoDiv;

  const costoImprevistos = costoRemodelacion * (imprevistosPct / 100);
  const costoRemodelacionTotal = costoRemodelacion + costoImprevistos;

  const gastosCompraMonto = precioCompra * (gastosCompraPct / 100);
  const gastosOperacionales = gastosCompraMonto + notariaConservador;

  const comisionCorredor = arv * (comisionCorredorPct / 100);

  const costoAdquisicion = precioCompra + gastosOperacionales;
  const costosVenta = comisionCorredor;
  const costoTotal = costoAdquisicion + costoRemodelacionTotal + costosFinanciamiento + costosVenta;
  const gananciaBruta = arv - costoTotal;

  const capitalPropio = pieMonto;
  const roiCapitalPct = capitalPropio > 0 ? (gananciaBruta / capitalPropio) * 100 : NaN;
  const rentabilidadSimple = capitalPropio > 0 ? gananciaBruta / capitalPropio : NaN;
  const roiAnualizadoPct = (isFinite(rentabilidadSimple) && duracionProyectoMeses > 0)
    ? (rentabilidadSimple / duracionProyectoMeses) * 12 * 100
    : NaN;
  const margenProyectoPct = costoTotal > 0 ? (gananciaBruta / costoTotal) * 100 : NaN;
  const factorSeguridadMargenPct = arv > 0 ? ((arv - costoTotal) / arv) * 100 : NaN;

  const gananciaObjetivo = arv * (margenObjetivoPct / 100);
  const costosNoCompra = costoRemodelacionTotal + gastosOperacionales + costosVenta;
  const maoClp = arv - costosNoCompra - gananciaObjetivo;
  const maoUf = maoClp / getUfValue();
  const diferenciaMaoClp = maoClp - precioCompra;
  const diferenciaMaoUf = diferenciaMaoClp / getUfValue();

  return {
    arv,
    costoAdquisicion,
    costoRemodelacionTotal,
    costosFinanciamiento,
    costosVenta,
    costoTotal,
    gananciaBruta,
    roiCapitalPct,
    roiAnualizadoPct,
    margenProyectoPct,
    factorSeguridadMargenPct,
    capitalPropio,
    dividendoMensual,
    mesesPagandoDiv,
    maoClp,
    maoUf,
    diferenciaMaoClp,
    diferenciaMaoUf,
  };
}

function determinarSemaforo(metrics) {
  const { gananciaBruta, roiAnualizadoPct, factorSeguridadMargenPct, margenProyectoPct } = metrics;

  if (
    gananciaBruta <= 0 ||
    roiAnualizadoPct < 12 ||
    factorSeguridadMargenPct < 12 ||
    margenProyectoPct < 8
  ) {
    return {
      color: 'rojo',
      titulo: 'NO RECOMENDADA (ROJO)',
      mensaje: 'Rojo - No es una buena inversión: la rentabilidad y/o el margen de seguridad son demasiado bajos para un flipping.',
    };
  }

  if (
    gananciaBruta > 0 &&
    roiAnualizadoPct >= 30 &&
    factorSeguridadMargenPct >= 25 &&
    margenProyectoPct >= 18
  ) {
    return {
      color: 'verde',
      titulo: 'ÓPTIMA INVERSIÓN (VERDE)',
      mensaje: 'Verde - Óptima oportunidad de flipping: buena rentabilidad anualizada y un colchón de seguridad adecuado.',
    };
  }

  return {
    color: 'amarillo',
    titulo: 'INVERSIÓN CON REPAROS (AMARILLO)',
    mensaje: 'Amarillo - Puede ser una oportunidad, pero requiere revisar con más detalle supuestos, tiempos y riesgos.',
  };
}

function renderResultados(metrics, estado) {
  outputs.arv.textContent = formatMoney(metrics.arv);
  outputs.adquisicion.textContent = formatMoney(metrics.costoAdquisicion);
  outputs.remodelacion.textContent = formatMoney(metrics.costoRemodelacionTotal);
  outputs.financiamiento.textContent = formatMoney(metrics.costosFinanciamiento);
  outputs.venta.textContent = formatMoney(metrics.costosVenta);
  outputs.total.textContent = formatMoney(metrics.costoTotal);
  outputs.ganancia.textContent = formatMoney(metrics.gananciaBruta);
  outputs.dividendo.textContent = `${formatMoney(metrics.dividendoMensual)} / mes (${metrics.mesesPagandoDiv} meses)`;
  outputs.roi.textContent = formatPercent(metrics.roiCapitalPct);
  outputs.roiAnual.textContent = formatPercent(metrics.roiAnualizadoPct);
  outputs.margen.textContent = formatPercent(metrics.margenProyectoPct);
  outputs.seguridad.textContent = formatPercent(metrics.factorSeguridadMargenPct);

  statusCard.classList.remove('status--verde', 'status--amarillo', 'status--rojo');
  statusCard.classList.add(`status--${estado.color}`);
  statusChip.textContent = estado.titulo;
  statusMsg.textContent = estado.mensaje;

  if (maoValorEl && maoDiferenciaEl) {
    const unit = currentUnit();
    const uf = getUfValue();
    const maoMostrado = unit === 'uf' && uf > 0 ? metrics.maoClp / uf : metrics.maoClp;
    const diferenciaMostrada = unit === 'uf' && uf > 0 ? metrics.diferenciaMaoClp / uf : metrics.diferenciaMaoClp;
    const etiqueta = unit === 'uf' ? 'UF' : '$';
    maoValorEl.textContent = `${etiqueta} ${formatearMonto(maoMostrado)}`;
    let textoDiferencia;
    if (isNaN(diferenciaMostrada)) {
      textoDiferencia = '—';
    } else if (diferenciaMostrada > 0) {
      textoDiferencia = `${etiqueta} ${formatearMonto(diferenciaMostrada)} por DEBAJO del MAO (hay margen para comprar).`;
    } else if (diferenciaMostrada < 0) {
      const absDiff = Math.abs(diferenciaMostrada);
      textoDiferencia = `${etiqueta} ${formatearMonto(absDiff)} por SOBRE el MAO (la oferta está alta para el margen objetivo).`;
    } else {
      textoDiferencia = 'El precio de compra coincide exactamente con el MAO.';
    }
    maoDiferenciaEl.textContent = textoDiferencia;
  }
}

function agregarAHistorial(metrics, estado) {
  if (!historialBody) return;
  const unit = currentUnit();
  const uf = getUfValue();
  const convertir = (clp) => (unit === 'uf' && uf > 0 ? clp / uf : clp);
  const fmt = (clp) => (unit === 'uf' && uf > 0
    ? `UF ${convertir(clp).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$ ${Math.round(clp).toLocaleString('es-CL')}`);

  historial.push({ metrics, estado, unidad: unit });
  const id = historial.length;

  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${id}</td>
    <td>${fmt(metrics.arv)}</td>
    <td>${fmt(metrics.gananciaBruta)}</td>
    <td>${formatPercent(metrics.roiAnualizadoPct)}</td>
    <td>${formatPercent(metrics.factorSeguridadMargenPct)}</td>
    <td>${estado.titulo}</td>
  `;

  historialBody.innerHTML = '';
  historialBody.appendChild(row);
}

function leerYValidar() {
  const valorUf = getUfValue();
  if (valorUf <= 0) throw new Error('Ingresa un valor de UF mayor a 0.');

  const precioCompra = parseNumber('precio_compra');
  const metros = parseNumber('metros');
  const precioSectorM2 = parseNumber('precio_sector_m2');
  const factorSeguridad = parseNumber('factor_seguridad');
  const costoRemodelacion = parseNumber('costo_remodelacion');
  const imprevistosPct = parseNumber('imprevistos_pct');
  const gastosCompraPct = parseNumber('gastos_compra_pct');
  const comisionCorredorPct = parseNumber('comision_corredor_pct');
  const notariaConservador = parseNumber('notaria_conservador');
  const piePct = parseNumber('pie_pct');
  const tasaAnualPct = parseNumber('tasa_anual_pct');
  const plazoCreditoMeses = parseNumber('plazo_credito_meses');
  const duracionProyectoMeses = parseNumber('duracion_proyecto_meses');
  const mesesPagandoDiv = parseNumber('meses_pagando_div');
  const margenObjetivoPct = parseNumber('margen_objetivo_pct');

  const baseValues = {
    precioCompra,
    metros,
    precioSectorM2,
    factorSeguridad,
    costoRemodelacion,
    imprevistosPct,
    gastosCompraPct,
    comisionCorredorPct,
    notariaConservador,
    piePct,
    tasaAnualPct,
    plazoCreditoMeses,
    duracionProyectoMeses,
    mesesPagandoDiv,
    margenObjetivoPct,
  };

  if (!validateInputs(baseValues)) {
    throw new Error('Revisa los campos: deben ser números válidos y no negativos.');
  }

  // Convertir montos a CLP si vienen en UF
  const toClpFields = ['precioCompra', 'precioSectorM2', 'costoRemodelacion', 'notariaConservador'];
  toClpFields.forEach((key) => {
    baseValues[key] = toCLP(baseValues[key]);
  });

  return baseValues;
}

function persistFormState() {
  if (!canUseStorage()) return;
  const payload = {
    unidad: currentUnit(),
    valorUf: valorUfInput.value || '',
    fields: {},
  };
  FLIPPING_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      payload.fields[id] = el.value;
    }
  });
  try {
    window.localStorage.setItem(FLIPPING_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('No se pudo guardar el formulario:', err);
  }
}

function restoreFormState() {
  if (!canUseStorage()) return;
  const raw = window.localStorage.getItem(FLIPPING_STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.valorUf) {
      valorUfInput.value = data.valorUf;
    }
    if (data.unidad) {
      const radio = document.querySelector(`input[name="unidad"][value="${data.unidad}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
    if (data.fields && typeof data.fields === 'object') {
      Object.entries(data.fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && typeof value !== 'undefined') {
          el.value = value;
        }
      });
    }
    lastUnit = currentUnit();
  } catch (err) {
    console.warn('No se pudo restaurar el formulario:', err);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const inputs = leerYValidar();
    const metrics = calcularIndicadores(inputs);
    const estado = determinarSemaforo(metrics);
    renderResultados(metrics, estado);
    agregarAHistorial(metrics, estado);
    scrollToResults();
  } catch (err) {
    statusCard.classList.remove('status--verde', 'status--amarillo', 'status--rojo');
    statusChip.textContent = 'Error en datos';
    statusMsg.textContent = err.message;
    scrollToResults();
  }
});

unitRadios.forEach((r) => r.addEventListener('change', () => {
  const nextUnit = currentUnit();
  convertInputs(lastUnit, nextUnit);
  lastUnit = nextUnit;
  updateLabels();
  persistFormState();
}));
valorUfInput.addEventListener('input', () => {
  updateLabels();
  persistFormState();
});
form.addEventListener('input', persistFormState);

function setTheme(theme) {
  const body = document.body;
  body.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  themeToggle.classList.toggle('dark', isDark);
  themeIcon.textContent = isDark ? '◐' : '◑';
  themeLabel.textContent = isDark ? 'Dark' : 'Light';
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
}

themeToggle.addEventListener('click', toggleTheme);

// Manejar dropdown de navegación en móviles
const tabDropdown = document.getElementById('tab_dropdown');
if (tabDropdown) {
  tabDropdown.addEventListener('change', (e) => {
    window.location.href = e.target.value;
  });
}

restoreFormState();
updateLabels();
setTheme(document.body.getAttribute('data-theme') || 'dark');
initMobileCtaVisibility();

function scrollToResults() {
  if (window.innerWidth > 720) return;
  const results = document.getElementById('seccion_resultados');
  if (!results) return;
  const topbar = document.querySelector('.topbar');
  const offset = topbar ? topbar.offsetHeight + 10 : 0;
  const target = results.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: target, behavior: 'smooth' });
}

function initMobileCtaVisibility() {
  if (!window.matchMedia('(max-width: 720px)').matches) return;
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
}
