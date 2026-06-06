// Liste et validation des types de récompenses individuelles.
//
// Référence : requirements.md - Exigence 18 (critère 18.2) ; schema.prisma
// (enum RewardType).
//
// Les 5 récompenses individuelles de la Coupe du Monde 2026 :
//   - GOLDEN_BOOT  : Soulier d'Or (meilleur buteur)
//   - GOLDEN_BALL  : Ballon d'Or (meilleur joueur)
//   - GOLDEN_GLOVE : Gant d'Or (meilleur gardien)
//   - BEST_YOUNG   : Meilleur Jeune Joueur
//   - FAIR_PLAY    : Prix du Fair-Play

import { RewardType } from '@prisma/client';

/** Les 5 types de récompenses individuelles (Exigence 18.2). */
export const REWARD_TYPES: readonly RewardType[] = [
  RewardType.GOLDEN_BOOT,
  RewardType.GOLDEN_BALL,
  RewardType.GOLDEN_GLOVE,
  RewardType.BEST_YOUNG,
  RewardType.FAIR_PLAY,
];

/**
 * Indique si une valeur correspond à un type de récompense valide.
 * Sert à valider le paramètre de route `[type]` (Exigence 18.2).
 */
export function isValidRewardType(value: unknown): value is RewardType {
  return (
    typeof value === 'string' &&
    (REWARD_TYPES as readonly string[]).includes(value)
  );
}
