/**
 * Utility script: inspect match #103 (third-place match) including its
 * official result and all existing pronostics, to check current state before
 * backfilling the FRA vs ENG (M103) pronostics from the screenshot.
 *
 * Run from /app on the Fly.io machine:
 *   node /app/check-match103.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const match = await prisma.match.findUnique({
    where: { matchNumber: 103 },
    include: {
      officialResult: true,
      pronostics: { include: { participant: { select: { displayName: true } } } },
    },
  });

  if (!match) {
    console.error('Match #103 not found.');
    process.exit(1);
  }

  console.log(`Match #103: id=${match.id}`);
  console.log(`  home=${match.homeTeamCode} (placeholder="${match.homePlaceholder}")`);
  console.log(`  away=${match.awayTeamCode} (placeholder="${match.awayPlaceholder}")`);
  console.log(`  officialResult=${match.officialResult ? JSON.stringify(match.officialResult) : 'none'}`);
  console.log(`  Existing pronostics (${match.pronostics.length}):`);
  for (const pr of match.pronostics) {
    console.log(`    ${pr.participant.displayName}: ${pr.homeGoals}-${pr.awayGoals} (points=${pr.points})`);
  }
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
