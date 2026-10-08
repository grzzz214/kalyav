import type { Equipment, Level, Limitation } from '../types';

export type Pattern =
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'h_push'
  | 'v_push'
  | 'h_pull'
  | 'v_pull'
  | 'core'
  | 'arms'
  | 'calves'
  | 'conditioning'
  | 'steady_cardio'
  | 'mobility';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary: string[];
  secondary: string[];
  /** tous requis */
  equipment: Equipment[];
  level: 1 | 2 | 3;
  /** zones sollicitées : exclut l'exercice si l'utilisateur a la limitation correspondante */
  stress: Limitation[];
  /** équivalent métabolique pour estimer la dépense */
  met: number;
  mode: 'reps' | 'time';
  /** démonstration pas-à-pas */
  cues: string[];
  /** erreur fréquente à éviter */
  pitfall: string;
}

type Def = Omit<Exercise, 'secondary' | 'pitfall'> & { secondary?: string[]; pitfall?: string };

const DEFS: Def[] = [
  // ——— Squat ———
  { id: 'bw_squat', name: 'Squat au poids du corps', pattern: 'squat', primary: ['Quadriceps', 'Fessiers'], secondary: ['Gainage'], equipment: [], level: 1, stress: ['knee'], met: 5, mode: 'reps',
    cues: ['Pieds largeur d’épaules, pointes légèrement ouvertes.', 'Descends en poussant les hanches en arrière, dos neutre.', 'Genoux dans l’axe des pieds, descends à hauteur confortable.', 'Remonte en poussant dans tout le pied.'], pitfall: 'Genoux qui rentrent vers l’intérieur.' },
  { id: 'box_squat', name: 'Squat sur chaise', pattern: 'squat', primary: ['Quadriceps', 'Fessiers'], equipment: [], level: 1, stress: [], met: 4, mode: 'reps',
    cues: ['Place une chaise stable derrière toi.', 'Descends lentement jusqu’à effleurer l’assise.', 'Remonte sans élan, buste fier.'], pitfall: 'Se laisser tomber sur la chaise.' },
  { id: 'goblet_squat', name: 'Goblet squat', pattern: 'squat', primary: ['Quadriceps', 'Fessiers'], secondary: ['Gainage', 'Haut du dos'], equipment: ['dumbbells'], level: 1, stress: ['knee'], met: 5.5, mode: 'reps',
    cues: ['Tiens l’haltère contre la poitrine, coudes sous la charge.', 'Descends entre les talons, buste droit.', 'Remonte en expirant.'], pitfall: 'Talons qui décollent.' },
  { id: 'kb_goblet_squat', name: 'Goblet squat kettlebell', pattern: 'squat', primary: ['Quadriceps', 'Fessiers'], equipment: ['kettlebell'], level: 1, stress: ['knee'], met: 5.5, mode: 'reps',
    cues: ['Kettlebell tenue par les cornes contre la poitrine.', 'Descends en gardant le buste vertical.', 'Remonte en poussant le sol.'] },
  { id: 'back_squat', name: 'Squat barre', pattern: 'squat', primary: ['Quadriceps', 'Fessiers'], secondary: ['Lombaires', 'Gainage'], equipment: ['barbell'], level: 2, stress: ['knee', 'lower_back'], met: 6, mode: 'reps',
    cues: ['Barre sur les trapèzes, mains serrées.', 'Inspire, gaine, descends contrôlé.', 'Remonte en gardant la poitrine haute.'], pitfall: 'Dos qui s’arrondit en bas du mouvement.' },
  { id: 'leg_press', name: 'Presse à cuisses', pattern: 'squat', primary: ['Quadriceps', 'Fessiers'], equipment: ['machines'], level: 1, stress: ['knee'], met: 5, mode: 'reps',
    cues: ['Dos bien plaqué au dossier.', 'Descends jusqu’à 90° aux genoux.', 'Pousse sans verrouiller les genoux.'] },
  { id: 'wall_sit', name: 'Chaise contre le mur', pattern: 'squat', primary: ['Quadriceps'], equipment: [], level: 1, stress: ['knee'], met: 4, mode: 'time',
    cues: ['Dos contre le mur, cuisses parallèles au sol.', 'Genoux au-dessus des chevilles.', 'Respire calmement.'] },
  // ——— Fente ———
  { id: 'reverse_lunge', name: 'Fente arrière', pattern: 'lunge', primary: ['Quadriceps', 'Fessiers'], secondary: ['Adducteurs'], equipment: [], level: 1, stress: ['knee'], met: 5, mode: 'reps',
    cues: ['Grand pas en arrière.', 'Descends le genou arrière vers le sol.', 'Pousse avec la jambe avant pour revenir.'], pitfall: 'Buste qui bascule vers l’avant.' },
  { id: 'db_reverse_lunge', name: 'Fente arrière haltères', pattern: 'lunge', primary: ['Quadriceps', 'Fessiers'], equipment: ['dumbbells'], level: 2, stress: ['knee'], met: 5.5, mode: 'reps',
    cues: ['Haltères le long du corps.', 'Pas en arrière, descente contrôlée.', 'Reviens en poussant sur le talon avant.'] },
  { id: 'bulgarian_split', name: 'Squat bulgare', pattern: 'lunge', primary: ['Quadriceps', 'Fessiers'], equipment: ['bench'], level: 2, stress: ['knee', 'hip'], met: 6, mode: 'reps',
    cues: ['Pied arrière posé sur le banc.', 'Descends verticalement.', 'Garde le genou avant stable.'] },
  { id: 'step_up', name: 'Montée sur banc', pattern: 'lunge', primary: ['Fessiers', 'Quadriceps'], equipment: ['bench'], level: 1, stress: ['knee'], met: 5, mode: 'reps',
    cues: ['Pied entier sur le banc.', 'Monte en poussant sur la jambe haute.', 'Redescends lentement.'] },
  { id: 'glute_bridge_march', name: 'Pont fessier alterné', pattern: 'lunge', primary: ['Fessiers', 'Ischios'], equipment: [], level: 1, stress: ['no_floor'], met: 3.5, mode: 'reps',
    cues: ['Allongé, pieds au sol, monte le bassin.', 'Lève un pied puis l’autre sans faire tomber le bassin.'] },
  // ——— Charnière de hanche ———
  { id: 'glute_bridge', name: 'Pont fessier', pattern: 'hinge', primary: ['Fessiers', 'Ischios'], equipment: [], level: 1, stress: ['no_floor'], met: 3.5, mode: 'reps',
    cues: ['Allongé sur le dos, pieds proches des fesses.', 'Pousse dans les talons, monte le bassin.', 'Serre les fessiers 1 s en haut.'], pitfall: 'Cambrer le bas du dos au lieu de serrer les fessiers.' },
  { id: 'hip_thrust', name: 'Hip thrust haltère', pattern: 'hinge', primary: ['Fessiers'], secondary: ['Ischios'], equipment: ['bench', 'dumbbells'], level: 2, stress: [], met: 4.5, mode: 'reps',
    cues: ['Haut du dos contre le banc, haltère sur les hanches.', 'Monte jusqu’à l’alignement épaules-hanches-genoux.', 'Menton rentré.'] },
  { id: 'db_rdl', name: 'Soulevé de terre jambes tendues haltères', pattern: 'hinge', primary: ['Ischios', 'Fessiers'], secondary: ['Lombaires'], equipment: ['dumbbells'], level: 1, stress: ['lower_back'], met: 5, mode: 'reps',
    cues: ['Genoux légèrement fléchis.', 'Pousse les hanches en arrière, haltères près des jambes.', 'Remonte en serrant les fessiers.'], pitfall: 'Arrondir le dos pour descendre plus bas.' },
  { id: 'barbell_deadlift', name: 'Soulevé de terre barre', pattern: 'hinge', primary: ['Ischios', 'Fessiers', 'Lombaires'], secondary: ['Dorsaux', 'Trapèzes'], equipment: ['barbell'], level: 3, stress: ['lower_back'], met: 6, mode: 'reps',
    cues: ['Barre au-dessus du milieu du pied.', 'Dos gainé, épaules au-dessus de la barre.', 'Pousse le sol, barre collée aux jambes.'], pitfall: 'Tirer avec le dos rond.' },
  { id: 'kb_swing', name: 'Kettlebell swing', pattern: 'hinge', primary: ['Fessiers', 'Ischios'], secondary: ['Gainage', 'Cardio'], equipment: ['kettlebell'], level: 2, stress: ['lower_back'], met: 8, mode: 'reps',
    cues: ['Charnière de hanche, kettlebell entre les jambes.', 'Projette les hanches vers l’avant.', 'Les bras guident, ce sont les hanches qui propulsent.'] },
  { id: 'band_pull_through', name: 'Pull-through élastique', pattern: 'hinge', primary: ['Fessiers', 'Ischios'], equipment: ['bands'], level: 1, stress: [], met: 4, mode: 'reps',
    cues: ['Élastique accroché bas derrière toi.', 'Recule les hanches, dos plat.', 'Verrouille en serrant les fessiers.'] },
  // ——— Poussée horizontale ———
  { id: 'push_up', name: 'Pompes', pattern: 'h_push', primary: ['Pectoraux', 'Triceps'], secondary: ['Épaules', 'Gainage'], equipment: [], level: 2, stress: ['wrist', 'shoulder', 'no_floor'], met: 5, mode: 'reps',
    cues: ['Mains sous les épaules, corps gainé.', 'Descends la poitrine vers le sol, coudes à 45°.', 'Repousse le sol.'], pitfall: 'Bassin qui s’affaisse.' },
  { id: 'incline_push_up', name: 'Pompes inclinées', pattern: 'h_push', primary: ['Pectoraux', 'Triceps'], equipment: [], level: 1, stress: ['wrist'], met: 4, mode: 'reps',
    cues: ['Mains sur une table ou un plan stable.', 'Corps aligné de la tête aux talons.', 'Descends la poitrine vers le support.'] },
  { id: 'wall_push_up', name: 'Pompes contre le mur', pattern: 'h_push', primary: ['Pectoraux'], equipment: [], level: 1, stress: [], met: 3, mode: 'reps',
    cues: ['Mains au mur à hauteur d’épaules.', 'Fléchis les coudes, corps gainé.', 'Repousse doucement.'] },
  { id: 'db_bench', name: 'Développé couché haltères', pattern: 'h_push', primary: ['Pectoraux', 'Triceps'], secondary: ['Épaules'], equipment: ['dumbbells', 'bench'], level: 1, stress: ['shoulder'], met: 5, mode: 'reps',
    cues: ['Omoplates serrées sur le banc.', 'Descends les haltères au niveau de la poitrine.', 'Pousse en rapprochant légèrement les haltères.'] },
  { id: 'db_floor_press', name: 'Floor press haltères', pattern: 'h_push', primary: ['Pectoraux', 'Triceps'], equipment: ['dumbbells'], level: 1, stress: ['no_floor'], met: 4.5, mode: 'reps',
    cues: ['Allongé au sol, coudes à 45°.', 'Descends jusqu’au contact des coudes avec le sol.', 'Pousse.'] },
  { id: 'bench_press', name: 'Développé couché barre', pattern: 'h_push', primary: ['Pectoraux', 'Triceps'], secondary: ['Épaules'], equipment: ['barbell', 'bench'], level: 2, stress: ['shoulder'], met: 5.5, mode: 'reps',
    cues: ['Pieds ancrés, omoplates rétractées.', 'Barre au bas des pectoraux.', 'Pousse en trajectoire légèrement arquée.'] },
  { id: 'band_chest_press', name: 'Développé élastique debout', pattern: 'h_push', primary: ['Pectoraux', 'Triceps'], equipment: ['bands'], level: 1, stress: [], met: 4, mode: 'reps',
    cues: ['Élastique accroché dans ton dos.', 'Pousse devant toi en expirant.', 'Reviens lentement.'] },
  // ——— Poussée verticale ———
  { id: 'db_shoulder_press', name: 'Développé épaules haltères', pattern: 'v_push', primary: ['Épaules', 'Triceps'], equipment: ['dumbbells'], level: 1, stress: ['shoulder', 'neck'], met: 4.5, mode: 'reps',
    cues: ['Haltères à hauteur d’oreilles.', 'Pousse au-dessus de la tête sans cambrer.', 'Redescends contrôlé.'] },
  { id: 'pike_push_up', name: 'Pompes piquées', pattern: 'v_push', primary: ['Épaules', 'Triceps'], equipment: [], level: 2, stress: ['shoulder', 'wrist', 'neck', 'no_floor'], met: 5, mode: 'reps',
    cues: ['Bassin haut, corps en V inversé.', 'Descends la tête entre les mains.', 'Repousse.'] },
  { id: 'band_overhead_press', name: 'Développé élastique', pattern: 'v_push', primary: ['Épaules'], equipment: ['bands'], level: 1, stress: ['shoulder'], met: 3.5, mode: 'reps',
    cues: ['Pieds sur l’élastique.', 'Pousse les mains au-dessus de la tête.', 'Gainage actif.'] },
  { id: 'db_lateral_raise', name: 'Élévations latérales', pattern: 'v_push', primary: ['Deltoïdes latéraux'], equipment: ['dumbbells'], level: 1, stress: [], met: 3.5, mode: 'reps',
    cues: ['Bras légèrement fléchis.', 'Monte jusqu’à hauteur d’épaules.', 'Descends lentement.'] },
  // ——— Tirage horizontal ———
  { id: 'db_row', name: 'Rowing haltère un bras', pattern: 'h_pull', primary: ['Dorsaux', 'Rhomboïdes'], secondary: ['Biceps'], equipment: ['dumbbells'], level: 1, stress: [], met: 4.5, mode: 'reps',
    cues: ['Main et genou en appui, dos plat.', 'Tire le coude vers la hanche.', 'Redescends en étirant.'] },
  { id: 'band_row', name: 'Rowing élastique', pattern: 'h_pull', primary: ['Dorsaux', 'Rhomboïdes'], equipment: ['bands'], level: 1, stress: [], met: 3.5, mode: 'reps',
    cues: ['Élastique accroché devant toi.', 'Tire en serrant les omoplates.', 'Reviens lentement.'] },
  { id: 'inverted_row', name: 'Rowing inversé sous une table', pattern: 'h_pull', primary: ['Dorsaux', 'Biceps'], equipment: [], level: 2, stress: ['no_floor'], met: 4.5, mode: 'reps',
    cues: ['Allongé sous une table solide, mains au bord.', 'Corps gainé, tire la poitrine vers la table.', 'Redescends contrôlé.'], pitfall: 'Utiliser une table instable : vérifie toujours la solidité.' },
  { id: 'towel_row', name: 'Tirage serviette à la porte', pattern: 'h_pull', primary: ['Dorsaux', 'Biceps'], equipment: [], level: 1, stress: [], met: 3.5, mode: 'reps',
    cues: ['Serviette autour d’une poignée de porte fermée et solide.', 'Penche-toi en arrière, bras tendus.', 'Tire-toi vers la porte.'] },
  { id: 'barbell_row', name: 'Rowing barre', pattern: 'h_pull', primary: ['Dorsaux', 'Trapèzes'], secondary: ['Lombaires'], equipment: ['barbell'], level: 2, stress: ['lower_back'], met: 5, mode: 'reps',
    cues: ['Buste penché à 45°, dos gainé.', 'Tire la barre vers le nombril.', 'Contrôle la descente.'] },
  { id: 'cable_row', name: 'Tirage horizontal poulie', pattern: 'h_pull', primary: ['Dorsaux', 'Rhomboïdes'], equipment: ['machines'], level: 1, stress: [], met: 4, mode: 'reps',
    cues: ['Buste droit.', 'Tire la poignée vers le ventre.', 'Relâche sans arrondir le dos.'] },
  // ——— Tirage vertical ———
  { id: 'pull_up', name: 'Tractions', pattern: 'v_pull', primary: ['Dorsaux', 'Biceps'], equipment: ['pullup_bar'], level: 3, stress: ['shoulder', 'wrist'], met: 6, mode: 'reps',
    cues: ['Prise un peu plus large que les épaules.', 'Tire les coudes vers les côtes.', 'Menton au-dessus de la barre, redescends tendu.'] },
  { id: 'negative_pull_up', name: 'Tractions négatives', pattern: 'v_pull', primary: ['Dorsaux', 'Biceps'], equipment: ['pullup_bar'], level: 2, stress: ['shoulder'], met: 5, mode: 'reps',
    cues: ['Saute pour avoir le menton au-dessus de la barre.', 'Redescends en 4 à 5 secondes.'] },
  { id: 'lat_pulldown', name: 'Tirage vertical poulie', pattern: 'v_pull', primary: ['Dorsaux'], secondary: ['Biceps'], equipment: ['machines'], level: 1, stress: [], met: 4, mode: 'reps',
    cues: ['Cuisses calées.', 'Tire la barre vers le haut de la poitrine.', 'Remonte en contrôlant.'] },
  { id: 'band_pulldown', name: 'Tirage élastique haut', pattern: 'v_pull', primary: ['Dorsaux'], equipment: ['bands'], level: 1, stress: [], met: 3.5, mode: 'reps',
    cues: ['Élastique accroché en hauteur.', 'Tire vers la poitrine en abaissant les épaules.'] },
  { id: 'prone_ytw', name: 'Y-T-W allongé', pattern: 'v_pull', primary: ['Trapèzes inférieurs', 'Rhomboïdes'], equipment: [], level: 1, stress: ['no_floor'], met: 3, mode: 'reps',
    cues: ['Allongé sur le ventre, front au sol.', 'Lève les bras en Y, puis T, puis W.', 'Pouces vers le ciel.'] },
  // ——— Gainage ———
  { id: 'plank', name: 'Planche', pattern: 'core', primary: ['Abdominaux', 'Gainage'], equipment: [], level: 1, stress: ['no_floor', 'shoulder'], met: 3.5, mode: 'time',
    cues: ['Avant-bras sous les épaules.', 'Corps aligné, serre fessiers et abdos.', 'Respire.'], pitfall: 'Fesses trop hautes ou bassin qui s’affaisse.' },
  { id: 'dead_bug', name: 'Dead bug', pattern: 'core', primary: ['Abdominaux profonds'], equipment: [], level: 1, stress: ['no_floor'], met: 3, mode: 'reps',
    cues: ['Sur le dos, bras et genoux à 90°.', 'Allonge bras et jambe opposés sans décoller le bas du dos.', 'Alterne.'] },
  { id: 'side_plank', name: 'Planche latérale', pattern: 'core', primary: ['Obliques'], equipment: [], level: 2, stress: ['no_floor', 'shoulder'], met: 3.5, mode: 'time',
    cues: ['Coude sous l’épaule.', 'Bassin haut, corps aligné.', 'Change de côté à mi-temps.'] },
  { id: 'bird_dog', name: 'Bird dog', pattern: 'core', primary: ['Lombaires', 'Gainage'], equipment: [], level: 1, stress: ['no_floor', 'wrist'], met: 3, mode: 'reps',
    cues: ['À quatre pattes.', 'Allonge bras et jambe opposés.', 'Bassin immobile.'] },
  { id: 'pallof_press', name: 'Pallof press', pattern: 'core', primary: ['Obliques', 'Gainage'], equipment: ['bands'], level: 1, stress: [], met: 3, mode: 'reps',
    cues: ['Élastique accroché sur le côté.', 'Pousse devant toi sans tourner.', 'Résiste à la rotation.'] },
  { id: 'standing_crunch', name: 'Crunch debout genou-coude', pattern: 'core', primary: ['Abdominaux', 'Obliques'], equipment: [], level: 1, stress: [], met: 3.5, mode: 'reps',
    cues: ['Debout, mains derrière la tête.', 'Ramène le genou vers le coude opposé.', 'Alterne en contrôlant.'] },
  { id: 'farmer_carry', name: 'Marche du fermier', pattern: 'core', primary: ['Gainage', 'Avant-bras', 'Trapèzes'], equipment: ['dumbbells'], level: 1, stress: [], met: 5, mode: 'time',
    cues: ['Haltères lourds le long du corps.', 'Marche à petits pas, épaules basses.', 'Buste droit.'] },
  { id: 'hollow_hold', name: 'Hollow hold', pattern: 'core', primary: ['Abdominaux'], equipment: [], level: 2, stress: ['no_floor', 'lower_back'], met: 3.5, mode: 'time',
    cues: ['Sur le dos, bas du dos plaqué.', 'Décolle épaules et jambes.', 'Tiens la position.'] },
  // ——— Bras / mollets ———
  { id: 'db_curl', name: 'Curl haltères', pattern: 'arms', primary: ['Biceps'], equipment: ['dumbbells'], level: 1, stress: [], met: 3, mode: 'reps',
    cues: ['Coudes fixes le long du corps.', 'Monte en supination.', 'Descends lentement.'] },
  { id: 'band_curl', name: 'Curl élastique', pattern: 'arms', primary: ['Biceps'], equipment: ['bands'], level: 1, stress: [], met: 3, mode: 'reps',
    cues: ['Pieds sur l’élastique.', 'Fléchis les coudes.', 'Contrôle le retour.'] },
  { id: 'db_overhead_triceps', name: 'Extension triceps au-dessus de la tête', pattern: 'arms', primary: ['Triceps'], equipment: ['dumbbells'], level: 1, stress: ['shoulder'], met: 3, mode: 'reps',
    cues: ['Haltère tenue à deux mains derrière la tête.', 'Tends les bras sans écarter les coudes.'] },
  { id: 'bench_dips', name: 'Dips sur chaise', pattern: 'arms', primary: ['Triceps'], equipment: [], level: 2, stress: ['shoulder', 'wrist'], met: 4, mode: 'reps',
    cues: ['Mains au bord d’une chaise stable.', 'Descends les fesses en fléchissant les coudes.', 'Remonte.'] },
  { id: 'calf_raise', name: 'Mollets debout', pattern: 'calves', primary: ['Mollets'], equipment: [], level: 1, stress: ['ankle'], met: 3, mode: 'reps',
    cues: ['Monte sur la pointe des pieds.', 'Tiens 1 s en haut.', 'Redescends lentement.'] },
  // ——— Conditionnement (HIIT) ———
  { id: 'jumping_jacks', name: 'Jumping jacks', pattern: 'conditioning', primary: ['Cardio'], equipment: [], level: 1, stress: ['no_jumping', 'ankle', 'knee', 'cardiac'], met: 8, mode: 'time',
    cues: ['Saute en écartant bras et jambes.', 'Reviens pieds joints.', 'Atterrissage souple.'] },
  { id: 'step_jacks', name: 'Jacks sans saut', pattern: 'conditioning', primary: ['Cardio'], equipment: [], level: 1, stress: [], met: 5, mode: 'time',
    cues: ['Écarte une jambe puis l’autre en levant les bras.', 'Rythme soutenu, sans impact.'] },
  { id: 'burpees', name: 'Burpees', pattern: 'conditioning', primary: ['Cardio', 'Corps entier'], equipment: [], level: 2, stress: ['no_jumping', 'wrist', 'knee', 'lower_back', 'no_floor', 'cardiac'], met: 10, mode: 'time',
    cues: ['Squat, mains au sol.', 'Jambes en arrière en planche.', 'Reviens et saute.'] },
  { id: 'mountain_climbers', name: 'Mountain climbers', pattern: 'conditioning', primary: ['Cardio', 'Gainage'], equipment: [], level: 1, stress: ['wrist', 'shoulder', 'no_floor', 'cardiac'], met: 8, mode: 'time',
    cues: ['Position de planche bras tendus.', 'Ramène les genoux vers la poitrine en alternance.', 'Bassin bas.'] },
  { id: 'high_knees', name: 'Montées de genoux', pattern: 'conditioning', primary: ['Cardio'], equipment: [], level: 1, stress: ['no_jumping', 'knee', 'ankle', 'cardiac'], met: 8, mode: 'time',
    cues: ['Cours sur place en montant les genoux.', 'Reste sur l’avant du pied.'] },
  { id: 'marching_knees', name: 'Marche genoux hauts', pattern: 'conditioning', primary: ['Cardio'], equipment: [], level: 1, stress: [], met: 4.5, mode: 'time',
    cues: ['Marche sur place en montant les genoux.', 'Balance les bras, rythme dynamique.'] },
  { id: 'shadow_boxing', name: 'Shadow boxing', pattern: 'conditioning', primary: ['Cardio', 'Épaules'], equipment: [], level: 1, stress: [], met: 6, mode: 'time',
    cues: ['Garde haute, pieds mobiles.', 'Enchaîne directs et crochets.', 'Expire à chaque coup.'] },
  { id: 'skater_hops', name: 'Sauts du patineur', pattern: 'conditioning', primary: ['Cardio', 'Fessiers'], equipment: [], level: 2, stress: ['no_jumping', 'knee', 'ankle', 'cardiac'], met: 8, mode: 'time',
    cues: ['Saute latéralement d’un pied sur l’autre.', 'Amortis la réception.'] },
  { id: 'jump_rope', name: 'Corde à sauter', pattern: 'conditioning', primary: ['Cardio', 'Mollets'], equipment: ['jump_rope'], level: 2, stress: ['no_jumping', 'ankle', 'cardiac'], met: 10, mode: 'time',
    cues: ['Petits sauts sur l’avant du pied.', 'Les poignets font tourner la corde.'] },
  { id: 'db_thruster', name: 'Thrusters haltères', pattern: 'conditioning', primary: ['Corps entier'], equipment: ['dumbbells'], level: 2, stress: ['knee', 'shoulder', 'cardiac'], met: 8, mode: 'time',
    cues: ['Squat avec haltères aux épaules.', 'Remonte et pousse au-dessus de la tête en un mouvement.'] },
  { id: 'rower_sprint', name: 'Rameur — intervalles', pattern: 'conditioning', primary: ['Cardio', 'Dos', 'Jambes'], equipment: ['cardio_machine'], level: 1, stress: ['lower_back', 'cardiac'], met: 9, mode: 'time',
    cues: ['Jambes, puis buste, puis bras.', 'Retour dans l’ordre inverse.'] },
  // ——— Cardio continu ———
  { id: 'brisk_walk', name: 'Marche rapide', pattern: 'steady_cardio', primary: ['Cardio'], equipment: [], level: 1, stress: [], met: 4.3, mode: 'time',
    cues: ['Allure où tu peux parler mais pas chanter.', 'Bras actifs, foulée naturelle.'] },
  { id: 'jog', name: 'Footing en endurance', pattern: 'steady_cardio', primary: ['Cardio', 'Jambes'], equipment: [], level: 2, stress: ['knee', 'ankle', 'no_jumping'], met: 8, mode: 'time',
    cues: ['Allure conversationnelle (zone 2).', 'Petites foulées, cadence élevée.'] },
  { id: 'bike', name: 'Vélo / vélo d’appartement', pattern: 'steady_cardio', primary: ['Cardio', 'Quadriceps'], equipment: ['cardio_machine'], level: 1, stress: [], met: 6.5, mode: 'time',
    cues: ['Selle à hauteur de hanche.', 'Résistance modérée, cadence régulière.'] },
  { id: 'elliptical', name: 'Elliptique', pattern: 'steady_cardio', primary: ['Cardio'], equipment: ['cardio_machine'], level: 1, stress: [], met: 5.5, mode: 'time',
    cues: ['Garde le buste droit.', 'Pousse avec les jambes, accompagne avec les bras.'] },
  { id: 'rower_steady', name: 'Rameur endurance', pattern: 'steady_cardio', primary: ['Cardio', 'Dos'], equipment: ['cardio_machine'], level: 1, stress: ['lower_back'], met: 7, mode: 'time',
    cues: ['Cadence 20–24 coups/min.', 'Respiration calme.'] },
  // ——— Mobilité ———
  { id: 'cat_cow', name: 'Chat-vache', pattern: 'mobility', primary: ['Colonne'], equipment: [], level: 1, stress: ['no_floor', 'wrist'], met: 2.5, mode: 'time',
    cues: ['À quatre pattes.', 'Arrondis puis creuse le dos lentement avec la respiration.'] },
  { id: 'worlds_greatest', name: 'World’s greatest stretch', pattern: 'mobility', primary: ['Hanches', 'Thoracique'], equipment: [], level: 1, stress: ['knee'], met: 3, mode: 'time',
    cues: ['Fente avant, main au sol.', 'Ouvre le bras vers le ciel en tournant le buste.', 'Alterne.'] },
  { id: 'hip_flexor_stretch', name: 'Étirement fléchisseurs de hanche', pattern: 'mobility', primary: ['Psoas'], equipment: [], level: 1, stress: ['knee'], met: 2.3, mode: 'time',
    cues: ['Genou au sol, pied avant devant.', 'Bascule le bassin, avance doucement.'] },
  { id: 'thoracic_rotation', name: 'Rotations thoraciques', pattern: 'mobility', primary: ['Thoracique'], equipment: [], level: 1, stress: [], met: 2.3, mode: 'time',
    cues: ['Assis ou debout, bras croisés.', 'Tourne le buste lentement de chaque côté.'] },
  { id: 'hamstring_stretch', name: 'Étirement ischios debout', pattern: 'mobility', primary: ['Ischios'], equipment: [], level: 1, stress: [], met: 2.3, mode: 'time',
    cues: ['Talon posé devant, jambe tendue.', 'Penche-toi dos droit jusqu’à sentir l’étirement.'] },
  { id: 'childs_pose', name: 'Posture de l’enfant', pattern: 'mobility', primary: ['Dos', 'Hanches'], equipment: [], level: 1, stress: ['no_floor', 'knee'], met: 2, mode: 'time',
    cues: ['Assis sur les talons, bras devant.', 'Relâche le front vers le sol, respire.'] },
  { id: 'shoulder_circles', name: 'Cercles d’épaules & bras', pattern: 'mobility', primary: ['Épaules'], equipment: [], level: 1, stress: [], met: 2.3, mode: 'time',
    cues: ['Grands cercles lents vers l’avant puis l’arrière.', 'Amplitude sans douleur.'] },
  { id: 'ankle_rocks', name: 'Mobilité chevilles', pattern: 'mobility', primary: ['Chevilles'], equipment: [], level: 1, stress: [], met: 2, mode: 'time',
    cues: ['Pied devant un mur.', 'Avance le genou vers le mur sans décoller le talon.'] },
  { id: 'hip_90_90', name: 'Mobilité 90/90', pattern: 'mobility', primary: ['Hanches'], equipment: [], level: 1, stress: ['no_floor', 'hip'], met: 2.3, mode: 'time',
    cues: ['Assis, jambes à 90°.', 'Bascule les genoux d’un côté à l’autre.'] },
  { id: 'box_breathing', name: 'Respiration carrée', pattern: 'mobility', primary: ['Récupération'], equipment: [], level: 1, stress: [], met: 1.3, mode: 'time',
    cues: ['Inspire 4 s, bloque 4 s, expire 4 s, bloque 4 s.', 'Répète calmement.'] },
];

export const EXERCISES: Exercise[] = DEFS.map((d) => ({
  ...d,
  secondary: d.secondary ?? [],
  pitfall: d.pitfall ?? 'Va à ton rythme : la qualité du mouvement prime sur la vitesse.',
}));

const INDEX = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const e = INDEX.get(id);
  if (!e) throw new Error(`Exercice inconnu: ${id}`);
  return e;
}

export function findExercise(id: string): Exercise | undefined {
  return INDEX.get(id);
}

export const LEVEL_NUM: Record<Level, 1 | 2 | 3> = { beginner: 1, intermediate: 2, advanced: 3 };

export interface EligibilityContext {
  equipment: Equipment[];
  limitations: Limitation[];
  level: Level;
}

export function isEligible(e: Exercise, ctx: EligibilityContext): boolean {
  if (!e.equipment.every((eq) => ctx.equipment.includes(eq))) return false;
  if (e.stress.some((s) => ctx.limitations.includes(s))) return false;
  return e.level <= LEVEL_NUM[ctx.level] + (ctx.level === 'beginner' ? 0 : 1);
}

export function eligibleFor(pattern: Pattern, ctx: EligibilityContext): Exercise[] {
  return EXERCISES.filter((e) => e.pattern === pattern && isEligible(e, ctx));
}

const RELATED: Partial<Record<Pattern, Pattern[]>> = {
  squat: ['lunge', 'hinge'],
  lunge: ['squat', 'hinge'],
  hinge: ['lunge', 'core'],
  h_push: ['v_push', 'arms'],
  v_push: ['h_push', 'arms'],
  h_pull: ['v_pull', 'arms'],
  v_pull: ['h_pull', 'arms'],
  core: ['mobility'],
  conditioning: ['steady_cardio'],
  steady_cardio: ['conditioning'],
  arms: ['h_push', 'h_pull'],
  calves: ['mobility'],
};

export type SwapReason = 'pain' | 'equipment' | 'too_hard' | 'dislike';

export const SWAP_REASONS: { id: SwapReason; label: string }[] = [
  { id: 'pain', label: 'Douleur / gêne' },
  { id: 'equipment', label: 'Pas le matériel' },
  { id: 'too_hard', label: 'Trop difficile' },
  { id: 'dislike', label: 'Je n’aime pas' },
];

/**
 * Alternatives immédiates à un exercice (bouton « Je ne peux pas faire cet exercice »).
 * On cherche d'abord le même schéma moteur, puis des schémas proches.
 */
export function findAlternatives(
  exerciseId: string,
  reason: SwapReason,
  ctx: EligibilityContext,
  exclude: string[] = [],
): Exercise[] {
  const original = getExercise(exerciseId);
  let localCtx = ctx;
  if (reason === 'pain') {
    localCtx = { ...ctx, limitations: [...new Set([...ctx.limitations, ...original.stress.filter((s) => s !== 'cardiac')])] };
  }
  if (reason === 'equipment') {
    localCtx = { ...localCtx, equipment: ctx.equipment.filter((e) => !original.equipment.includes(e)) };
  }
  const banned = new Set([exerciseId, ...exclude]);
  const rank = (list: Exercise[]) =>
    list
      .filter((e) => !banned.has(e.id))
      .sort((a, b) => {
        if (reason === 'too_hard' || reason === 'pain') return a.level - b.level || a.stress.length - b.stress.length;
        return Math.abs(a.level - original.level) - Math.abs(b.level - original.level);
      })
      .filter((e) => (reason === 'too_hard' ? e.level <= original.level : true));

  const same = rank(eligibleFor(original.pattern, localCtx));
  if (same.length >= 2) return same.slice(0, 3);
  const related = (RELATED[original.pattern] ?? []).flatMap((p) => rank(eligibleFor(p, localCtx)));
  const result = [...same, ...related].slice(0, 3);
  if (result.length) return result;
  return rank(eligibleFor('mobility', localCtx)).slice(0, 2);
}
