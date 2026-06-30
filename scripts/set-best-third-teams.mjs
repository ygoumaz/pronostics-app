// One-shot script: set the 8 best 3rd-place teams in ROUND_OF_32 matches
// Run on fly.io machine: node /app/scripts/set-best-third-teams.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Best 3rd-place teams per match (away slot)
// Source: FIFA 2026 WC combination table (groups B,D,E,F,I,J,K,L qualified)
const UPDATES = [
  { matchNumber: 74, awayTeamCode: 'PAR' }, // 1E Germany vs 3D Paraguay
  { matchNumber: 77, awayTeamCode: 'SWE' }, // 1I France   vs 3F Sweden
  { matchNumber: 79, awayTeamCode: 'ECU' }, // 1A Mexico   vs 3E Ecuador
  { matchNumber: 80, awayTeamCode: 'COD' }, // 1L England  vs 3K DR Congo
  { matchNumber: 81, awayTeamCode: 'BIH' }, // 1D USA      vs 3B Bosnia-Herz.
  { matchNumber: 82, awayTeamCode: 'SEN' }, // 1G Belgium  vs 3I Senegal
  { matchNumber: 85, awayTeamCode: 'ALG' }, // 1B Switz.   vs 3J Algeria
  { matchNumber: 87, awayTeamCode: 'GHA' }, // 1K Colombia vs 3L Ghana
];

async function main() {
  for (const { matchNumber, awayTeamCode } of UPDATES) {
    const match = await prisma.match.findUnique({ where: { matchNumber } });
    if (!match) {
      console.error(`Match ${matchNumber} not found — skipping`);
      continue;
    }
    await prisma.match.update({
      where: { matchNumber },
      data: { awayTeamCode },
    });
    console.log(`Match ${matchNumber}: awayTeamCode set to ${awayTeamCode}`);
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
