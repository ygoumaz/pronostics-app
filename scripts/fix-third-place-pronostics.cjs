/**
 * Fix script: backfill all participants' pronostics for the third-place
 * match (M103, France vs England) from a manually-collected results sheet
 * (Pronos.xlsx, "FRA_ENG" column) that was never entered into the app.
 *
 * Run from /app on the Fly.io machine so node_modules resolves correctly:
 *   node /app/fix-third-place-pronostics.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MATCH_NUMBER = 103;
const EXPECTED_HOME_CODE = 'FRA';
const EXPECTED_AWAY_CODE = 'ENG';

// displayName -> "homeGoals-awayGoals" (FRA - ENG), from the screenshot.
const PRONOSTICS = [
  ['Gia', 2, 1],
  ['TomGoat', 3, 2],
  ['Kevin', 3, 1],
  ['Elizabeta', 3, 1],
  ['Le Roux', 1, 2],
  ['Nathan', 2, 0],
  ['Goumz', 2, 1],
  ['Davidraj', 3, 1],
  ['Denis', 2, 1],
  ['Yoyo1009', 1, 2],
  ['Martinoups', 3, 0],
  ['Axelle', 1, 1],
  ['Valentin', 2, 1],
  ['Hyo_', 2, 1],
  ['Marilou', 3, 2],
  ['Rubenleouf', 1, 2],
  ['RafaLoco', 3, 1],
  ['Cam', 2, 1],
  ['Thomas', 2, 2],
  ['Serge', 2, 1],
  ['Sebinho', 6, 7],
  ['Andreas', 1, 2],
  ['ATN', 6, 7],
];

async function main() {
  const match = await prisma.match.findUnique({ where: { matchNumber: MATCH_NUMBER } });

  if (!match) {
    console.error(`ERROR: Match #${MATCH_NUMBER} not found.`);
    process.exit(1);
  }

  if (match.homeTeamCode !== EXPECTED_HOME_CODE || match.awayTeamCode !== EXPECTED_AWAY_CODE) {
    console.error(
      `ERROR: Match #${MATCH_NUMBER} has home=${match.homeTeamCode}, away=${match.awayTeamCode}, ` +
        `expected home=${EXPECTED_HOME_CODE}, away=${EXPECTED_AWAY_CODE}. Aborting.`
    );
    process.exit(1);
  }

  console.log(`Match #${MATCH_NUMBER}: ${match.homeTeamCode} vs ${match.awayTeamCode} (id=${match.id})`);

  const allParticipants = await prisma.participant.findMany({
    select: { id: true, displayName: true, email: true },
  });

  const notFound = [];
  const skippedExisting = [];
  const inserted = [];

  for (const [displayName, homeGoals, awayGoals] of PRONOSTICS) {
    const participant = allParticipants.find((p) => p.displayName === displayName);

    if (!participant) {
      notFound.push(displayName);
      console.error(`  [MISSING] No participant found with displayName="${displayName}"`);
      continue;
    }

    const existing = await prisma.pronostic.findUnique({
      where: { participantId_matchId: { participantId: participant.id, matchId: match.id } },
    });

    if (existing) {
      skippedExisting.push(displayName);
      console.log(
        `  [SKIP]    ${displayName}: pronostic already exists (${existing.homeGoals}-${existing.awayGoals})`
      );
      continue;
    }

    await prisma.pronostic.create({
      data: {
        participantId: participant.id,
        matchId: match.id,
        homeGoals,
        awayGoals,
        points: null,
      },
    });

    inserted.push(displayName);
    console.log(`  [OK]      ${displayName}: inserted ${homeGoals}-${awayGoals}`);
  }

  // Report any registered participants who are NOT in the sheet at all.
  const sheetNames = new Set(PRONOSTICS.map(([name]) => name));
  const missingFromSheet = allParticipants
    .filter((p) => p.displayName !== 'Admin' && !sheetNames.has(p.displayName))
    .map((p) => p.displayName);

  console.log('\n--- Summary ---');
  console.log(`Inserted: ${inserted.length} -> ${inserted.join(', ') || 'none'}`);
  console.log(`Skipped (already existed): ${skippedExisting.length} -> ${skippedExisting.join(', ') || 'none'}`);
  console.log(`Not found in DB (name mismatch?): ${notFound.length} -> ${notFound.join(', ') || 'none'}`);
  console.log(`Registered participants missing from sheet: ${missingFromSheet.length} -> ${missingFromSheet.join(', ') || 'none'}`);
  console.log('\nDone!');
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
