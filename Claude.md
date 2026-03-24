> **[INSTRUCTIONS POUR L'IA]** > Tu es mon assistant de développement. Ce fichier est ta mémoire et ton point de vérité absolu pour ce projet. Base-toi toujours sur son contenu avant de coder. Si nous modifions l'architecture, résolvons un bug majeur ou ajoutons une dépendance, tu dois **proactivement** me proposer une mise à jour concise de ce fichier sous forme de bloc de code pour que je puisse la sauvegarder.

# Mémoire du Projet (Claude.md)

## 🛠️ Stack Technique
- **Framework** : Expo SDK 54, React Native, Expo Router (file-based routing)
- **Backend** : Supabase (PostgreSQL + Auth)
- **State** : Zustand
- **AI** : Gemini 2.5 Flash (image nutrition + analyse séance + recommandations surcharge progressive)
- **CSS** : NativeWind (Tailwind CSS)
- **Background** : react-native-background-actions (foreground service Android pour timer)
- **Install** : toujours `npm install --legacy-peer-deps` (conflit @types/react peer dep)

## 🏗️ Architecture & Règles

### Aliases (tsconfig + metro)
```
@components → src/components/
@store      → src/store/
@services   → src/services/
@hooks      → src/hooks/
@types      → src/types/
@widgets    → src/widgets/
```

### Fichiers clés
| Fichier | Rôle |
|---|---|
| `src/store/workoutStore.ts` | Store Zustand central (sessions, sets, exercices, timer, offline) |
| `src/services/geminiService.ts` | Appels Gemini (repas image, analyse séance, surcharge progressive) |
| `src/services/offlineQueue.ts` | File d'attente offline → AsyncStorage |
| `src/types/index.ts` | Tous les types TypeScript du projet |
| `app/session/[id].tsx` | Détail d'une séance (log sets, analyse IA, recommandations) |
| `app/(tabs)/workout.tsx` | Liste des séances + création |
| `app/exercise/[id].tsx` | Stats & progression d'un exercice |

### Base de données Supabase
Tables : `sessions`, `sets`, `exercises`
Sets contiennent : `id, session_id, exercise_id, weight, repetitions, rpe, note, created_at`
Sessions : `id, user_id, date (ISO), name, note, created_at`

### Timer (foreground service)
- `src/services/backgroundTimer.ts` : start/stop du foreground service, met à jour la notif chaque seconde
- `src/components/workout/RestTimer.tsx` : UI in-app (décompte, overtime, vibration, Stop)
- `src/services/timerNotifications.ts` : uniquement setup channel + permissions
- `src/store/workoutStore.ts` : `startRestTimer` / `clearRestTimer` / `resumeRestTimer` (persiste dans AsyncStorage)
- AndroidManifest : `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SHORT_SERVICE` + service `RNBackgroundActionsTask`

### Offline-first
- Mise à jour optimiste → état local immédiat
- `offlineQueue` dans AsyncStorage pour les ops en attente
- `flushOfflineQueue()` au retour en ligne (batch INSERT/DELETE)
- Bannière offline + `pendingCount` visible dans l'UI

## ✅ Features Implémentées
- Dashboard, Workout tracker, Nutrition + AI scan, Défis/Badges, Stats, Profil
- Leaderboard, Shopping list, Meal prep
- Analyse IA de séance (Gemini, comparaison avec séance précédente)
- **Recommandations surcharge progressive IA** : générées une seule fois à la création de séance, cachées dans AsyncStorage par `recs_<sessionId>`, affichées dans le header de séance
- Notes dans Last performance + chips "Précédent"
- Progression visuelle par exercice (1RM / Poids / Volume)
- Mode hors-ligne robuste
- Widget Android (react-native-android-widget) — nécessite rebuild natif
- **Timer de repos** : foreground service Android (`react-native-background-actions`) — décompte live en notification + barre de progression même en background. Overtime rouge négatif (+MM:SS) avec vibration continue, arrêt uniquement par bouton Stop
- **Système Défis/Badges** :
  - Défis de séance : évalués uniquement quand `currentSessionId !== null` (ne s'écrasent pas en naviguant hors session)
  - Défis hebdomadaires : reset automatique via ISO week (AsyncStorage `nokka_challenge_week`), réévalués à chaque focus du tab via `useFocusEffect`
  - Badges : permanents, persistés dans AsyncStorage `nokka_achievements`
- **Rappel créatine** : notif toutes les heures tant que non prise, reset quotidien, carte dashboard avec bouton "Pris ✓" / "Annuler", `expo-notifications` repeating trigger (1h), persisté dans AsyncStorage `nokka_creatine_YYYY-MM-DD`

## 📐 Conventions de Code
- Styles : `StyleSheet.create` inline dans chaque fichier (pas de classes NativeWind dans les screens complexes)
- Couleurs : `#0f0f12` (fond), `#c8f060` (accent vert), `#7a7a90` (texte secondaire), `#f06060` (danger)
- Haptics : `useHaptics()` hook pour feedback tactile
- Toast : `useToast()` hook pour notifications
- Toutes les strings UI visibles par l'utilisateur sont en **français**

## 🔨 Build Android
- APK release : `npx expo run:android --variant release`
- APK : `android/app/build/outputs/apk/release/app-release.apk`
- Rebuild natif requis après changement de config plugin
- `local.properties` : `sdk.dir=C\:\\Users\\Nickben\\AppData\\Local\\Android\\Sdk`
