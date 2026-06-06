import type { GroupMatchResult, GroupStanding } from '@/types';

/**
 * Module de calcul du classement d'un groupe de la phase de groupes (Exigence 3).
 *
 * La fonction `calculateGroupStandings` est volontairement PURE : elle prend en
 * entrée le nom du groupe (pour traçabilité) et la liste des résultats de
 * matchs déjà associés aux équipes (`GroupMatchResult`), et retourne le
 * classement trié sans aucun accès base de données. Cela la rend directement
 * testable (property test 5.2 / Property 4).
 *
 * Critères de départage appliqués DANS L'ORDRE (Exigences 3.3 et 3.11) :
 *  1. Nombre de points (3 victoire / 1 nul / 0 défaite), décroissant
 *  2. Différence de buts générale, décroissante
 *  3. Nombre de buts marqués (général), décroissant
 *  4. Points en confrontation directe entre les équipes encore à égalité
 *  5. Différence de buts en confrontation directe
 *  6. Buts marqués en confrontation directe
 *  7. Ordre alphabétique croissant du nom d'équipe (départage final, Exigence 3.11)
 *
 * Les positions résultantes sont 1, 2, 3, 4… sans trou.
 */

/**
 * Statistiques cumulées d'une équipe, avant attribution de la position finale.
 */
interface TeamStats {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

/**
 * Construit une statistique d'équipe vierge.
 */
function emptyStats(team: string): TeamStats {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

/**
 * Agrège les statistiques de chaque équipe à partir d'un ensemble de matchs.
 * Seuls les matchs fournis sont pris en compte : pour le classement général, on
 * passe tous les matchs du groupe ; pour la confrontation directe, on ne passe
 * que les matchs joués entre les équipes à égalité.
 */
function aggregateStats(matches: GroupMatchResult[]): Map<string, TeamStats> {
  const statsByTeam = new Map<string, TeamStats>();

  const ensure = (team: string): TeamStats => {
    let stats = statsByTeam.get(team);
    if (stats === undefined) {
      stats = emptyStats(team);
      statsByTeam.set(team, stats);
    }
    return stats;
  };

  for (const match of matches) {
    const home = ensure(match.homeTeam);
    const away = ensure(match.awayTeam);

    home.played += 1;
    away.played += 1;

    home.goalsFor += match.homeGoals;
    home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals;
    away.goalsAgainst += match.homeGoals;

    if (match.homeGoals > match.awayGoals) {
      home.won += 1;
      away.lost += 1;
      home.points += POINTS_WIN;
      away.points += POINTS_LOSS;
    } else if (match.homeGoals < match.awayGoals) {
      away.won += 1;
      home.lost += 1;
      away.points += POINTS_WIN;
      home.points += POINTS_LOSS;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += POINTS_DRAW;
      away.points += POINTS_DRAW;
    }
  }

  for (const stats of Array.from(statsByTeam.values())) {
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
  }

  return statsByTeam;
}

/**
 * Compare deux équipes sur les critères généraux (1 à 3) :
 * points, puis différence de buts, puis buts marqués (tous décroissants).
 * Retourne un nombre négatif si `a` est mieux classée que `b`, positif sinon,
 * 0 si elles sont indépartageables sur ces seuls critères.
 */
function compareOverall(a: TeamStats, b: TeamStats): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
  if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
  return 0;
}

/**
 * Départage un groupe d'équipes à égalité sur les critères généraux en
 * appliquant la confrontation directe (critères 4 à 6) puis, à défaut, l'ordre
 * alphabétique (critère 7).
 *
 * @param tiedTeams équipes encore à égalité (au moins 2)
 * @param allMatches l'intégralité des matchs du groupe
 * @returns les équipes triées dans l'ordre du classement
 */
function breakTie(tiedTeams: string[], allMatches: GroupMatchResult[]): string[] {
  const tiedSet = new Set(tiedTeams);

  // Mini-classement basé uniquement sur les matchs entre équipes à égalité.
  const h2hMatches = allMatches.filter(
    (m) => tiedSet.has(m.homeTeam) && tiedSet.has(m.awayTeam)
  );
  const h2hStats = aggregateStats(h2hMatches);

  const statsFor = (team: string): TeamStats => h2hStats.get(team) ?? emptyStats(team);

  // On regroupe les équipes indépartageables même en confrontation directe pour
  // leur appliquer le départage final (alphabétique) sans les départager à tort.
  const sorted = [...tiedTeams].sort((teamA, teamB) => {
    const byH2h = compareOverall(statsFor(teamA), statsFor(teamB));
    if (byH2h !== 0) return byH2h;
    // Départage final : ordre alphabétique croissant du nom d'équipe.
    return teamA.localeCompare(teamB);
  });

  return sorted;
}

/**
 * Calcule le classement d'un groupe à partir des résultats de ses matchs.
 *
 * @param group identifiant du groupe (ex. « A »), conservé pour la traçabilité
 * @param results résultats des matchs du groupe, associés à leurs équipes
 * @returns le tableau des `GroupStanding` trié par position (1, 2, 3, …)
 */
export function calculateGroupStandings(
  group: string,
  results: GroupMatchResult[]
): GroupStanding[] {
  void group; // L'identifiant de groupe n'influence pas le calcul mais documente l'appel.

  const statsByTeam = aggregateStats(results);
  const allTeams = Array.from(statsByTeam.values());

  // Tri initial sur les critères généraux.
  allTeams.sort(compareOverall);

  // Regroupe les équipes à égalité parfaite sur les critères généraux, puis
  // applique la confrontation directe / l'ordre alphabétique à chaque groupe.
  const orderedTeams: string[] = [];
  let index = 0;
  while (index < allTeams.length) {
    let end = index + 1;
    while (
      end < allTeams.length &&
      compareOverall(allTeams[index], allTeams[end]) === 0
    ) {
      end += 1;
    }

    const tiedGroup = allTeams.slice(index, end).map((s) => s.team);
    if (tiedGroup.length === 1) {
      orderedTeams.push(tiedGroup[0]);
    } else {
      orderedTeams.push(...breakTie(tiedGroup, results));
    }

    index = end;
  }

  return orderedTeams.map((team, i) => {
    const stats = statsByTeam.get(team) ?? emptyStats(team);
    return {
      team: stats.team,
      played: stats.played,
      won: stats.won,
      drawn: stats.drawn,
      lost: stats.lost,
      goalsFor: stats.goalsFor,
      goalsAgainst: stats.goalsAgainst,
      goalDifference: stats.goalDifference,
      points: stats.points,
      position: i + 1,
    };
  });
}
