/**
 * Fix script: insert Serge's missing pronostics for Group Day 2 (matches 39-48).
 *
 * Run from /app on the Fly.io machine so node_modules resolves correctly:
 *   node /app/fix-serge-pronostics.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mapped by match number (verified against matches.json):
//  39: URU vs CPV, 40: NZL vs EGY, 41: FRA vs IRQ, 42: ARG vs AUT,
//  43: NOR vs SEN, 44: JOR vs ALG, 45: POR vs UZB, 46: ENG vs GHA,
//  47: PAN vs CRO, 48: COL vs COD
const PRONOSTICS = [
  { matchNumber: 39, homeGoals: 2, awayGoals: 0 }, // Uruguay - Cape Verde
  { matchNumber: 40, homeGoals: 0, awayGoals: 3 }, // New Zealand - Egypt
  { matchNumber: 41, homeGoals: 4, awayGoals: 0 }, // France - Iraq
  { matchNumber: 42, homeGoals: 3, awayGoals: 1 }, // Argentina - Austria
  { matchNumber: 43, homeGoals: 2, awayGoals: 3 }, // Norway - Senegal
  { matchNumber: 44, homeGoals: 1, awayGoals: 2 }, // Jordan - Algeria
  { matchNumber: 45, homeGoals: 5, awayGoals: 0 }, // Portugal - Uzbekistan
  { matchNumber: 46, homeGoals: 4, awayGoals: 0 }, // England - Ghana
  { matchNumber: 47, homeGoals: 1, awayGoals: 1 }, // Panama - Croatia
  { matchNumber: 48, homeGoals: 2, awayGoals: 1 }, // Colombia - DR Congo
];

async function main() {
  // Find participant Serge
  const participant = await prisma.participant.findFirst({
    where: {
      OR: [
        { displayName: { contains: 'serge' } },
        { email: { contains: 'serge' } },
      ],
    },
  });

  if (!participant) {
    console.error('ERROR: No participant matching "serge" found.');
    process.exit(1);
  }

  console.log(`Found participant: "${participant.displayName}" <${participant.email}> (id=${participant.id})`);

  for (const { matchNumber, homeGoals, awayGoals } of PRONOSTICS) {
    const match = await prisma.match.findUnique({ where: { matchNumber } });

    if (!match) {
      console.error(`ERROR: Match #${matchNumber} not found.`);
      process.exit(1);
    }

    const label = `${match.homeTeamCode ?? match.homePlaceholder} vs ${match.awayTeamCode ?? match.awayPlaceholder}`;

    // Check if pronostic already exists
    const existing = await prisma.pronostic.findUnique({
      where: { participantId_matchId: { participantId: participant.id, matchId: match.id } },
    });

    if (existing) {
      console.log(`  [SKIP] Match #${matchNumber} (${label}): pronostic already exists (${existing.homeGoals}-${existing.awayGoals})`);
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

    console.log(`  [OK]   Match #${matchNumber} (${label}): inserted ${homeGoals}-${awayGoals}`);
  }

  console.log('Done!');
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
