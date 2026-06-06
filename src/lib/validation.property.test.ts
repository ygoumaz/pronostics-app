import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateEmail,
  validateDisplayName,
  validatePassword,
  validatePasswordConfirmation,
  validateRegistration,
  VALIDATION_LIMITS,
} from "./validation";

// Feature: pronostics-coupe-du-monde, Property 11: Input validation — account creation
//
// Property 11 : Validation des entrées à l'inscription.
// Validates: Requirements 1.1, 1.3, 1.4, 1.6, 1.7
//
// Pour toute chaîne soumise comme e-mail ne respectant pas le format standard
// ou dépassant 254 caractères, OU pour tout nom d'affichage hors 3-30
// caractères ou contenant des caractères interdits, OU pour tout mot de passe
// hors 8-64 caractères, la validation DOIT rejeter la soumission. À l'inverse,
// pour des entrées respectant toutes les contraintes, la validation DOIT
// réussir.

const NUM_RUNS = 100;

// --- Générateurs alignés sur les regex de l'implémentation -----------------

const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const alnumChar = fc.constantFrom(...ALNUM.split(""));
const alnumString = (minLength: number, maxLength: number) =>
  fc.array(alnumChar, { minLength, maxLength }).map((a) => a.join(""));

// E-mail valide : local@domaine.tld, sans espace ni @, longueur << 254.
const validEmail = fc
  .tuple(alnumString(1, 20), alnumString(1, 20), alnumString(2, 10))
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// E-mail invalide : aucun '@' (la regex exige un '@').
const invalidEmailNoAt = alnumString(1, 30);

// E-mail invalide : contient une espace ([^\s@] exclut les espaces).
const invalidEmailWithSpace = fc
  .tuple(alnumString(1, 10), alnumString(1, 10), alnumString(2, 5))
  .map(([local, domain, tld]) => `${local} @${domain}.${tld}`);

// E-mail invalide : longueur > 254 (rejeté avant même le test de format).
const invalidEmailTooLong = fc
  .integer({ min: VALIDATION_LIMITS.EMAIL_MAX_LENGTH + 1, max: 320 })
  .map((n) => "a".repeat(n - 5) + "@a.aa"); // longueur totale = n > 254

// Nom d'affichage : caractères autorisés (lettres/chiffres/espace/_/-).
const DISPLAY_ALLOWED = "abcABCxyz012 _-";
const displayAllowedChar = fc.constantFrom(...DISPLAY_ALLOWED.split(""));
const displayAllowedString = (minLength: number, maxLength: number) =>
  fc.array(displayAllowedChar, { minLength, maxLength }).map((a) => a.join(""));

const validDisplayName = displayAllowedString(
  VALIDATION_LIMITS.DISPLAY_NAME_MIN_LENGTH,
  VALIDATION_LIMITS.DISPLAY_NAME_MAX_LENGTH
);

const displayNameTooShort = displayAllowedString(
  0,
  VALIDATION_LIMITS.DISPLAY_NAME_MIN_LENGTH - 1
);

const displayNameTooLong = displayAllowedString(
  VALIDATION_LIMITS.DISPLAY_NAME_MAX_LENGTH + 1,
  VALIDATION_LIMITS.DISPLAY_NAME_MAX_LENGTH + 20
);

// Nom d'affichage avec un caractère interdit, longueur maintenue dans 3-30.
const disallowedChar = fc.constantFrom("!", "@", ".", "#", "$", "%", "*", "(", ")", "+");
const displayNameBadChar = fc
  .tuple(
    displayAllowedString(
      VALIDATION_LIMITS.DISPLAY_NAME_MIN_LENGTH - 1,
      VALIDATION_LIMITS.DISPLAY_NAME_MAX_LENGTH - 1
    ),
    disallowedChar
  )
  .map(([base, bad]) => base + bad);

// Mots de passe (seule la longueur compte, tous caractères autorisés).
const validPassword = fc.string({
  minLength: VALIDATION_LIMITS.PASSWORD_MIN_LENGTH,
  maxLength: VALIDATION_LIMITS.PASSWORD_MAX_LENGTH,
});
const passwordTooShort = fc.string({
  minLength: 0,
  maxLength: VALIDATION_LIMITS.PASSWORD_MIN_LENGTH - 1,
});
const passwordTooLong = fc.string({
  minLength: VALIDATION_LIMITS.PASSWORD_MAX_LENGTH + 1,
  maxLength: VALIDATION_LIMITS.PASSWORD_MAX_LENGTH + 40,
});

// --- E-mail (Exigences 1.1, 1.6) -------------------------------------------

describe("Property 11: validation e-mail à l'inscription", () => {
  it("accepte tout e-mail bien formé d'au plus 254 caractères", () => {
    fc.assert(
      fc.property(validEmail, (email) => {
        expect(email.length).toBeLessThanOrEqual(
          VALIDATION_LIMITS.EMAIL_MAX_LENGTH
        );
        expect(validateEmail(email)).toEqual({ valid: true });
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette tout e-mail mal formé ou trop long avec EMAIL_INVALID", () => {
    const invalidEmail = fc.oneof(
      invalidEmailNoAt,
      invalidEmailWithSpace,
      invalidEmailTooLong
    );
    fc.assert(
      fc.property(invalidEmail, (email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errorKey).toBe("EMAIL_INVALID");
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// --- Nom d'affichage (Exigences 1.1, 1.7) ----------------------------------

describe("Property 11: validation nom d'affichage à l'inscription", () => {
  it("accepte tout nom de 3-30 caractères du jeu autorisé", () => {
    fc.assert(
      fc.property(validDisplayName, (name) => {
        expect(validateDisplayName(name)).toEqual({ valid: true });
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette tout nom trop court, trop long ou avec caractère interdit avec DISPLAY_NAME_INVALID", () => {
    const invalidDisplayName = fc.oneof(
      displayNameTooShort,
      displayNameTooLong,
      displayNameBadChar
    );
    fc.assert(
      fc.property(invalidDisplayName, (name) => {
        const result = validateDisplayName(name);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errorKey).toBe("DISPLAY_NAME_INVALID");
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// --- Mot de passe (Exigences 1.1, 1.3) -------------------------------------

describe("Property 11: validation longueur mot de passe", () => {
  it("accepte tout mot de passe de 8 à 64 caractères", () => {
    fc.assert(
      fc.property(validPassword, (pw) => {
        expect(validatePassword(pw)).toEqual({ valid: true });
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette tout mot de passe hors 8-64 caractères avec PASSWORD_LENGTH", () => {
    const invalidPassword = fc.oneof(passwordTooShort, passwordTooLong);
    fc.assert(
      fc.property(invalidPassword, (pw) => {
        const result = validatePassword(pw);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errorKey).toBe("PASSWORD_LENGTH");
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// --- Confirmation du mot de passe (Exigences 1.1, 1.4) ---------------------

describe("Property 11: confirmation du mot de passe", () => {
  it("accepte deux chaînes identiques", () => {
    fc.assert(
      fc.property(fc.string(), (pw) => {
        expect(validatePasswordConfirmation(pw, pw)).toEqual({ valid: true });
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette deux chaînes différentes avec PASSWORD_MISMATCH", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (pw, confirm) => {
          fc.pre(pw !== confirm);
          const result = validatePasswordConfirmation(pw, confirm);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.errorKey).toBe("PASSWORD_MISMATCH");
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// --- Inscription composite (Exigences 1.1, 1.3, 1.4, 1.6, 1.7) -------------

describe("Property 11: validation composite de l'inscription", () => {
  it("accepte une inscription dont tous les champs sont valides", () => {
    fc.assert(
      fc.property(
        validEmail,
        validDisplayName,
        validPassword,
        (email, displayName, password) => {
          const result = validateRegistration({
            email,
            displayName,
            password,
            passwordConfirmation: password,
          });
          expect(result).toEqual({ valid: true });
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("rejette l'inscription dès qu'un seul champ viole une contrainte", () => {
    const invalidEmail = fc.oneof(
      invalidEmailNoAt,
      invalidEmailWithSpace,
      invalidEmailTooLong
    );
    const invalidDisplayName = fc.oneof(
      displayNameTooShort,
      displayNameTooLong,
      displayNameBadChar
    );
    const invalidPassword = fc.oneof(passwordTooShort, passwordTooLong);

    fc.assert(
      fc.property(
        validEmail,
        validDisplayName,
        validPassword,
        // 0=email, 1=displayName, 2=password, 3=confirmation
        fc.integer({ min: 0, max: 3 }),
        invalidEmail,
        invalidDisplayName,
        invalidPassword,
        fc.string(),
        (
          email,
          displayName,
          password,
          fieldToBreak,
          badEmail,
          badName,
          badPassword,
          mismatch
        ) => {
          const input = {
            email,
            displayName,
            password,
            passwordConfirmation: password,
          };

          let expectedErrorKey: string;
          switch (fieldToBreak) {
            case 0:
              input.email = badEmail;
              expectedErrorKey = "EMAIL_INVALID";
              break;
            case 1:
              input.displayName = badName;
              expectedErrorKey = "DISPLAY_NAME_INVALID";
              break;
            case 2:
              input.password = badPassword;
              input.passwordConfirmation = badPassword;
              expectedErrorKey = "PASSWORD_LENGTH";
              break;
            default:
              // Confirmation différente du mot de passe.
              fc.pre(mismatch !== password);
              input.passwordConfirmation = mismatch;
              expectedErrorKey = "PASSWORD_MISMATCH";
              break;
          }

          const result = validateRegistration(input);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.errorKey).toBe(expectedErrorKey);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
