// app.js — frontend logic
const form = document.getElementById('uploadForm');
const errorBox = document.getElementById('errorBox');
const statusEl = document.getElementById('status');
let charts = { doughnut: null, bar: null };
let currentData = null;
let currentFilter = 'ALL';

// File-name display
document.querySelectorAll('.drop input[type=file]').forEach(inp => {
  inp.addEventListener('change', e => {
    const target = inp.parentElement.querySelector('.drop-file');
    target.textContent = inp.files[0] ? inp.files[0].name : 'No file selected';
  });
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentFilter = b.dataset.filter;
    renderFindings();
  });
});

// Sidebar nav highlight (visual only)
document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelectorAll('.sidebar nav a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  const fd = new FormData(form);
  if (!fd.get('drawing') || !fd.get('specification')) {
    showError('Please upload both files.');
    return;
  }
  statusEl.textContent = 'Analyzing…';
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Analyzing…';
  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Server error (${res.status})`);
    }
    const data = await res.json();
    currentData = data;
    statusEl.textContent = `Analyzed ${new Date(data.meta.analyzedAt).toLocaleTimeString()}`;
    renderAll(data);
    document.getElementById('overview').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showError(err.message || String(err));
    statusEl.textContent = 'Error';
  } finally {
    btn.disabled = false; btn.textContent = 'Analyze →';
  }
});

function showError(msg) { errorBox.textContent = msg; errorBox.hidden = false; }

function renderAll(data) {
  // reveal sections
  ['overview','findings','extracted'].forEach(id => document.getElementById(id).hidden = false);

  // KPIs
  document.getElementById('kpiCompliance').textContent = data.compliancePct + '%';
  document.getElementById('kpiComplianceFoot').textContent = `${data.counts.MATCH || 0} of ${data.total} checks`;
  document.getElementById('kpiClashes').textContent = data.counts.CLASH || 0;
  document.getElementById('kpiMarginal').textContent = data.counts.MARGINAL || 0;
  document.getElementById('kpiMissing').textContent = (data.counts.MISSING_IN_DRAWING || 0) + (data.counts.MISSING_IN_SPEC || 0);
  document.getElementById('kpiMatches').textContent = data.counts.MATCH || 0;

  // Meta
  const m = data.meta;
  document.getElementById('metaRow').innerHTML = `
    <span>Specification: <strong>${escapeHTML(m.specFile)}</strong> (${m.specTextLength.toLocaleString()} chars)</span>
    <span>Drawing: <strong>${escapeHTML(m.drawingFile)}</strong> (${m.drawingTextLength.toLocaleString()} chars)</span>
    <span>Parameters extracted — spec: <strong>${data.extracted.spec.length}</strong>, drawing: <strong>${data.extracted.drawing.length}</strong></span>
  `;

  drawDoughnut(data.counts);
  drawBar(data.findings);
  renderFindings();
  renderExtracted(data.extracted);
}

function drawDoughnut(c) {
  const ctx = document.getElementById('doughnut');
  const labels = ['Match','Marginal','Clash','Missing in drawing','Missing in spec'];
  const colors = ['#10b981','#f59e0b','#ef4444','#6366f1','#8b5cf6'];
  const data  = [c.MATCH||0, c.MARGINAL||0, c.CLASH||0, c.MISSING_IN_DRAWING||0, c.MISSING_IN_SPEC||0];
  if (charts.doughnut) charts.doughnut.destroy();
  charts.doughnut = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } }
      }
    }
  });
}

function drawBar(findings) {
  // group findings by key prefix category
  const catMap = {
    bearing_pressure_sls: 'Bearing pressure',
    bearing_pressure_uls: 'Bearing pressure',
    foundation_embedment_min: 'Foundation geometry',
    foundation_anchorage_min: 'Foundation geometry',
    finished_floor_level: 'Levels',
    strip_footing: 'Strip footings',
    isolated_footing: 'Isolated footings',
    tie_beam: 'Tie beams',
    load_permanent_kg: 'Loads',
    load_live_kg: 'Loads',
    load_permanent_kn: 'Loads',
    load_live_kn: 'Loads',
    concrete_grade: 'Materials',
    rebar_grade: 'Materials',
    concrete_cover: 'Materials',
    parapet_height: 'Architecture',
    slab_thickness: 'Slabs',
    floor_buildup: 'Slabs',
  };
  const counts = {};
  for (const f of findings) {
    const cat = catMap[f.key] || (f.key.startsWith('strip_footing') ? 'Strip footings' : 'Other');
    counts[cat] = counts[cat] || { MATCH:0, MARGINAL:0, CLASH:0, MISSING_IN_DRAWING:0, MISSING_IN_SPEC:0 };
    counts[cat][f.status]++;
  }
  const labels = Object.keys(counts);
  const ds = (key, color) => ({
    label: key.replace(/_/g, ' ').toLowerCase(),
    data: labels.map(l => counts[l][key] || 0),
    backgroundColor: color,
    borderWidth: 0,
  });
  const ctx = document.getElementById('bar');
  if (charts.bar) charts.bar.destroy();
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      ds('MATCH', '#10b981'),
      ds('MARGINAL', '#f59e0b'),
      ds('CLASH', '#ef4444'),
      ds('MISSING_IN_DRAWING', '#6366f1'),
      ds('MISSING_IN_SPEC', '#8b5cf6'),
    ]},
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });
}

function renderFindings() {
  if (!currentData) return;
  const list = document.getElementById('findingsList');
  const items = currentData.findings.filter(f => currentFilter === 'ALL' || f.status === currentFilter);
  if (!items.length) { list.innerHTML = `<div class="muted">No findings in this category.</div>`; return; }
  list.innerHTML = items.map(f => {
    const badge = `<span class="badge ${f.status}">${labelStatus(f.status)}</span>`;
    const specVal = fmtValue(f.specValue, f.unit);
    const drawVal = fmtValue(f.drawingValue, f.unit);
    let detail = '';
    if (Array.isArray(f.dimensionDetails) && f.dimensionDetails.length) {
      detail = `<table class="f-detail-table"><thead><tr><th>Field</th><th>Spec min</th><th>Drawing</th><th>Δ</th><th>Status</th></tr></thead><tbody>${
        f.dimensionDetails.map(d => `<tr>
          <td>${escapeHTML(d.field)}</td>
          <td>${d.spec} mm</td>
          <td class="${d.status === 'MATCH' ? 'ok' : 'bad'}">${d.drawing} mm</td>
          <td>${d.delta > 0 ? '+' : ''}${d.delta} mm</td>
          <td>${labelStatus(d.status)}</td>
        </tr>`).join('')
      }</tbody></table>`;
    }
    const sugg = f.suggestion ? `<div class="f-suggest"><strong>Suggested action:</strong> ${escapeHTML(f.suggestion)}</div>` : '';
    return `
      <div class="finding ${f.status}">
        <div class="f-head">
          <div class="f-title">${escapeHTML(f.label)}</div>
          ${badge}
        </div>
        <div class="f-values">
          <div class="col">
            <div class="col-label">Specification</div>
            <div class="col-value">${specVal}</div>
            ${f.specContext ? `<div class="f-context">“${escapeHTML(truncate(f.specContext, 220))}”</div>` : ''}
          </div>
          <div class="col">
            <div class="col-label">Drawing</div>
            <div class="col-value">${drawVal}</div>
            ${f.drawingContext ? `<div class="f-context">“${escapeHTML(truncate(f.drawingContext, 220))}”</div>` : ''}
          </div>
        </div>
        ${detail}
        ${sugg}
      </div>
    `;
  }).join('');
}

function renderExtracted(extracted) {
  const fillTable = (tableId, rows) => {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="3" class="muted">No parameters extracted.</td></tr>`; return; }
    tbody.innerHTML = rows.map(r => `<tr>
      <td>${escapeHTML(r.label)}</td>
      <td class="val">${fmtValue(r.value, r.unit)}</td>
      <td>${escapeHTML(r.unit || '')}</td>
    </tr>`).join('');
  };
  fillTable('specTable', extracted.spec);
  fillTable('drawTable', extracted.drawing);
}

function fmtValue(v, unit) {
  if (v == null) return '<span style="color:#999">—</span>';
  if (typeof v === 'object') {
    return Object.entries(v).map(([k, val]) => `${k.replace(/_/g, ' ')}: ${val}`).join(', ');
  }
  if (typeof v === 'number') return v.toString();
  return escapeHTML(String(v));
}
function labelStatus(s) {
  return ({ MATCH:'Match', MARGINAL:'Marginal', CLASH:'Clash', MISSING_IN_DRAWING:'Missing in drawing', MISSING_IN_SPEC:'Missing in spec' })[s] || s;
}
function escapeHTML(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]); }
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
