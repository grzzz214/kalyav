import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { UserProfile } from '../core/types';
import { computeTargets } from '../core/nutrition/calculator';
import { validateTargetWeight } from '../core/coach/safety';
import { dayLabel } from '../core/utils/date';
import { useStore } from '../data/store';
import { requestNotificationPermission } from '../services/notifications';
import { Button, Card, ChipGroup, Field, FadeIn, Muted, NumberStepper, Row, tap } from '../ui/components/primitives';
import { ProgressBar } from '../ui/components/charts';
import { TimeStepper } from '../ui/components/TimeStepper';
import { Disclaimer } from '../ui/components/coach';
import {
  ACTIVITY_OPTIONS,
  ALLERGEN_OPTIONS,
  DIET_OPTIONS,
  EQUIPMENT_OPTIONS,
  GOAL_EMOJI,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  LIMITATION_OPTIONS,
  SEX_OPTIONS,
  STYLE_OPTIONS,
} from '../ui/labels';
import { colors, font, radius, space } from '../ui/theme';

type Draft = Omit<UserProfile, 'createdAt' | 'likedFoods' | 'dislikedFoods'> & { liked: string; disliked: string };

const INITIAL: Draft = {
  firstName: '',
  age: 30,
  sex: 'female',
  heightCm: 170,
  weightKg: 70,
  goal: 'fat_loss',
  targetWeightKg: 65,
  level: 'beginner',
  sessionsPerWeek: 3,
  availableDays: [0, 2, 4, 5],
  sessionMinutes: 45,
  preferredStyles: ['mixed'],
  equipment: [],
  diet: 'omnivore',
  eatingHabits: '',
  mealsPerDay: 3,
  allergies: [],
  liked: '',
  disliked: '',
  bedtime: '23:00',
  wakeTime: '07:00',
  trainingTime: '18:00',
  occupation: '',
  activityLevel: 'light',
  limitations: [],
  limitationNotes: '',
};

const STEPS = ['Toi', 'Ton objectif', 'Ton sport', 'Ton corps', 'Ton assiette', 'Ton rythme', 'Ton plan'];

function Q({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ gap: space.sm, marginBottom: space.lg }}>
      <Text style={{ ...font.h3, color: colors.text }}>{label}</Text>
      {hint ? <Muted>{hint}</Muted> : null}
      {children}
    </View>
  );
}

const splitList = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(INITIAL);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const targetWarning = validateTargetWeight(d.heightCm, d.targetWeightKg);
  const profile: UserProfile = useMemo(
    () => ({
      ...d,
      firstName: d.firstName.trim() || 'Champion',
      likedFoods: splitList(d.liked),
      dislikedFoods: splitList(d.disliked),
      sessionsPerWeek: Math.min(d.sessionsPerWeek, Math.max(1, d.availableDays.length)),
      createdAt: new Date().toISOString(),
    }),
    [d],
  );
  const targets = useMemo(() => computeTargets(profile), [profile]);

  const canNext = [
    d.firstName.trim().length > 0,
    !targetWarning,
    d.availableDays.length > 0,
    true,
    true,
    true,
    true,
  ][step];

  const finish = async () => {
    complete(profile);
    await requestNotificationPermission().catch(() => false);
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ ...font.tiny, color: colors.accent }}>
              Étape {step + 1}/{STEPS.length} · {STEPS[step]}
            </Text>
            {step > 0 ? (
              <Pressable onPress={() => setStep(step - 1)} hitSlop={10}>
                <Text style={{ ...font.small, color: colors.textDim }}>← Retour</Text>
              </Pressable>
            ) : null}
          </Row>
          <ProgressBar value={(step + 1) / STEPS.length} />
        </View>

        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <FadeIn key={step}>
            {step === 0 && (
              <>
                <Text style={{ ...font.hero, color: colors.text, marginBottom: space.sm }}>Ton coach,{'\n'}24 h/24.</Text>
                <Muted style={{ marginBottom: space.xl }}>
                  Quelques questions pour construire ton programme, ton plan nutrition et tes rappels. Tout reste modifiable.
                </Muted>
                <Field label="Ton prénom" value={d.firstName} onChangeText={(t) => set('firstName', t)} placeholder="Ex. Camille" autoFocus />
                <Q label="Âge">
                  <NumberStepper value={d.age} onChange={(v) => set('age', v)} min={14} max={90} unit="ans" />
                </Q>
                <Q label="Sexe" hint="Utilisé uniquement pour estimer ta dépense énergétique.">
                  <ChipGroup options={SEX_OPTIONS} value={d.sex} onChange={(v) => set('sex', v as Draft['sex'])} />
                </Q>
              </>
            )}

            {step === 1 && (
              <>
                <Q label="Ton objectif principal">
                  <View style={{ gap: space.sm }}>
                    {GOAL_OPTIONS.map((g) => (
                      <Pressable
                        key={g.id}
                        onPress={() => {
                          tap();
                          set('goal', g.id);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.md,
                          padding: space.md,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: d.goal === g.id ? colors.accent : colors.border,
                          backgroundColor: d.goal === g.id ? colors.accent + '14' : colors.surface,
                        }}
                      >
                        <Text style={{ fontSize: 22 }}>{GOAL_EMOJI[g.id]}</Text>
                        <Text style={{ ...font.h3, color: colors.text }}>{g.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Q>
                <Q label="Taille">
                  <NumberStepper value={d.heightCm} onChange={(v) => set('heightCm', v)} min={120} max={230} unit="cm" />
                </Q>
                <Q label="Poids actuel">
                  <NumberStepper value={d.weightKg} onChange={(v) => set('weightKg', v)} min={35} max={250} step={0.5} decimals={1} unit="kg" />
                </Q>
                <Q label="Poids cible">
                  <NumberStepper value={d.targetWeightKg} onChange={(v) => set('targetWeightKg', v)} min={35} max={250} step={0.5} decimals={1} unit="kg" />
                  {targetWarning ? <Text style={{ ...font.small, color: colors.warning }}>{targetWarning}</Text> : null}
                </Q>
              </>
            )}

            {step === 2 && (
              <>
                <Q label="Niveau sportif">
                  <ChipGroup options={LEVEL_OPTIONS} value={d.level} onChange={(v) => set('level', v as Draft['level'])} />
                </Q>
                <Q label="Jours disponibles" hint="Je répartis les séances pour laisser de la récupération.">
                  <ChipGroup
                    multi
                    options={[0, 1, 2, 3, 4, 5, 6].map((i) => ({ id: i, label: dayLabel(i) }))}
                    value={d.availableDays}
                    onChange={(v) => set('availableDays', (v as number[]).sort())}
                  />
                </Q>
                <Q label="Séances souhaitées par semaine">
                  <NumberStepper value={d.sessionsPerWeek} onChange={(v) => set('sessionsPerWeek', v)} min={1} max={6} />
                  {d.sessionsPerWeek > d.availableDays.length ? (
                    <Muted>Limité à {d.availableDays.length} (jours disponibles).</Muted>
                  ) : null}
                </Q>
                <Q label="Durée disponible par séance">
                  <ChipGroup
                    options={[20, 30, 45, 60, 75, 90].map((m) => ({ id: m, label: `${m} min` }))}
                    value={d.sessionMinutes}
                    onChange={(v) => set('sessionMinutes', v as number)}
                  />
                </Q>
                <Q label="Heure d’entraînement habituelle">
                  <TimeStepper value={d.trainingTime} onChange={(v) => set('trainingTime', v)} />
                </Q>
                <Q label="Ce que tu préfères">
                  <ChipGroup multi options={STYLE_OPTIONS} value={d.preferredStyles} onChange={(v) => set('preferredStyles', v as Draft['preferredStyles'])} />
                </Q>
                <Q label="Équipement disponible" hint="Rien ? Pas de souci : tout fonctionne au poids du corps.">
                  <ChipGroup multi options={EQUIPMENT_OPTIONS} value={d.equipment} onChange={(v) => set('equipment', v as Draft['equipment'])} />
                </Q>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={{ ...font.h1, color: colors.text, marginBottom: space.sm }}>Limitations & blessures</Text>
                <Muted style={{ marginBottom: space.lg }}>
                  J’exclus automatiquement les mouvements qui sollicitent ces zones. Ta sécurité passe avant tout.
                </Muted>
                <Q label="Zones à ménager / mouvements à éviter">
                  <ChipGroup multi color={colors.warning} options={LIMITATION_OPTIONS} value={d.limitations} onChange={(v) => set('limitations', v as Draft['limitations'])} />
                </Q>
                <Field
                  label="Précisions (facultatif)"
                  value={d.limitationNotes}
                  onChangeText={(t) => set('limitationNotes', t)}
                  placeholder="Ex. entorse cheville gauche en 2024"
                  multiline
                />
                <Disclaimer />
              </>
            )}

            {step === 4 && (
              <>
                <Q label="Habitudes alimentaires">
                  <ChipGroup options={DIET_OPTIONS} value={d.diet} onChange={(v) => set('diet', v as Draft['diet'])} />
                </Q>
                <Field
                  label="Comment manges-tu aujourd’hui ? (facultatif)"
                  value={d.eatingHabits}
                  onChangeText={(t) => set('eatingHabits', t)}
                  placeholder="Ex. je saute souvent le petit-déj, je mange à la cantine"
                  multiline
                />
                <Q label="Repas par jour">
                  <NumberStepper value={d.mealsPerDay} onChange={(v) => set('mealsPerDay', v)} min={2} max={6} />
                </Q>
                <Q label="Allergies / intolérances">
                  <ChipGroup multi color={colors.danger} options={ALLERGEN_OPTIONS} value={d.allergies} onChange={(v) => set('allergies', v as Draft['allergies'])} />
                </Q>
                <Field label="Aliments que tu aimes" value={d.liked} onChangeText={(t) => set('liked', t)} placeholder="poulet, riz, avocat…" />
                <Field label="Aliments que tu n’aimes pas" value={d.disliked} onChangeText={(t) => set('disliked', t)} placeholder="brocoli, thon…" />
              </>
            )}

            {step === 5 && (
              <>
                <Q label="Heure de coucher">
                  <TimeStepper value={d.bedtime} onChange={(v) => set('bedtime', v)} />
                </Q>
                <Q label="Heure de réveil">
                  <TimeStepper value={d.wakeTime} onChange={(v) => set('wakeTime', v)} />
                </Q>
                <Field label="Activité professionnelle" value={d.occupation} onChangeText={(t) => set('occupation', t)} placeholder="Ex. développeur, infirmière, étudiant" />
                <Q label="Niveau d’activité quotidien (hors sport)">
                  <View style={{ gap: space.sm }}>
                    <ChipGroup options={ACTIVITY_OPTIONS} value={d.activityLevel} onChange={(v) => set('activityLevel', v as Draft['activityLevel'])} />
                  </View>
                </Q>
              </>
            )}

            {step === 6 && (
              <>
                <Text style={{ ...font.hero, color: colors.text }}>Ton plan est prêt, {profile.firstName}.</Text>
                <Muted style={{ marginVertical: space.md }}>Voici tes objectifs de départ. Je les ajusterai selon tes tendances, jamais sur une seule journée.</Muted>
                <Card>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
                    {[
                      ['🔥', `${targets.kcal}`, 'kcal / jour'],
                      ['🥩', `${targets.protein} g`, 'protéines'],
                      ['🍚', `${targets.carbs} g`, 'glucides'],
                      ['🥑', `${targets.fat} g`, 'lipides'],
                      ['💧', `${(targets.waterMl / 1000).toFixed(1).replace('.', ',')} L`, 'eau'],
                      ['👟', targets.steps.toLocaleString('fr-FR'), 'pas'],
                      ['🏋️', `${profile.sessionsPerWeek} × ${profile.sessionMinutes} min`, 'par semaine'],
                      ['😴', `${targets.sleepHours} h`, 'sommeil'],
                    ].map(([e, v, l]) => (
                      <View key={l} style={{ width: '44%' }}>
                        <Text style={{ fontSize: 18 }}>{e}</Text>
                        <Text style={{ ...font.h2, color: colors.text }}>{v}</Text>
                        <Muted>{l}</Muted>
                      </View>
                    ))}
                  </View>
                </Card>
                <View style={{ gap: 6, marginVertical: space.lg }}>
                  {targets.notes.map((n) => (
                    <Muted key={n}>• {n}</Muted>
                  ))}
                </View>
                <Disclaimer />
              </>
            )}
          </FadeIn>
        </ScrollView>

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, backgroundColor: colors.bg + 'F2' }}>
          {step < STEPS.length - 1 ? (
            <Button label="Continuer" onPress={() => setStep(step + 1)} disabled={!canNext} />
          ) : (
            <Button label="C’est parti 🚀" onPress={finish} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
