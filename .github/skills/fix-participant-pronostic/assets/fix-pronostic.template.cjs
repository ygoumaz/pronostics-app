/**
 * Fix script: update <PARTICIPANT>'s pronostic for match <N> (<HOME> vs <AWAY>)
 * to <H>-<A>. Inserts the pronostic if it doesn't exist yet.
 *
 * Run from /app on the Fly.io machine so node_modules resolves correctly:
 *   node /app/fix-<participant>-match<N>.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MATCH_NUMBER = 0; // TODO: set match number
const EXPECTED_HOME_CODE = 'XXX'; // TODO: 3-letter code from data/teams.json
const EXPECTED_AWAY_CODE = 'YYY'; // TODO: 3-letter code from data/teams.json
const HOME_GOALS = 0; // TODO
const AWAY_GOALS = 0; // TODO

async function main() {
  // --- Find participant (case-insensitive on both email and displayName) ---
  const participant = await prisma.participant.findFirst({
    where: {
      OR: [
        { displayName: { contains: 'TODO' } }, // e.g. exact-case fragment
        { displayName: { contains: 'todo' } }, // lowercase fragment
        { email: { contains: 'todo' } },
      ],
    },
  });

  if (!participant) {
    console.error('ERROR: No participant matching "TODO" found.');
    process.exit(1);
  }

  console.log(`Found participant: "${participant.displayName}" <${participant.email}> (id=${participant.id})`);

  // --- Find match ---
  const match = await prisma.match.findUnique({
    where: { matchNumber: MATCH_NUMBER },
  });

  if (!match) {
    console.error(`ERROR: Match #${MATCH_NUMBER} not found.`);
    process.exit(1);
  }

  const homeCode = match.homeTeamCode ?? match.homePlaceholder;
  const awayCode = match.awayTeamCode ?? match.awayPlaceholder;
  console.log(`Found match #${MATCH_NUMBER}: ${homeCode} vs ${awayCode} (id=${match.id})`);

  if (match.homeTeamCode !== EXPECTED_HOME_CODE || match.awayTeamCode !== EXPECTED_AWAY_CODE) {
    console.error(
      `ERROR: Expected ${EXPECTED_HOME_CODE} vs ${EXPECTED_AWAY_CODE} but found ${homeCode} vs ${awayCode}. Aborting to avoid mistakes.`
    );
    process.exit(1);
  }

  // --- Find existing pronostic (if any) ---
  const pronostic = await prisma.pronostic.findUnique({
    where: {
      participantId_matchId: {
        participantId: participant.id,
        matchId: match.id,
      },
    },
  });

  if (pronostic) {
    console.log(`Current pronostic: ${pronostic.homeGoals}-${pronostic.awayGoals} (points=${pronostic.points ?? 'null'})`);

    if (pronostic.homeGoals === HOME_GOALS && pronostic.awayGoals === AWAY_GOALS) {
      console.log(`Pronostic is already ${HOME_GOALS}-${AWAY_GOALS}. Nothing to do.`);
      return;
    }

    const updated = await prisma.pronostic.update({
      where: {
        participantId_matchId: {
          participantId: participant.id,
          matchId: match.id,
        },
      },
      data: {
        homeGoals: HOME_GOALS,
        awayGoals: AWAY_GOALS,
        points: null,
      },
    });

    console.log(`Updated pronostic: ${updated.homeGoals}-${updated.awayGoals} (points reset to null)`);
  } else {
    const created = await prisma.pronostic.create({
      data: {
        participantId: participant.id,
        matchId: match.id,
        homeGoals: HOME_GOALS,
        awayGoals: AWAY_GOALS,
        points: null,
      },
    });

    console.log(`No existing pronostic found — created new one: ${created.homeGoals}-${created.awayGoals}`);
  }

  console.log('Done!');
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
