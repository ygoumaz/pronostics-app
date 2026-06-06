# Implementation Plan: Pronostics Coupe du Monde 2026

## Overview

Application web Next.js 14 (TypeScript) permettant à un cercle d'amis de saisir des pronostics sur les matchs de la Coupe du Monde 2026. L'implémentation suit une approche incrémentale : structure projet et modèles de données, puis logique métier (calcul des points, classement, verrouillage), puis interfaces utilisateur, et enfin fonctionnalités admin.

## Tasks

- [x] 1. Initialisation du projet et infrastructure
  - [x] 1.1 Créer le projet Next.js 14 avec TypeScript et configurer les dépendances
    - Initialiser Next.js 14 (App Router) avec TypeScript strict
    - Installer les dépendances : Prisma, NextAuth.js v5, bcrypt, date-fns, date-fns-tz, ExcelJS, Tailwind CSS, shadcn/ui
    - Installer les dépendances de test : Vitest, fast-check, @testing-library/react
    - Configurer `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`
    - Créer la structure de dossiers : `src/app`, `src/lib`, `src/components`, `src/types`, `prisma`
    - _Requirements: 13.1, 13.4, 13.5_

  - [x] 1.2 Définir le schéma Prisma et créer la migration initiale
    - Créer `prisma/schema.prisma` avec tous les modèles : Participant, LoginAttempt, Team, Player, Match, OfficialResult, Pronostic, RewardPrediction, RewardResult, RegistrationStatus
    - Définir les enums : Phase, Stage, PenaltyWinner, RewardType
    - Configurer les index et contraintes d'unicité
    - Générer et exécuter la migration initiale
    - _Requirements: 1.1, 4.3, 18.4_

  - [x] 1.3 Créer les types TypeScript de domaine
    - Créer `src/types/index.ts` avec les interfaces : Participant, Match, OfficialResult, Pronostic, RewardPrediction, Player, ScoringResult, GroupStanding, RankingEntry
    - Définir les types Stage, Phase, RewardType, PenaltyWinner
    - _Requirements: 8.2, 8.5, 9.1_

  - [x] 1.4 Extraire les données des PDFs source et créer les fichiers JSON de référence
    - Lire et parser `World_Cup_2026_standings_en.pdf` (à la racine du projet) pour extraire : les 48 équipes (nom, code ISO, groupe A-L), le calendrier complet de la phase de groupes (matchs, dates, heures UTC), et la structure de la phase éliminatoire (dates, règles de qualification)
    - Lire et parser `SquadLists-English.pdf` (à la racine du projet) pour extraire la liste de tous les joueurs (nom, équipe, poste)
    - Générer `data/teams.json`, `data/matches.json` et `data/players.json` à partir des données extraites
    - Ces fichiers JSON servent de source de vérité pour le script de seed
    - _Requirements: 3.1, 3.2, 18.1_

  - [x] 1.5 Créer le script de seed Prisma à partir des fichiers JSON
    - Créer `prisma/seed.ts` qui lit `data/teams.json`, `data/matches.json` et `data/players.json`
    - Insérer les 48 équipes avec codes ISO, groupes et drapeaux
    - Insérer les 64+ matchs de la phase de groupes (3 journées × 16 matchs)
    - Insérer la structure des matchs éliminatoires (placeholders)
    - Insérer la liste des joueurs (nom, équipe, poste)
    - Configurer le participant administrateur initial
    - _Requirements: 3.1, 3.2, 18.1_

- [x] 2. Checkpoint - Vérifier la structure projet
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Module d'authentification
  - [x] 3.1 Implémenter la création de compte (inscription)
    - Créer `src/lib/validation.ts` avec les fonctions de validation email, mot de passe, nom d'affichage
    - Créer `src/app/api/auth/register/route.ts` : validation des entrées, vérification unicité email, hachage bcrypt (coût 12), création du participant
    - Implémenter la vérification de fermeture des inscriptions (tous les matchs Journée 1 ont un résultat)
    - Utiliser une transaction Prisma pour garantir l'unicité
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.10, 1.11_

  - [x] 3.2 Écrire les property tests pour la validation des entrées (inscription)
    - **Property 11: Input validation — account creation**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.6, 1.7**

  - [x] 3.3 Écrire les property tests pour le hachage de mot de passe
    - **Property 14: Password hashing irreversibility**
    - **Validates: Requirements 1.5**

  - [x] 3.4 Écrire le property test pour le rejet de doublon email
    - **Property 19: Duplicate email rejection**
    - **Validates: Requirements 1.2**

  - [x] 3.5 Implémenter l'authentification NextAuth.js avec Credentials provider
    - Créer `src/app/api/auth/[...nextauth]/route.ts` avec configuration NextAuth.js v5
    - Implémenter le Credentials provider avec vérification bcrypt
    - Configurer les sessions JWT avec timeout de 30 minutes d'inactivité
    - Implémenter le middleware d'authentification pour les routes protégées
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [x] 3.6 Implémenter le verrouillage de compte après tentatives échouées
    - Créer la logique de comptage des tentatives dans `src/lib/auth-lockout.ts`
    - Enregistrer chaque tentative dans LoginAttempt
    - Bloquer après 5 échecs consécutifs pendant 15 minutes
    - Réinitialiser le compteur uniquement après expiration de la période de blocage
    - _Requirements: 2.2, 2.3, 2.7_

  - [x] 3.7 Écrire le property test pour le verrouillage de compte
    - **Property 16: Account lockout after failed attempts**
    - **Validates: Requirements 2.3**

  - [x] 3.8 Écrire le property test pour la fermeture des inscriptions
    - **Property 10: Registration closure**
    - **Validates: Requirements 1.10**

- [x] 4. Module de calcul des points (scoring)
  - [x] 4.1 Implémenter la fonction `calculatePoints` dans `src/lib/scoring.ts`
    - Déterminer l'issue (HOME_WIN, DRAW, AWAY_WIN) pour le pronostic et le résultat
    - Attribuer 1 point pour bonne issue, 1 point pour bonne différence de buts, 1 point pour score exact
    - Gérer le cas des matchs éliminatoires terminés aux TAB (score nul = bonne issue si pronostic nul)
    - Retourner un ScoringResult avec le détail et le total (0 à 3)
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9, 8.10_

  - [x] 4.2 Écrire le property test pour le scoring (barème complet)
    - **Property 1: Scoring correctness (barème complet)**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.7, 8.8**

  - [x] 4.3 Écrire le property test pour le score exact impliquant tous les sous-critères
    - **Property 2: Exact score implies all sub-criteria**
    - **Validates: Requirements 8.4**

  - [x] 4.4 Écrire le property test pour les matchs éliminatoires avec TAB
    - **Property 3: Knockout draw outcome for penalty shootouts**
    - **Validates: Requirements 8.10**

  - [x] 4.5 Écrire les tests unitaires pour le scoring avec exemples spécifiques
    - Tester : 2-1 vs 2-1 → 3 pts, 2-1 vs 3-2 → 2 pts, 2-1 vs 1-0 → 2 pts, 2-1 vs 3-0 → 1 pt, 2-1 vs 0-0 → 0 pt
    - Tester les cas TAB : 1-1 (TAB) vs 2-2 → 2 pts, 1-1 (TAB) vs 0-0 → 1 pt
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.10_

- [x] 5. Module de classement de groupe
  - [x] 5.1 Implémenter `calculateGroupStandings` dans `src/lib/group-ranking.ts`
    - Calculer points (3V/1N/0D), différence de buts, buts marqués pour chaque équipe
    - Implémenter les critères de départage dans l'ordre : points, diff. buts, buts marqués, confrontation directe (points, diff. buts, buts marqués), ordre alphabétique
    - Retourner un tableau de GroupStanding triés par position
    - _Requirements: 3.3, 3.11_

  - [x] 5.2 Écrire le property test pour le classement de groupe
    - **Property 4: Group standings tiebreaker correctness**
    - **Validates: Requirements 3.3, 3.11**

  - [x] 5.3 Implémenter la logique de qualification éliminatoire
    - Détecter quand tous les matchs d'un groupe ont un résultat
    - Calculer le classement du groupe et identifier les qualifiés (1er et 2e)
    - Mettre à jour les matchs éliminatoires avec les équipes qualifiées
    - Utiliser une transaction Prisma pour atomicité
    - _Requirements: 3.3, 3.4, 3.5, 3.12_

- [x] 6. Module de verrouillage et classement global
  - [x] 6.1 Implémenter la logique de verrouillage dans `src/lib/lock.ts`
    - Créer `getStageLockTime(stage)` : premier match de l'étape - 1 heure
    - Créer `isStageOpen(stage)` : vérification heure actuelle vs heure de clôture
    - Créer `getTimeRemaining(stage)` : temps restant avant clôture
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Écrire le property test pour le calcul du temps de clôture
    - **Property 6: Stage lock time calculation**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 6.3 Écrire le property test pour l'application du verrouillage
    - **Property 7: Pronostic lock enforcement**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6**

  - [x] 6.4 Implémenter le classement global dans `src/lib/ranking.ts`
    - Créer `calculateRanking` : somme des points matchs + points bonus récompenses
    - Implémenter le tri par score décroissant, puis alphabétique en cas d'égalité
    - Attribuer les rangs (ex-aequo = même rang = 1 + nombre de participants avec score supérieur)
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6_

  - [x] 6.5 Écrire le property test pour le classement global
    - **Property 9: Ranking calculation**
    - **Validates: Requirements 9.1, 9.2, 9.4, 18.11**

- [x] 7. Checkpoint - Vérifier les modules de logique métier
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. API Routes — Pronostics et résultats
  - [x] 8.1 Implémenter les routes API pour les matchs
    - Créer `src/app/api/matches/route.ts` : GET avec filtrage par étape (stage)
    - Créer `src/app/api/matches/[id]/route.ts` : GET détail du match
    - Implémenter le tri par kickoffTime croissant, puis alphabétique
    - Inclure le statut du match (à venir, en cours, terminé)
    - _Requirements: 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 8.2 Écrire le property test pour le tri des matchs
    - **Property 5: Match sorting invariant**
    - **Validates: Requirements 3.7**

  - [x] 8.3 Écrire le property test pour la détermination du statut de match
    - **Property 20: Match status determination**
    - **Validates: Requirements 3.9**

  - [x] 8.4 Implémenter les routes API pour les pronostics
    - Créer `src/app/api/pronostics/route.ts` : GET mes pronostics
    - Créer `src/app/api/pronostics/[matchId]/route.ts` : PUT saisir/modifier un pronostic
    - Créer `src/app/api/pronostics/participant/[id]/route.ts` : GET pronostics d'un autre participant
    - Valider les entrées (entier 0-99), vérifier le verrouillage, appliquer confidentialité
    - Utiliser la contrainte d'unicité (participantId, matchId)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3_

  - [x] 8.5 Écrire le property test pour la validation des scores
    - **Property 12: Input validation — goal scores**
    - **Validates: Requirements 4.1, 4.4, 7.1, 7.6**

  - [x] 8.6 Écrire le property test pour la confidentialité des pronostics
    - **Property 8: Pronostic confidentiality**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 8.7 Écrire le property test pour la contrainte d'unicité
    - **Property 13: Uniqueness constraint**
    - **Validates: Requirements 4.3, 18.4**

  - [x] 8.8 Implémenter la route API pour la saisie du résultat officiel
    - Créer `src/app/api/matches/[id]/result/route.ts` : POST saisie résultat (admin only)
    - Valider : rôle admin, coup d'envoi atteint, format scores, penaltyWinner si nul en éliminatoire
    - Dans une transaction : enregistrer résultat → calculer points → recalculer classement → vérifier qualification
    - Gérer la correction d'un résultat existant (recalcul complet)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.1, 8.6_

  - [x] 8.9 Écrire le property test pour l'autorisation admin
    - **Property 15: Authorization enforcement**
    - **Validates: Requirements 7.4, 14.5, 18.15**

  - [x] 8.10 Implémenter les routes API pour le classement
    - Créer `src/app/api/classement/route.ts` : GET classement global
    - Inclure rang, nom d'affichage, score total pour chaque participant
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 8.11 Implémenter les routes API pour les statistiques de match
    - Créer `src/app/api/stats/[matchId]/route.ts` : GET résumé statistique des pronostics
    - Compter les scores distincts, trier par fréquence décroissante puis lexicographiquement
    - N'exposer les stats que pour les matchs dont l'étape est clôturée
    - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.6_

  - [x] 8.12 Écrire le property test pour l'agrégation statistique
    - **Property 18: Statistics aggregation correctness**
    - **Validates: Requirements 16.1, 16.2**

- [x] 9. API Routes — Récompenses individuelles
  - [x] 9.1 Implémenter les routes API pour les récompenses
    - Créer `src/app/api/recompenses/route.ts` : GET état des récompenses
    - Créer `src/app/api/recompenses/[type]/route.ts` : PUT saisir pronostic récompense
    - Créer `src/app/api/recompenses/[type]/winner/route.ts` : POST désigner vainqueur (admin)
    - Vérifier verrouillage (clôture Journée 1), unicité (participant, rewardType)
    - Calculer les points bonus (5 si correct, 0 sinon) dans un délai < 5s
    - _Requirements: 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.13, 18.14, 18.15, 18.16_

  - [x] 9.2 Écrire le property test pour le scoring des récompenses
    - **Property 17: Reward prediction scoring**
    - **Validates: Requirements 18.9, 18.10**

- [x] 10. Checkpoint - Vérifier les API routes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Pages d'authentification (UI)
  - [x] 11.1 Créer la page d'inscription `src/app/(auth)/inscription/page.tsx`
    - Formulaire : email, nom d'affichage, mot de passe, confirmation mot de passe
    - Validation côté client, messages d'erreur en français
    - Gestion de la fermeture des inscriptions (message contextuel)
    - Préservation des données saisies en cas d'erreur
    - _Requirements: 1.1, 1.8, 1.9, 1.10, 13.2, 17.6_

  - [x] 11.2 Créer la page de connexion `src/app/(auth)/connexion/page.tsx`
    - Formulaire : email, mot de passe
    - Messages d'erreur : identifiants invalides, compte bloqué, champs obligatoires
    - Redirection vers la page calendrier après connexion réussie
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 13.2_

- [x] 12. Pages principales (UI)
  - [x] 12.1 Créer le layout principal avec navigation
    - Créer `src/app/(main)/layout.tsx` avec menu de navigation
    - Menu permanent sur desktop/tablette, hamburger sur mobile
    - Sections : Calendrier, Pronostics, Classement, Récompenses, (Admin)
    - Distinguer visuellement l'entrée de navigation active
    - _Requirements: 12.4, 12.7, 13.6_

  - [x] 12.2 Créer la page calendrier avec navigation par étape
    - Créer `src/app/(main)/calendrier/page.tsx`
    - Navigation par journée/tour (onglets ou sélecteur)
    - Afficher par défaut la prochaine étape avec matchs à venir
    - Afficher les matchs triés par date, avec drapeaux, statut, heure locale
    - Distinguer les étapes avec pronostics manquants
    - _Requirements: 3.6, 3.7, 3.8, 3.9, 3.10, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.3_

  - [x] 12.3 Créer la page pronostics avec formulaire de saisie
    - Créer `src/app/(main)/pronostics/page.tsx`
    - Composant `PronosticForm` : champs score (0-99), pré-remplissage si existant
    - Afficher le barème contextuel à proximité des champs (3 lignes max)
    - Indicateur de verrouillage et compte à rebours
    - Confirmation de saisie, gestion des erreurs
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 5.7, 5.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 17.2, 17.3, 17.4, 17.5_

  - [x] 12.4 Créer la page classement
    - Créer `src/app/(main)/classement/page.tsx`
    - Tableau : rang, nom d'affichage, score total
    - Clic sur un participant → vue pronostics en lecture seule
    - _Requirements: 9.2, 9.3, 9.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 12.5 Créer la page récompenses individuelles
    - Créer `src/app/(main)/recompenses/page.tsx`
    - Formulaire de sélection de joueurs pour les 5 récompenses
    - Sélecteur filtrable avec recherche parmi les joueurs
    - Indicateur de verrouillage (clôture Journée 1)
    - Affichage des résultats et points bonus si vainqueur désigné
    - _Requirements: 18.2, 18.3, 18.5, 18.6, 18.7, 18.12, 18.13, 18.14_

  - [x] 12.6 Créer le composant de résumé statistique par match
    - Créer `src/components/stats-summary.tsx`
    - Afficher le nombre total de participants ayant pronostiqué
    - Lister les scores distincts avec fréquences, triés par popularité
    - Distinguer visuellement le pronostic du participant connecté
    - Ne s'affiche que si l'étape est clôturée
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 13. Pages administration (UI)
  - [x] 13.1 Créer la page admin de saisie des résultats
    - Créer `src/app/(main)/admin/resultats/page.tsx`
    - Formulaire : scores des deux équipes, sélection vainqueur TAB si nul en éliminatoire
    - Validation : coup d'envoi atteint, format scores, confirmation
    - Affichage des règles contextuelles
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 17.6_

  - [x] 13.2 Créer la page admin des participants et leurs pronostics
    - Créer `src/app/(main)/admin/participants/page.tsx`
    - Liste des participants avec score et rang
    - Vue détaillée : tous les pronostics (y compris non clôturés), résultats, points
    - Regroupement par journée/tour, en-tête avec nom, score, rang
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 13.3 Créer la page admin des récompenses
    - Créer `src/app/(main)/admin/recompenses/page.tsx`
    - Formulaire de désignation du vainqueur pour chaque récompense
    - Sélecteur filtrable de joueurs
    - Correction d'un vainqueur existant
    - _Requirements: 18.8, 18.15, 18.16_

  - [x] 13.4 Créer la page admin d'export Excel
    - Créer `src/app/(main)/admin/export/page.tsx`
    - Créer `src/app/api/admin/export/route.ts` : génération du fichier .xlsx
    - Feuille détaillée : participant × match × pronostic × résultat × points
    - Feuille récapitulative : classement complet
    - Nommage : `pronostics-coupe-du-monde-2026_AAAA-MM-JJ.xlsx`
    - Téléchargement direct au navigateur, gestion des erreurs
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [x] 14. Checkpoint - Vérifier les pages UI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Composants transversaux et finalisation
  - [x] 15.1 Implémenter les utilitaires de fuseau horaire
    - Créer `src/lib/timezone.ts` avec conversion UTC ↔ fuseau local via date-fns-tz
    - Intégrer dans tous les composants affichant des dates/heures
    - _Requirements: 3.6, 12.5_

  - [x] 15.2 Implémenter les indicateurs de chargement et la gestion responsive
    - Créer `src/components/ui/loading-indicator.tsx` pour les opérations > 300ms
    - Vérifier le responsive sur 3 viewports (mobile 375px, tablette 768px, desktop 1280px)
    - S'assurer des zones tactiles minimales de 44×44px sur mobile
    - Vérifier les contrastes WCAG AA (4.5:1 texte normal, 3:1 texte agrandi)
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.7_

  - [x] 15.3 Implémenter l'affichage contextuel des règles
    - Ajouter le barème à proximité des formulaires de pronostics
    - Ajouter la règle de clôture près des indicateurs de verrouillage
    - Ajouter la décomposition des points près des résultats
    - Afficher les messages de refus contextuels à l'endroit de l'action
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 15.4 Connecter tous les composants et vérifier les flux end-to-end
    - Vérifier le flux : inscription → connexion → saisie pronostic → résultat officiel → points → classement
    - Vérifier le flux : qualification éliminatoire (résultats groupe → matchs éliminatoires mis à jour)
    - Vérifier le flux : récompenses (pronostic → vainqueur désigné → points bonus → classement)
    - Vérifier la confidentialité des pronostics (avant/après clôture)
    - _Requirements: 8.1, 9.5, 3.4, 18.11_

- [x] 16. Final checkpoint - Vérification complète
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- Le projet utilise TypeScript tout au long (Next.js 14, Prisma, fast-check)
- Les messages d'erreur et l'interface sont en français
- Le calendrier et la liste des joueurs sont chargés via un script de seed Prisma

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5"] },
    { "id": 3, "tasks": ["3.1", "4.1", "6.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "4.2", "4.3", "4.4", "4.5", "5.1", "6.2", "6.4"] },
    { "id": 5, "tasks": ["3.5", "3.7", "3.8", "5.2", "5.3", "6.3", "6.5"] },
    { "id": 6, "tasks": ["3.6", "8.1", "8.4", "8.10", "8.11"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.5", "8.6", "8.7", "8.8", "8.12", "9.1"] },
    { "id": 8, "tasks": ["8.9", "9.2"] },
    { "id": 9, "tasks": ["11.1", "11.2", "12.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "12.4", "12.5", "12.6"] },
    { "id": 11, "tasks": ["13.1", "13.2", "13.3", "13.4"] },
    { "id": 12, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 13, "tasks": ["15.4"] }
  ]
}
```
