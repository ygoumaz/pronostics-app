const fs = require('fs');
const path = require('path');

const { PDFParse } = require(path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'dist', 'pdf-parse', 'cjs', 'index.cjs'));

async function main() {
  const buffer = fs.readFileSync(path.join(__dirname, '..', 'SquadLists-English.pdf'));
  const dataBuffer = new Uint8Array(buffer);
  const parser = new PDFParse(dataBuffer);
  const data = await parser.getText();
  
  const fullText = data.text;
  
  // Parse each team's squad
  const players = [];
  const teamPattern = /^([A-Za-z\u00C0-\u024F\s\-.'()]+)\s*\(([A-Z]{3})\)/;
  
  // Split by page markers
  const pageTexts = fullText.split(/-- \d+ of \d+ --/);
  
  for (const pageText of pageTexts) {
    const lines = pageText.trim().split('\n');
    let currentTeam = null;
    let currentCode = null;
    
    for (const line of lines) {
      // Try to match team header
      const teamMatch = line.match(teamPattern);
      if (teamMatch) {
        currentTeam = teamMatch[1].trim();
        currentCode = teamMatch[2];
        continue;
      }
      
      // Skip non-relevant lines
      if (!currentCode) continue;
      if (line.startsWith('#') || line.startsWith('ROLE') || line.startsWith('DOB') || 
          line.includes('FIFA World Cup') || line.includes('SQUAD LIST') ||
          line.includes('Head coach') || line.includes('Assistant') ||
          line.match(/^\d+$/) || line.trim() === '') continue;
      
      // Match player line: POS PLAYER_NAME\tREST...
      const playerMatch = line.match(/^(GK|DF|MF|FW)\s+(.+)/);
      if (playerMatch) {
        const position = playerMatch[1];
        const rest = playerMatch[2];
        
        // Split by tabs - first column is PLAYER NAME (commonly known name)
        const parts = rest.split(/\t+/);
        if (parts.length >= 1) {
          const rawPlayerName = parts[0].trim();
          // The 4th column (index 3) is "NAME ON SHIRT" which is also good
          // But let's use PLAYER NAME field and title-case it
          const displayName = smartTitleCase(rawPlayerName);
          
          players.push({
            name: displayName,
            teamCode: currentCode,
            position: position
          });
        }
      }
    }
  }
  
  console.log('Total players extracted:', players.length);
  
  // Count by team
  const teamCounts = {};
  players.forEach(p => {
    teamCounts[p.teamCode] = (teamCounts[p.teamCode] || 0) + 1;
  });
  console.log('Teams:', Object.keys(teamCounts).length);
  
  // Check for missing teams
  const expectedTeams = ['ALG','ARG','AUS','AUT','BEL','BIH','BRA','CPV','CAN','COL','COD','CIV','CRO','CUW','CZE','ECU','EGY','ENG','FRA','GER','GHA','HAI','IRN','IRQ','JPN','JOR','KOR','MEX','MAR','NED','NZL','NOR','PAN','PAR','POR','QAT','KSA','SCO','SEN','RSA','ESP','SWE','SUI','TUN','TUR','URU','USA','UZB'];
  const missing = expectedTeams.filter(t => !teamCounts[t]);
  if (missing.length > 0) console.log('Missing teams:', missing);
  
  // Sample output
  console.log('\nSample ARG:', players.filter(x => x.teamCode === 'ARG').slice(0, 6));
  console.log('\nSample FRA:', players.filter(x => x.teamCode === 'FRA').slice(0, 6));
  console.log('\nSample BRA:', players.filter(x => x.teamCode === 'BRA').slice(0, 10));
  console.log('\nSample ENG:', players.filter(x => x.teamCode === 'ENG').slice(0, 6));
  console.log('\nSample NED:', players.filter(x => x.teamCode === 'NED').slice(0, 6));
  
  // Write output
  fs.writeFileSync(
    path.join(__dirname, '..', 'data', 'players.json'),
    JSON.stringify(players, null, 2)
  );
  console.log('\nWrote data/players.json with', players.length, 'players');
}

/**
 * Smart title case for player names from all-caps format.
 * Handles particles (de, van, el, al, jr, etc.) and special characters.
 * Examples:
 *   "MESSI Lionel" -> "Messi Lionel" (but we want "Lionel Messi")
 *   "VINICIUS JUNIOR" -> "Vinicius Junior"
 *   "DE PAUL Rodrigo" -> stays complex...
 * 
 * Actually since the PLAYER NAME field from the PDF has the format:
 *   "LASTNAME Firstname" OR "NICKNAME" (for Brazilians)
 * We need to detect which format it is.
 * 
 * For now: just title-case the whole thing since the PLAYER NAME is the 
 * public-facing name that includes both first and last parts already.
 * The tricky part is that some are "MESSI Lionel" (LAST First) and others
 * are just "MARQUINHOS" (single name) or "VINICIUS JUNIOR" (nickname).
 * 
 * Looking at the PDF more carefully:
 * - Most entries: "LASTNAME Firstname" (e.g., "MESSI Lionel", "RICE Declan") 
 * - Brazilian entries: All caps nicknames (e.g., "ALISSON", "VINICIUS JUNIOR")
 * 
 * Strategy: detect if all words are uppercase → it's a nickname, title-case it.
 * If mixed case (some uppercase, some not) → it's "LASTNAME Firstname" format,
 * rearrange to "Firstname Lastname".
 */
function smartTitleCase(rawName) {
  const words = rawName.split(/\s+/);
  
  // Check if ALL words are uppercase → nickname/single name
  const allUppercase = words.every(w => w === w.toUpperCase());
  
  if (allUppercase) {
    // It's a nickname like "MARQUINHOS", "VINICIUS JUNIOR", "NEYMAR JR"
    return words.map(w => titleWord(w)).join(' ');
  }
  
  // Mixed case: "LASTNAME Firstname" or "DE PAUL Rodrigo"
  // Find where uppercase part ends and mixed-case part begins
  let lastNameEnd = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i] === words[i].toUpperCase() && /[A-ZÀ-ÿ]/.test(words[i].charAt(0))) {
      lastNameEnd = i + 1;
    } else {
      break;
    }
  }
  
  if (lastNameEnd === 0 || lastNameEnd >= words.length) {
    // Fallback: just title-case everything
    return words.map(w => titleWord(w)).join(' ');
  }
  
  const lastNameParts = words.slice(0, lastNameEnd).map(w => titleWord(w));
  const firstNameParts = words.slice(lastNameEnd);
  
  return [...firstNameParts, ...lastNameParts].join(' ');
}

function titleWord(word) {
  if (!word) return '';
  // Lowercase particles
  const lower = word.toLowerCase();
  if (['jr', 'jr.'].includes(lower)) return 'Jr.';
  
  // Handle apostrophes: O'REILLY -> O'Reilly
  if (word.includes("'")) {
    return word.split("'").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("'");
  }
  // Handle hyphens: HADJ-MOUSSA -> Hadj-Moussa
  if (word.includes("-")) {
    return word.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-");
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

main().catch(e => console.error(e));
