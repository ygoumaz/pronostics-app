# Requirements Document

## Introduction

Cette fonctionnalité décrit une application web en français destinée à un cercle d'amis souhaitant faire des pronostics sur les matchs de la Coupe du Monde 2026 de football. Chaque participant prédit le résultat des matchs (score exact ou issue) avant le coup d'envoi. L'application calcule automatiquement les points obtenus à partir des résultats officiels et présente un classement global comparatif entre tous les participants.

Le périmètre couvre la gestion des comptes participants, l'affichage du calendrier des matchs, la saisie et le verrouillage des pronostics, le calcul des scores, ainsi que l'affichage du classement global. Le calendrier officiel de la Coupe du Monde 2026 (équipes, groupes, dates, horaires) est pré-chargé dans l'application ; les matchs de la phase à élimination directe sont automatiquement déterminés à partir des résultats de la phase de groupes. Aucun appel réseau externe n'est effectué pour récupérer les matchs à l'exécution. La saisie des résultats officiels des matchs est effectuée manuellement par un administrateur unique de l'application.

Ce document constitue la première étape (exigences) d'un projet greenfield. Aucune contrainte technologique n'est imposée à ce stade : les exigences décrivent le « quoi » et non le « comment ».

## Glossary

- **Système** : L'application de pronostics de la Coupe du Monde dans son ensemble.
- **Participant** : Personne disposant d'un compte et participant aux pronostics.
- **Administrateur** : Participant unique disposant de droits étendus sur l'application, notamment la saisie des résultats officiels des matchs. Le rôle d'Administrateur est attribué lors du déploiement ou via un script technique (CLI, seed de base de données) ; aucune interface graphique dédiée à la promotion d'un participant en Administrateur n'est requise.
- **Phase_de_Groupes** : Première phase de la Coupe du Monde durant laquelle les équipes sont réparties en groupes et s'affrontent au sein de chaque groupe ; le calendrier et les équipes de cette phase sont pré-chargés dans le Système.
- **Phase_Eliminatoire** : Seconde phase de la Coupe du Monde (huitièmes, quarts, demi-finales, match pour la troisième place, finale) dont les matchs sont automatiquement déterminés par le Système à partir des classements de la Phase_de_Groupes. En phase éliminatoire, le Resultat_Officiel correspond au score final après prolongations (hors tirs au but) ; si le match se termine aux TAB, le score enregistré est le nul après prolongations et l'Administrateur désigne le vainqueur pour la qualification.
- **Match** : Rencontre de la Coupe du Monde caractérisée par deux équipes (ou deux emplacements à déterminer pour la Phase_Eliminatoire), une date et une heure de coup d'envoi.
- **Coup_d_envoi** : Date et heure officielles du début d'un match.
- **Pronostic** : Prédiction faite par un participant pour un match, composée du nombre de buts prédits pour chaque équipe.
- **Resultat_Officiel** : Score final réel d'un match, saisi par l'Administrateur.
- **Issue** : Conséquence d'un match parmi trois valeurs : victoire de l'équipe à domicile, match nul, victoire de l'équipe à l'extérieur.
- **Score_Participant** : Total cumulé des points obtenus par un participant sur l'ensemble des matchs disposant d'un Resultat_Officiel.
- **Classement** : Liste ordonnée de tous les participants selon leur Score_Participant.
- **Module_Calcul_Points** : Composant du Système qui attribue les points d'un pronostic à partir du Resultat_Officiel.
- **Barème** : Ensemble des règles définissant le nombre de points attribués selon l'exactitude d'un pronostic.

## Requirements

### Exigence 1 : Création de compte participant

**User Story :** En tant que personne souhaitant pronostiquer, je veux créer un compte, afin de pouvoir participer aux pronostics avec mes amis.

#### Critères d'acceptation

1. QUAND un visiteur soumet une adresse e-mail conforme au format standard (présence d'une partie locale, du symbole @ et d'un nom de domaine) et ne dépassant pas 254 caractères, un nom d'affichage de 3 à 30 caractères composé uniquement de lettres, chiffres, espaces, tirets ou underscores, et un mot de passe de 8 à 64 caractères saisi à l'identique dans les deux champs (mot de passe et confirmation), LE Système DOIT créer un compte Participant.
2. SI un visiteur soumet une adresse e-mail déjà associée à un compte existant, ALORS LE Système DOIT rejeter la demande sans créer de compte et afficher un message indiquant que l'adresse e-mail est déjà utilisée.
3. SI un visiteur soumet un mot de passe comportant moins de 8 caractères ou plus de 64 caractères, ALORS LE Système DOIT rejeter la demande sans créer de compte et afficher un message indiquant la plage de longueur requise (8 à 64 caractères).
4. SI le mot de passe et la confirmation du mot de passe ne sont pas identiques, ALORS LE Système DOIT rejeter la demande sans créer de compte et afficher un message indiquant que les deux champs doivent être identiques.
5. LE Système DOIT stocker le mot de passe sous une forme chiffrée non réversible.
6. SI un visiteur soumet une adresse e-mail dont le format n'est pas conforme au format standard ou dont la longueur dépasse 254 caractères, ALORS LE Système DOIT rejeter la demande sans créer de compte et afficher un message indiquant que le format de l'adresse e-mail est invalide.
7. SI un visiteur soumet un nom d'affichage comportant moins de 3 caractères, plus de 30 caractères, ou contenant des caractères autres que lettres, chiffres, espaces, tirets ou underscores, ALORS LE Système DOIT rejeter la demande sans créer de compte et afficher un message indiquant les contraintes du nom d'affichage (3 à 30 caractères, composé uniquement de lettres, chiffres, espaces, tirets ou underscores).
8. QUAND LE Système crée un compte Participant, LE Système DOIT afficher un message confirmant la création du compte.
9. SI une erreur technique empêche la création du compte, ALORS LE Système DOIT ne pas créer de compte, conserver les données saisies par le visiteur dans le formulaire, et afficher un message indiquant que la création a échoué et invitant à réessayer.
10. QUAND la Journée 1 de la Phase_de_Groupes est terminée (tous les matchs de la Journée 1 disposent d'un Resultat_Officiel), LE Système DOIT bloquer la création de nouveaux comptes et afficher un message indiquant que les inscriptions sont closes. Le blocage NE DOIT PAS s'appliquer avant que la Journée 1 soit effectivement terminée. LE Système DOIT vérifier le statut de complétion de la Journée 1 indépendamment d'un indicateur interne, de sorte que si la Journée 1 est complète, les inscriptions sont bloquées même en cas de défaillance de la mise à jour de l'indicateur.
11. LE Système NE DOIT PAS permettre la suppression d'un compte Participant.

### Exigence 2 : Authentification du participant

**User Story :** En tant que participant, je veux me connecter à mon compte, afin d'accéder à mes pronostics et au classement.

#### Critères d'acceptation

1. QUAND un participant soumet une adresse e-mail et un mot de passe correspondant à un compte existant, LE Système DOIT ouvrir une session pour ce participant et lui accorder l'accès à ses pronostics et au classement.
2. SI un participant soumet une adresse e-mail ou un mot de passe ne correspondant à aucun compte et que le compte n'est pas bloqué, ALORS LE Système DOIT refuser la connexion sans ouvrir de session et afficher un message indiquant que les identifiants sont invalides, sans préciser lequel de l'adresse e-mail ou du mot de passe est erroné.
3. SI un participant soumet des identifiants invalides 5 fois consécutives pour une même adresse e-mail, ALORS LE Système DOIT bloquer toute nouvelle tentative de connexion pour cette adresse pendant 15 minutes et afficher un message indiquant que les tentatives sont temporairement bloquées. Le compteur de tentatives échouées DOIT être remis à zéro uniquement à l'expiration de la période de blocage de 15 minutes. SI le compte est bloqué, la règle de blocage prévaut sur le message d'identifiants invalides.
4. QUAND un participant authentifié demande la déconnexion, LE Système DOIT fermer sa session, réinitialiser explicitement l'état d'authentification (participant non authentifié, session inactive), et exiger une nouvelle authentification pour tout accès ultérieur aux pages de pronostics et de classement.
5. QUAND une session demeure inactive pendant 30 minutes consécutives, LE Système DOIT fermer cette session et exiger une nouvelle authentification pour tout accès ultérieur aux pages de pronostics et de classement.
6. TANT QU'un participant n'est pas authentifié, LE Système DOIT refuser l'affichage des pages de pronostics et de classement et le rediriger vers la page de connexion.
7. SI un participant soumet le formulaire de connexion avec le champ adresse e-mail vide ou le champ mot de passe vide, ALORS LE Système DOIT refuser la soumission et indiquer que les deux champs sont obligatoires.

### Exigence 3 : Calendrier des matchs et génération de la phase éliminatoire

**User Story :** En tant que participant, je veux consulter la liste des matchs de la Coupe du Monde, y compris les matchs de la phase éliminatoire générés automatiquement, afin de savoir sur quels matchs je peux pronostiquer.

#### Critères d'acceptation

1. LE Système DOIT contenir en données pré-chargées l'intégralité du calendrier officiel de la Phase_de_Groupes de la Coupe du Monde 2026 (équipes, groupes, dates et heures de Coup_d_envoi) sans effectuer aucun appel réseau externe à l'exécution.
2. LE Système DOIT contenir en données pré-chargées la structure de la Phase_Eliminatoire (dates, heures de Coup_d_envoi, règles d'affectation des équipes qualifiées) sans effectuer aucun appel réseau externe à l'exécution.
3. QUAND tous les matchs d'un groupe de la Phase_de_Groupes disposent d'un Resultat_Officiel, LE Système DOIT calculer le classement de ce groupe dans un délai maximal de 5 secondes en appliquant les critères de départage suivants dans l'ordre : (a) nombre de points (3 pour une victoire, 1 pour un nul, 0 pour une défaite), (b) différence de buts générale, (c) nombre de buts marqués, (d) points en confrontation directe entre les équipes à égalité, (e) différence de buts en confrontation directe, (f) buts marqués en confrontation directe, et déterminer les équipes qualifiées pour les matchs correspondants de la Phase_Eliminatoire.
4. QUAND les équipes qualifiées pour un match de la Phase_Eliminatoire sont déterminées, LE Système DOIT mettre à jour ce match en y inscrivant les deux équipes qualifiées, rendant ainsi le match disponible pour la saisie de pronostics. TANT QUE la mise à jour du match n'est pas terminée avec succès, LE Système DOIT maintenir les pronostics désactivés pour ce match.
5. TANT QUE les équipes qualifiées pour un match de la Phase_Eliminatoire ne sont pas encore déterminées, LE Système DOIT afficher ce match avec la mention des emplacements à déterminer (par exemple « 1er Groupe A vs 2e Groupe B ») sans permettre la saisie de pronostics pour ce match.
6. LE Système DOIT afficher la liste des matchs, chaque match indiquant les deux équipes (ou les emplacements à déterminer), la date et l'heure de Coup_d_envoi dans le fuseau horaire local du participant.
7. LE Système DOIT afficher les matchs triés par date et heure de Coup_d_envoi croissantes, puis, pour des matchs partageant le même Coup_d_envoi, par ordre alphabétique croissant du nom de l'équipe à domicile (ou de l'emplacement à déterminer).
8. QUAND un participant sélectionne un match, LE Système DOIT afficher le détail du match comprenant les deux équipes (ou emplacements), la phase (groupe ou éliminatoire), la date et l'heure de Coup_d_envoi, ainsi que son statut parmi « à venir », « en cours » et « terminé ».
9. LE Système DOIT déterminer le statut d'un match comme « à venir » tant que son Coup_d_envoi n'est pas atteint, comme « en cours » lorsque son Coup_d_envoi est atteint et qu'aucun Resultat_Officiel n'a été saisi pour ce match, et comme « terminé » lorsqu'un Resultat_Officiel a été saisi pour ce match.
10. LÀ OÙ un Resultat_Officiel a été saisi pour un match, LE Système DOIT afficher, avec le détail du match, le nombre de buts de chaque équipe enregistré dans ce Resultat_Officiel.
11. SI deux équipes ou plus restent à égalité après application de tous les critères de départage définis au critère 3, ALORS LE Système DOIT les départager par ordre alphabétique croissant du nom d'équipe pour déterminer leur position dans le classement du groupe.
12. SI une erreur technique empêche le calcul du classement d'un groupe, ALORS LE Système DOIT conserver inchangés les matchs de la Phase_Eliminatoire concernés, ne qualifier aucune équipe pour ces matchs, et afficher un message d'erreur uniquement lorsqu'une erreur technique survient réellement, indiquant que le calcul du classement a échoué et invitant l'Administrateur à vérifier les résultats saisis.

### Exigence 4 : Saisie d'un pronostic

**User Story :** En tant que participant, je veux saisir un pronostic de score pour un match, afin de marquer des points selon l'exactitude de ma prédiction.

#### Critères d'acceptation

1. QUAND un participant authentifié soumet, pour chaque équipe d'un match dont le Coup_d_envoi n'est pas atteint, un nombre de buts entier compris entre 0 et 99 inclus, LE Système DOIT enregistrer le Pronostic pour ce participant et ce match.
2. QUAND un participant modifie un Pronostic existant avant le Coup_d_envoi du match concerné, LE Système DOIT remplacer le Pronostic précédent par la nouvelle valeur.
3. LE Système DOIT conserver au plus un Pronostic par participant et par match.
4. SI un participant soumet, pour une équipe, un nombre de buts non entier, négatif, supérieur à 99, ou manquant pour l'une des deux équipes, ALORS LE Système DOIT rejeter le Pronostic sans l'enregistrer, conserver les valeurs saisies par le participant dans le formulaire, et afficher un message indiquant le format attendu (nombre entier compris entre 0 et 99 inclus pour chaque équipe).
5. QUAND LE Système enregistre ou remplace un Pronostic, LE Système DOIT afficher un message confirmant la prise en compte du Pronostic.
6. QUAND un participant authentifié accède au formulaire de saisie d'un match pour lequel il possède déjà un Pronostic enregistré, LE Système DOIT pré-remplir le formulaire avec les valeurs du Pronostic existant.

### Exigence 5 : Verrouillage des pronostics

**User Story :** En tant que participant, je veux que les pronostics soient figés 1 heure avant le début de chaque phase, afin que personne ne puisse modifier sa prédiction en ayant connaissance des résultats précédents.

#### Critères d'acceptation

1. LE Système DOIT verrouiller les pronostics par étape de la compétition : tous les pronostics d'une même étape (Journée 1, Journée 2, Journée 3, huitièmes de finale, quarts de finale, demi-finales, match pour la troisième place et finale) sont clôturés simultanément.
2. LE Système DOIT fixer l'heure de clôture d'une étape à 1 heure avant le Coup_d_envoi du premier match de cette étape.
3. TANT QUE l'heure de clôture d'une étape n'est pas atteinte, LE Système DOIT permettre la saisie et la modification des Pronostics pour tous les matchs de cette étape.
4. QUAND l'heure de clôture d'une étape est atteinte, LE Système DOIT verrouiller l'ensemble des pronostics associés à tous les matchs de cette étape de sorte qu'aucun Pronostic ne puisse être créé, modifié ou supprimé pour ces matchs.
5. SI un participant tente de modifier un Pronostic existant pour un match dont l'étape est clôturée, ALORS LE Système DOIT rejeter l'opération de modification, conserver sans modification le Pronostic déjà enregistré, et afficher un message indiquant que les pronostics de cette étape sont clôturés.
6. SI un participant tente d'enregistrer un nouveau Pronostic pour un match dont l'étape est clôturée et qu'aucun Pronostic n'existe pour ce participant et ce match, ALORS LE Système DOIT rejeter l'opération sans créer de Pronostic et afficher un message indiquant que les pronostics de cette étape sont clôturés.
7. LE Système DOIT afficher pour chaque étape l'état de verrouillage des pronostics comme « ouvert » tant que l'heure de clôture n'est pas atteinte, et comme « clôturé » dès qu'elle est atteinte.
8. LE Système DOIT afficher pour chaque étape ouverte le temps restant avant la clôture (compte à rebours ou date/heure de clôture).

### Exigence 6 : Confidentialité des pronostics avant clôture

**User Story :** En tant que participant, je veux que mes pronostics restent privés jusqu'au coup d'envoi, afin que les autres participants ne puissent pas copier ma prédiction.

#### Critères d'acceptation

1. TANT QUE la date et l'heure du Coup_d_envoi d'un match ne sont pas atteintes, LE Système DOIT masquer aux autres participants le nombre de buts prédits par un participant dans son Pronostic pour ce match, sans révéler si un Pronostic a été enregistré ou non pour ce participant.
2. QUAND la date et l'heure du Coup_d_envoi d'un match sont atteintes, LE Système DOIT rendre visible à tous les participants le nombre de buts prédits par chaque participant ayant enregistré un Pronostic pour ce match, et indiquer l'absence de Pronostic uniquement pour les participants n'en ayant pas enregistré.
3. QUAND un participant consulte ses propres pronostics, LE Système DOIT afficher le nombre de buts prédits dans son Pronostic quel que soit l'état de verrouillage du match.

### Exigence 7 : Saisie du résultat officiel d'un match

**User Story :** En tant qu'administrateur, je veux saisir le résultat officiel d'un match, afin que les points des participants soient calculés.

#### Critères d'acceptation

1. QUAND l'Administrateur saisit, pour chaque équipe d'un match dont le Coup_d_envoi est atteint ou dépassé, un nombre de buts entier compris entre 0 et 99 inclus, LE Système DOIT enregistrer ce Resultat_Officiel.
2. LÀ OÙ un match appartient à la Phase_Eliminatoire et que le Resultat_Officiel saisi est un score nul (même nombre de buts pour les deux équipes), LE Système DOIT exiger de l'Administrateur qu'il désigne le vainqueur aux tirs au but parmi les deux équipes du match.
3. QUAND l'Administrateur corrige un Resultat_Officiel existant, LE Système DOIT remplacer le résultat précédent et recalculer les points de tous les pronostics associés à ce match.
4. SI un participant n'ayant pas le rôle d'Administrateur tente de saisir un Resultat_Officiel, ALORS LE Système DOIT refuser l'opération, n'enregistrer aucun Resultat_Officiel, et afficher un message indiquant que l'opération est réservée à l'Administrateur.
5. SI l'Administrateur soumet un Resultat_Officiel pour un match dont le Coup_d_envoi n'est pas encore atteint, ALORS LE Système DOIT rejeter la saisie, conserver l'éventuel Resultat_Officiel déjà enregistré, et afficher un message indiquant que le Coup_d_envoi du match n'est pas encore atteint.
6. SI l'Administrateur soumet, pour une équipe, un nombre de buts non entier, négatif, supérieur à 99, ou manquant pour l'une des deux équipes, ALORS LE Système DOIT rejeter la saisie du Resultat_Officiel et afficher un message indiquant le format attendu.
7. SI l'Administrateur soumet un score nul pour un match de la Phase_Eliminatoire sans désigner le vainqueur aux tirs au but, ALORS LE Système DOIT rejeter la saisie et afficher un message indiquant que le vainqueur aux tirs au but doit être sélectionné.
8. QUAND LE Système enregistre ou remplace un Resultat_Officiel, LE Système DOIT afficher un message confirmant l'enregistrement du résultat.
9. QUAND un Resultat_Officiel avec vainqueur aux TAB est enregistré pour un match de la Phase_Eliminatoire, LE Système DOIT utiliser ce vainqueur pour déterminer l'équipe qualifiée au tour suivant (conformément à l'Exigence 3).

### Exigence 8 : Calcul des points d'un pronostic

**User Story :** En tant que participant, je veux que mes points soient calculés automatiquement selon un barème clair, afin de connaître ma performance de façon équitable et reproductible.

#### Critères d'acceptation

1. QUAND un Resultat_Officiel est enregistré ou corrigé pour un match, LE Module_Calcul_Points DOIT calculer, dans un délai maximal de 5 secondes, les points de chaque Pronostic associé à ce match selon le Barème, en remplaçant toute valeur de points précédemment attribuée pour ce match.
2. LE Barème DOIT attribuer 1 point si le Pronostic prédit la bonne issue du match (bon vainqueur, ou nul trouvé si le résultat officiel est nul).
3. LE Barème DOIT attribuer 1 point supplémentaire si le Pronostic prédit la bonne différence de buts entre les deux équipes (en valeur absolue), indépendamment du score exact.
4. LE Barème DOIT attribuer 1 point supplémentaire si le Pronostic correspond exactement au Resultat_Officiel pour les deux équipes (score exact). Un score exact satisfait automatiquement les critères de bonne issue et de bonne différence de buts.
5. LE Module_Calcul_Points DOIT attribuer à chaque Pronostic évalué un total de points compris entre 0 et 3 inclus, résultant de la somme des critères 2, 3 et 4.
6. SI un participant n'a enregistré aucun Pronostic pour un match disposant d'un Resultat_Officiel, ALORS LE Module_Calcul_Points DOIT attribuer 0 point à ce participant pour ce match.
7. LE Module_Calcul_Points DOIT attribuer un nombre de points identique à deux pronostics identiques évalués avec un même Resultat_Officiel.
8. LE Module_Calcul_Points DOIT déterminer l'Issue d'un Pronostic ou d'un Resultat_Officiel comme « victoire de l'équipe à domicile » si le nombre de buts de l'équipe à domicile est supérieur à celui de l'équipe à l'extérieur, comme « match nul » si les deux nombres de buts sont égaux, et comme « victoire de l'équipe à l'extérieur » si le nombre de buts de l'équipe à l'extérieur est supérieur à celui de l'équipe à domicile.
9. LÀ OÙ un match appartient à la Phase_Eliminatoire, LE Resultat_Officiel pris en compte pour le calcul des points DOIT être le score final après prolongations (hors tirs au but). SI le match se termine aux tirs au but, LE Resultat_Officiel DOIT être le score nul à la fin des prolongations.
10. LÀ OÙ un match de la Phase_Eliminatoire se termine aux tirs au but (Resultat_Officiel nul), un Pronostic prédisant un score nul DOIT être considéré comme ayant trouvé la bonne issue (1 point pour le critère 2).

### Exigence 9 : Calcul du score cumulé et du classement

**User Story :** En tant que participant, je veux voir le classement global, afin de comparer ma performance à celle de tous les autres participants.

#### Critères d'acceptation

1. LE Système DOIT calculer le Score_Participant d'un participant comme la somme des points attribués à ses pronostics sur l'ensemble des matchs disposant d'un Resultat_Officiel, cette somme valant 0 lorsque aucun match ne dispose encore d'un Resultat_Officiel.
2. QUAND un participant consulte le Classement, LE Système DOIT afficher la liste de tous les participants ordonnée par Score_Participant décroissant, chaque entrée indiquant le rang, le nom d'affichage et le Score_Participant du participant.
3. QUAND un participant sélectionne un autre participant dans le Classement, LE Système DOIT afficher la vue en lecture seule des pronostics de ce participant (conformément à l'Exigence 11).
4. LÀ OÙ plusieurs participants possèdent un Score_Participant identique, LE Système DOIT leur attribuer un rang identique égal à un plus le nombre de participants ayant un Score_Participant strictement supérieur, et les afficher par ordre alphabétique croissant de nom d'affichage. Les participants ayant des Score_Participant différents DOIVENT toujours avoir des rangs différents.
5. QUAND un Resultat_Officiel est enregistré ou corrigé, LE Système DOIT recalculer le Score_Participant de chaque participant et mettre à jour le Classement dans un délai maximal de 5 secondes suivant l'enregistrement ou la correction.
6. QUAND le Score_Participant d'au moins un participant change, LE Système DOIT mettre à jour les rangs de tous les participants conformément à la règle d'attribution de rang définie au critère 4.

### Exigence 10 : Affichage des résultats et points par match pour le participant

**User Story :** En tant que participant, je veux voir clairement pour chaque match terminé le score réel à côté de mon pronostic et les points obtenus, afin de suivre ma performance match par match.

#### Critères d'acceptation

1. LÀ OÙ un Resultat_Officiel a été saisi pour un match, LE Système DOIT afficher dans un même bloc visuel regroupé : les deux équipes du match, le Pronostic du participant (nombre de buts prédits pour chaque équipe, ou la mention « aucun pronostic » si aucun Pronostic n'a été enregistré), le Resultat_Officiel (nombre de buts réels pour chaque équipe), et les points obtenus par le participant pour ce match (valeur numérique parmi 0, 1, 2 et 3).
2. LE Système DOIT distinguer visuellement le Pronostic du participant du Resultat_Officiel au moyen d'un libellé explicite associé à chaque valeur (par exemple « Mon pronostic » et « Résultat ») de sorte qu'un utilisateur puisse identifier sans ambiguïté laquelle des deux valeurs est le pronostic et laquelle est le résultat officiel.
3. LÀ OÙ un Resultat_Officiel a été saisi pour un match, LE Système DOIT afficher un indicateur visuel distinct pour chacun des quatre niveaux de réussite du pronostic : score exact (3 points), bonne différence de buts (2 points), bonne issue seule (1 point), ou mauvaise prédiction (0 point), en utilisant une différenciation visuelle perceptible (couleur, icône ou forme distincte) pour chaque niveau.
4. QUAND un participant consulte la liste de ses matchs, LE Système DOIT afficher son Score_Participant total cumulé en en-tête ou en pied de liste.
5. TANT QU'un match ne dispose pas de Resultat_Officiel, LE Système DOIT afficher uniquement le Pronostic du participant (nombre de buts prédits pour chaque équipe, ou la mention « aucun pronostic ») sans zone de score réel ni de points.
6. SI aucun match ne dispose d'un Resultat_Officiel au moment où le participant consulte la liste de ses matchs, ALORS LE Système DOIT afficher le Score_Participant à 0 et ne présenter aucun indicateur de réussite pour l'ensemble des matchs. Ce comportement s'applique uniquement durant la consultation active de la liste des matchs.

### Exigence 11 : Consultation des pronostics d'un autre participant

**User Story :** En tant que participant, je veux consulter les pronostics d'un autre participant depuis le classement, afin de comparer ses prédictions aux miennes après la clôture.

#### Critères d'acceptation

1. QUAND un participant sélectionne un autre participant dans le Classement, LE Système DOIT afficher une vue en lecture seule présentant les pronostics de ce participant pour tous les matchs dont la clôture est atteinte.
2. LE Système DOIT afficher, pour chaque match clôturé, le Pronostic du participant consulté (nombre de buts prédits pour chaque équipe, ou « aucun pronostic »), le Resultat_Officiel s'il existe (sinon afficher uniquement le Pronostic sans zone de résultat ni de points), et les points obtenus pour ce match lorsque le Resultat_Officiel est disponible.
3. LE Système DOIT afficher en en-tête de la vue le nom d'affichage du participant consulté, son Score_Participant total et son rang dans le Classement.
4. TANT QUE la clôture d'un match n'est pas atteinte, LE Système NE DOIT PAS afficher le Pronostic de ce participant pour ce match, ni indiquer si un Pronostic a été enregistré ou non.
5. LE Système DOIT regrouper les matchs par journée de la Phase_de_Groupes et par tour de la Phase_Eliminatoire, dans l'ordre chronologique croissant.
6. LE Système NE DOIT PAS permettre la modification des pronostics depuis cette vue (lecture seule uniquement).

### Exigence 12 : Navigation par journée et par phase

**User Story :** En tant que participant, je veux naviguer facilement entre les différentes journées de la phase de groupes et les tours de la phase éliminatoire, afin de ne pas être submergé par tous les matchs sur une seule page.

#### Critères d'acceptation

1. LE Système DOIT organiser les matchs de la Phase_de_Groupes en 3 journées distinctes (Journée 1, Journée 2, Journée 3), chaque journée correspondant à un tour de rencontres au sein de chaque groupe de 4 équipes.
2. LE Système DOIT organiser les matchs de la Phase_Eliminatoire en tours distincts : huitièmes de finale, quarts de finale, demi-finales, match pour la troisième place et finale.
3. LE Système DOIT afficher un seul tour ou une seule journée à la fois, sans mélanger les matchs de journées ou de tours différents sur la même vue.
4. LE Système DOIT proposer un élément de navigation visible en permanence (onglets, sélecteur ou menu) listant dans l'ordre chronologique les 3 journées de la Phase_de_Groupes suivies des 5 tours de la Phase_Eliminatoire, et permettant au participant de passer de l'un à l'autre sans rechargement complet de la page.
5. QUAND un participant sélectionne une journée ou un tour dans l'élément de navigation, LE Système DOIT remplacer le contenu affiché par les matchs de la journée ou du tour sélectionné dans un délai maximal de 1 seconde.
6. QUAND un participant accède au calendrier des matchs, LE Système DOIT afficher par défaut la journée ou le tour contenant le prochain match (par ordre chronologique de Coup_d_envoi) dont le Coup_d_envoi n'est pas encore atteint ; SI aucun match ne possède un Coup_d_envoi futur, ALORS LE Système DOIT afficher le dernier tour par ordre chronologique (finale).
7. LE Système DOIT distinguer visuellement dans l'élément de navigation la journée ou le tour actuellement affiché par rapport aux autres entrées de navigation, de sorte que l'entrée active soit immédiatement identifiable.
8. LE Système DOIT distinguer visuellement dans l'élément de navigation les journées ou tours contenant au moins un match dont le Coup_d_envoi n'est pas atteint et pour lequel le participant n'a pas encore enregistré de Pronostic, par rapport aux journées ou tours où tous les matchs ouverts possèdent un Pronostic enregistré par ce participant.

### Exigence 13 : Interface responsive et qualité visuelle

**User Story :** En tant que participant, je veux utiliser l'application aussi bien sur mon téléphone que sur mon ordinateur, avec une interface soignée et professionnelle, afin de profiter d'une expérience agréable quel que soit mon appareil.

#### Critères d'acceptation

1. LE Système DOIT afficher une interface fonctionnelle et lisible (taille de police minimale de 16 pixels sur mobile et 14 pixels sur bureau) sur les écrans de bureau (largeur supérieure ou égale à 1024 pixels), les écrans de tablette (largeur comprise entre 768 et 1023 pixels) et les écrans mobiles (largeur comprise entre 320 et 767 pixels) sans défilement horizontal.
2. LE Système DOIT adapter la disposition des composants (navigation, formulaires, listes, classement) à la largeur de l'écran en utilisant un design responsive, de sorte que tous les éléments interactifs soient accessibles au toucher sur mobile (zone tactile minimale de 44 × 44 pixels).
3. LE Système DOIT afficher les drapeaux officiels des équipes participantes sous forme d'images intégrées à l'application (pas de chargement externe) à côté du nom de chaque équipe dans le calendrier, les pronostics et le détail des matchs.
4. LE Système DOIT utiliser une charte graphique cohérente comprenant une palette de couleurs définie, une typographie lisible, des espacements réguliers et des contrastes conformes au niveau AA des WCAG 2.1 (ratio minimum de 4,5:1 pour le texte normal et 3:1 pour le texte agrandi).
5. LE Système DOIT afficher les pages dans un délai maximal de 2 secondes sur une connexion 4G standard (débit descendant de 10 Mbps) pour un contenu ne nécessitant pas d'appel réseau externe.
6. LE Système DOIT proposer une navigation avec un menu principal visible en permanence sur bureau et tablette, et un menu rétractable (hamburger) sur mobile, permettant d'accéder à toutes les sections principales (calendrier, pronostics, classement, compte) en un maximum de 2 interactions depuis n'importe quelle page.
7. SI une opération nécessite un délai de traitement supérieur à 300 millisecondes, ALORS LE Système DOIT afficher un indicateur de chargement visuel (animation ou icône de progression) jusqu'à la fin de l'opération.

### Exigence 14 : Vue administration des pronostics par participant

**User Story :** En tant qu'administrateur, je veux consulter le détail des pronostics de chaque participant (passés, en cours et à venir), afin de suivre l'activité de chacun et vérifier la cohérence des données.

#### Critères d'acceptation

1. QUAND l'Administrateur accède à la vue d'administration des pronostics, LE Système DOIT afficher la liste de tous les participants avec leur nom d'affichage et leur Score_Participant, triée par Score_Participant décroissant puis par ordre alphabétique croissant du nom d'affichage en cas d'égalité.
2. QUAND l'Administrateur sélectionne un participant dans la liste, LE Système DOIT afficher l'ensemble des matchs avec, pour chaque match, le Pronostic saisi par ce participant (ou la mention « aucun pronostic »), le Resultat_Officiel s'il existe (ou la mention « non disponible » dans le cas contraire), et les points obtenus pour ce match (ou la mention « — » si aucun Resultat_Officiel n'a été saisi pour ce match).
3. LE Système DOIT afficher les matchs du participant sélectionné regroupés par journée de la Phase_de_Groupes et par tour de la Phase_Eliminatoire, dans l'ordre chronologique croissant au sein de chaque groupe.
4. LE Système DOIT afficher en en-tête de la vue détaillée du participant sélectionné son nom d'affichage, son Score_Participant total et son rang dans le Classement.
5. SI un participant n'ayant pas le rôle d'Administrateur tente d'accéder à la vue d'administration des pronostics, ALORS LE Système DOIT refuser l'accès et afficher un message indiquant que cette fonctionnalité est réservée à l'Administrateur. SI le mécanisme de refus d'accès échoue techniquement, ALORS LE Système DOIT bloquer tout accès à la vue d'administration plutôt que de permettre un accès non autorisé.
6. TANT QUE l'Administrateur consulte la vue d'administration des pronostics d'un participant, LE Système DOIT afficher les Pronostics de ce participant pour tous les matchs, y compris ceux dont le Coup_d_envoi n'est pas encore atteint, sans appliquer les règles de confidentialité définies à l'Exigence 6.

### Exigence 15 : Export Excel des résultats

**User Story :** En tant qu'administrateur, je veux exporter un fichier Excel contenant tous les pronostics et résultats de tous les participants, afin de le partager facilement avec tout le monde.

#### Critères d'acceptation

1. QUAND l'Administrateur déclenche l'export Excel, LE Système DOIT générer un fichier au format .xlsx contenant les données de tous les participants dans un délai maximal de 30 secondes.
2. LE fichier Excel DOIT contenir, pour chaque participant et chaque match : le nom d'affichage du participant, la phase (groupe ou éliminatoire), la journée ou le tour, les deux équipes du match, la date de Coup_d_envoi, le Pronostic saisi (ou « aucun »), le Resultat_Officiel (ou « non saisi »), et les points obtenus pour ce match. Les lignes DOIVENT être triées par nom d'affichage du participant en ordre alphabétique croissant, puis par date de Coup_d_envoi croissante.
3. LE fichier Excel DOIT contenir une feuille récapitulative avec le Classement complet : rang, nom d'affichage et Score_Participant de chaque participant, triés par Score_Participant décroissant, les participants à Score_Participant identique étant ordonnés par nom d'affichage en ordre alphabétique croissant.
4. QUAND la génération du fichier Excel est terminée, LE Système DOIT proposer le fichier en téléchargement au navigateur de l'Administrateur sans nécessiter d'envoi par e-mail.
5. SI un participant n'ayant pas le rôle d'Administrateur tente de déclencher l'export Excel, ALORS LE Système DOIT refuser l'opération et afficher un message indiquant que cette fonctionnalité est réservée à l'Administrateur.
6. LE Système DOIT nommer le fichier exporté selon le format « pronostics-coupe-du-monde-2026_AAAA-MM-JJ.xlsx » où AAAA-MM-JJ correspond à la date d'export dans le fuseau horaire local de l'Administrateur.
7. SI une erreur technique empêche la génération du fichier Excel, ALORS LE Système DOIT ne produire aucun fichier (ni en téléchargement ni sur le serveur) et afficher un message indiquant que l'export a échoué et invitant l'Administrateur à réessayer.

### Exigence 16 : Résumé statistique des pronostics par match

**User Story :** En tant que participant, je veux voir pour chaque match clôturé combien de personnes ont misé sur chaque score, afin de comparer la popularité des prédictions.

#### Critères d'acceptation

1. QUAND un participant consulte le détail d'un match dont l'étape est clôturée, LE Système DOIT afficher un résumé statistique indiquant le nombre total de participants ayant enregistré un Pronostic pour ce match, puis listant chaque score pronostiqué distinct avec le nombre de participants ayant choisi ce score.
2. LE Système DOIT trier le résumé statistique par nombre de participants décroissant, puis, en cas d'égalité, par score pronostiqué en ordre lexicographique croissant caractère par caractère (par exemple « 1-0 » avant « 1-1 », « 2-1 » avant « 3-0 »).
3. LE Système DOIT afficher pour chaque ligne du résumé : le score pronostiqué (format « X-Y » où X est le nombre de buts de l'équipe à domicile et Y celui de l'équipe à l'extérieur) et le nombre de participants ayant choisi ce score.
4. LE Système DOIT distinguer visuellement dans le résumé statistique la ligne correspondant au score pronostiqué par le participant connecté (si un Pronostic existe pour ce participant et ce match), de sorte que le participant puisse identifier sa propre prédiction sans ambiguïté.
5. TANT QUE l'étape d'un match n'est pas clôturée, LE Système NE DOIT PAS afficher le résumé statistique des pronostics pour ce match.
6. LÀ OÙ aucun participant n'a enregistré de Pronostic pour un match clôturé, LE Système DOIT afficher un message indiquant qu'aucun pronostic n'a été saisi pour ce match, sans afficher de résumé statistique.

### Exigence 17 : Affichage contextuel des règles

**User Story :** En tant que participant, je veux comprendre les règles directement là où je fais mes actions (saisie, résultats, classement), sans devoir chercher une page de règles séparée, afin de toujours savoir ce que je fais et pourquoi.

#### Critères d'acceptation

1. LE Système NE DOIT PAS proposer de page dédiée listant l'ensemble des règles sous forme de bullet points.
2. LE Système DOIT afficher les règles et explications applicables directement dans la même zone visuelle que l'élément d'interface concerné (champs de saisie, résultats de matchs, indicateurs de points, statuts de verrouillage), sans que le participant ait besoin de faire défiler la page ou de naviguer vers une autre vue pour les consulter.
3. LÀ OÙ un formulaire de saisie de pronostic est affiché, LE Système DOIT indiquer à proximité immédiate des champs de score le barème applicable sous forme d'un texte statique ne dépassant pas 3 lignes de texte, mentionnant les trois critères et leurs valeurs : bonne issue (1 pt), bonne différence de buts (1 pt), score exact (1 pt).
4. LÀ OÙ un match affiche l'état « clôturé », LE Système DOIT indiquer à proximité de cet état la règle de clôture applicable (1 heure avant le premier match de l'étape).
5. LÀ OÙ un Resultat_Officiel a été saisi et que les points sont affichés pour un match, LE Système DOIT afficher la décomposition des points obtenus en indiquant pour chacun des trois critères du Barème (issue, différence de buts, score exact) s'il est satisfait ou non, ainsi que le total de points résultant, de sorte que le participant puisse identifier quel critère a contribué à son score.
6. LÀ OÙ une action est refusée (pronostic clôturé, inscription fermée, accès restreint), LE Système DOIT afficher un message contextuel expliquant la raison du refus directement à l'endroit de l'action tentée, sans nécessiter de navigation vers une autre page.
7. SI le texte d'une règle contextuelle ne peut pas être affiché dans la même zone visuelle que l'élément concerné sans masquer cet élément ou ses contrôles interactifs, ALORS LE Système DOIT l'afficher dans un encadré dédié visible sur la même page, sans nécessiter de navigation vers une autre page. LE Système DOIT privilégier l'affichage en ligne lorsque le texte tient dans la zone visuelle de l'élément, et n'utiliser l'encadré dédié qu'en dernier recours.

### Exigence 18 : Pronostics sur les récompenses individuelles

**User Story :** En tant que participant, je veux pronostiquer les gagnants des récompenses individuelles de la Coupe du Monde (meilleur buteur, meilleur joueur, meilleur gardien, meilleur jeune, fair-play), afin de gagner des points bonus supplémentaires.

#### Critères d'acceptation

1. LE Système DOIT contenir en données pré-chargées la liste complète des joueurs de chaque équipe participante à la Coupe du Monde 2026 (nom, équipe, poste) sans effectuer aucun appel réseau externe à l'exécution.
2. LE Système DOIT proposer à chaque participant authentifié un formulaire de sélection pour les 5 récompenses individuelles suivantes : Soulier d'Or (meilleur buteur), Ballon d'Or (meilleur joueur), Gant d'Or (meilleur gardien), Meilleur Jeune Joueur, et Prix du Fair-Play. Pour chaque récompense, tout joueur de la liste pré-chargée est sélectionnable, quel que soit son poste.
3. QUAND un participant sélectionne un joueur pour une récompense, LE Système DOIT proposer une recherche ou un sélecteur filtrable parmi les joueurs pré-chargés, de sorte que le participant ne puisse sélectionner qu'un joueur existant dans la liste officielle.
4. LE Système DOIT conserver au plus un pronostic par participant et par récompense.
5. TANT QUE l'heure de clôture de la Journée 1 de la Phase_de_Groupes n'est pas atteinte (1 heure avant le premier match de la Journée 1), LE Système DOIT permettre la saisie et la modification des pronostics de récompenses individuelles.
6. QUAND l'heure de clôture de la Journée 1 est atteinte, LE Système DOIT verrouiller les pronostics de récompenses individuelles de sorte qu'aucun pronostic de récompense ne puisse être créé, modifié ou supprimé.
7. SI un participant tente de saisir ou modifier un pronostic de récompense après la clôture de la Journée 1, ALORS LE Système DOIT rejeter l'opération et afficher un message indiquant que les pronostics de récompenses sont clôturés.
8. QUAND l'Administrateur sélectionne le vainqueur officiel d'une récompense individuelle parmi la liste des joueurs pré-chargés, LE Système DOIT enregistrer ce résultat et calculer automatiquement les points bonus pour tous les participants dans un délai maximal de 5 secondes.
9. SI le pronostic d'un participant pour une récompense correspond exactement au vainqueur officiel désigné par l'Administrateur (correspondance stricte par identifiant du joueur dans la liste pré-chargée), ALORS LE Système DOIT attribuer exactement 5 points bonus à ce participant pour cette récompense.
10. SI le pronostic d'un participant pour une récompense ne correspond pas au vainqueur officiel, ALORS LE Système DOIT attribuer 0 point bonus à ce participant pour cette récompense.
11. LE Système DOIT ajouter les points bonus des récompenses individuelles au Score_Participant total utilisé pour le Classement.
12. QUAND le vainqueur officiel d'une récompense est désigné par l'Administrateur, LE Système DOIT afficher dans le profil de chaque participant son pronostic pour cette récompense, le vainqueur officiel, et les points bonus obtenus (0 ou 5).
13. TANT QUE l'heure de clôture de la Journée 1 n'est pas atteinte, LE Système DOIT masquer aux autres participants les pronostics de récompenses d'un participant, sans révéler si un pronostic de récompense a été enregistré ou non pour ce participant.
14. QUAND l'heure de clôture de la Journée 1 est atteinte, LE Système DOIT rendre visibles à tous les participants les pronostics de récompenses de chaque participant ayant enregistré un pronostic, et indiquer l'absence de pronostic pour tout participant n'en ayant pas enregistré.
15. SI un participant n'ayant pas le rôle d'Administrateur tente de désigner le vainqueur officiel d'une récompense, ALORS LE Système DOIT refuser l'opération et afficher un message indiquant que cette fonctionnalité est réservée à l'Administrateur.
16. QUAND l'Administrateur corrige le vainqueur officiel d'une récompense déjà désignée, LE Système DOIT remplacer le vainqueur précédent et recalculer les points bonus de tous les participants pour cette récompense dans un délai maximal de 5 secondes.
