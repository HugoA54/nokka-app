# Nokka — Fitness & Nutrition Tracker

Application mobile React Native (Expo) combinant suivi d'entraînement, nutrition intelligente et analyse IA des repas.

---

## Stack technique

- **Framework** : React Native + Expo (file-based routing via Expo Router)
- **Backend** : Supabase (PostgreSQL + Auth)
- **State management** : Zustand
- **IA** : Google Gemini 2.5 Flash (analyse photo de repas, analyse de séance, surcharge progressive)
- **Base alimentaire** : Open Food Facts API v2
- **i18n** : i18next + react-i18next (Français / English, persistance + détection locale appareil)
- **UI** : Dark theme custom — accent lime `#c8f060`

---

## Fonctionnalités

### Authentification
- Inscription / connexion par email + mot de passe via Supabase
- Gestion de session et déconnexion sécurisée
- Redirection automatique des utilisateurs non connectés

---

### Tableau de bord
- Salutation personnalisée selon l'heure de la journée
- Résumé rapide : sessions totales, streak hebdomadaire, volume total soulevé
- Aperçu de la journée : entraînement du jour + bilan nutritionnel combiné (classique + IA)
- Grille de raccourcis vers toutes les fonctions majeures
- Accès rapide au classement
- Pull-to-refresh
- **Rappel créatine** : carte dashboard avec bouton "Pris ✓", reset quotidien automatique — mode intervalle (1–4h) ou heure fixe configurable depuis le profil
- **Routine abdos** : carte dashboard activable depuis le profil — 3 niveaux (Débutant / Intermédiaire / Avancé), rappel quotidien à heure configurable, streak journalier visible et badges dédiés

---

### Entraînement

#### Sessions
- Créer une session vide ou depuis un template
- Noms générés automatiquement avec date
- Notes par session
- Historique complet des sessions avec date, nombre de séries et volume total
- Suppression par appui long

#### Exercices
- Bibliothèque d'exercices couvrant 10+ groupes musculaires : poitrine, dos, épaules, biceps, triceps, jambes, fessiers, core, cardio, full body
- Recherche et filtrage par nom ou groupe musculaire
- Fiche d'exercice avec records personnels et graphique de progression (10 derniers points)

#### Suivi des séries
- Log : poids, répétitions, RPE (1–10), notes
- Calcul automatique du volume (poids × reps)
- Affichage des dernières performances pour référence
- Édition et suppression individuelles

#### Progression par exercice
- Graphique de progression sur les 20 derniers sets
- Sélecteur de métrique : **1RM estimé** / **Poids max** / **Volume par série**
- Boutons pill interactifs avec état actif/inactif
- Titre dynamique selon la métrique sélectionnée

#### Timer de repos
- Compte à rebours configurable entre les séries
- Foreground service Android (`react-native-background-actions`) : décompte live en notification même en background
- Mode overtime : timer négatif rouge (+MM:SS) avec vibration continue à la fin du repos
- Arrêt uniquement par bouton Stop (pas d'auto-dismiss)
- Barre de progression dans la notification

#### Analyse IA de séance (Gemini)
- Analyse de la séance en cours via Gemini, comparée à la séance précédente
- Mise en cache dans AsyncStorage (`ai_analysis_<id>`) — affichée inline en bas de séance
- Recommandations surcharge progressive générées une seule fois par séance (`recs_<id>`) et affichées dans le header
- Bouton refresh pour regénérer l'analyse

#### Résumé screenshot
- Bouton caméra dans le header de séance
- Modale compacte avec toutes les séries regroupées par exercice (chips `poids × reps`)
- Conçu pour tenir en un seul screenshot

#### Templates
- Création de sessions depuis des routines passées
- Affiche le nombre d'exercices et la date de la routine source

---

### Statistiques
- **Graphique de volume** : courbe sur les 7 dernières sessions
- **Records personnels** : top 10 exercices classés par 1RM estimé
- **Répartition musculaire** : camembert montrant la distribution des séries par groupe
- **Heatmap calendrier** : activité sur 105 jours (style GitHub contributions)
- Calculs : 1RM estimé, streak de semaines consécutives, volume total, total sessions/séries

---

### Nutrition

#### Journal quotidien
- Compteur de calories avec progression par rapport à l'objectif
- Macros du jour : protéines (cyan), glucides (jaune), lipides (rose) avec barres de progression
- Suivi de l'hydratation (8 verres/jour)
- Vue combinée repas classiques + repas analysés par IA
- Ajout / suppression de repas depuis le journal

#### Base alimentaire & Recherche
- Recherche locale (bibliothèque personnelle) + Open Food Facts (500 000+ aliments)
- Priorité aux résultats en français (`lc=fr`)
- Informations par aliment : nom, marque, calories/100g, macros/100g, portion, code-barres
- Aliments populaires pour sélection rapide
- Ajout d'aliments personnalisés

#### Scan de code-barres
- Scan par caméra via Expo Camera
- Saisie manuelle en secours
- Lookup automatique via Open Food Facts
- Gestion des permissions caméra

#### Bibliothèque de repas
- Création de repas personnalisés avec plusieurs aliments
- Calcul automatique des macros totales selon les quantités
- Fiche repas avec toutes les infos nutritionnelles
- Ajout rapide au journal depuis la bibliothèque

#### Planification des repas (14 jours)
- Assigner des repas à : petit-déjeuner, déjeuner, dîner, collation
- Sélecteur de jours visuel avec indicateurs de repas
- Marquer les repas comme consommés
- Visualisation des calories et macros planifiées

#### Liste de courses
- Générée automatiquement depuis le plan 14 jours
- Catégories : protéines, légumes, fruits, produits laitiers, féculents, condiments, autre
- Checkboxes de suivi des achats
- Édition des quantités et unités
- Progression d'achat (items cochés / total)
- Nettoyage en lot des items achetés

---

### Nutrition IA (Gemini)

#### Analyse photo de repas
- Prise de photo ou import depuis la galerie
- Analyse automatique par Google Gemini 2.5 Flash
- Flux en 4 étapes : idle → aperçu → analyse → révision
- Résultats éditables avant sauvegarde : nom, calories, protéines, glucides, lipides
- Notes additionnelles avant l'analyse
- Photo associée à chaque repas sauvegardé

#### Objectifs macro
- Définir les objectifs quotidiens : calories, protéines, glucides, lipides
- Mode automatique (calculé depuis le profil) ou manuel
- Affichage objectifs vs consommation réelle

#### Historique IA
- Liste des repas analysés par IA du jour
- Photo, nom, calories, macros pour chaque repas
- Édition et suppression des repas après analyse
- Bilan combiné IA + classique vs objectifs

---

### Profil & Paramètres

#### Clé API Gemini
- Saisie et sauvegarde de la clé API personnelle (Google AI Studio)
- Toggle pour activer/désactiver toutes les fonctions IA

#### Rappel créatine
- Mode **Intervalle** : notification répétée toutes les 1–4h jusqu'à ce que la prise soit confirmée
- Mode **Heure fixe** : notification à une heure précise (7h, 8h, 9h…)
- Désactivation complète possible

#### Routine abdos
- Activable / désactivable depuis le profil
- 3 niveaux de difficulté (Débutant / Intermédiaire / Avancé) — exercices, séries et reps/temps adaptés
- Rappel quotidien à heure fixe configurable (notification DAILY)
- Player dédié avec checklist par exercice et timer intégré pour les exos chronométrés (planches, mountain climbers…)
- Streak journalier (reset si un jour est manqué)
- Badges dédiés intégrés au système d'achievements : 1ère routine, streak 7j, streak 30j, 50 routines totales

#### Langue
- Sélecteur FR / EN en bas du profil, persisté dans AsyncStorage et appliqué immédiatement

#### Profil utilisateur
- Affichage email et avatar (initiale)
- BMR (Mifflin-St Jeor) et TDEE calculés et affichés
- Objectif calorique journalier dynamique

#### Mesures corporelles
- Poids (kg), taille (cm), âge
- Sélection du genre : homme / femme
- Recalcul en temps réel à chaque modification

#### Niveau d'activité
- 5 niveaux : sédentaire, léger (1–3j/sem), modéré (3–5j/sem), actif (6–7j/sem), très actif
- Description pour chaque niveau

#### Objectif fitness
- **Sèche** : −15% calories
- **Maintien** : calories TDEE
- **Prise de masse** : +10% calories
- Cartes colorées, ajustement automatique de l'objectif calorique

#### Mode de calcul calorique
- **Automatique** : basé sur BMR × activité × objectif
- **Manuel** : objectif personnalisé
- Bascule entre les deux modes

---

### Social & Compétition

#### Classement (Leaderboard)
- Top 20 mondial basé sur le volume total soulevé (all-time)
- Médailles pour le top 3 (or, argent, bronze)
- Mise en évidence de votre propre classement (bordure lime verte)
- Données par utilisateur : rang, pseudo, sessions, volume (en tonnes)
- Bannière "Mon classement" avec position et stats personnelles
- Pull-to-refresh pour mise à jour en direct
- Message d'erreur explicite si le chargement échoue (connexion perdue)

---

### Mode hors-ligne

- **Détection réseau** : via `@react-native-community/netinfo`, écoute les changements de connectivité en temps réel
- **Optimistic updates offline** : les séries ajoutées/supprimées hors-ligne sont conservées immédiatement (pas de rollback)
- **Queue de synchronisation** : les opérations en attente sont persistées dans AsyncStorage (`nokka_offline_queue`)
- **Sync automatique** : à la reconnexion, toutes les opérations queued sont rejouées sur Supabase
- **Bannière d'état** : indicateur visuel sur le Dashboard lorsque des séries sont en attente de synchronisation

---

### Widget Android

- Widget d'accueil Android affichant les stats du jour
- **Données affichées** : calories du jour / objectif, barre de progression, nombre de séances cette semaine
- **Mise à jour automatique** : toutes les 30 minutes + à chaque modification dans l'app
- **Implémentation** : `react-native-android-widget` (config plugin Expo — rebuild natif requis)
- **Taille** : 180dp × 110dp minimum, 250dp × 120dp cible

---

### UI/UX

- **Dark theme** complet : fond `#0f0f12`, cartes `#16161c`, accent `#c8f060`
- **Navigation** : 6 onglets principaux (Dashboard, Workout, Nutrition, IA, Stats, Profil) + écrans stack et modales
- **Squelettes de chargement** pour les cartes meals, sessions, résumés macros
- **Toasts** : succès, erreur, info — auto-dismiss en haut d'écran
- **Haptic feedback** : léger (interactions), médium (suppressions), succès/erreur
- **Pull-to-refresh** sur tous les écrans listes (tint lime `#c8f060`)
- **Internationalisation** : FR / EN — toutes les chaînes UI passent par i18next, dates localisées (`fr-FR` / `en-US`)

---

## Architecture

```
NokkaApp/
├── app/                    # Écrans (Expo Router file-based)
│   ├── (tabs)/             # Onglets principaux
│   ├── meal/               # Éditeur de repas
│   ├── session/            # Sessions & exercices
│   └── ...
├── src/
│   ├── components/         # Composants réutilisables
│   │   ├── nutrition/      # FoodSearchModal, FoodCard, MealCard...
│   │   ├── workout/        # SessionCard, SetRow, RestTimer...
│   │   └── ui/             # Toast, Skeleton, etc.
│   ├── store/              # Zustand stores
│   │   ├── authStore.ts
│   │   ├── workoutStore.ts  # + offline queue integration
│   │   ├── nutritionStore.ts
│   │   ├── macroAIStore.ts
│   │   └── uiStore.ts
│   ├── services/           # Intégrations externes
│   │   ├── supabase.ts
│   │   ├── openFoodFactsService.ts
│   │   ├── geminiService.ts
│   │   ├── offlineQueue.ts       # File d'attente offline (AsyncStorage)
│   │   ├── creatineReminder.ts   # Rappels créatine (interval / heure fixe)
│   │   ├── absRoutine.ts         # Routine abdos (settings, streak, notifs DAILY)
│   │   └── calorieCalculations.ts
│   ├── hooks/
│   │   └── useNetworkSync.ts  # Détection réseau + flush offline queue
│   ├── i18n/
│   │   ├── index.ts          # Setup i18next + persistance langue
│   │   ├── fr.json
│   │   └── en.json
│   ├── widgets/
│   │   ├── NokkaWidget.tsx    # UI du widget Android
│   │   └── widgetTaskHandler.ts  # Handler système widget
│   └── types/              # Types TypeScript globaux
└── assets/
```
