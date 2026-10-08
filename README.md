# Kalyav — Sport et Nutrition

Coach personnel mobile (iOS, Android, web) : entraînement, nutrition, suivi de progression et habitudes.
L'application ne se contente pas d'afficher des données : chaque jour, elle les transforme en **décisions** (quelle séance faire, quoi manger, quelle est la prochaine action) et adapte le programme au fil des semaines.

> ⚕️ Les recommandations sont générales et ne remplacent pas l'avis d'un médecin ou d'un professionnel de santé.

## Démarrer

```bash
npm install
npx expo start          # puis i (iOS), a (Android) ou w (web)
npm test                # tests du moteur de coaching (vitest)
npx tsc --noEmit        # typecheck
npx expo lint           # lint
```

### Version web en ligne (GitHub Pages)

À chaque push sur `main` (ou la branche de développement), le workflow `.github/workflows/deploy-pages.yml` vérifie le code, construit la version web et la publie sur la branche `gh-pages`.
Activation, une seule fois : **Settings → Pages → Source : Deploy from a branch → Branch : `gh-pages` / `(root)` → Save**.
L'app est alors servie sur `https://<utilisateur>.github.io/kalyav/`.

Le scanner caméra et les notifications nécessitent un appareil (Expo Go ou development build). Sur le web, le code-barres se saisit à la main.

## Fonctionnalités

| Domaine | Ce que fait l'app |
| --- | --- |
| **Onboarding** | 7 étapes : identité, objectif & poids cible (refus d'un IMC cible < 18,5), sport (niveau, jours, durée, préférences, équipement, heure), limitations/blessures, alimentation (régime, repas, allergies, goûts), rythme (sommeil, métier, activité). Affiche le plan calculé. |
| **Accueil** | « Décision du coach » du jour + prochaine action, score du jour (nutrition, sport, hydratation, sommeil), mission du jour en cases à cocher, jauges calories / macros / eau / pas, séance, sommeil, poids → objectif, série et niveau, conseil prioritaire. |
| **Coach IA** | Moteur de règles fondé sur des **tendances** (régression sur 14 / 21 / 28 jours) : plateau (vérifie d'abord la régularité), perte trop rapide, prise de muscle trop lente/rapide, performances en baisse → semaine allégée, séances manquées → programme plus léger, progression facile → +10 % de volume, protéines basses (3 options), sommeil, hydratation, pas, motivation, difficultés récurrentes. Chaque conseil explique **pourquoi** ; l'utilisateur l'applique ou le reporte. Ajustements bornés (−300 / +400 kcal max, jamais sous le métabolisme de base). Chat hors-ligne qui répond à partir des données de l'utilisateur. |
| **Sport** | Programme hebdo généré selon l'objectif (8 catégories), les jours, la durée, le matériel et les limitations. Chaque séance : exercices, séries, répétitions, repos, durée, difficulté, muscles, démonstration pas-à-pas. Boutons **« Je ne peux pas faire cet exercice »** (alternative selon douleur / matériel / difficulté / goût) et **« Je suis fatigué aujourd'hui »** (version allégée ou récupération active). Suivi des séries, minuteur de repos, effort perçu. |
| **Nutrition** | Recherche (base locale + Open Food Facts), scan code-barres, favoris, aliments personnalisés, repas/recettes personnalisés. Jauges calories, protéines, glucides, lipides, fibres. |
| **Générateur de repas** | 3 repas calés sur les calories et protéines restantes, filtres rapide / économique / riche en protéines / végétarien / gourmand / meal prep, temps, budget, aliments disponibles ; respecte régime, allergies et aliments détestés. |
| **Progression** | Courbes poids, tour de taille, masse grasse/musculaire, cardio, pas, calories, force (1RM estimé) ; records personnels ; grille de régularité ; objectifs hebdo ; badges. |
| **Check-ins** | Matin (sommeil, énergie, fatigue, motivation, douleurs, poids) → la séance du jour est adaptée immédiatement. Soir (séance, alimentation, eau, humeur, difficulté). |
| **Gamification** | Séries, 14 niveaux (Départ → Légende), XP et badges qui récompensent **les habitudes**, jamais la seule perte de poids. |
| **Bilan hebdo** | Chaque dimanche : poids initial/final, séances, nutrition, sommeil, activité, points forts/faibles, recommandations, puis génération du programme suivant. |
| **Rappels** | Planifiés sur 48 h, max 5/jour, jamais pendant le sommeil, supprimés si l'action est déjà faite. Un rappel ignoré ≥ 70 % du temps déclenche une proposition de nouvel horaire (basé sur l'heure réelle de l'action) ou de désactivation. |
| **Sécurité** | Douleur ≥ 7 ou symptôme inquiétant → repos + avis professionnel (message d'urgence 15/112). Douleur modérée → récupération sans la zone. Plancher calorique, perte ≤ 1 %/semaine, limitation « cardiaque » → pas de HIIT. |
| **Données** | Persistance locale, export JSON/CSV, compte + synchronisation cloud optionnels (Supabase). |

## Architecture

```
src/
  core/            TypeScript pur, sans React Native — testable et réutilisable côté serveur
    nutrition/     calculs (Mifflin-St Jeor, TDEE, macros, planchers), aliments, recettes, générateur de repas
    training/      bibliothèque d'exercices (contre-indications, alternatives), générateur de programme, performances
    coach/         analyse des tendances, moteur d'adaptation, sécurité, briefing du jour, chat, bilan hebdo
    gamification/  séries, niveaux, badges, objectifs hebdo
    reminders/     planification adaptative des rappels
    dashboard/     instantané et scores du jour
  data/store.ts    état applicatif (zustand + AsyncStorage)
  services/        notifications, export, authentification & synchronisation cloud
  integrations/    contrats (santé, montres, balance, bases alimentaires, IA conversationnelle, communauté) + registre
  ui/              thème, composants, graphiques SVG
  app/             écrans (Expo Router)
tests/             tests vitest du moteur
supabase/          schéma SQL (RLS) pour la synchronisation
```

### Cloud (optionnel)

Sans configuration, l'app fonctionne en **mode local**. Pour activer comptes et synchronisation :

1. Créer un projet Supabase et exécuter `supabase/schema.sql`.
2. Définir `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (fichier `.env.local`).

La synchronisation actuelle est « dernier écrit gagne » sur l'instantané complet. Tout autre backend peut implémenter `CloudBackend` (`src/services/cloud.ts`).

### Brancher une intégration

Implémenter l'interface correspondante dans `src/integrations/types.ts`, puis l'enregistrer dans `src/integrations/registry.ts` :

- **Apple Santé / Health Connect / montres** → `HealthDataProvider` (pas, sommeil, poids, séances). Nécessite un development build.
- **Balance connectée** → `SmartScaleProvider`.
- **Scanner / base alimentaire** → `FoodDatabase` (Open Food Facts est déjà actif).
- **IA conversationnelle** → `ConversationalCoach` via `registerConversationalCoach()` : l'onglet Coach IA l'utilise automatiquement, avec le même contexte (profil + analyse) que le coach hors-ligne.
- **Communauté & challenges** → `CommunityService`.

## Limites connues

- Démonstrations d'exercices : animation + étapes guidées ; pas encore de vidéos.
- Pas, sommeil et poids se saisissent à la main tant qu'aucune intégration santé n'est branchée.
- Les notifications ne sont pas disponibles sur le web.
