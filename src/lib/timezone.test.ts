import { describe, expect, it } from 'vitest';

import {
  formatKickoffLocal,
  formatKickoffShort,
  getLocalTimeZone,
} from './timezone';

// Validates: Requirements 3.6 — affichage de la date/heure de Coup_d_envoi dans
// le fuseau horaire local du participant. On force `timeZone` explicitement pour
// rendre les assertions déterministes, indépendamment du fuseau de l'exécuteur.

const UTC_ISO = '2026-06-11T16:00:00.000Z';

describe('formatKickoffLocal', () => {
  it('convertit un instant UTC vers Europe/Paris (UTC+2 en été) en français', () => {
    // 16:00 UTC = 18:00 à Paris (heure d'été).
    const result = formatKickoffLocal(UTC_ISO, { timeZone: 'Europe/Paris' });
    expect(result).toBe('jeudi 11 juin 2026 à 18:00');
  });

  it('convertit le même instant vers un fuseau différent (America/New_York)', () => {
    // 16:00 UTC = 12:00 à New York (EDT, UTC-4).
    const result = formatKickoffLocal(UTC_ISO, {
      timeZone: 'America/New_York',
    });
    expect(result).toBe('jeudi 11 juin 2026 à 12:00');
  });

  it('accepte un objet Date en entrée', () => {
    const result = formatKickoffLocal(new Date(UTC_ISO), {
      timeZone: 'Europe/Paris',
    });
    expect(result).toBe('jeudi 11 juin 2026 à 18:00');
  });

  it('respecte un modèle de format personnalisé', () => {
    const result = formatKickoffLocal(UTC_ISO, {
      timeZone: 'Europe/Paris',
      format: 'HH:mm',
    });
    expect(result).toBe('18:00');
  });
});

describe('formatKickoffShort', () => {
  it('produit une date compacte dans le fuseau cible', () => {
    const result = formatKickoffShort(UTC_ISO, { timeZone: 'Europe/Paris' });
    expect(result).toBe('11/06/2026 18:00');
  });
});

describe('getLocalTimeZone', () => {
  it('retourne une chaîne IANA non vide', () => {
    const tz = getLocalTimeZone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });
});
