# Project Structure

## Arborescence

```
tiger-reservation-bot/
├── .kiro/
│   ├── specs/                          # Spécifications fonctionnelles
│   │   └── pronostics-coupe-du-monde/
│   └── steering/                       # Règles de guidage IA
├── data/                               # Données JSON statiques (matchs, équipes, joueurs)
├── prisma/
│   ├── schema.prisma                   # Schéma de la base de données
│   ├── seed.ts                         # Script de seed
│   ├── migrations/                     # Migrations SQL
│   └── dev.db                          # Base SQLite locale
├── scripts/                            # Scripts utilitaires (parse PDF, validation)
├── src/
│   ├── app/
│   │   ├── (auth)/                     # Pages d'authentification
│   │   │   ├── connexion/
│   │   │   └── inscription/
│   │   ├── (main)/                     # Pages principales (layout avec nav)
│   │   │   ├── admin/                  # Pages admin (résultats, participants, export, récompenses)
│   │   │   ├── calendrier/
│   │   │   ├── classement/
│   │   │   ├── pronostics/
│   │   │   └── recompenses/
│   │   ├── api/                        # Route Handlers (REST)
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── classement/
│   │   │   ├── matches/
│   │   │   ├── players/
│   │   │   ├── pronostics/
│   │   │   ├── recompenses/
│   │   │   └── stats/
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Page d'accueil (redirect)
│   │   └── globals.css
│   ├── components/
│   │   ├── admin/                      # Composants admin (result-form)
│   │   ├── ui/                         # Composants UI génériques (button, input, loading)
│   │   └── *.tsx                       # Composants métier (calendrier, pronostic-form, etc.)
│   ├── lib/                            # Logique métier et utilitaires
│   │   ├── prisma.ts                   # Client Prisma singleton
│   │   ├── scoring.ts                  # Calcul des points
│   │   ├── ranking.ts                  # Classement
│   │   ├── lock.ts                     # Verrouillage des pronostics
│   │   ├── validation.ts              # Validation des entrées
│   │   ├── timezone.ts                # Gestion fuseaux horaires
│   │   ├── password.ts               # Hashing bcrypt
│   │   ├── auth-lockout.ts           # Protection brute-force
│   │   ├── authorization.ts          # Contrôle d'accès admin
│   │   ├── pronostic-visibility.ts   # Confidentialité des pronostics
│   │   ├── reward-scoring.ts         # Points récompenses individuelles
│   │   ├── qualification.ts          # Logique de qualification
│   │   ├── group-ranking.ts          # Classement de groupe
│   │   ├── match-sort.ts             # Tri des matchs
│   │   ├── match-status.ts           # Statut des matchs
│   │   ├── stats.ts                  # Statistiques
│   │   └── *.property.test.ts        # Tests property-based associés
│   ├── test/
│   │   └── setup.ts                   # Configuration Vitest
│   ├── types/
│   │   ├── index.ts                   # Types métier
│   │   └── next-auth.d.ts            # Extension types NextAuth
│   ├── auth.ts                        # Configuration NextAuth
│   ├── auth.config.ts                 # Options auth (credentials provider)
│   └── middleware.ts                  # Middleware Next.js (protection routes)
├── package.json
├── next.config.mjs
├── tailwind.config.ts (implicite via postcss)
└── tsconfig.json (implicite)
```

## Conventions

- Les specs suivent le workflow requirements → design → tasks
- Les exigences sont rédigées en français au format EARS (QUAND, SI, TANT QUE, LÀ OÙ)
- Les noms de dossiers et fichiers techniques utilisent le kebab-case
- La documentation et l'interface utilisateur sont en français
- Les tests property-based sont co-localisés avec le module testé (`*.property.test.ts`)
- Les Route Handlers suivent le pattern `src/app/api/<resource>/route.ts`
- Les composants métier sont dans `src/components/`, les génériques dans `src/components/ui/`
- La logique métier pure (sans dépendance Next.js) est dans `src/lib/`
