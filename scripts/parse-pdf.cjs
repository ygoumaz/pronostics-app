const fs = require('fs');
const path = require('path');

const { PDFParse } = require(path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'dist', 'pdf-parse', 'cjs', 'index.cjs'));

async function main() {
  const buffer = fs.readFileSync(path.join(__dirname, '..', 'World_Cup_2026_standings_en.pdf'));
  const dataBuffer = new Uint8Array(buffer);
  const parser = new PDFParse(dataBuffer);
  const data = await parser.getText();
  console.log('Total pages:', data.total);
  console.log('Text:', data.text.substring(0, 8000));
}

main().catch(e => console.error(e));
