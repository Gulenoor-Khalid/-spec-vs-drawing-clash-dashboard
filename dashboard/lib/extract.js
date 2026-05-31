// extract.js
// Real PDF text extraction + bilingual (EN/FR) structural parameter extractor.
// Uses the `pdftotext` CLI (poppler) which is installed on this machine.

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function extractText(pdfPath) {
  // pdftotext -layout preserves spatial structure which helps regexes
  try {
    const buf = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], {
      maxBuffer: 64 * 1024 * 1024
    });
    return buf.toString('utf8');
  } catch (e) {
    // fallback: no -layout
    const buf = execFileSync('pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], {
      maxBuffer: 64 * 1024 * 1024
    });
    return buf.toString('utf8');
  }
}

// Helper: normalize number string
function num(s) {
  if (s === undefined || s === null) return null;
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Helper: convert anything to mm
function toMM(value, unit) {
  if (value == null) return null;
  const u = (unit || 'mm').toLowerCase();
  if (u === 'mm') return value;
  if (u === 'cm') return value * 10;
  if (u === 'm') return value * 1000;
  return value;
}
function toM(value, unit) {
  if (value == null) return null;
  const u = (unit || 'm').toLowerCase();
  if (u === 'mm') return value / 1000;
  if (u === 'cm') return value / 100;
  if (u === 'm') return value;
  return value;
}

// Snip surrounding context for a regex match
function context(text, idx, len, span = 60) {
  const start = Math.max(0, idx - span);
  const end = Math.min(text.length, idx + len + span);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

// === Individual extractors ===
// Each returns array of { key, label, value, unit, raw, context }

function extractBearingPressure(text) {
  const out = [];
  const re = /q['′]?\s*(ELS|SLS|ELU|ULS)\s*[=:]?\s*([0-9]+[.,]?[0-9]*)\s*MPa/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const ls = /^(ELS|SLS)$/i.test(m[1]) ? 'SLS' : 'ULS';
    out.push({
      key: `bearing_pressure_${ls.toLowerCase()}`,
      label: `Allowable bearing pressure (${ls})`,
      value: num(m[2]),
      unit: 'MPa',
      raw: m[0],
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractEmbedment(text) {
  const out = [];
  // English: "embedment ... 1.00 m"  /  French: "encastrement ... 0,9 m" or "Encastrement minimal (D) de 0,9 m"
  const patterns = [
    /(?:encastrement|embedment)[^.\n]{0,80}?([0-9]+[.,]?[0-9]*)\s*m\b/gi,
    /Minimum embedment[^.\n]{0,80}?([0-9]+[.,]?[0-9]*)\s*m\b/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push({
        key: 'foundation_embedment_min',
        label: 'Min. foundation embedment depth',
        value: num(m[1]),
        unit: 'm',
        raw: m[0],
        context: context(text, m.index, m[0].length)
      });
    }
  }
  return out;
}

function extractAnchorage(text) {
  const out = [];
  const re = /(?:ancrage|anchorage)[^.\n]{0,80}?([0-9]+[.,]?[0-9]*)\s*m\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      key: 'foundation_anchorage_min',
      label: 'Min. anchorage in bearing soil',
      value: num(m[1]),
      unit: 'm',
      raw: m[0],
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractStripFooting(text) {
  const out = [];
  // Drawing form: "SF1 50x25cm ht" or "50x25cm ht" or "80x25cm ht"
  const drawRe = /(SF\d+)?\s*([0-9]{2,3})\s*x\s*([0-9]{2,3})\s*cm\s*ht/gi;
  let m;
  const seen = new Set();
  while ((m = drawRe.exec(text)) !== null) {
    const w = num(m[2]);
    const h = num(m[3]);
    if (!w || !h) continue;
    // Filter to plausible strip footings: width 40-150 cm, depth 20-60 cm
    if (w < 30 || w > 200 || h < 15 || h > 80) continue;
    const tag = m[1] ? m[1].toUpperCase() : `${w}x${h}`;
    const dimKey = `${w}x${h}`;
    if (seen.has(dimKey)) continue;
    seen.add(dimKey);
    out.push({
      key: `strip_footing`,
      label: `Strip footing ${tag} (${w}×${h} cm)`,
      value: { width_mm: w * 10, depth_mm: h * 10 },
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  // Spec form: "Standard strip ... 600 min. ... 300 min."
  const specRe = /(standard strip|heavy strip|strip footing[^|]{0,30})[^|]{0,180}?([0-9]{3,4})\s*(?:mm)?\s*min[^|]{0,40}?([0-9]{3,4})\s*(?:mm)?\s*min/gi;
  while ((m = specRe.exec(text)) !== null) {
    const w = num(m[2]);
    const h = num(m[3]);
    const tag = /heavy/i.test(m[1]) ? 'heavy' : 'standard';
    if (seen.has('spec_' + tag)) continue;
    seen.add('spec_' + tag);
    out.push({
      key: `strip_footing`,
      label: `Strip footing — spec minimum (${tag})`,
      value: { width_mm: w, depth_mm: h },
      unit: 'mm',
      raw: m[0].slice(0, 120).trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractIsolatedFooting(text) {
  const out = [];
  // Drawing: "SI 110x110x25cm ht"
  const drawRe = /(SI\s*)?([0-9]{2,4})\s*x\s*([0-9]{2,4})\s*x\s*([0-9]{2,3})\s*cm/gi;
  let m;
  const seen = new Set();
  while ((m = drawRe.exec(text)) !== null) {
    const l = num(m[2]), w = num(m[3]), d = num(m[4]);
    if (!l || !w || !d) continue;
    if (l < 60 || l > 400 || w < 60 || w > 400 || d < 15 || d > 100) continue;
    const tag = `ISO_${l}x${w}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push({
      key: 'isolated_footing',
      label: `Isolated footing ${l}×${w}×${d} cm`,
      value: { length_mm: l * 10, width_mm: w * 10, depth_mm: d * 10 },
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  // Spec: "1200 × 1200 min. ... 300 min."
  const specRe = /isolated[^|]{0,40}?([0-9]{3,4})\s*[×x]\s*([0-9]{3,4})[^|]{0,60}?([0-9]{3,4})\s*(?:mm)?\s*min/gi;
  while ((m = specRe.exec(text)) !== null) {
    const l = num(m[1]), w = num(m[2]), d = num(m[3]);
    const tag = `ISO_SPEC`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push({
      key: 'isolated_footing',
      label: `Isolated footing (spec min)`,
      value: { length_mm: l, width_mm: w, depth_mm: d },
      unit: 'mm',
      raw: m[0].slice(0, 120).trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractTieBeam(text) {
  const out = [];
  // Drawing: "Tirant T1 25x25cm ht"
  const drawRe = /Tirant\s*T?\d*[^\n]{0,40}?([0-9]{2,3})\s*x\s*([0-9]{2,3})\s*cm/gi;
  let m;
  const seen = new Set();
  while ((m = drawRe.exec(text)) !== null) {
    const w = num(m[1]), d = num(m[2]);
    if (!w || !d) continue;
    if (w < 15 || w > 80 || d < 15 || d > 80) continue;
    const tag = `TIE_${w}x${d}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push({
      key: 'tie_beam',
      label: `Tie beam ${w}×${d} cm`,
      value: { width_mm: w * 10, depth_mm: d * 10 },
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  // Spec: "minimum cross-section shall be 300 × 300 mm"
  const specRe = /tie\s*beam[^.]{0,200}?([0-9]{3})\s*[×x]\s*([0-9]{3})\s*mm/gi;
  while ((m = specRe.exec(text)) !== null) {
    const w = num(m[1]), d = num(m[2]);
    const tag = 'TIE_SPEC';
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push({
      key: 'tie_beam',
      label: `Tie beam (spec min)`,
      value: { width_mm: w, depth_mm: d },
      unit: 'mm',
      raw: m[0].slice(0, 120).trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractLoads(text) {
  const out = [];
  const dedup = new Set();
  // G = 200 kg/m²  or G = 2.00 kN/m²
  const kgRe = /([GQ])\s*=\s*([0-9]+[.,]?[0-9]*)\s*kg\/m[²2]/gi;
  let m;
  while ((m = kgRe.exec(text)) !== null) {
    const kind = m[1].toUpperCase() === 'G' ? 'permanent' : 'live';
    const val = num(m[2]);
    const sig = `${kind}:${val}`;
    if (dedup.has(sig)) continue;
    dedup.add(sig);
    out.push({
      key: `load_${kind}_kg`,
      label: `${kind === 'permanent' ? 'Permanent (G)' : 'Live (Q)'} load`,
      value: val,
      unit: 'kg/m²',
      raw: m[0],
      context: context(text, m.index, m[0].length)
    });
  }
  const knRe = /([GQ])\s*=\s*([0-9]+[.,]?[0-9]*)\s*kN\/m[²2]/gi;
  while ((m = knRe.exec(text)) !== null) {
    const kind = m[1].toUpperCase() === 'G' ? 'permanent' : 'live';
    const val = Math.round(num(m[2]) * 100); // 1 kN/m² ≈ 100 kg/m²
    const sig = `${kind}:${val}`;
    if (dedup.has(sig)) continue;
    dedup.add(sig);
    out.push({
      key: `load_${kind}_kg`,
      label: `${kind === 'permanent' ? 'Permanent (G)' : 'Live (Q)'} load`,
      value: val,
      unit: 'kg/m² (from kN/m²)',
      raw: m[0],
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractConcreteGrade(text) {
  const out = [];
  const re = /\bC\s*([0-9]{2})\s*\/\s*([0-9]{2})\b/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(text)) !== null) {
    const a = parseInt(m[1], 10);
    if (a < 16) continue; // skip C12/15 blinding mix — not structural
    const g = `C${m[1]}/${m[2]}`;
    if (seen.has(g)) continue;
    seen.add(g);
    // Use the highest grade found as the headline structural concrete
    out.push({
      key: 'concrete_grade',
      label: `Concrete grade ${g}`,
      value: g,
      unit: '',
      raw: g,
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractParapet(text) {
  const out = [];
  // Drawing: "Acrotère périphérique 37 cm"  Spec: "minimum of 400 mm"
  const re = /(acrot[èe]re|parapet)[^.\n]{0,80}?([0-9]{2,4})\s*(cm|mm)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      key: 'parapet_height',
      label: 'Parapet (acrotère) height',
      value: toMM(num(m[2]), m[3]),
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractSlabThickness(text) {
  const out = [];
  // Spec form: "total floor thickness shall be 220 mm"
  const specRe = /(floor thickness|slab thickness|total floor thickness|épaisseur de dalle)[^.\n]{0,80}?([0-9]{2,4})\s*(mm|cm)/gi;
  let m;
  while ((m = specRe.exec(text)) !== null) {
    out.push({
      key: 'slab_thickness',
      label: 'Slab/floor thickness',
      value: toMM(num(m[2]), m[3]),
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  // Drawing form: "Poutrelle hourdis ... 20" on its own line near "Epaisseur de dalle"
  // Simpler heuristic: find "Poutrelle hourdis" and then 1-3 digit value 16-25 nearby
  const phRe = /Poutrelle\s+hourdis[\s\S]{0,250}?\b(1[6-9]|2[0-5])\b/g;
  while ((m = phRe.exec(text)) !== null) {
    out.push({
      key: 'slab_thickness',
      label: 'Beam-and-block floor thickness (poutrelle-hourdis)',
      value: num(m[1]) * 10,
      unit: 'mm',
      raw: `Poutrelle hourdis ${m[1]} cm`,
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractFloorBuildup(text) {
  const out = [];
  // Drawing: "L'épaisseur du complexe de sol au rez-de-chaussée est de 20cm"
  const drawRe = /complexe\s+de\s+sol[^.\n]{0,80}?([0-9]+)\s*cm/gi;
  let m;
  while ((m = drawRe.exec(text)) !== null) {
    out.push({
      key: 'floor_buildup',
      label: 'Floor finish build-up thickness',
      value: num(m[1]) * 10,
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  // Spec: "floor finish build-up at ground floor level shall be 180 mm"
  const specRe = /(floor finish build-up|finish build-up|floor build-up)[^.\n]{0,100}?([0-9]{2,4})\s*(mm|cm)/gi;
  while ((m = specRe.exec(text)) !== null) {
    out.push({
      key: 'floor_buildup',
      label: 'Floor finish build-up thickness',
      value: toMM(num(m[2]), m[3]),
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractFFL(text) {
  const out = [];
  // Look for FFL specifically — French "calé à la cote X NGF" or "rez-de-chaussée ... cote X NGF"
  const re = /(?:cal[ée] à la cote|rez-de-chauss[ée]e[^.]{0,80}?cote|niveau bas du rez-de-chauss[ée]e[^.]{0,80}?cote)\s*([0-9]{3}[.,][0-9]{1,2})\s*NGF/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      key: 'finished_floor_level',
      label: 'Finished Floor Level (FFL)',
      value: num(m[1]),
      unit: 'NGF',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  // English: "shall be set at 127.00 NGF"
  const re2 = /set at\s*([0-9]{3}[.,][0-9]{1,2})\s*NGF/gi;
  while ((m = re2.exec(text)) !== null) {
    out.push({
      key: 'finished_floor_level',
      label: 'Finished Floor Level (FFL)',
      value: num(m[1]),
      unit: 'NGF',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractCover(text) {
  const out = [];
  const re = /(?:concrete cover|cover to reinforcement|enrobage)[^.\n]{0,100}?([0-9]{2,3})\s*mm/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      key: 'concrete_cover',
      label: 'Concrete cover to reinforcement',
      value: num(m[1]),
      unit: 'mm',
      raw: m[0].trim(),
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function extractRebarGrade(text) {
  const out = [];
  const re = /\bB\s*500\s*([ABC])\b/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(text)) !== null) {
    const g = `B500${m[1].toUpperCase()}`;
    if (seen.has(g)) continue;
    seen.add(g);
    out.push({
      key: 'rebar_grade',
      label: 'Reinforcement steel grade',
      value: g,
      unit: '',
      raw: g,
      context: context(text, m.index, m[0].length)
    });
  }
  return out;
}

function dedupeByKeyValue(arr) {
  const seen = new Set();
  const out = [];
  for (const p of arr) {
    const sig = `${p.key}::${typeof p.value === 'object' ? JSON.stringify(p.value) : p.value}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(p);
  }
  return out;
}

function extractAllParameters(text) {
  const all = [
    ...extractBearingPressure(text),
    ...extractEmbedment(text),
    ...extractAnchorage(text),
    ...extractStripFooting(text),
    ...extractIsolatedFooting(text),
    ...extractTieBeam(text),
    ...extractLoads(text),
    ...extractConcreteGrade(text),
    ...extractParapet(text),
    ...extractSlabThickness(text),
    ...extractFloorBuildup(text),
    ...extractFFL(text),
    ...extractCover(text),
    ...extractRebarGrade(text),
  ];
  return dedupeByKeyValue(all);
}

module.exports = { extractText, extractAllParameters };
