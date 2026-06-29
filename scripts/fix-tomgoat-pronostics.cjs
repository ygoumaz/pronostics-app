/**
 * Fix script: insert TomGoat's missing pronostics for ROUND_OF_32.
 * Matches are looked up by exact homeTeamCode + awayTeamCode in the DB.
 * Any match not found (e.g. the one TomGoat intentionally skipped) is silently skipped.
 *
 * Run from /app on the Fly.io machine:
 *   node /app/fix-tomgoat-pronostics.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 15 out of 16 R32 pronos — one intentionally left out (TomGoat missed it)
const PRONOSTICS = [
  { home: 'RSA', away: 'CAN', homeGoals: 0, awayGoals: 2 }, // Afrique du sud - Canada
  { home: 'BRA', away: 'JPN', homeGoals: 2, awayGoals: 1 }, // Brésil - Japon
  { home: 'GER', away: 'PAR', homeGoals: 2, awayGoals: 0 }, // Allemagne - Paraguay
  { home: 'NED', away: 'MAR', homeGoals: 2, awayGoals: 1 }, // Pays Bas - Maroc
  { home: 'CIV', away: 'NOR', homeGoals: 1, awayGoals: 2 }, // Côte d'Ivoire - Norvège
  { home: 'FRA', away: 'SWE', homeGoals: 2, awayGoals: 0 }, // France - Suède
  { home: 'MEX', away: 'ECU', homeGoals: 1, awayGoals: 0 }, // Mexique - Équateur
  { home: 'ENG', away: 'COD', homeGoals: 3, awayGoals: 0 }, // Angleterre - RDC
  { home: 'BEL', away: 'SEN', homeGoals: 1, awayGoals: 2 }, // Belgique - Sénégal
  { home: 'USA', away: 'BIH', homeGoals: 3, awayGoals: 1 }, // USA - Bosnie
  { home: 'POR', away: 'CRO', homeGoals: 1, awayGoals: 1 }, // Portugal - Croatie
  { home: 'SUI', away: 'ALG', homeGoals: 2, awayGoals: 0 }, // Suisse - Algérie
  { home: 'AUS', away: 'EGY', homeGoals: 0, awayGoals: 1 }, // Australie - Égypte
  { home: 'ARG', away: 'CPV', homeGoals: 3, awayGoals: 0 }, // Argentine - Cap vert
  { home: 'COL', away: 'GHA', homeGoals: 1, awayGoals: 0 }, // Colombie - Ghana
];

async function main() {
  // Find participant TomGoat
  const participant = await prisma.participant.findFirst({
    where: {
      OR: [
        { displayName: { contains: 'TomGoat' } },
        { displayName: { contains: 'tomgoat' } },
        { email: { contains: 'tomgoat' } },
      ],
    },
  });

  if (!participant) {
    console.error('ERROR: No participant matching "TomGoat" found.');
    process.exit(1);
  }

  console.log(`Found participant: "${participant.displayName}" <${participant.email}> (id=${participant.id})`);

  let inserted = 0;
  let skipped = 0;
  let notFound = 0;

  for (const { home, away, homeGoals, awayGoals } of PRONOSTICS) {
    const match = await prisma.match.findFirst({
      where: { homeTeamCode: home, awayTeamCode: away },
    });

    if (!match) {
      console.log(`  [NOT FOUND] ${home} vs ${away} — no match in DB, skipping`);
      notFound++;
      continue;
    }

    const existing = await prisma.pronostic.findUnique({
      where: { participantId_matchId: { participantId: participant.id, matchId: match.id } },
    });

    if (existing) {
      console.log(`  [SKIP] Match #${match.matchNumber} (${home} vs ${away}): already exists (${existing.homeGoals}-${existing.awayGoals})`);
      skipped++;
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

    console.log(`  [OK]   Match #${match.matchNumber} (${home} vs ${away}): inserted ${homeGoals}-${awayGoals}`);
    inserted++;
  }

  console.log(`\nDone! inserted=${inserted}, skipped=${skipped}, notFound=${notFound}`);
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
