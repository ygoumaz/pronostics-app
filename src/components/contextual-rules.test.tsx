// Tests unitaires des composants d'affichage contextuel des règles (Exigence 17).
//
// On vérifie :
//   - BaremeHint affiche les 3 lignes du barème (≤ 3 lignes — Exigence 17.2/17.3).
//   - LockRuleHint affiche la règle de clôture (1 h avant le premier match —
//     Exigence 17.4).
//   - PointsBreakdown indique pour chaque critère s'il est satisfait et affiche
//     le total correct (Exigence 17.5), cohérent avec calculatePoints.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  BaremeHint,
  LockRuleHint,
  PointsBreakdown,
  LOCK_RULE_TEXT,
} from '@/components/contextual-rules';
import { BAREME_LINES } from '@/components/score-indicator';

describe('BaremeHint', () => {
  it('affiche chaque ligne du barème et ne dépasse pas 3 lignes', () => {
    render(<BaremeHint />);
    expect(BAREME_LINES.length).toBeLessThanOrEqual(3);
    for (const line of BAREME_LINES) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });
});

describe('LockRuleHint', () => {
  it("affiche la règle de clôture 1 h avant le premier match", () => {
    render(<LockRuleHint />);
    expect(screen.getByText(LOCK_RULE_TEXT)).toBeInTheDocument();
    expect(LOCK_RULE_TEXT).toContain('1 heure avant');
  });
});

describe('PointsBreakdown', () => {
  it('score exact : les trois critères satisfaits, total 3 points', () => {
    render(
      <PointsBreakdown
        pronostic={{ homeGoals: 2, awayGoals: 1 }}
        result={{ homeGoals: 2, awayGoals: 1 }}
      />
    );
    expect(screen.getByText(/Bonne issue.*satisfait/)).toBeInTheDocument();
    expect(
      screen.getByText(/Bonne différence de buts.*satisfait/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Score exact.*satisfait/)).toBeInTheDocument();
    expect(screen.getByText(/Total\s*:\s*3\s*points/)).toBeInTheDocument();
  });

  it('bonne issue seule : 1 point, différence et score exact non satisfaits', () => {
    // Pronostic 1-0 (victoire domicile), résultat 3-0 (victoire domicile).
    // Bonne issue oui, mauvaise différence, score inexact.
    render(
      <PointsBreakdown
        pronostic={{ homeGoals: 1, awayGoals: 0 }}
        result={{ homeGoals: 3, awayGoals: 0 }}
      />
    );
    expect(screen.getByText(/Bonne issue.*— satisfait/)).toBeInTheDocument();
    expect(
      screen.getByText(/Bonne différence de buts.*— non satisfait/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Score exact.*— non satisfait/)).toBeInTheDocument();
    expect(screen.getByText(/Total\s*:\s*1\s*point/)).toBeInTheDocument();
  });

  it('prédiction manquée : aucun critère satisfait, total 0 point', () => {
    // Pronostic victoire domicile 1-0, résultat victoire extérieur 0-2.
    render(
      <PointsBreakdown
        pronostic={{ homeGoals: 1, awayGoals: 0 }}
        result={{ homeGoals: 0, awayGoals: 2 }}
      />
    );
    expect(screen.getByText(/Bonne issue.*— non satisfait/)).toBeInTheDocument();
    expect(
      screen.getByText(/Bonne différence de buts.*— non satisfait/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Score exact.*— non satisfait/)).toBeInTheDocument();
    expect(screen.getByText(/Total\s*:\s*0\s*point/)).toBeInTheDocument();
  });
});
