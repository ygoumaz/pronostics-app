// === Types de domaine ===

export interface Participant {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: Date;
}

export interface Match {
  id: string;
  phase: Phase;
  stage: Stage;
  group?: string;              // 'A' à 'L' pour la phase de groupes
  homeTeam?: string;           // null si pas encore déterminé (éliminatoire)
  awayTeam?: string;
  homePlaceholder?: string;    // ex: "1er Groupe A"
  awayPlaceholder?: string;    // ex: "2e Groupe B"
  kickoffTime: Date;           // UTC
  officialResult?: OfficialResult;
}

export type Stage =
  | 'GROUP_DAY_1' | 'GROUP_DAY_2' | 'GROUP_DAY_3'
  | 'ROUND_OF_32' | 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL'
  | 'THIRD_PLACE' | 'FINAL';

export type Phase = 'GROUP' | 'KNOCKOUT';

export type PenaltyWinner = 'HOME' | 'AWAY';

export type RewardType =
  | 'GOLDEN_BOOT' | 'GOLDEN_BALL' | 'GOLDEN_GLOVE'
  | 'BEST_YOUNG' | 'FAIR_PLAY';

export type MatchStatus = 'à venir' | 'en cours' | 'terminé';

export interface OfficialResult {
  id: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  penaltyWinner?: PenaltyWinner; // Uniquement si match nul en éliminatoire
  createdAt: Date;
  updatedAt: Date;
}

export interface Pronostic {
  id: string;
  participantId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  points?: number;             // null tant que pas de résultat officiel
  createdAt: Date;
  updatedAt: Date;
}

export interface RewardPrediction {
  id: string;
  participantId: string;
  rewardType: RewardType;
  playerId?: string | null;   // null pour FAIR_PLAY (récompense d'équipe)
  teamCode?: string | null;   // utilisé pour FAIR_PLAY uniquement
  points?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
}

// === Interfaces du Module Calcul Points ===

export interface ScoringResult {
  correctOutcome: boolean;     // +1 point
  correctDifference: boolean;  // +1 point
  exactScore: boolean;         // +1 point
  totalPoints: number;         // 0 à 3
}

// === Interface du Module Classement Groupes ===

/**
 * Résultat d'un match de phase de groupes utilisé comme entrée pure du calcul
 * de classement. Il associe les buts marqués aux équipes effectivement en jeu,
 * information indispensable que `OfficialResult` (lié uniquement par matchId) ne
 * porte pas directement.
 */
export interface GroupMatchResult {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface GroupStanding {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
}

// === Interface du Module Classement Global ===

export interface RankingEntry {
  participantId: string;
  displayName: string;
  totalPoints: number;
  rank: number;
}
