// Logique de verrouillage de compte après tentatives de connexion échouées.
//
// Référence : requirements.md - Exigence 2.3 ; design.md - Property 16
// (Account lockout after failed attempts).
//
// Règles métier (Exigence 2.3) :
// - Après 5 tentatives de connexion échouées consécutives pour une même adresse
//   e-mail, le Système bloque toute nouvelle tentative pour cette adresse
//   pendant 15 minutes.
// - Le blocage s'applique indépendamment de la validité des identifiants : tant
//   que la période de 15 minutes n'est pas écoulée, toute tentative (même avec
//   des identifiants valides) est rejetée.
// - Le compteur de tentatives échouées n'est remis à zéro qu'à l'expiration de
//   la période de blocage de 15 minutes.
//
// La décision de blocage est extraite ici sous forme de fonction PURE
// (`isLockedOut`) afin d'être exercée directement par des tests de propriété,
// sans dépendre d'une base de données réelle. Un mince adaptateur lisant les
// lignes `LoginAttempt` peut déléguer à cette fonction (voir `checkEmailLockout`).

/** Seuil de tentatives échouées consécutives déclenchant le blocage. */
export const FAILED_ATTEMPTS_THRESHOLD = 5;

/** Durée du blocage en millisecondes (15 minutes). */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/**
 * Tentative de connexion telle qu'enregistrée (sous-ensemble du modèle
 * `LoginAttempt` nécessaire à la décision de blocage). Les enregistrements
 * fournis sont supposés concerner une seule adresse e-mail.
 */
export interface LoginAttemptRecord {
  /** `true` si la tentative a réussi, `false` sinon. */
  success: boolean;
  /** Horodatage de la tentative. */
  attemptedAt: Date;
}

/** Résultat de l'évaluation du blocage à un instant donné. */
export interface LockoutStatus {
  /** `true` si l'adresse est actuellement bloquée. */
  locked: boolean;
  /**
   * Instant jusqu'auquel l'adresse reste bloquée (exclu), ou `null` si aucun
   * blocage n'est en vigueur ou si le dernier blocage a expiré.
   */
  lockedUntil: Date | null;
  /**
   * Nombre de tentatives échouées consécutives prises en compte (après
   * application des remises à zéro liées aux blocages expirés).
   */
  consecutiveFailures: number;
}

export interface LockoutOptions {
  /** Seuil de tentatives échouées (défaut : 5). */
  threshold?: number;
  /** Durée du blocage en millisecondes (défaut : 15 minutes). */
  lockoutDurationMs?: number;
}

/**
 * Détermine si une adresse e-mail est bloquée à l'instant `now`, à partir de la
 * liste de ses tentatives de connexion.
 *
 * Algorithme :
 * 1. On ne considère que la suite de tentatives échouées consécutives la plus
 *    récente (toute tentative réussie antérieure interrompt la suite).
 * 2. On parcourt cette suite dans l'ordre chronologique en comptant les échecs.
 *    Dès que le seuil est atteint, un blocage est armé jusqu'à
 *    `(instant du Nᵉ échec) + durée`.
 * 3. Une tentative survenant pendant un blocage actif est ignorée du comptage
 *    (elle est rejetée et n'incrémente pas le compteur). Une tentative survenant
 *    à/après l'expiration du blocage provoque la remise à zéro du compteur
 *    (Exigence 2.3 : remise à zéro uniquement à l'expiration des 15 minutes).
 * 4. Le blocage en vigueur en fin de parcours est comparé à `now`.
 *
 * La fonction est pure : elle ne lit ni ne modifie aucun état externe.
 */
export function isLockedOut(
  attempts: ReadonlyArray<LoginAttemptRecord>,
  now: Date,
  options: LockoutOptions = {}
): LockoutStatus {
  const threshold = options.threshold ?? FAILED_ATTEMPTS_THRESHOLD;
  const lockoutMs = options.lockoutDurationMs ?? LOCKOUT_DURATION_MS;

  // Tri chronologique croissant (sans muter l'entrée).
  const sorted = [...attempts].sort(
    (a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime()
  );

  // Suite d'échecs consécutifs la plus récente : on remonte depuis la fin
  // jusqu'à rencontrer une tentative réussie.
  const trailingFailures: LoginAttemptRecord[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].success) {
      break;
    }
    trailingFailures.unshift(sorted[i]);
  }

  let count = 0;
  let lockUntilMs: number | null = null;

  for (const failure of trailingFailures) {
    const t = failure.attemptedAt.getTime();

    // Un blocage précédent a-t-il expiré avant cet échec ? → remise à zéro.
    if (lockUntilMs !== null && t >= lockUntilMs) {
      count = 0;
      lockUntilMs = null;
    }

    // Tentative survenant pendant un blocage actif : rejetée, non comptée.
    if (lockUntilMs !== null && t < lockUntilMs) {
      continue;
    }

    count += 1;
    if (count >= threshold) {
      // Le Nᵉ échec consécutif arme le blocage pour la durée définie.
      lockUntilMs = t + lockoutMs;
    }
  }

  if (lockUntilMs !== null && now.getTime() < lockUntilMs) {
    return {
      locked: true,
      lockedUntil: new Date(lockUntilMs),
      consecutiveFailures: count,
    };
  }

  // Aucun blocage en vigueur, ou blocage expiré à `now` (compteur réputé remis
  // à zéro à l'expiration de la période de blocage).
  return {
    locked: false,
    lockedUntil: null,
    consecutiveFailures: lockUntilMs !== null ? 0 : count,
  };
}

// ---------------------------------------------------------------------------
// Adaptateur persistant (tâche 3.6)
//
// Les fonctions ci-dessous relient la logique PURE `isLockedOut` au modèle
// Prisma `LoginAttempt`. Elles ne sont utilisées qu'en runtime Node (jamais en
// Edge), notamment depuis le Credentials provider de `src/auth.ts`.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma';

/**
 * Nombre maximum de tentatives récentes chargées pour évaluer le blocage.
 * Largement supérieur au seuil afin que la suite d'échecs consécutifs la plus
 * récente soit toujours capturée, tout en bornant la requête.
 */
const RECENT_ATTEMPTS_LIMIT = 50;

/**
 * Normalise une adresse e-mail de la même façon que le reste du code
 * (inscription, connexion) : suppression des espaces et passage en minuscules.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Charge les tentatives de connexion récentes pour une adresse e-mail, sous la
 * forme attendue par `isLockedOut`. Les lignes sont retournées dans l'ordre
 * chronologique croissant (la fonction pure re-trie de toute façon).
 */
export async function getRecentAttempts(
  email: string
): Promise<LoginAttemptRecord[]> {
  const normalized = normalizeEmail(email);

  const rows = await prisma.loginAttempt.findMany({
    where: { email: normalized },
    orderBy: { attemptedAt: 'desc' },
    take: RECENT_ATTEMPTS_LIMIT,
    select: { success: true, attemptedAt: true },
  });

  // `desc` pour borner aux plus récentes ; on rétablit l'ordre croissant.
  return rows.reverse();
}

/**
 * Évalue si une adresse e-mail est actuellement bloquée, en chargeant ses
 * tentatives récentes puis en déléguant à la logique pure `isLockedOut`.
 */
export async function checkEmailLockout(
  email: string,
  now: Date = new Date()
): Promise<LockoutStatus> {
  const attempts = await getRecentAttempts(email);
  return isLockedOut(attempts, now);
}

/**
 * Enregistre une tentative de connexion (succès ou échec) dans `LoginAttempt`.
 * L'adresse est normalisée pour rester cohérente avec l'évaluation du blocage.
 *
 * Remarque (Exigence 2.3) : enregistrer un succès crée une ligne `success=true`
 * qui interrompt, pour les évaluations FUTURES, la suite d'échecs consécutifs.
 * La remise à zéro liée au blocage de 15 minutes reste encodée dans la logique
 * pure `isLockedOut`.
 */
export async function recordLoginAttempt(
  email: string,
  success: boolean,
  participantId?: string
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      email: normalizeEmail(email),
      success,
      participantId: participantId ?? null,
    },
  });
}
