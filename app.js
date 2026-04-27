/* ============================================================
   AquaForecast Pro — app.js
   ============================================================ */

'use strict';

// ── Chart defaults ─────────────────────────────────────────
Chart.defaults.font.family = "'Outfit', system-ui, sans-serif";
Chart.defaults.font.size   = 12;
Chart.defaults.color       = '#6B8DB5';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const C1 = '#3B82F6', C2 = '#10B981', C3 = '#F59E0B', C4 = '#EF4444', C5 = '#8B5CF6';

// ── State ──────────────────────────────────────────────────
const charts = {};

let reservoirs = [
  { name:'Northgate Dam',  cap:450,  fill:310,  inflow:180, outflow:165 },
  { name:'Valley Reserve', cap:280,  fill:190,  inflow:90,  outflow:95  },
  { name:'Eastern Weir',   cap:180,  fill:85,   inflow:60,  outflow:65  },
  { name:'Southern Pool',  cap:120,  fill:104,  inflow:50,  outflow:48  },
];

let currentScen = 'all';

// ── Helpers ────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const num = id => parseFloat($(id)?.value) || 0;
function sv(id, val) { const el = $(id); if(el) el.textContent = val; }

function getDemands() {
  return {
    agri: num('agri') || 420,
    mun:  num('mun')  || 180,
    ind:  num('ind')  || 95,
    eco:  num('eco')  || 45,
  };
}
function totalDemand() { const d = getDemands(); return d.agri + d.mun + d.ind + d.eco; }

function destroyChart(id) {
  if (charts[id]) { try { charts[id].destroy(); } catch(e){} delete charts[id]; }
}

function makeChartOptions(extra={}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltipStyle() } },
    ...extra,
  };
}

function tooltipStyle() {
  return {
    backgroundColor: 'rgba(255,255,255,0.97)',
    titleColor: '#0F2744',
    bodyColor: '#3B5A82',
    borderColor: '#D8E8F8',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    titleFont: { weight: '600', family: "'Outfit',sans-serif" },
  };
}

// ── App nav ────────────────────────────────────────────────
function launchApp() {
  $('app').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  refreshAll();
  setTimeout(() => { $('lastUpdate').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }, 100);
}

function closeDash() {
  $('app').classList.add('hidden');
  document.body.style.overflow = '';
}

function switchPane(btn) {
  document.querySelectorAll('.anav').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const id = btn.dataset.pane;
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  $('pane-'+id).classList.add('active');
  // trigger chart redraws for newly visible pane
  setTimeout(() => {
    if (id === 'res')      { refreshResCharts(); }
    if (id === 'fcast')    { refreshForecast(); }
    if (id === 'risk')     { refreshRisk(); }
    if (id === 'strategy') { refreshSnapshot(); }
    if (id === 'data')     { refreshClimateChart(); refreshUsageChart(); }
  }, 50);
}

function handleContact(e) {
  e.preventDefault();
  const msg = $('formMsg');
  msg.style.display = 'block';
  e.target.reset();
  setTimeout(() => { msg.style.display = 'none'; }, 5000);
}

// ── Master refresh ─────────────────────────────────────────
function refreshAll() {
  updateRegionLabel();
  refreshKPIs();
  refreshAlerts();
  refreshDonut();
  refreshSparklines();
  refreshResBars();
  refreshUsageChart();
  refreshStatusPill();
  // Lazy refresh other panes only if active
  const activePane = document.querySelector('.pane.active');
  if (activePane) {
    const id = activePane.id.replace('pane-','');
    if (id === 'data')     refreshClimateChart();
    if (id === 'res')      refreshResCharts();
    if (id === 'fcast')    refreshForecast();
    if (id === 'risk')     refreshRisk();
    if (id === 'strategy') refreshSnapshot();
  }
}

// ── Region label ───────────────────────────────────────────
function updateRegionLabel() {
  const name = $('regionName')?.value || 'Northern Basin';
  const year = $('baseYear')?.value || '2025';
  sv('regionLabel', `${name} · ${year}`);
}

// ── Status pill ────────────────────────────────────────────
function refreshStatusPill() {
  const pill = $('statusPill');
  if (!pill) return;
  const totalCap  = reservoirs.reduce((s,r) => s+r.cap, 0);
  const totalFill = reservoirs.reduce((s,r) => s+r.fill, 0);
  const pct = totalFill / totalCap;
  const td  = totalDemand();
  if (pct < 0.25 || td > 900) {
    pill.className = 'status-pill crit'; pill.textContent = '● Critical';
  } else if (pct < 0.5 || td > 700) {
    pill.className = 'status-pill warn'; pill.textContent = '● Warning';
  } else {
    pill.className = 'status-pill ok';   pill.textContent = '● Healthy';
  }
}

// ── KPI strip ──────────────────────────────────────────────
function refreshKPIs() {
  const strip = $('kpiStrip');
  if (!strip) return;
  const d = getDemands();
  const td = d.agri+d.mun+d.ind+d.eco;
  const totalCap  = reservoirs.reduce((s,r) => s+r.cap,  0);
  const totalFill = reservoirs.reduce((s,r) => s+r.fill, 0);
  const fillPct = Math.round(totalFill/totalCap*100);
  const pop = num('pop') || 850;
  const percapita = Math.round(td*1000/pop);

  strip.innerHTML = `
    <div class="kpi k-blue">
      <div class="kpi-label">Total demand</div>
      <div class="kpi-val">${td.toLocaleString()}</div>
      <div class="kpi-unit">MCM / year</div>
    </div>
    <div class="kpi k-teal">
      <div class="kpi-label">Reservoir fill</div>
      <div class="kpi-val">${fillPct}%</div>
      <div class="kpi-unit">${totalFill.toLocaleString()} / ${totalCap.toLocaleString()} MCM</div>
      <div class="kpi-trend ${fillPct>50?'ok':'up'}">${fillPct>50?'▲ Adequate':'▼ Low'}</div>
    </div>
    <div class="kpi k-amber">
      <div class="kpi-label">Per capita</div>
      <div class="kpi-val">${percapita}</div>
      <div class="kpi-unit">m³ / person / yr</div>
    </div>
    <div class="kpi k-red">
      <div class="kpi-label">Supply index</div>
      <div class="kpi-val">${Math.round(totalFill/td*100)}%</div>
      <div class="kpi-unit">storage vs demand</div>
      <div class="kpi-trend ${totalFill/td>0.8?'ok':'up'}">${totalFill/td>0.8?'✓ OK':'▼ Monitor'}</div>
    </div>`;
}

// ── Alerts ─────────────────────────────────────────────────
function refreshAlerts() {
  const az = $('alertZone');
  if (!az) return;
  az.innerHTML = '';
  const d = getDemands();
  const td = d.agri+d.mun+d.ind+d.eco;
  const lowRes = reservoirs.filter(r => r.fill/r.cap < 0.3);
  if (lowRes.length) {
    az.innerHTML += `<div class="alert-item warn">⚠ ${lowRes.map(r=>r.name).join(', ')} below 30% capacity — consider demand restrictions.</div>`;
  }
  if (td > 800) {
    az.innerHTML += `<div class="alert-item crit">🔴 Total demand (${td} MCM) exceeds recommended threshold of 800 MCM.</div>`;
  }
  if (!az.innerHTML) {
    az.innerHTML = '<div class="alert-item ok">✓ All systems within normal operating parameters.</div>';
  }
}

// ── Donut chart ────────────────────────────────────────────
function refreshDonut() {
  destroyChart('donut');
  const d = getDemands();
  const td = d.agri+d.mun+d.ind+d.eco;
  sv('totalBadge', `${td.toFixed(0)} MCM/yr`);

  charts.donut = new Chart($('donutC'), {
    type: 'doughnut',
    data: {
      labels: ['Agriculture','Municipal','Industrial','Ecological'],
      datasets: [{
        data: [d.agri, d.mun, d.ind, d.eco],
        backgroundColor: [C1, C2, C3, C4],
        borderWidth: 3,
        borderColor: '#FFFFFF',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { ...makeChartOptions().plugins.tooltip, callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.parsed} MCM (${(ctx.parsed/td*100).toFixed(1)}%)`
        }},
      },
    }
  });
}

// ── Sparklines ─────────────────────────────────────────────
function refreshSparklines() {
  const el = $('sparklines');
  if (!el) return;
  const d  = getDemands();
  const td = d.agri+d.mun+d.ind+d.eco;
  const items = [
    { label:'Agriculture', val:d.agri, color:C1 },
    { label:'Municipal',   val:d.mun,  color:C2 },
    { label:'Industrial',  val:d.ind,  color:C3 },
    { label:'Ecological',  val:d.eco,  color:C4 },
  ];
  el.innerHTML = items.map(i => {
    const pct = Math.round(i.val/td*100);
    return `<div class="spark-row">
      <div class="spark-label">${i.label}</div>
      <div class="spark-bar-wrap"><div class="spark-bar" style="width:${pct}%;background:${i.color}"></div></div>
      <div class="spark-val">${i.val} MCM <span style="color:var(--text3);font-size:0.72rem">(${pct}%)</span></div>
    </div>`;
  }).join('');
}

// ── Reservoir bars ─────────────────────────────────────────
function fillColor(pct) {
  if (pct < 30) return '#EF4444';
  if (pct < 50) return '#F59E0B';
  if (pct < 75) return '#3B82F6';
  return '#10B981';
}

function resBarsHTML() {
  return reservoirs.map(r => {
    const pct = Math.round(r.fill/r.cap*100);
    const col = fillColor(pct);
    return `<div class="res-bar-row">
      <div class="res-bar-top">
        <span class="res-name">${r.name}</span>
        <span class="res-pct" style="color:${col}">${pct}%</span>
      </div>
      <div class="res-bar-track"><div class="res-bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="res-sub">${r.fill.toLocaleString()} / ${r.cap.toLocaleString()} MCM · Inflow ${r.inflow} | Outflow ${r.outflow}</div>
    </div>`;
  }).join('');
}

function refreshResBars() {
  const totalFill = reservoirs.reduce((s,r) => s+r.fill, 0);
  const totalCap  = reservoirs.reduce((s,r) => s+r.cap,  0);
  const badge = `${totalFill} / ${totalCap} MCM`;
  sv('resBadgeDash', badge);
  const main = $('resBarsMain');
  if (main) main.innerHTML = resBarsHTML();
  sv('resBadge2', badge);
  const el2 = $('resBars2');
  if (el2) el2.innerHTML = resBarsHTML();
  sv('resTotal', `${totalCap.toLocaleString()} MCM total capacity`);
}

// ── Usage (stacked bar) ────────────────────────────────────
function refreshUsageChart() {
  destroyChart('usage');
  const d = getDemands();
  const agriM = (num('agriM') || 100)/100;
  const munM  = (num('munM')  || 100)/100;
  const indM  = (num('indM')  || 100)/100;

  // Seasonal pattern seeds
  const agriSeed = [0.6,0.6,0.7,0.9,1.1,1.3,1.4,1.4,1.2,1.0,0.8,0.7];
  const munSeed  = [0.9,0.9,0.95,1.0,1.0,1.1,1.15,1.15,1.05,1.0,0.9,0.85];
  const indSeed  = [1.0,0.95,1.0,1.0,1.05,1.1,1.1,1.05,1.0,1.0,0.95,0.9];
  const ecoSeed  = [0.8,0.8,0.9,1.0,1.1,1.2,1.2,1.1,1.0,0.9,0.8,0.8];

  const norm = arr => { const s=arr.reduce((a,b)=>a+b,0); return arr.map(v=>v/s*12); };
  const agriN = norm(agriSeed), munN = norm(munSeed), indN = norm(indSeed), ecoN = norm(ecoSeed);

  const make = (base, seed, m) => MONTHS.map((_,i) => +(base/12*seed[i]*m).toFixed(2));

  charts.usage = new Chart($('usageC'), {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [
        { label:'Agriculture', data: make(d.agri, agriN, agriM), backgroundColor: C1+'CC', stack:'s' },
        { label:'Municipal',   data: make(d.mun,  munN,  munM),  backgroundColor: C2+'CC', stack:'s' },
        { label:'Industrial',  data: make(d.ind,  indN,  indM),  backgroundColor: C3+'CC', stack:'s' },
        { label:'Ecological',  data: make(d.eco,  ecoN,  1),     backgroundColor: C4+'CC', stack:'s' },
      ]
    },
    options: {
      ...makeChartOptions(),
      plugins: { ...makeChartOptions().plugins, tooltip: { ...tooltipStyle(), mode:'index', intersect:false } },
      scales: {
        x: { stacked:true, grid:{ color:'rgba(37,99,235,0.06)' }, ticks:{ color:'#94A8C2' } },
        y: { stacked:true, grid:{ color:'rgba(37,99,235,0.06)' }, ticks:{ color:'#94A8C2' },
             title:{ display:true, text:'MCM', color:'#94A8C2', font:{size:11} } },
      },
      animation: { duration: 400 },
    }
  });
}

// ── Climate chart ──────────────────────────────────────────
function refreshClimateChart() {
  destroyChart('climate');
  const rainBase = num('rainfall') || 680;
  const rf = (num('rainM') || 100)/100;
  const rainSeed = [0.5,0.6,0.8,1.0,1.2,1.4,1.5,1.4,1.1,0.9,0.7,0.6];
  const evapSeed = [0.6,0.7,0.9,1.1,1.3,1.5,1.6,1.5,1.2,0.9,0.7,0.6];
  const norm = arr => { const s=arr.reduce((a,b)=>a+b,0); return arr.map(v=>v/s*12); };
  const rainN = norm(rainSeed), evapN = norm(evapSeed);
  const rainData = MONTHS.map((_,i) => +(rainBase/12*rainN[i]*rf).toFixed(1));
  const evapData = MONTHS.map((_,i) => +(rainBase/12*evapN[i]*0.65).toFixed(1));
  const netData  = MONTHS.map((_,i) => +(rainData[i]-evapData[i]).toFixed(1));

  charts.climate = new Chart($('climateC'), {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [
        { label:'Rainfall',        type:'bar',  data: rainData, backgroundColor: C1+'55', borderColor:C1, borderWidth:1 },
        { label:'Evaporation',     type:'bar',  data: evapData, backgroundColor: C4+'55', borderColor:C4, borderWidth:1 },
        { label:'Net availability',type:'line', data: netData,
          borderColor: C2, backgroundColor: C2+'20', fill:true,
          tension:0.4, pointRadius:3, pointBackgroundColor:C2, borderWidth:2 },
      ]
    },
    options: {
      ...makeChartOptions(),
      plugins: { ...makeChartOptions().plugins, tooltip: { ...tooltipStyle(), mode:'index', intersect:false } },
      scales: {
        x: { grid:{ color:'rgba(37,99,235,0.06)' }, ticks:{ color:'#94A8C2' } },
        y: { grid:{ color:'rgba(37,99,235,0.06)' }, ticks:{ color:'#94A8C2' },
             title:{ display:true, text:'mm', color:'#94A8C2', font:{size:11} } },
      }
    }
  });
}

// ── Reservoir management ───────────────────────────────────
function renderResInputs() {
  const el = $('resInputs');
  if (!el) return;
  el.innerHTML = reservoirs.map((r,i) => `
    <div class="res-input-row" id="ri_${i}">
      <div class="field"><label>Name</label><input type="text" value="${r.name}" oninput="reservoirs[${i}].name=this.value;refreshAll()"></div>
      <div class="field"><label>Capacity (MCM)</label><input type="number" value="${r.cap}" min="1" oninput="reservoirs[${i}].cap=+this.value||0;refreshAll()"></div>
      <div class="field"><label>Current fill (MCM)</label><input type="number" value="${r.fill}" min="0" oninput="reservoirs[${i}].fill=Math.min(+this.value||0,reservoirs[${i}].cap);refreshAll()"></div>
      <div class="field"><label>Inflow (MCM/yr)</label><input type="number" value="${r.inflow}" min="0" oninput="reservoirs[${i}].inflow=+this.value||0;refreshAll()"></div>
      <button class="btn-del" onclick="delRes(${i})" title="Remove">✕</button>
    </div>`).join('');
}

function addRes() {
  reservoirs.push({ name:`Reservoir ${reservoirs.length+1}`, cap:100, fill:60, inflow:40, outflow:38 });
  renderResInputs();
  refreshAll();
}

function delRes(i) {
  if (reservoirs.length <= 1) return;
  reservoirs.splice(i,1);
  renderResInputs();
  refreshAll();
}

function refreshResCharts() {
  destroyChart('res');
  destroyChart('flow');
  const names = reservoirs.map(r => r.name.split(' ')[0]);

  charts.res = new Chart($('resC'), {
    type:'bar',
    data: {
      labels: names,
      datasets:[
        { label:'Capacity', data: reservoirs.map(r=>r.cap),  backgroundColor:'#3B82F620', borderColor:C1, borderWidth:2, borderRadius:6 },
        { label:'Fill',     data: reservoirs.map(r=>r.fill), backgroundColor: reservoirs.map(r=>fillColor(r.fill/r.cap*100)+'AA'), borderColor: reservoirs.map(r=>fillColor(r.fill/r.cap*100)), borderWidth:2, borderRadius:6 },
      ]
    },
    options: {
      ...makeChartOptions(),
      plugins: { ...makeChartOptions().plugins, tooltip: { ...tooltipStyle(), mode:'index', intersect:false } },
      scales: {
        x:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'} },
        y:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'},
            title:{display:true,text:'MCM',color:'#94A8C2',font:{size:11}} },
      },
    }
  });

  charts.flow = new Chart($('flowC'), {
    type:'bar',
    data: {
      labels: names,
      datasets:[
        { label:'Inflow',  data: reservoirs.map(r=>r.inflow),  backgroundColor:C2+'AA', borderColor:C2, borderWidth:1.5, borderRadius:4 },
        { label:'Outflow', data: reservoirs.map(r=>r.outflow), backgroundColor:C4+'AA', borderColor:C4, borderWidth:1.5, borderRadius:4 },
        { label:'Net',     data: reservoirs.map(r=>r.inflow-r.outflow), type:'line',
          borderColor:C1, backgroundColor:'transparent', pointBackgroundColor:C1, pointRadius:5, borderWidth:2 },
      ]
    },
    options: {
      ...makeChartOptions(),
      plugins: { ...makeChartOptions().plugins, tooltip: { ...tooltipStyle(), mode:'index', intersect:false } },
      scales: {
        x:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'} },
        y:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'},
            title:{display:true,text:'MCM/yr',color:'#94A8C2',font:{size:11}} },
      },
    }
  });
}

// ── Forecast ───────────────────────────────────────────────
function refreshForecast() {
  destroyChart('fcast');
  destroyChart('gap');
  const td      = totalDemand();
  const popGr   = num('popGr')   || 1.8;
  const climStr = num('climStr') || 1.2;
  const effGain = num('effGain') || 0.8;
  const recycle = num('recycle') || 0.5;
  const newCap  = num('newCap')  || 0;
  const horizon = Math.round(num('horizon') || 15);
  const baseYear = parseInt($('baseYear')?.value || '2025');

  const labels = Array.from({length:horizon+1},(_,i) => baseYear+i);
  const base=[], stress=[], eff=[], supply=[];

  const totalCap = reservoirs.reduce((s,r)=>s+r.cap,0);

  for (let i=0;i<=horizon;i++) {
    const g = Math.pow(1+popGr/100,i);
    base.push(+(100*g).toFixed(1));
    stress.push(+(100*g*Math.pow(climStr,i/15)).toFixed(1));
    const e = Math.pow(1+(popGr-effGain)/100,i) * (1-recycle/100*i);
    eff.push(+(100*Math.max(e,0.5)).toFixed(1));
    const supplyMCM = totalCap + newCap + td*recycle/100*i;
    supply.push(+(supplyMCM/td*100).toFixed(1));
  }

  const visible = (key) => currentScen==='all' || currentScen===key;

  charts.fcast = new Chart($('fcastC'),{
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Baseline',        data:visible('base')  ?base   :[], borderColor:C2, backgroundColor:C2+'15', fill:false, tension:0.3, borderWidth:2.5, pointRadius:0, pointHoverRadius:4 },
        { label:'Climate stress',  data:visible('stress')?stress :[], borderColor:C4, backgroundColor:C4+'15', fill:false, tension:0.3, borderWidth:2.5, pointRadius:0, pointHoverRadius:4, borderDash:[5,3] },
        { label:'With efficiency', data:visible('eff')   ?eff    :[], borderColor:C1, backgroundColor:C1+'15', fill:false, tension:0.3, borderWidth:2.5, pointRadius:0, pointHoverRadius:4 },
        { label:'Supply capacity', data:visible('all')   ?supply :[], borderColor:C5, backgroundColor:C5+'10', fill:false, tension:0.3, borderWidth:2, pointRadius:0, pointHoverRadius:4, borderDash:[3,3] },
      ]
    },
    options:{
      ...makeChartOptions(),
      interaction:{ mode:'index', intersect:false },
      plugins:{...makeChartOptions().plugins, tooltip:{ ...tooltipStyle(), mode:'index', intersect:false }},
      scales:{
        x:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2', maxTicksLimit:8} },
        y:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'},
            title:{display:true,text:'Index (base=100)',color:'#94A8C2',font:{size:11}} },
      }
    }
  });

  // Gap chart
  const gaps = base.map((b,i) => {
    const supplyMCM = totalCap + newCap + td*recycle/100*i;
    return +(supplyMCM - td*b/100).toFixed(1);
  });
  const lastGap = gaps[gaps.length-1];
  const gapBadge = $('gapBadge');
  if (gapBadge) {
    gapBadge.textContent = `${lastGap > 0 ? '+' : ''}${lastGap.toFixed(0)} MCM at year ${horizon}`;
    gapBadge.className = `badge ${lastGap > 0 ? 'green' : 'red'}`;
  }

  charts.gap = new Chart($('gapC'),{
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'Supply–demand gap',
        data:gaps,
        backgroundColor: gaps.map(v => v>=0 ? C2+'88' : C4+'88'),
        borderColor:      gaps.map(v => v>=0 ? C2 : C4),
        borderWidth:1.5,
        borderRadius:3,
      }]
    },
    options:{
      ...makeChartOptions(),
      plugins:{...makeChartOptions().plugins, tooltip:{...tooltipStyle()}},
      scales:{
        x:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2', maxTicksLimit:8} },
        y:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'},
            title:{display:true,text:'MCM',color:'#94A8C2',font:{size:11}} },
      }
    }
  });
}

function setScen(s, btn) {
  currentScen = s;
  document.querySelectorAll('.sc').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  refreshForecast();
}

// ── Risk ───────────────────────────────────────────────────
function refreshRisk() {
  const drought = num('drought') || 2;
  const flood   = num('flood')   || 10;
  const infra   = num('infra')   || 5;
  const surge   = num('surge')   || 110;
  const td = totalDemand();
  const totalCap  = reservoirs.reduce((s,r)=>s+r.cap, 0);
  const totalFill = reservoirs.reduce((s,r)=>s+r.fill, 0);

  // Derived risk scores (0–10)
  const droughtRisk   = drought*1.8;
  const floodRisk     = flood/5;
  const infraRisk     = infra/3;
  const demandRisk    = Math.min((surge-100)/3, 10);
  const supplyRisk    = Math.max(10-(totalFill/td*10), 0);
  const climateRisk   = drought*1.2 + 1;

  const kpiEl = $('riskKpis');
  if (kpiEl) {
    const overall = ((droughtRisk+floodRisk+infraRisk+demandRisk)/4).toFixed(1);
    const lvl = overall < 3 ? ['Low','low'] : overall < 6 ? ['Medium','med'] : ['High','high'];
    kpiEl.innerHTML = `
      <div class="risk-kpi"><div class="rk-label">Overall risk</div><div class="rk-val">${overall}/10</div><span class="rk-badge ${lvl[1]}">${lvl[0]}</span></div>
      <div class="risk-kpi"><div class="rk-label">Drought impact</div><div class="rk-val">${droughtRisk.toFixed(1)}/9</div><span class="rk-badge ${droughtRisk<4?'low':droughtRisk<7?'med':'high'}">${droughtRisk<4?'Low':droughtRisk<7?'Medium':'High'}</span></div>
      <div class="risk-kpi"><div class="rk-label">Supply buffer</div><div class="rk-val">${Math.round(totalFill - td*surge/100)} MCM</div><span class="rk-badge ${totalFill>td*surge/100?'low':'high'}">${totalFill>td*surge/100?'Adequate':'Deficit'}</span></div>`;
  }

  // Radar chart
  destroyChart('radar');
  charts.radar = new Chart($('radarC'),{
    type:'radar',
    data:{
      labels:['Drought','Flood','Infrastructure','Demand surge','Supply shortage','Climate change'],
      datasets:[{
        label:'Risk level',
        data:[droughtRisk, floodRisk, infraRisk, demandRisk, supplyRisk, climateRisk],
        borderColor: C4,
        backgroundColor: C4+'25',
        pointBackgroundColor: C4,
        pointRadius: 5,
        borderWidth: 2,
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{...tooltipStyle()} },
      scales:{
        r:{
          min:0, max:10,
          grid:{ color:'rgba(37,99,235,0.10)' },
          ticks:{ color:'#94A8C2', font:{size:10}, stepSize:2, backdropColor:'transparent' },
          pointLabels:{ color:'#3B5A82', font:{size:11, weight:'500'} },
          angleLines:{ color:'rgba(37,99,235,0.10)' },
        }
      }
    }
  });

  // Risk bar chart
  destroyChart('riskBar');
  const base    = td;
  const drSc    = +(td*(1-drought*0.08)).toFixed(0);
  const flSc    = +(td*(1+flood/200)).toFixed(0);
  const srgSc   = +(td*surge/100).toFixed(0);
  const infraSc = +(td*(1+infra/100)).toFixed(0);

  charts.riskBar = new Chart($('riskBarC'),{
    type:'bar',
    data:{
      labels:['Baseline','Drought scenario','Flood scenario','Demand surge','Infra. failure'],
      datasets:[{
        label:'Adjusted demand (MCM)',
        data:[base, drSc, flSc, srgSc, infraSc],
        backgroundColor:[C2+'AA', C4+'AA', C1+'AA', C3+'AA', C5+'AA'],
        borderColor:[C2, C4, C1, C3, C5],
        borderWidth:1.5, borderRadius:6,
      }]
    },
    options:{
      ...makeChartOptions(),
      plugins:{...makeChartOptions().plugins, tooltip:{...tooltipStyle()}},
      scales:{
        x:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'} },
        y:{ grid:{color:'rgba(37,99,235,0.06)'}, ticks:{color:'#94A8C2'},
            title:{display:true,text:'MCM',color:'#94A8C2',font:{size:11}} },
      }
    }
  });
}

// ── Snapshot ───────────────────────────────────────────────
function refreshSnapshot() {
  const el = $('snapshotGrid');
  if (!el) return;
  const d = getDemands();
  const td = d.agri+d.mun+d.ind+d.eco;
  const totalCap  = reservoirs.reduce((s,r)=>s+r.cap,0);
  const totalFill = reservoirs.reduce((s,r)=>s+r.fill,0);
  const region = $('regionName')?.value || 'Northern Basin';
  const year   = $('baseYear')?.value   || '2025';
  const pop    = num('pop') || 850;
  const rain   = num('rainfall') || 680;
  const gw     = num('gwPct') || 15;

  el.innerHTML = [
    ['Region',       region],
    ['Base year',    year],
    ['Population',   `${pop}k`],
    ['Annual rainfall',`${rain} mm`],
    ['Groundwater',  `${gw}%`],
    ['Total demand', `${td} MCM/yr`],
    ['Agriculture',  `${d.agri} MCM`],
    ['Municipal',    `${d.mun} MCM`],
    ['Industrial',   `${d.ind} MCM`],
    ['Ecological',   `${d.eco} MCM`],
    ['Reservoir cap',`${totalCap} MCM`],
    ['Current fill', `${totalFill} MCM (${Math.round(totalFill/totalCap*100)}%)`],
  ].map(([l,v]) => `<div class="snap-item"><div class="snap-label">${l}</div><div class="snap-val">${v}</div></div>`).join('');
}

function getSnapshot() {
  const d = getDemands();
  const td = d.agri+d.mun+d.ind+d.eco;
  const totalCap  = reservoirs.reduce((s,r)=>s+r.cap,0);
  const totalFill = reservoirs.reduce((s,r)=>s+r.fill,0);
  return {
    region:      $('regionName')?.value || 'Northern Basin',
    year:        $('baseYear')?.value   || '2025',
    population:  `${num('pop')||850}k`,
    rainfall:    `${num('rainfall')||680}mm`,
    groundwater: `${num('gwPct')||15}%`,
    totalDemand: `${td} MCM/yr`,
    agriculture: `${d.agri} MCM`,
    municipal:   `${d.mun} MCM`,
    industrial:  `${d.ind} MCM`,
    ecological:  `${d.eco} MCM`,
    totalCapacity:`${totalCap} MCM`,
    currentFill:  `${totalFill} MCM (${Math.round(totalFill/totalCap*100)}%)`,
    reservoirs:   reservoirs.map(r=>`${r.name}: ${r.fill}/${r.cap}MCM (${Math.round(r.fill/r.cap*100)}%)`).join('; '),
    droughtLevel: $('drought')?.value || '2',
    floodProb:    $('flood')?.value   || '10',
    popGrowth:    `${$('popGr')?.value||1.8}%/yr`,
    climateStr:   $('climStr')?.value || '1.2',
  };
}

// ── AI Integration ─────────────────────────────────────────
async function doAI(type) {
  const card  = $('aiOutputCard');
  const title = $('aiOutputTitle');
  const out   = $('aiOutput');
  if (!card || !out) return;

  card.style.display = 'block';
  card.scrollIntoView({ behavior:'smooth', block:'nearest' });

  const titles = {
    strategy:   '5-Year Strategic Plan',
    risk:       'Risk Assessment Brief',
    policy:     'Policy Memo',
    mitigation: 'Mitigation Plan',
  };
  title.textContent = titles[type];
  out.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div>Generating analysis from your live data…</div>';

  const snap = getSnapshot();

  const prompts = {
    strategy: `You are a senior water resources strategist. Based on the following real-time data snapshot from the AquaForecast Pro dashboard, generate a concise, practical 5-year strategic water management plan with top interventions ranked by impact-to-cost ratio.

DATA SNAPSHOT:
Region: ${snap.region} (${snap.year})
Population: ${snap.population} | Rainfall: ${snap.rainfall} | Groundwater: ${snap.groundwater}
Total demand: ${snap.totalDemand}
  - Agriculture: ${snap.agriculture}
  - Municipal: ${snap.municipal}
  - Industrial: ${snap.industrial}
  - Ecological: ${snap.ecological}
Reservoir system: ${snap.totalCapacity} total, ${snap.currentFill}
Individual reservoirs: ${snap.reservoirs}
Population growth rate: ${snap.popGrowth}

Write a structured 5-year strategy with: Executive Summary (2 sentences), Top 5 Interventions ranked by impact-to-cost (with brief rationale each), Key Milestones (Year 1, 2-3, 4-5), and a Risk Register (3 top risks with mitigations). Be specific and quantitative where possible.`,

    risk: `You are a water security risk analyst. Based on this live data snapshot, write a concise risk assessment brief for decision-makers.

DATA SNAPSHOT:
Region: ${snap.region} | Demand: ${snap.totalDemand} | Reservoir fill: ${snap.currentFill}
Drought severity level: ${snap.droughtLevel}/5 | Flood probability: ${snap.floodProb}%
Agriculture: ${snap.agriculture} | Municipal: ${snap.municipal} | Industrial: ${snap.industrial}
Reservoirs: ${snap.reservoirs}

Write a 1-page risk brief covering: Overall Risk Rating (Low/Med/High with justification), 4 Key Risk Areas with likelihood and impact scores (1-5), Immediate Actions Required (next 30 days), and Monitoring Indicators to watch. Use clear, executive language.`,

    policy: `You are a water governance policy advisor. Draft a clear 2-page policy memo based on this water system data.

DATA SNAPSHOT:
Region: ${snap.region} (Base year: ${snap.year})
Population: ${snap.population} | Annual rainfall: ${snap.rainfall}
Total annual demand: ${snap.totalDemand} (Agriculture ${snap.agriculture}, Municipal ${snap.municipal}, Industrial ${snap.industrial}, Ecological ${snap.ecological})
Reservoir system: ${snap.totalCapacity} capacity, currently at ${snap.currentFill}
Climate stress multiplier: ${snap.climateStr}x | Population growth: ${snap.popGrowth}

Structure as: TO/FROM/DATE/SUBJECT header, Executive Summary (3 sentences), Background & Context, Policy Recommendations (Immediate: 0-6 months; Medium-term: 1-3 years; Long-term: 3-10 years), Governance Actions, and Conclusion. Be specific about the region's numbers.`,

    mitigation: `You are a water resilience planner. Based on the live dashboard data below, create a phased mitigation action plan.

DATA SNAPSHOT:
Region: ${snap.region} | Total demand: ${snap.totalDemand} | Reservoir fill: ${snap.currentFill}
Drought level: ${snap.droughtLevel}/5 | Flood risk: ${snap.floodProb}%
Agriculture: ${snap.agriculture} | Municipal: ${snap.municipal}
Reservoir details: ${snap.reservoirs}

Create three phased response plans:
PHASE 1 (0-6 months): Immediate actions — list 5 specific actions with owners and measurable targets
PHASE 2 (1-3 years): Medium-term investments — 4 infrastructure and policy interventions with estimated impacts
PHASE 3 (3-10 years): Long-term transformation — 3 structural changes with projected outcomes

Include a quick-win table at the end (Action | Timeline | Cost level | Impact). Be practical and specific.`,
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompts[type] }],
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(()=>({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.filter(b=>b.type==='text').map(b=>b.text).join('\n') || 'No response.';
    out.innerHTML = formatAIOutput(text);
  } catch (err) {
    out.innerHTML = `<div style="color:var(--red);font-size:0.88rem">
      <strong>⚠ Could not generate analysis.</strong><br><br>
      ${err.message}<br><br>
      <em>This feature requires an active Anthropic API connection. The snapshot data above can be used with an external AI tool by copying the prompt.</em>
    </div>`;
  }
}

function formatAIOutput(text) {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/^\d+\. (.+)$/gm, (m,p1,offset,str) => m);
}

// ── CSV import ─────────────────────────────────────────────
function importCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => parseCSV(e.target.result);
  reader.readAsText(file);
}

function parseCSV(text) {
  const msg = $('importMsg');
  const lines = text.trim().split('\n').filter(l=>l.trim());
  if (!lines.length) return;
  const vals = lines[0].split(',').map(v=>parseFloat(v.trim())).filter(v=>!isNaN(v));
  if (vals.length < 4) {
    if (msg) { msg.textContent = '✕ Need 4 values: agri, mun, ind, eco'; msg.className='import-msg err'; }
    return;
  }
  const [a,m,i,e] = vals;
  if ($('agri')) $('agri').value = a;
  if ($('mun'))  $('mun').value  = m;
  if ($('ind'))  $('ind').value  = i;
  if ($('eco'))  $('eco').value  = e;
  if (msg) { msg.textContent = `✓ Imported: Agri ${a}, Mun ${m}, Ind ${i}, Eco ${e} MCM`; msg.className='import-msg ok'; }
  refreshAll();
  setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderResInputs();
  refreshAll();

  // Clock updater
  setInterval(() => {
    sv('lastUpdate', new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  }, 60000);
});
