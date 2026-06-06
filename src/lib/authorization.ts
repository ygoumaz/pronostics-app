// Helper d'autorisation ADMIN (pur, testable).
//
// Référence : requirements.md - Exigences 7.4, 14.5, 18.15 ;
// design.md - Property 15 (autorisation admin).
//
// Plusieurs ressources sont RÉSERVÉES À L'ADMINISTRATEUR UNIQUE :
//   - saisie/correction du résultat officiel d'un match (Exigence 7.4) ;
//   - vue administrateur des pronostics des participants / export Excel
//     (Exigence 14.5) ;
//   - désignation du vainqueur d'une récompense (Exigence 18.15).
//
// Dans les route handlers, ce contrôle est effectué « inline » à partir de la
// session NextAuth :
//   - pas de session / pas d'utilisateur          → 401 (INVALID_CREDENTIALS) ;
//   - utilisateur authentifié mais NON admin        → 403 (ADMIN_ONLY) ;
//   - utilisateur authentifié ET admin              → accès autorisé.
//
// Les fonctions ci-dessous MODÉLISENT exactement cette logique inline sous
// forme pure afin de pouvoir la tester (Property 15) sans HTTP ni session
// vivante. Voir :
//   - src/app/api/matches/[id]/result/route.ts
//   - src/app/api/recompenses/[type]/winner/route.ts

/**
 * Forme minimale d'une session pertinente pour la décision d'autorisation.
 * On ne s'intéresse qu'à la présence d'un utilisateur et à son drapeau admin.
 */
export interface AuthSessionLike {
  user?: {
    isAdmin?: boolean;
  };
}

/**
 * Retourne `true` si et seulement si la session correspond à un administrateur
 * authentifié, c'est-à-dire `session.user.isAdmin === true`.
 *
 * Tout autre cas (session absente, utilisateur absent, `isAdmin` falsy ou
 * indéfini) renvoie `false`.
 */
export function canAccessAdminResource(
  session: AuthSessionLike | null | undefined
): boolean {
  return session?.user?.isAdmin === true;
}

/**
 * Résultat d'une vérification d'autorisation admin reproduisant le
 * comportement des route handlers :
 *   - `{ ok: true }`                          → administrateur authentifié ;
 *   - `{ ok: false, status: 401 }`            → ni session ni utilisateur ;
 *   - `{ ok: false, status: 403 }`            → utilisateur authentifié non admin.
 */
export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 };

/**
 * Modélise le contrôle d'accès admin tel qu'implémenté inline dans les routes :
 *   1. Absence de session ou d'utilisateur            → 401 ;
 *   2. Utilisateur authentifié mais non administrateur → 403 (ADMIN_ONLY) ;
 *   3. Administrateur                                  → ok.
 */
export function assertAdmin(
  session: AuthSessionLike | null | undefined
): AdminAuthResult {
  if (!session || !session.user) {
    return { ok: false, status: 401 };
  }
  if (session.user.isAdmin !== true) {
    return { ok: false, status: 403 };
  }
  return { ok: true };
}
