import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  applyUpsert,
  pronosticKey,
  rewardKey,
} from "./upsert-store";

// Feature: pronostics-coupe-du-monde, Property 13: Uniqueness constraint

/**
 * Petit ensemble de participants et de matchs/récompenses afin de garantir des
 * collisions de clés fréquentes (sinon chaque upsert porterait sur une clé
 * distincte et la contrainte d'unicité ne serait jamais sollicitée).
 */
const participantIds = ["p1", "p2", "p3"];
const matchIds = ["m1", "m2", "m3"];
const rewardTypes = ["TOP_SCORER", "BEST_PLAYER", "WINNER"];

interface UpsertOp {
  participant: string;
  second: string; // matchId ou rewardType
  value: number; // valeur arbitraire stockée
}

const opArb = (seconds: string[]): fc.Arbitrary<UpsertOp> =>
  fc.record({
    participant: fc.constantFrom(...participantIds),
    second: fc.constantFrom(...seconds),
    value: fc.integer({ min: 0, max: 1_000_000 }),
  });

describe("Property 13: Uniqueness constraint", () => {
  // Validates: Requirements 4.3, 18.4

  it("conserve au plus un pronostic par (participant, match), avec la dernière valeur", () => {
    fc.assert(
      fc.property(
        fc.array(opArb(matchIds), { minLength: 0, maxLength: 50 }),
        (ops) => {
          const store = new Map<string, number>();
          // Référence : dernière valeur upsertée par clé.
          const lastByKey = new Map<string, number>();

          for (const op of ops) {
            const key = pronosticKey(op.participant, op.second);
            applyUpsert(store, key, op.value);
            lastByKey.set(key, op.value);
          }

          // Total d'entrées === nombre de clés distinctes (au plus une par clé).
          const distinctKeys = new Set(
            ops.map((o) => pronosticKey(o.participant, o.second))
          );
          expect(store.size).toBe(distinctKeys.size);

          // Chaque clé distincte a exactement une entrée valant le DERNIER upsert.
          const storeKeys = Array.from(store.keys());
          Array.from(distinctKeys).forEach((key) => {
            const entries = storeKeys.filter((k) => k === key);
            expect(entries.length).toBe(1);
            expect(store.get(key)).toBe(lastByKey.get(key));
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("conserve au plus une prédiction par (participant, rewardType), avec la dernière valeur", () => {
    fc.assert(
      fc.property(
        fc.array(opArb(rewardTypes), { minLength: 0, maxLength: 50 }),
        (ops) => {
          const store = new Map<string, number>();
          const lastByKey = new Map<string, number>();

          for (const op of ops) {
            const key = rewardKey(op.participant, op.second);
            applyUpsert(store, key, op.value);
            lastByKey.set(key, op.value);
          }

          const distinctKeys = new Set(
            ops.map((o) => rewardKey(o.participant, o.second))
          );
          expect(store.size).toBe(distinctKeys.size);

          const storeKeys = Array.from(store.keys());
          Array.from(distinctKeys).forEach((key) => {
            const entries = storeKeys.filter((k) => k === key);
            expect(entries.length).toBe(1);
            expect(store.get(key)).toBe(lastByKey.get(key));
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
