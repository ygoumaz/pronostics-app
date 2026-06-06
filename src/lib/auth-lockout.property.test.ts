import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isLockedOut,
  FAILED_ATTEMPTS_THRESHOLD,
  LOCKOUT_DURATION_MS,
  type LoginAttemptRecord,
} from "./auth-lockout";

// Feature: pronostics-coupe-du-monde, Property 16: Account lockout after failed attempts

/**
 * Property 16: Account lockout after failed attempts
 * Validates: Requirements 2.3
 *
 * Pour toute adresse e-mail, après 5 tentatives de connexion échouées
 * consécutives, le Système DOIT rejeter toute nouvelle tentative pour cette
 * adresse pendant exactement 15 minutes, indépendamment de la validité des
 * identifiants. Le compteur n'est remis à zéro qu'à l'expiration des 15 minutes.
 */

const THRESHOLD = FAILED_ATTEMPTS_THRESHOLD; // 5
const BLOCK_MS = LOCKOUT_DURATION_MS; // 15 minutes

// Base temporelle raisonnable (autour de la Coupe du Monde 2026).
const BASE_MS = new Date("2026-06-11T00:00:00.000Z").getTime();

/**
 * Construit une suite de tentatives échouées consécutives à des instants
 * strictement croissants, à partir de `baseMs` et d'incréments positifs.
 * Retourne les tentatives et l'instant de la dernière (la plus récente).
 */
function buildConsecutiveFailures(
  baseMs: number,
  gaps: number[]
): { attempts: LoginAttemptRecord[]; lastFailureMs: number } {
  const attempts: LoginAttemptRecord[] = [];
  let t = baseMs;
  for (const gap of gaps) {
    t += gap;
    attempts.push({ success: false, attemptedAt: new Date(t) });
  }
  return { attempts, lastFailureMs: t };
}

// Générateur d'écarts (en ms) entre tentatives consécutives : strictement
// positifs et modérés pour garder des instants distincts et ordonnés.
const gap = () => fc.integer({ min: 1, max: 60_000 });

describe("Property 16: Account lockout after failed attempts", () => {
  it("après exactement 5 échecs consécutifs, le compte est bloqué pendant 15 minutes", () => {
    fc.assert(
      fc.property(
        fc.array(gap(), { minLength: THRESHOLD, maxLength: THRESHOLD }),
        // Décalage de `now` dans la fenêtre de blocage [0, 15min).
        fc.integer({ min: 0, max: BLOCK_MS - 1 }),
        (gaps, nowOffset) => {
          const { attempts, lastFailureMs } = buildConsecutiveFailures(
            BASE_MS,
            gaps
          );
          const now = new Date(lastFailureMs + nowOffset);

          const status = isLockedOut(attempts, now);

          // Exigence 2.3 : bloqué pendant 15 minutes après le 5e échec.
          expect(status.locked).toBe(true);
          // Le blocage dure exactement 15 minutes après le dernier échec.
          expect(status.lockedUntil?.getTime()).toBe(lastFailureMs + BLOCK_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("à l'expiration des 15 minutes (now >= dernier échec + 15min), le blocage est levé et le compteur remis à zéro", () => {
    fc.assert(
      fc.property(
        fc.array(gap(), { minLength: THRESHOLD, maxLength: THRESHOLD }),
        // Décalage de `now` à/au-delà de la fin du blocage.
        fc.integer({ min: 0, max: 24 * 60 * 60 * 1000 }),
        (gaps, afterOffset) => {
          const { attempts, lastFailureMs } = buildConsecutiveFailures(
            BASE_MS,
            gaps
          );
          const now = new Date(lastFailureMs + BLOCK_MS + afterOffset);

          const status = isLockedOut(attempts, now);

          // Exigence 2.3 : le blocage de 15 minutes a expiré → plus bloqué.
          expect(status.locked).toBe(false);
          expect(status.lockedUntil).toBeNull();
          // Le compteur n'est remis à zéro qu'à l'expiration de la période.
          expect(status.consecutiveFailures).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("moins de 5 échecs consécutifs ne bloquent jamais le compte", () => {
    fc.assert(
      fc.property(
        fc.array(gap(), { minLength: 0, maxLength: THRESHOLD - 1 }),
        fc.integer({ min: 0, max: 24 * 60 * 60 * 1000 }),
        (gaps, nowOffset) => {
          const { attempts, lastFailureMs } = buildConsecutiveFailures(
            BASE_MS,
            gaps
          );
          // `now` au moment du dernier échec ou après (peu importe).
          const now = new Date(
            (attempts.length > 0 ? lastFailureMs : BASE_MS) + nowOffset
          );

          const status = isLockedOut(attempts, now);

          // Exigence 2.3 : le seuil de 5 n'est pas atteint → pas de blocage.
          expect(status.locked).toBe(false);
          expect(status.lockedUntil).toBeNull();
          expect(status.consecutiveFailures).toBe(attempts.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("pendant le blocage, la décision est indépendante de la validité des identifiants (reste bloqué)", () => {
    fc.assert(
      fc.property(
        fc.array(gap(), { minLength: THRESHOLD, maxLength: THRESHOLD }),
        fc.integer({ min: 0, max: BLOCK_MS - 1 }),
        // Drapeau symbolisant la validité des identifiants présentés ; la
        // fonction de décision ne le prend pas en compte (Exigence 2.3 : la
        // règle de blocage prévaut, indépendamment des identifiants).
        fc.boolean(),
        (gaps, nowOffset, credentialsWouldBeValid) => {
          const { attempts, lastFailureMs } = buildConsecutiveFailures(
            BASE_MS,
            gaps
          );
          const now = new Date(lastFailureMs + nowOffset);

          const status = isLockedOut(attempts, now);

          // Le résultat ne dépend que de l'historique des tentatives, jamais de
          // `credentialsWouldBeValid` : le compte reste bloqué dans tous les cas.
          void credentialsWouldBeValid;
          expect(status.locked).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
