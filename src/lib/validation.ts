// Fonctions de validation pures pour la création de compte (inscription).
//
// Ces fonctions sont volontairement pures et exportées individuellement afin
// de pouvoir être exercées directement par des tests de propriété
// (Properties 11 et 19, tâches 3.2 / 3.4 / 3.8).
//
// Référence : requirements.md - Exigence 1 (critères 1, 3, 4, 6, 7).

import { ERROR_MESSAGES, ErrorMessageKey } from './errors';

/** Résultat d'une validation : valide, ou invalide avec une clé de message. */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errorKey: ErrorMessageKey; error: string };

const EMAIL_MAX_LENGTH = 254;
const DISPLAY_NAME_MIN_LENGTH = 3;
const DISPLAY_NAME_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;

// Format standard d'adresse e-mail : partie locale, @, domaine avec au moins
// un point dans le domaine et aucun espace. Volontairement strict mais simple.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Nom d'affichage : uniquement lettres (y compris accentuées Latin-1),
// chiffres, espaces, tirets et underscores. On évite les échappements de
// propriété Unicode (\p{...}) pour rester compatible avec les cibles < ES6.
const DISPLAY_NAME_REGEX = /^[A-Za-z\u00C0-\u024F0-9 _-]+$/;

function invalid(errorKey: ErrorMessageKey): ValidationResult {
  return { valid: false, errorKey, error: ERROR_MESSAGES[errorKey] };
}

const VALID: ValidationResult = { valid: true };

/**
 * Valide une adresse e-mail.
 * Rejette si le format n'est pas conforme ou si la longueur dépasse 254.
 * Exigence 1.1, 1.6.
 */
export function validateEmail(email: unknown): ValidationResult {
  if (typeof email !== 'string') {
    return invalid('EMAIL_INVALID');
  }
  if (email.length > EMAIL_MAX_LENGTH) {
    return invalid('EMAIL_INVALID');
  }
  if (!EMAIL_REGEX.test(email)) {
    return invalid('EMAIL_INVALID');
  }
  return VALID;
}

/**
 * Valide un nom d'affichage.
 * 3 à 30 caractères, uniquement lettres/chiffres/espaces/tirets/underscores.
 * Exigence 1.1, 1.7.
 */
export function validateDisplayName(displayName: unknown): ValidationResult {
  if (typeof displayName !== 'string') {
    return invalid('DISPLAY_NAME_INVALID');
  }
  if (
    displayName.length < DISPLAY_NAME_MIN_LENGTH ||
    displayName.length > DISPLAY_NAME_MAX_LENGTH
  ) {
    return invalid('DISPLAY_NAME_INVALID');
  }
  if (!DISPLAY_NAME_REGEX.test(displayName)) {
    return invalid('DISPLAY_NAME_INVALID');
  }
  return VALID;
}

/**
 * Valide la longueur d'un mot de passe (8 à 64 caractères).
 * Exigence 1.1, 1.3.
 */
export function validatePassword(password: unknown): ValidationResult {
  if (typeof password !== 'string') {
    return invalid('PASSWORD_LENGTH');
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return invalid('PASSWORD_LENGTH');
  }
  return VALID;
}

/**
 * Vérifie que le mot de passe et sa confirmation sont identiques.
 * Exigence 1.1, 1.4.
 */
export function validatePasswordConfirmation(
  password: unknown,
  confirmation: unknown
): ValidationResult {
  if (
    typeof password !== 'string' ||
    typeof confirmation !== 'string' ||
    password !== confirmation
  ) {
    return invalid('PASSWORD_MISMATCH');
  }
  return VALID;
}

export interface RegistrationInput {
  email: unknown;
  displayName: unknown;
  password: unknown;
  passwordConfirmation: unknown;
}

/**
 * Valide l'ensemble des champs d'une inscription dans l'ordre :
 * e-mail, nom d'affichage, longueur du mot de passe, confirmation.
 * Retourne le premier échec rencontré, ou { valid: true }.
 * Exigence 1.1, 1.3, 1.4, 1.6, 1.7.
 */
export function validateRegistration(
  input: RegistrationInput
): ValidationResult {
  const emailResult = validateEmail(input.email);
  if (!emailResult.valid) return emailResult;

  const displayNameResult = validateDisplayName(input.displayName);
  if (!displayNameResult.valid) return displayNameResult;

  const passwordResult = validatePassword(input.password);
  if (!passwordResult.valid) return passwordResult;

  const confirmationResult = validatePasswordConfirmation(
    input.password,
    input.passwordConfirmation
  );
  if (!confirmationResult.valid) return confirmationResult;

  return VALID;
}

export const VALIDATION_LIMITS = {
  EMAIL_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} as const;

// === Validation des scores (buts) ===
//
// Ces fonctions pures servent à valider un nombre de buts saisi pour un
// pronostic (Exigence 4.1, 4.4) ou un résultat officiel (Exigence 7.1, 7.6).
// Elles sont exportées individuellement pour être exercées par le property
// test 8.5 (Property 12 : validation des scores de buts).
//
// Référence : requirements.md - Exigences 4.1, 4.4, 7.1, 7.6 ;
// design.md - Property 12 : Input validation — goal scores.

const GOAL_MIN = 0;
const GOAL_MAX = 99;

/**
 * Indique si une valeur est un nombre de buts valide : un entier compris entre
 * 0 et 99 inclus. Toute valeur non numérique, non entière, négative ou
 * supérieure à 99 est rejetée. Exigence 4.1, 4.4, 7.1, 7.6.
 */
export function isValidGoalCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= GOAL_MIN &&
    value <= GOAL_MAX
  );
}

/**
 * Valide les deux nombres de buts d'un pronostic (ou résultat) : chacun doit
 * être un entier compris entre 0 et 99 inclus, et aucun ne doit être manquant.
 * Retourne { valid: false, errorKey: 'GOALS_INVALID' } sinon. Exigence 4.4, 7.6.
 */
export function validateGoals(
  homeGoals: unknown,
  awayGoals: unknown
): ValidationResult {
  if (!isValidGoalCount(homeGoals) || !isValidGoalCount(awayGoals)) {
    return invalid('GOALS_INVALID');
  }
  return VALID;
}

export const GOAL_LIMITS = {
  GOAL_MIN,
  GOAL_MAX,
} as const;
