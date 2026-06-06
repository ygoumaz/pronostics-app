import { describe, expect, it } from 'vitest';

import { parsePlaceholder } from '@/lib/qualification';

describe('parsePlaceholder', () => {
  it('parse « 1er Groupe A » comme vainqueur du groupe A', () => {
    expect(parsePlaceholder('1er Groupe A')).toEqual({ position: 1, group: 'A' });
  });

  it('parse « 2e Groupe B » comme deuxième du groupe B', () => {
    expect(parsePlaceholder('2e Groupe B')).toEqual({ position: 2, group: 'B' });
  });

  it('accepte les variantes « 2ème » et « 2eme »', () => {
    expect(parsePlaceholder('2ème Groupe L')).toEqual({ position: 2, group: 'L' });
    expect(parsePlaceholder('2eme Groupe L')).toEqual({ position: 2, group: 'L' });
  });

  it('est insensible à la casse et tolère les espaces autour', () => {
    expect(parsePlaceholder('  1ER groupe e  ')).toEqual({ position: 1, group: 'E' });
  });

  it('retourne null pour les emplacements de meilleurs troisièmes', () => {
    expect(parsePlaceholder('3e Groupe A/B/C/D/F')).toBeNull();
    expect(parsePlaceholder('3e Groupe E/H/I/J/K')).toBeNull();
  });

  it('retourne null pour un emplacement inconnu ou nul', () => {
    expect(parsePlaceholder(null)).toBeNull();
    expect(parsePlaceholder(undefined)).toBeNull();
    expect(parsePlaceholder('')).toBeNull();
    expect(parsePlaceholder('Vainqueur match 73')).toBeNull();
    expect(parsePlaceholder('1er Groupe Z')).toBeNull();
    expect(parsePlaceholder('1er Groupe AB')).toBeNull();
  });
});
