# Tech Stack

## Stack

- **Frontend** : Next.js 14 (App Router) + React 18 + Tailwind CSS 3
- **Backend** : Next.js API Routes (Route Handlers)
- **Base de données** : SQLite via Prisma ORM 6
- **Authentification** : NextAuth.js v5 (beta) avec credentials (bcrypt)
- **UI Components** : Radix UI + class-variance-authority (shadcn/ui pattern)
- **Tests** : Vitest + Testing Library + fast-check (property-based)
- **Utilitaires** : date-fns / date-fns-tz (fuseaux horaires), exceljs (export), lucide-react (icônes)

## Contraintes connues

- L'interface doit être en français
- Le calcul des points doit s'exécuter en moins de 5 secondes après la saisie d'un résultat officiel
- Les mots de passe doivent être stockés sous forme chiffrée non réversible (hash bcrypt)
- Gestion des fuseaux horaires pour l'affichage des horaires de match (date-fns-tz)
- Base SQLite — pas de concurrence multi-process en écriture

## Commandes

```shell
# Build
npm run build

# Lint
npm run lint

# Tests (exécution unique)
npm run test

# Tests (mode watch)
npm run test:watch

# Lancement local (dev server)
npm run dev

# Prisma — générer le client
npm run prisma:generate

# Prisma — créer/appliquer une migration
npm run prisma:migrate

# Prisma — seed de données
npm run prisma:seed
```
