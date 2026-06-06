import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isEmailTaken, normalizeEmail } from "./email-dedup";

// Feature: pronostics-coupe-du-monde, Property 19: Duplicate email rejection

/**
 * Générateur d'adresses e-mail simples mais réalistes (partie locale + domaine
 * avec un point). On reste sur des caractères ASCII de base afin de produire
 * des e-mails normalisables (toLowerCase) de façon déterministe.
 */
const emailArb = (): fc.Arbitrary<string> => {
  const segment = fc
    .stringMatching(/^[a-zA-Z0-9]{1,10}$/)
    .filter((s) => s.length > 0);
  const tld = fc.constantFrom("com", "fr", "net", "org", "io");
  return fc
    .tuple(segment, segment, tld)
    .map(([local, domain, ext]) => `${local}@${domain}.${ext}`);
};

/**
 * Applique une variation de casse et/ou d'espaces périphériques à un e-mail,
 * sans changer son identité normalisée.
 */
const caseWhitespaceVariant = (
  base: string
): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.array(fc.boolean(), { minLength: base.length, maxLength: base.length }),
      fc.stringMatching(/^[ ]{0,3}$/),
      fc.stringMatching(/^[ ]{0,3}$/)
    )
    .map(([flags, leading, trailing]) => {
      const flipped = base
        .split("")
        .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join("");
      return `${leading}${flipped}${trailing}`;
    });

describe("Property 19: Duplicate email rejection", () => {
  // Validates: Requirements 1.2

  it("rejette toute variante de casse/espaces d'un e-mail déjà présent", () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(emailArb(), {
            minLength: 1,
            maxLength: 20,
            selector: (e) => normalizeEmail(e),
          })
          .chain((existing) =>
            // On choisit un e-mail existant puis on en dérive une variante.
            fc
              .nat({ max: existing.length - 1 })
              .chain((idx) =>
                caseWhitespaceVariant(existing[idx]).map((variant) => ({
                  existing,
                  variant,
                }))
              )
          ),
        ({ existing, variant }) => {
          // Exigence 1.2 : un e-mail déjà présent est rejeté quelle que soit
          // sa casse ou ses espaces périphériques.
          expect(isEmailTaken(variant, existing)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepte un e-mail dont la forme normalisée n'existe pas", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(emailArb(), {
          minLength: 0,
          maxLength: 20,
          selector: (e) => normalizeEmail(e),
        }),
        emailArb(),
        (existing, candidate) => {
          const normalizedExisting = new Set(existing.map(normalizeEmail));
          const taken = isEmailTaken(candidate, existing);
          // La décision doit refléter exactement l'appartenance normalisée.
          expect(taken).toBe(normalizedExisting.has(normalizeEmail(candidate)));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("la normalisation est idempotente et insensible à la casse/espaces", () => {
    fc.assert(
      fc.property(emailArb(), (email) => {
        const once = normalizeEmail(email);
        // Idempotence : renormaliser ne change rien.
        expect(normalizeEmail(once)).toBe(once);
        // Insensibilité à la casse et aux espaces périphériques.
        expect(normalizeEmail(`  ${email.toUpperCase()}  `)).toBe(once);
      }),
      { numRuns: 100 }
    );
  });
});
