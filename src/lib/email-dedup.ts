// Logique pure de détection de doublon d'adresse e-mail à l'inscription.
//
// Référence : requirements.md - Exigence 1.2 ; design.md - Property 19
// (Duplicate email rejection).
//
// Le route handler d'inscription normalise l'e-mail via `trim().toLowerCase()`
// puis vérifie l'unicité en base. Ces deux opérations — normalisation et
// décision « e-mail déjà pris » — sont extraites ici sous forme de fonctions
// pures afin d'être exercées directement par des tests de propriété, sans
// dépendre d'une base de données réelle.

/**
 * Normalise une adresse e-mail pour la comparaison d'unicité.
 *
 * Reproduit exactement la normalisation appliquée par le route handler :
 * suppression des espaces de début/fin (trim) et passage en minuscules
 * (toLowerCase). La comparaison d'unicité est donc insensible à la casse et
 * aux espaces périphériques. Exigence 1.2 / Property 19.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Indique si une adresse e-mail est déjà associée à un compte existant.
 *
 * La décision se fait sur les valeurs normalisées : `normalizedEmail` est
 * comparé à l'ensemble des e-mails existants, eux aussi normalisés. Tout
 * variant en casse ou avec des espaces périphériques d'un e-mail existant est
 * donc considéré comme un doublon. Exigence 1.2 / Property 19.
 */
export function isEmailTaken(
  normalizedEmail: string,
  existingEmails: ReadonlyArray<string> | ReadonlySet<string>
): boolean {
  const target = normalizeEmail(normalizedEmail);
  const list = Array.isArray(existingEmails)
    ? existingEmails
    : Array.from(existingEmails as ReadonlySet<string>);
  return list.some((existing) => normalizeEmail(existing) === target);
}
