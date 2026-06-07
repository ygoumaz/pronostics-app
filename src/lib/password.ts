// Utilitaires de hachage de mot de passe.
//
// Référence : requirements.md - Exigence 1.5 ("les mots de passe doivent être
// stockés sous forme chiffrée non réversible") ; design.md - Property 14
// (Password hashing irreversibility).
//
// On centralise ici l'usage de bcrypt (coût 12) afin que la route d'inscription
// et les tests partagent exactement la même logique de hachage/vérification.

import bcrypt from 'bcryptjs';

/** Facteur de coût bcrypt utilisé pour le hachage des mots de passe. */
export const BCRYPT_COST = 12;

/**
 * Hache un mot de passe en clair via bcrypt (coût 12).
 *
 * Le hachage est non réversible : le hash retourné diffère du mot de passe en
 * clair et ne permet pas de le reconstituer (Exigence 1.5).
 */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Vérifie qu'un mot de passe en clair correspond à un hash bcrypt donné.
 *
 * Retourne true si et seulement si `password` est le mot de passe d'origine.
 */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
