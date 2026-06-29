/**
 * Fix script: update davidraj's pronostic for match 85 (Switzerland vs Algeria)
 * from 2-2 to 2-1 (Switzerland wins).
 *
 * Run from /app on the Fly.io machine so node_modules resolves correctly:
 *   node /app/fix-davidraj-pronostic.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // --- Find participant "davidraj" (case-insensitive on both email and displayName) ---
  const participant = await prisma.participant.findFirst({
    where: {
      OR: [
        { displayName: { contains: 'davidraj' } },
        { email: { contains: 'davidraj' } },
      ],
    },
  });

  if (!participant) {
    console.error('ERROR: No participant matching "davidraj" found.');
    process.exit(1);
  }

  console.log(`Found participant: "${participant.displayName}" <${participant.email}> (id=${participant.id})`);

  // --- Find match 85 ---
  const match = await prisma.match.findUnique({
    where: { matchNumber: 85 },
  });

  if (!match) {
    console.error('ERROR: Match #85 not found.');
    process.exit(1);
  }

  console.log(`Found match #85: ${match.homeTeamCode ?? match.homePlaceholder} vs ${match.awayTeamCode ?? match.awayPlaceholder} (id=${match.id})`);

  // --- Find the pronostic ---
  const pronostic = await prisma.pronostic.findUnique({
    where: {
      participantId_matchId: {
        participantId: participant.id,
        matchId: match.id,
      },
    },
  });

  if (!pronostic) {
    console.error(`ERROR: No pronostic found for participant "${participant.displayName}" on match #85.`);
    process.exit(1);
  }

  console.log(`Current pronostic: ${pronostic.homeGoals}-${pronostic.awayGoals} (points=${pronostic.points ?? 'null'})`);

  if (pronostic.homeGoals === 2 && pronostic.awayGoals === 1) {
    console.log('Pronostic is already 2-1. Nothing to do.');
    return;
  }

  // --- Update to 2-1, reset points so it gets re-evaluated ---
  const updated = await prisma.pronostic.update({
    where: {
      participantId_matchId: {
        participantId: participant.id,
        matchId: match.id,
      },
    },
    data: {
      homeGoals: 2,
      awayGoals: 1,
      points: null,
    },
  });

  console.log(`Updated pronostic: ${updated.homeGoals}-${updated.awayGoals} (points reset to null)`);
  console.log('Done!');
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
