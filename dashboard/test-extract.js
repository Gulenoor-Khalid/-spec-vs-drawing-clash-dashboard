// test-extract.js — Debug tool to see what parameters are extracted from a PDF
const { extractText, extractAllParameters } = require('./lib/extract');
const path = require('path');
const fs = require('fs');

if (process.argv.length < 3) {
  console.log('Usage: node test-extract.js <pdf-file>');
  console.log('Example: node test-extract.js specifications/STRUCTURAL-SPECIFICATION.pdf');
  process.exit(1);
}

const pdfPath = process.argv[2];

if (!fs.existsSync(pdfPath)) {
  console.error(`File not found: ${pdfPath}`);
  process.exit(1);
}

console.log(`\n📄 Extracting from: ${pdfPath}\n`);

try {
  const text = extractText(pdfPath);
  console.log(`✅ PDF text extracted (${text.length} characters)\n`);
  
  const params = extractAllParameters(text);
  
  if (params.length === 0) {
    console.log('❌ No parameters found!');
    console.log('\n📋 First 2000 characters of extracted text:');
    console.log('---');
    console.log(text.slice(0, 2000));
    console.log('---\n');
  } else {
    console.log(`✅ Found ${params.length} parameters:\n`);
    params.forEach((p, i) => {
      console.log(`${i + 1}. ${p.label}`);
      console.log(`   Key: ${p.key}`);
      console.log(`   Value: ${typeof p.value === 'object' ? JSON.stringify(p.value) : p.value} ${p.unit}`);
      console.log(`   Raw: ${p.raw}`);
      console.log();
    });
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
