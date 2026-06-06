import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { hashPassword, verifyPassword } from "./password";

// Feature: pronostics-coupe-du-monde, Property 14: Password hashing irreversibility

/**
 * Property 14 : le hachage de mot de passe est non réversible et vérifiable.
 *
 * Pour toute chaîne de mot de passe :
 *  1. le hash stocké diffère du mot de passe en clair (Exigence 1.5) ;
 *  2. verifyPassword(password, hash) === true ;
 *  3. verifyPassword(autreChaîne, hash) === false pour une chaîne garantie
 *     différente du mot de passe.
 *
 * bcrypt (coût 12) est volontairement lent : on garde un faible numRuns et un
 * timeout élevé pour exercer réellement le chemin coût 12.
 */
describe("Property 14: Password hashing irreversibility", () => {
  // Validates: Requirements 1.5
  // Mots de passe respectant le domaine attendu (8 à 64 caractères).
  const password = () => fc.string({ minLength: 8, maxLength: 64 });

  it(
    "produit un hash distinct du mot de passe et vérifiable uniquement par le bon mot de passe",
    async () => {
      await fc.assert(
        fc.asyncProperty(password(), async (plain) => {
          const hash = await hashPassword(plain);

          // 1. Le hash diffère du mot de passe en clair (non réversible).
          expect(hash).not.toBe(plain);

          // 2. Le bon mot de passe est vérifié avec succès.
          expect(await verifyPassword(plain, hash)).toBe(true);

          // 3. Une chaîne garantie différente échoue à la vérification.
          const different = plain + "x";
          expect(await verifyPassword(different, hash)).toBe(false);
        }),
        { numRuns: 10 }
      );
    },
    30000
  );
});
