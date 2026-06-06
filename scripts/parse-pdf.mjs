import fs from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const dataBuffer = fs.readFileSync('./World_Cup_2026_standings_en.pdf');
const data = await pdfParse(dataBuffer);
console.log('Pages:', data.numpages);
console.log('Text length:', data.text.length);
// Print first 5000 chars
console.log('=== FIRST 5000 CHARS ===');
console.log(data.text.substring(0, 5000));
