// compare.js
// Compares two sets of extracted parameters (spec vs drawing) and produces
// findings: MATCH, MARGINAL, CLASH, MISSING_IN_DRAWING, MISSING_IN_SPEC.

// Tolerances (fraction OR absolute). Both must be exceeded to count as CLASH.
const NUMERIC_TOL = {
  bearing_pressure_sls: { abs: 0.005, frac: 0.02 },
  bearing_pressure_uls: { abs: 0.005, frac: 0.02 },
  foundation_embedment_min: { abs: 0.01, frac: 0.02 },
  foundation_anchorage_min: { abs: 0.01, frac: 0.02 },
  load_permanent_kg: { abs: 5, frac: 0.05 },
  load_live_kg: { abs: 5, frac: 0.05 },
  parapet_height: { abs: 5, frac: 0.02 },
  slab_thickness: { abs: 5, frac: 0.02 },
  floor_buildup: { abs: 5, frac: 0.02 },
  finished_floor_level: { abs: 0.005, frac: 0.001 },
  concrete_cover: { abs: 2, frac: 0.05 },
};
const MARGINAL_MULTIPLIER = 2; // within 2× tolerance => MARGINAL (warning)

function classifyNumeric(specVal, drawVal, key) {
  const tol = NUMERIC_TOL[key] || { abs: 1, frac: 0.05 };
  const diff = Math.abs(specVal - drawVal);
  const ref = Math.max(Math.abs(specVal), Math.abs(drawVal), 1e-9);
  const tolAbs = Math.max(tol.abs, ref * tol.frac);
  if (diff <= tolAbs) return 'MATCH';
  if (diff <= tolAbs * MARGINAL_MULTIPLIER) return 'MARGINAL';
  return 'CLASH';
}

function classifyDimensionObject(specObj, drawObj, key) {
  // Compare every numeric field in spec to corresponding drawing field.
  // For strip/isolated/tie beams, spec value is a MINIMUM — drawing < spec = CLASH.
  const fields = Object.keys(specObj);
  let worst = 'MATCH';
  const details = [];
  for (const f of fields) {
    const sv = specObj[f];
    const dv = drawObj[f];
    if (sv == null || dv == null) continue;
    const tolAbs = Math.max(5, sv * 0.02); // 2% or 5 mm
    const diff = dv - sv;
    let status;
    if (diff >= -tolAbs) status = 'MATCH';
    else if (diff >= -tolAbs * MARGINAL_MULTIPLIER) status = 'MARGINAL';
    else status = 'CLASH';
    details.push({ field: f, spec: sv, drawing: dv, delta: diff, status });
    if (status === 'CLASH') worst = 'CLASH';
    else if (status === 'MARGINAL' && worst !== 'CLASH') worst = 'MARGINAL';
  }
  return { status: worst, details };
}

function buildSuggestion(finding) {
  const { key, status, specValue, drawingValue, label } = finding;
  if (status === 'MATCH') return null;
  if (status === 'MISSING_IN_DRAWING') {
    return `The specification requires "${label}" but the drawing does not show or call out this parameter. Engineer to add an explicit note/dimension on the drawing.`;
  }
  if (status === 'MISSING_IN_SPEC') {
    return `The drawing defines "${label}" but the specification is silent. Recommend updating the specification to capture this value so the contractor has a written reference.`;
  }
  if (typeof specValue === 'object' && specValue && typeof drawingValue === 'object' && drawingValue) {
    const f = finding.dimensionDetails || [];
    const undersized = f.filter(x => x.status !== 'MATCH').map(x => `${x.field}: drawing ${x.drawing} mm < spec min ${x.spec} mm`).join('; ');
    return `Drawing element is undersized relative to the client specification minimum. ${undersized}. Engineer should either (a) increase the element size on the drawing to meet the specified minimum, or (b) issue a Technical Query justifying the smaller section with calculations.`;
  }
  // simple scalar
  if (status === 'CLASH') {
    if (key === 'concrete_grade' || key === 'rebar_grade') {
      return `Specification calls for ${specValue}, drawing/notes indicate ${drawingValue}. Align material schedule on drawing with specified grade, or raise a TQ to confirm grade.`;
    }
    return `Specification value (${specValue}) differs from drawing value (${drawingValue}). Engineer to revise drawing to match specification, or issue a formal change request.`;
  }
  if (status === 'MARGINAL') {
    return `Values are close but outside the recommended tolerance band. Specification: ${specValue}, drawing: ${drawingValue}. Confirm with engineer whether this falls within acceptable design margin.`;
  }
  return null;
}

function compare(specParams, drawParams) {
  const findings = [];
  // Group by key
  const groupBy = (arr) => {
    const m = new Map();
    for (const p of arr) {
      if (!m.has(p.key)) m.set(p.key, []);
      m.get(p.key).push(p);
    }
    return m;
  };
  const sMap = groupBy(specParams);
  const dMap = groupBy(drawParams);
  const allKeys = new Set([...sMap.keys(), ...dMap.keys()]);

  for (const key of allKeys) {
    const sList = sMap.get(key) || [];
    const dList = dMap.get(key) || [];

    if (sList.length && !dList.length) {
      for (const s of sList) {
        findings.push({
          key,
          label: s.label,
          status: 'MISSING_IN_DRAWING',
          specValue: s.value,
          drawingValue: null,
          unit: s.unit,
          specContext: s.context,
          drawingContext: null,
        });
      }
      continue;
    }
    if (!sList.length && dList.length) {
      for (const d of dList) {
        findings.push({
          key,
          label: d.label,
          status: 'MISSING_IN_SPEC',
          specValue: null,
          drawingValue: d.value,
          unit: d.unit,
          specContext: null,
          drawingContext: d.context,
        });
      }
      continue;
    }

    // Both present — pair them up. For multi-instance keys (e.g. multiple strip
    // footings), pair each spec with the closest drawing entry.
    // Simple strategy: cross-compare; pick the worst clash status as the finding.
    for (const s of sList) {
      let best = null;
      for (const d of dList) {
        let status, dimDetails;
        if (typeof s.value === 'object' && s.value && typeof d.value === 'object' && d.value) {
          const r = classifyDimensionObject(s.value, d.value, key);
          status = r.status; dimDetails = r.details;
        } else if (typeof s.value === 'number' && typeof d.value === 'number') {
          status = classifyNumeric(s.value, d.value, key);
        } else {
          status = (String(s.value).toUpperCase() === String(d.value).toUpperCase()) ? 'MATCH' : 'CLASH';
        }
        const rank = { MATCH: 0, MARGINAL: 1, CLASH: 2 };
        if (!best || rank[status] < rank[best.status]) {
          best = { status, dimDetails, d };
        }
      }
      const finding = {
        key,
        label: s.label,
        status: best.status,
        specValue: s.value,
        drawingValue: best.d.value,
        unit: s.unit,
        specContext: s.context,
        drawingContext: best.d.context,
        dimensionDetails: best.dimDetails,
      };
      finding.suggestion = buildSuggestion(finding);
      findings.push(finding);
    }
  }

  // Stats
  const counts = { MATCH: 0, MARGINAL: 0, CLASH: 0, MISSING_IN_DRAWING: 0, MISSING_IN_SPEC: 0 };
  for (const f of findings) counts[f.status] = (counts[f.status] || 0) + 1;
  // Sort: clashes first
  const order = { CLASH: 0, MARGINAL: 1, MISSING_IN_DRAWING: 2, MISSING_IN_SPEC: 3, MATCH: 4 };
  findings.sort((a, b) => order[a.status] - order[b.status]);

  // For findings without suggestion (e.g., MATCH), leave undefined
  findings.forEach(f => { if (!f.suggestion) f.suggestion = buildSuggestion(f); });

  return { findings, counts };
}

module.exports = { compare };
