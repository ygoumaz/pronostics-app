/**
 * Fix script: backfill the team codes for the third-place match (M103) on
 * production.
 *
 * BUG CONTEXT: `propagateKnockoutWinnerInTx` (src/lib/qualification.ts) only
 * ever computed the WINNER of a knockout match and propagated it to
 * "Vainqueur M{N}" placeholders. It never computed the LOSER, so matches
 * whose placeholder is "Perdant M{N}" (i.e. only the third-place match,
 * M103, which references "Perdant M101" / "Perdant M102") never got their
 * homeTeamCode/awayTeamCode populated, even though the semi-finals (M101,
 * M102) already had official results. This left M103 with null team codes,
 * so it never showed teams and pronostics were disabled for it.
 *
 * The propagation code itself has been fixed to also handle "Perdant M{N}"
 * placeholders going forward. This script is a one-off backfill for the
 * production DB so M103 gets its teams retroactively, without needing to
 * re-enter the semi-final results.
 *
 * Run from /app on the Fly.io machine so node_modules resolves correctly:
 *   node /app/fix-third-place-teams.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const THIRD_PLACE_MATCH_NUMBER = 103;

/** Resolve winner/loser team codes for a finished knockout match. */
function resolveWinnerLoser(match) {
  const { officialResult: result, homeTeamCode, awayTeamCode } = match;
  if (!result || !homeTeamCode || !awayTeamCode) return null;

  const { homeGoals, awayGoals, penaltyWinner } = result;

  if (homeGoals > awayGoals) return { winner: homeTeamCode, loser: awayTeamCode };
  if (awayGoals > homeGoals) return { winner: awayTeamCode, loser: homeTeamCode };

  if (penaltyWinner === 'HOME') return { winner: homeTeamCode, loser: awayTeamCode };
  if (penaltyWinner === 'AWAY') return { winner: awayTeamCode, loser: homeTeamCode };

  return null; // Draw with no penalty winner recorded — cannot resolve.
}

async function main() {
  const thirdPlaceMatch = await prisma.match.findUnique({
    where: { matchNumber: THIRD_PLACE_MATCH_NUMBER },
  });

  if (!thirdPlaceMatch) {
    console.error(`ERROR: Match #${THIRD_PLACE_MATCH_NUMBER} (third place) not found.`);
    process.exit(1);
  }

  console.log(
    `Third-place match #${THIRD_PLACE_MATCH_NUMBER} (id=${thirdPlaceMatch.id}): ` +
      `homeTeamCode=${thirdPlaceMatch.homeTeamCode ?? 'null'} (placeholder="${thirdPlaceMatch.homePlaceholder}"), ` +
      `awayTeamCode=${thirdPlaceMatch.awayTeamCode ?? 'null'} (placeholder="${thirdPlaceMatch.awayPlaceholder}")`
  );

  // Parse "Perdant M{N}" placeholders to find the referenced semi-final match numbers.
  const placeholderRe = /^Perdant M(\d+)$/i;
  const homeRef = thirdPlaceMatch.homePlaceholder?.match(placeholderRe);
  const awayRef = thirdPlaceMatch.awayPlaceholder?.match(placeholderRe);

  if (!homeRef || !awayRef) {
    console.error(
      `ERROR: Unexpected placeholders (expected "Perdant M<n>"): home="${thirdPlaceMatch.homePlaceholder}", away="${thirdPlaceMatch.awayPlaceholder}". Aborting.`
    );
    process.exit(1);
  }

  const homeSemiNumber = Number(homeRef[1]);
  const awaySemiNumber = Number(awayRef[1]);

  const [homeSemi, awaySemi] = await Promise.all([
    prisma.match.findUnique({
      where: { matchNumber: homeSemiNumber },
      include: { officialResult: true },
    }),
    prisma.match.findUnique({
      where: { matchNumber: awaySemiNumber },
      include: { officialResult: true },
    }),
  ]);

  if (!homeSemi || !awaySemi) {
    console.error('ERROR: Could not find one or both semi-final matches. Aborting.');
    process.exit(1);
  }

  console.log(
    `Semi-final M${homeSemiNumber}: ${homeSemi.homeTeamCode ?? '?'} vs ${homeSemi.awayTeamCode ?? '?'}, ` +
      `result=${homeSemi.officialResult ? `${homeSemi.officialResult.homeGoals}-${homeSemi.officialResult.awayGoals} (pen=${homeSemi.officialResult.penaltyWinner ?? 'none'})` : 'none'}`
  );
  console.log(
    `Semi-final M${awaySemiNumber}: ${awaySemi.homeTeamCode ?? '?'} vs ${awaySemi.awayTeamCode ?? '?'}, ` +
      `result=${awaySemi.officialResult ? `${awaySemi.officialResult.homeGoals}-${awaySemi.officialResult.awayGoals} (pen=${awaySemi.officialResult.penaltyWinner ?? 'none'})` : 'none'}`
  );

  const homeResolved = resolveWinnerLoser(homeSemi);
  const awayResolved = resolveWinnerLoser(awaySemi);

  if (!homeResolved) {
    console.error(`ERROR: Cannot resolve winner/loser for M${homeSemiNumber} yet (missing result or teams). Aborting.`);
    process.exit(1);
  }
  if (!awayResolved) {
    console.error(`ERROR: Cannot resolve winner/loser for M${awaySemiNumber} yet (missing result or teams). Aborting.`);
    process.exit(1);
  }

  const data = {};

  if (thirdPlaceMatch.homeTeamCode !== homeResolved.loser) {
    data.homeTeamCode = homeResolved.loser;
  }
  if (thirdPlaceMatch.awayTeamCode !== awayResolved.loser) {
    data.awayTeamCode = awayResolved.loser;
  }

  if (Object.keys(data).length === 0) {
    console.log('Third-place match already has the correct teams. Nothing to do.');
    return;
  }

  const updated = await prisma.match.update({
    where: { id: thirdPlaceMatch.id },
    data,
  });

  console.log(
    `Updated third-place match #${THIRD_PLACE_MATCH_NUMBER}: homeTeamCode=${updated.homeTeamCode}, awayTeamCode=${updated.awayTeamCode}`
  );
  console.log('Done!');
}

main()
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
