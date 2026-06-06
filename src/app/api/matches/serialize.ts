// Sérialisation d'un match pour les réponses API (liste et détail).
//
// Référence : requirements.md - Exigence 3 (critères 3.6, 3.8, 3.9, 3.10).
//
// La forme retournée inclut : phase, étape, groupe, équipes (code + nom si
// connu) ou emplacements à déterminer, heure de coup d'envoi (UTC, ISO 8601),
// statut, et — si présent — le résultat officiel (buts de chaque équipe,
// vainqueur aux TAB).

import type { Match, OfficialResult } from '@prisma/client';
import type { MatchStatus } from '@/types';

/** Match tel que chargé avec sa relation `officialResult`. */
export type MatchWithResult = Match & {
  officialResult: OfficialResult | null;
};

/** Représentation d'une équipe (ou d'un emplacement à déterminer). */
interface TeamSide {
  code: string | null;
  name: string | null;
  placeholder: string | null;
}

/** Résultat officiel sérialisé (buts + éventuel vainqueur aux TAB). */
interface SerializedResult {
  homeGoals: number;
  awayGoals: number;
  penaltyWinner: 'HOME' | 'AWAY' | null;
}

/** Forme JSON d'un match renvoyée par les routes /api/matches. */
export interface SerializedMatch {
  id: string;
  matchNumber: number;
  phase: string;
  stage: string;
  group: string | null;
  homeTeam: TeamSide;
  awayTeam: TeamSide;
  kickoffTime: string; // ISO 8601 (UTC)
  status: MatchStatus;
  officialResult: SerializedResult | null;
}

interface SerializeOptions {
  teamNameByCode: Map<string, string>;
  status: MatchStatus;
}

function buildSide(
  code: string | null,
  placeholder: string | null,
  teamNameByCode: Map<string, string>
): TeamSide {
  return {
    code: code ?? null,
    name: code ? teamNameByCode.get(code) ?? null : null,
    placeholder: placeholder ?? null,
  };
}

/** Convertit un match Prisma en objet JSON prêt pour la réponse API. */
export function serializeMatch(
  match: MatchWithResult,
  { teamNameByCode, status }: SerializeOptions
): SerializedMatch {
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    phase: match.phase,
    stage: match.stage,
    group: match.groupCode ?? null,
    homeTeam: buildSide(match.homeTeamCode, match.homePlaceholder, teamNameByCode),
    awayTeam: buildSide(match.awayTeamCode, match.awayPlaceholder, teamNameByCode),
    kickoffTime: match.kickoffTime.toISOString(),
    status,
    officialResult: match.officialResult
      ? {
          homeGoals: match.officialResult.homeGoals,
          awayGoals: match.officialResult.awayGoals,
          penaltyWinner: match.officialResult.penaltyWinner ?? null,
        }
      : null,
  };
}
