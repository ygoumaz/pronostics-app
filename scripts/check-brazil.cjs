const fs = require('fs');
const path = require('path');

const { PDFParse } = require(path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'dist', 'pdf-parse', 'cjs', 'index.cjs'));

async function main() {
  const buffer = fs.readFileSync(path.join(__dirname, '..', 'SquadLists-English.pdf'));
  const dataBuffer = new Uint8Array(buffer);
  const parser = new PDFParse(dataBuffer);
  const data = await parser.getText();
  
  const pages = data.text.split(/-- \d+ of \d+ --/);
  const braPage = pages.find(p => p.includes('Brazil (BRA)'));
  const lines = braPage.split('\n').filter(l => l.match(/^(GK|DF|MF|FW)/));
  
  console.log('=== RAW BRAZIL LINES (first 10) ===');
  lines.slice(0, 10).forEach(l => {
    // Show tabs clearly
    console.log(l.replace(/\t/g, ' | '));
  });
}

main().catch(e => console.error(e));
