# Product Overview

Application web de pronostics pour la Coupe du Monde 2026 de football, destinée à un cercle d'amis.

## Fonctionnalités principales

- Création de compte et authentification des participants (email + mot de passe)
- Fermeture des inscriptions par l'admin
- Affichage du calendrier des matchs (fuseau horaire local)
- Saisie de pronostics (score exact) avant le coup d'envoi
- Verrouillage automatique des pronostics au coup d'envoi
- Confidentialité des pronostics avant clôture du match
- Saisie des résultats officiels par un administrateur unique
- Calcul automatique des points :
  - 3 pts : score exact
  - 1 pt : bonne issue (victoire/nul)
  - 0 pt : mauvais pronostic
  - Phase éliminatoire : bonus identique, issue déterminée par tirs au but si nul
- Pronostics récompenses individuelles (Soulier d'or, Ballon d'or, Gant d'or, Meilleur jeune, Fair-play) : 5 pts si correct
- Classement global comparatif entre participants
- Statistiques détaillées par participant
- Export des données (Excel)
- Protection anti brute-force sur la connexion

## Contexte

- Langue de l'interface : français
- Public cible : groupe restreint d'amis
- Un seul administrateur gère les résultats officiels et les récompenses
- 104 matchs au total (48 équipes, groupes A–L)
- Les données de matchs, équipes et joueurs sont pré-chargées via seed Prisma
