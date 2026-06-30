// One-shot script: insert late Day-1 pronos for Marilou directly in production DB
// Run on fly.io machine: node /app/scripts/insert-marilou-pronos.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Scores from screenshot (match number → [homeGoals, awayGoals])
const PRONOS = [
  { matchNumber: 10, homeGoals: 2, awayGoals: 1 }, // NED – JPN
  { matchNumber: 11, homeGoals: 1, awayGoals: 1 }, // CIV – ECU
  { matchNumber: 12, homeGoals: 3, awayGoals: 1 }, // SWE – TUN
  { matchNumber: 13, homeGoals: 3, awayGoals: 0 }, // ESP – CPV
  { matchNumber: 14, homeGoals: 2, awayGoals: 0 }, // BEL – EGY
  { matchNumber: 15, homeGoals: 0, awayGoals: 1 }, // KSA – URU
  { matchNumber: 16, homeGoals: 0, awayGoals: 0 }, // IRN – NZL
  { matchNumber: 17, homeGoals: 3, awayGoals: 0 }, // FRA – SEN
  { matchNumber: 18, homeGoals: 0, awayGoals: 1 }, // IRQ – NOR
  { matchNumber: 19, homeGoals: 2, awayGoals: 0 }, // ARG – ALG
  { matchNumber: 20, homeGoals: 1, awayGoals: 0 }, // AUT – JOR
  { matchNumber: 21, homeGoals: 3, awayGoals: 1 }, // POR – COD
  { matchNumber: 22, homeGoals: 2, awayGoals: 1 }, // ENG – CRO
  { matchNumber: 23, homeGoals: 1, awayGoals: 1 }, // GHA – PAN
  { matchNumber: 24, homeGoals: 0, awayGoals: 3 }, // UZB – COL
];

async function main() {
  // 1. Find Marilou
  const marilou = await prisma.participant.findFirst({
    where: {
      OR: [
        { displayName: { contains: 'arilou' } },
        { email: { contains: 'marilou' } },
      ],
    },
  });

  if (!marilou) throw new Error('Participant Marilou not found');
  console.log(`Found participant: ${marilou.displayName} (${marilou.email}) id=${marilou.id}`);

  // 2. Fetch matches for those match numbers
  const matches = await prisma.match.findMany({
    where: { matchNumber: { in: PRONOS.map((p) => p.matchNumber) } },
    select: { id: true, matchNumber: true, homeTeamCode: true, awayTeamCode: true },
  });

  const matchByNumber = Object.fromEntries(matches.map((m) => [m.matchNumber, m]));

  // 3. Upsert pronostics
  let created = 0;
  let skipped = 0;

  for (const prono of PRONOS) {
    const match = matchByNumber[prono.matchNumber];
    if (!match) {
      console.warn(`Match ${prono.matchNumber} not found in DB – skipping`);
      skipped++;
      continue;
    }

    const result = await prisma.pronostic.upsert({
      where: {
        participantId_matchId: {
          participantId: marilou.id,
          matchId: match.id,
        },
      },
      create: {
        participantId: marilou.id,
        matchId: match.id,
        homeGoals: prono.homeGoals,
        awayGoals: prono.awayGoals,
      },
      update: {
        homeGoals: prono.homeGoals,
        awayGoals: prono.awayGoals,
      },
    });

    console.log(
      `Match ${prono.matchNumber} (${match.homeTeamCode}–${match.awayTeamCode}): ` +
        `${prono.homeGoals}-${prono.awayGoals} → id=${result.id}`
    );
    created++;
  }

  console.log(`\nDone: ${created} upserted, ${skipped} skipped.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
