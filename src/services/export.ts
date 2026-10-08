import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AppState } from '../core/types';

/** Export complet (JSON) + tableaux CSV lisibles dans un tableur. */
export function toJson(state: AppState): string {
  return JSON.stringify({ app: 'kalyav', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function csv(headers: string[], rows: unknown[][]): string {
  return [headers.join(';'), ...rows.map((r) => r.map(csvCell).join(';'))].join('\n');
}

export function toCsvBundle(state: AppState): Record<string, string> {
  return {
    'poids.csv': csv(['date', 'kg'], state.weights.map((w) => [w.date, w.kg])),
    'mensurations.csv': csv(
      ['date', 'taille_cm', 'hanches_cm', 'poitrine_cm', 'bras_cm', 'cuisse_cm', 'masse_grasse_pct', 'masse_musculaire_kg'],
      state.measurements.map((m) => [m.date, m.waistCm, m.hipCm, m.chestCm, m.armCm, m.thighCm, m.bodyFatPct, m.muscleMassKg]),
    ),
    'alimentation.csv': csv(
      ['date', 'repas', 'aliment', 'quantite', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres'],
      state.foodLog.map((f) => [f.date, f.slot, f.name, f.quantityLabel, Math.round(f.kcal), Math.round(f.protein), Math.round(f.carbs), Math.round(f.fat), Math.round(f.fiber)]),
    ),
    'seances.csv': csv(
      ['date', 'seance', 'duree_min', 'kcal', 'effort_rpe', 'terminee', 'mode_fatigue'],
      state.workouts.map((w) => [w.date, w.title, w.durationMin, w.kcal, w.rpe, w.completed ? 'oui' : 'non', w.fatigueMode ? 'oui' : 'non']),
    ),
    'checkins.csv': csv(
      ['date', 'sommeil_h', 'qualite', 'energie', 'fatigue', 'motivation', 'douleur_zone', 'douleur_intensite'],
      state.morningCheckIns.map((c) => [c.date, c.sleepHours, c.sleepQuality, c.energy, c.fatigue, c.motivation, c.pain?.area, c.pain?.intensity]),
    ),
    'activite.csv': csv(['date', 'pas', 'eau_ml'], state.activity.map((a) => [a.date, a.steps, a.waterMl])),
  };
}

export async function shareExport(state: AppState): Promise<void> {
  const name = `kalyav-export-${new Date().toISOString().slice(0, 10)}.json`;
  const content = toJson(state);
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exporter mes données' });
  }
}

export async function shareCsv(state: AppState): Promise<void> {
  const bundle = toCsvBundle(state);
  // Un seul fichier texte regroupant les tableaux, séparés par un titre.
  const content = Object.entries(bundle)
    .map(([n, c]) => `# ${n}\n${c}`)
    .join('\n\n');
  const name = `kalyav-tableaux-${new Date().toISOString().slice(0, 10)}.csv`;
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
}
