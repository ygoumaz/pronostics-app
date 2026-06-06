import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  canAccessAdminResource,
  assertAdmin,
  type AuthSessionLike,
} from "./authorization";

// Feature: pronostics-coupe-du-monde, Property 15: Authorization enforcement
//
// Énoncé : pour toute ressource protégée exigeant le rôle administrateur et
// tout utilisateur authentifié dépourvu de ce rôle, l'accès DOIT être refusé.
// En particulier : saisie de résultat, désignation du vainqueur d'une
// récompense, vue admin des participants et export Excel rejettent les
// utilisateurs non admin.
//
// L'enforcement réel est inline dans les route handlers (vérification de
// `session.user.isAdmin`). On modélise la décision d'autorisation sous forme de
// fonction pure (`canAccessAdminResource` / `assertAdmin`) et on la teste ici.

/**
 * Générateur de sessions couvrant l'ensemble de l'espace d'entrée pertinent :
 *   - null / undefined (non authentifié) ;
 *   - { user: undefined } (session sans utilisateur) ;
 *   - { user: { isAdmin: <bool|undefined> , ... } } avec champs additionnels.
 */
const sessionArb: fc.Arbitrary<AuthSessionLike | null | undefined> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({} as AuthSessionLike),
  fc.constant({ user: undefined } as AuthSessionLike),
  // Utilisateur avec isAdmin booléen + champs additionnels aléatoires.
  fc.record({
    isAdmin: fc.boolean(),
    id: fc.string(),
    email: fc.string(),
  }).map((user) => ({ user }) as AuthSessionLike),
  // Utilisateur sans champ isAdmin (donc undefined).
  fc.record({ id: fc.string() }).map((user) => ({ user }) as AuthSessionLike),
  // Cas piégeux : isAdmin truthy mais non === true (ne doit PAS autoriser).
  fc.constantFrom<unknown>(1, "true", "yes", {}, [] as unknown).map(
    (val) => ({ user: { isAdmin: val as unknown as boolean } }) as AuthSessionLike
  )
);

describe("Property 15: Authorization enforcement", () => {
  // Validates: Requirements 7.4, 14.5, 18.15

  it("canAccessAdminResource est true UNIQUEMENT quand user.isAdmin === true", () => {
    fc.assert(
      fc.property(sessionArb, (session) => {
        const granted = canAccessAdminResource(session);
        const expected = session?.user?.isAdmin === true;
        expect(granted).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("refuse l'accès pour null, undefined, sans user, et isAdmin false/undefined", () => {
    expect(canAccessAdminResource(null)).toBe(false);
    expect(canAccessAdminResource(undefined)).toBe(false);
    expect(canAccessAdminResource({})).toBe(false);
    expect(canAccessAdminResource({ user: undefined })).toBe(false);
    expect(canAccessAdminResource({ user: {} })).toBe(false);
    expect(canAccessAdminResource({ user: { isAdmin: false } })).toBe(false);
    // Cas piégeux : valeurs truthy mais non strictement === true.
    expect(
      canAccessAdminResource({ user: { isAdmin: 1 as unknown as boolean } })
    ).toBe(false);
    // Seul cas autorisé.
    expect(canAccessAdminResource({ user: { isAdmin: true } })).toBe(true);
  });

  it("assertAdmin : 401 sans session/user, 403 pour non-admin, ok pour admin", () => {
    fc.assert(
      fc.property(sessionArb, (session) => {
        const result = assertAdmin(session);

        if (!session || !session.user) {
          // Non authentifié → 401.
          expect(result).toEqual({ ok: false, status: 401 });
        } else if (session.user.isAdmin !== true) {
          // Authentifié mais non administrateur → 403.
          expect(result).toEqual({ ok: false, status: 403 });
        } else {
          // Administrateur → autorisé.
          expect(result).toEqual({ ok: true });
        }
      }),
      { numRuns: 100 }
    );
  });

  it("assertAdmin : exemples explicites couvrant les trois régimes", () => {
    expect(assertAdmin(null)).toEqual({ ok: false, status: 401 });
    expect(assertAdmin(undefined)).toEqual({ ok: false, status: 401 });
    expect(assertAdmin({})).toEqual({ ok: false, status: 401 });
    expect(assertAdmin({ user: undefined })).toEqual({ ok: false, status: 401 });
    expect(assertAdmin({ user: { isAdmin: false } })).toEqual({
      ok: false,
      status: 403,
    });
    expect(assertAdmin({ user: {} })).toEqual({ ok: false, status: 403 });
    expect(assertAdmin({ user: { isAdmin: true } })).toEqual({ ok: true });
  });
});
