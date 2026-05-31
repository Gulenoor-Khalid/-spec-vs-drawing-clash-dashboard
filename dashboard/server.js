// server.js — Express backend for spec-vs-drawing clash dashboard
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { extractText, extractAllParameters } = require('./lib/extract');
const { compare } = require('./lib/compare');

const app = express();
const PORT = process.env.PORT || 5174;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

app.use(express.static(path.join(__dirname, 'public')));

app.post(
  '/api/analyze',
  upload.fields([
    { name: 'drawing', maxCount: 1 },
    { name: 'specification', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const dFile = req.files.drawing && req.files.drawing[0];
      const sFile = req.files.specification && req.files.specification[0];
      if (!dFile || !sFile) {
        return res.status(400).json({ error: 'Both drawing and specification PDFs are required.' });
      }

      const drawingText = extractText(dFile.path);
      const specText = extractText(sFile.path);

      const drawingParams = extractAllParameters(drawingText);
      const specParams = extractAllParameters(specText);

      const { findings, counts } = compare(specParams, drawingParams);

      // Optional cleanup of uploads
      try { fs.unlinkSync(dFile.path); } catch (_) {}
      try { fs.unlinkSync(sFile.path); } catch (_) {}

      const total = findings.length;
      const compliancePct = total === 0 ? 0 : Math.round(((counts.MATCH || 0) / total) * 100);

      res.json({
        meta: {
          drawingFile: dFile.originalname,
          specFile: sFile.originalname,
          drawingTextLength: drawingText.length,
          specTextLength: specText.length,
          analyzedAt: new Date().toISOString(),
        },
        counts,
        compliancePct,
        total,
        extracted: {
          spec: specParams,
          drawing: drawingParams,
        },
        findings,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
