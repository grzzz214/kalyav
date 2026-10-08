import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useStore } from '../data/store';
import { useCoach } from '../ui/useCoach';
import type { Difficulty, PainArea, TriState } from '../core/types';
import { trainingClearance, EMERGENCY_NOTE } from '../core/coach/safety';
import { Button, Card, ChipGroup, Field, Muted, NumberStepper, Screen, ScalePicker, tap } from '../ui/components/primitives';
import { DIFFICULTY_OPTIONS, PAIN_OPTIONS } from '../ui/labels';
import { colors, font, space } from '../ui/theme';

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm, marginBottom: space.md }}>
      <Text style={{ ...font.h3, color: colors.text }}>{label}</Text>
      {children}
    </View>
  );
}

const TRI: { id: TriState; label: string }[] = [
  { id: 'yes', label: 'Oui' },
  { id: 'partial', label: 'En partie' },
  { id: 'no', label: 'Non' },
];

export default function CheckIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const data = useCoach();
  const saveMorning = useStore((s) => s.saveMorningCheckIn);
  const saveEvening = useStore((s) => s.saveEveningCheckIn);
  const [mode, setMode] = useState<'morning' | 'evening'>(params.mode === 'evening' ? 'evening' : 'morning');

  const existingM = data?.snapshot.morning;
  const existingE = data?.state.eveningCheckIns.find((c) => c.date === data.date);
  const lastWeight = data?.analysis.weight.current ?? data?.profile.weightKg ?? 70;

  // Matin
  const [sleepHours, setSleepHours] = useState(existingM?.sleepHours ?? 7.5);
  const [sleepQuality, setSleepQuality] = useState<number | undefined>(existingM?.sleepQuality);
  const [energy, setEnergy] = useState<number | undefined>(existingM?.energy);
  const [fatigue, setFatigue] = useState<number | undefined>(existingM?.fatigue);
  const [motivation, setMotivation] = useState<number | undefined>(existingM?.motivation);
  const [hasPain, setHasPain] = useState(!!existingM?.pain);
  const [painArea, setPainArea] = useState<PainArea | undefined>(existingM?.pain?.area);
  const [painIntensity, setPainIntensity] = useState<number | undefined>(existingM?.pain?.intensity);
  const [alarming, setAlarming] = useState(!!existingM?.pain?.alarming);
  const [weigh, setWeigh] = useState(existingM?.weightKg !== undefined);
  const [weight, setWeight] = useState(existingM?.weightKg ?? Math.round(lastWeight * 10) / 10);

  // Soir
  const [trainingDone, setTrainingDone] = useState<TriState | undefined>(existingE?.trainingDone);
  const [nutrition, setNutrition] = useState<TriState | undefined>(existingE?.nutritionRespected);
  const [water, setWater] = useState(existingE?.waterMl ?? data?.snapshot.waterMl ?? 1500);
  const [mood, setMood] = useState<number | undefined>(existingE?.mood);
  const [difficulty, setDifficulty] = useState<Difficulty>(existingE?.difficulty ?? 'none');
  const [note, setNote] = useState(existingE?.note ?? '');
  const [result, setResult] = useState<string[] | null>(null);

  if (!data) return null;

  const morningValid = sleepQuality && energy && fatigue && motivation && (!hasPain || (painArea && painIntensity !== undefined));
  const eveningValid = trainingDone && nutrition && mood;

  const submitMorning = () => {
    const pain = hasPain && painArea ? { area: painArea, intensity: painIntensity ?? 0, alarming } : null;
    const c = { date: data.date, sleepHours, sleepQuality: sleepQuality!, energy: energy!, fatigue: fatigue!, motivation: motivation!, pain, weightKg: weigh ? weight : undefined };
    saveMorning(c);
    const d = trainingClearance({ ...c, createdAt: '' });
    setResult(
      d.messages.length
        ? d.messages
        : ['Feu vert : ta séance du jour reste au programme. Bonne journée !'],
    );
  };

  const submitEvening = () => {
    saveEvening({ date: data.date, trainingDone: trainingDone!, nutritionRespected: nutrition!, waterMl: water, mood: mood!, difficulty, note: note.trim() || undefined });
    const msgs = ['Merci. Je prends tout ça en compte pour demain.'];
    if (difficulty !== 'none') msgs.push('Difficulté notée : si elle revient, je te proposerai des solutions concrètes.');
    if (trainingDone === 'no') msgs.push('Séance manquée ? Aucun souci. On regarde la tendance sur la semaine, pas une journée.');
    setResult(msgs);
  };

  if (result) {
    return (
      <Screen edges={[]}>
        <Card accent={colors.accent}>
          <Text style={{ ...font.h1, color: colors.text, marginBottom: space.sm }}>{mode === 'morning' ? '☀️ C’est noté' : '🌙 Bonne soirée'}</Text>
          {result.map((m) => (
            <Text key={m} style={{ ...font.body, color: colors.textDim, marginBottom: 6 }}>
              {m}
            </Text>
          ))}
        </Card>
        <Button label="Voir mon plan du jour" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: mode === 'morning' ? 'Check-in du matin' : 'Bilan du soir' }} />
      <Screen edges={[]}>
        <ChipGroup
          options={[
            { id: 'morning', label: '☀️ Matin' },
            { id: 'evening', label: '🌙 Soir' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as 'morning' | 'evening')}
        />

        {mode === 'morning' ? (
          <>
            <Q label="Combien d’heures as-tu dormi ?">
              <NumberStepper value={sleepHours} onChange={setSleepHours} step={0.5} min={0} max={14} decimals={1} unit="h" />
            </Q>
            <Q label="Comment as-tu dormi ?">
              <ScalePicker value={sleepQuality} onChange={setSleepQuality} max={5} color={colors.sleep} lowLabel="Très mal" highLabel="Très bien" />
            </Q>
            <Q label="Niveau d’énergie">
              <ScalePicker value={energy} onChange={setEnergy} lowLabel="À plat" highLabel="Au top" />
            </Q>
            <Q label="Niveau de fatigue">
              <ScalePicker value={fatigue} onChange={setFatigue} color={colors.sport} lowLabel="Reposé" highLabel="Épuisé" />
            </Q>
            <Q label="Motivation">
              <ScalePicker value={motivation} onChange={setMotivation} color={colors.nutrition} />
            </Q>
            <Q label="Douleurs éventuelles ?">
              <ChipGroup
                options={[
                  { id: 'no', label: 'Aucune' },
                  { id: 'yes', label: 'Oui' },
                ]}
                value={hasPain ? 'yes' : 'no'}
                onChange={(v) => setHasPain(v === 'yes')}
                color={colors.warning}
              />
              {hasPain ? (
                <View style={{ gap: space.sm }}>
                  <ChipGroup options={PAIN_OPTIONS} value={painArea} onChange={(v) => setPainArea(v as PainArea)} color={colors.warning} />
                  <Muted>Intensité (0 = gêne légère, 10 = insupportable)</Muted>
                  <ScalePicker value={painIntensity} onChange={setPainIntensity} min={0} max={10} color={colors.warning} />
                  <Pressable
                    onPress={() => {
                      tap();
                      setAlarming(!alarming);
                    }}
                    style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.danger, backgroundColor: alarming ? colors.danger : 'transparent' }} />
                    <Text style={{ ...font.small, color: colors.text, flex: 1 }}>
                      Symptôme inhabituel (douleur thoracique, essoufflement, malaise, vertiges)
                    </Text>
                  </Pressable>
                  {alarming || painArea === 'chest' ? <Text style={{ ...font.small, color: colors.danger }}>{EMERGENCY_NOTE}</Text> : null}
                </View>
              ) : null}
            </Q>
            <Q label="Poids du jour">
              <ChipGroup
                options={[
                  { id: 'yes', label: 'Je me pèse' },
                  { id: 'no', label: 'Pas aujourd’hui' },
                ]}
                value={weigh ? 'yes' : 'no'}
                onChange={(v) => setWeigh(v === 'yes')}
              />
              {weigh ? <NumberStepper value={weight} onChange={setWeight} step={0.1} min={30} max={300} decimals={1} unit="kg" /> : null}
              <Muted>Idéalement le matin, à jeun, après être passé aux toilettes.</Muted>
            </Q>
            <Button label="Valider mon check-in" onPress={submitMorning} disabled={!morningValid} />
          </>
        ) : (
          <>
            <Q label="As-tu fait ton entraînement ?">
              <ChipGroup options={TRI} value={trainingDone} onChange={(v) => setTrainingDone(v as TriState)} />
            </Q>
            <Q label="As-tu respecté ton alimentation ?">
              <ChipGroup options={TRI} value={nutrition} onChange={(v) => setNutrition(v as TriState)} color={colors.nutrition} />
            </Q>
            <Q label="Combien d’eau as-tu bu ?">
              <NumberStepper value={water} onChange={setWater} step={250} min={0} max={6000} unit="ml" />
            </Q>
            <Q label="Comment te sens-tu ?">
              <ScalePicker value={mood} onChange={setMood} max={5} lowLabel="😞" highLabel="😄" />
            </Q>
            <Q label="Difficulté rencontrée ?">
              <ChipGroup options={DIFFICULTY_OPTIONS} value={difficulty} onChange={(v) => setDifficulty(v as Difficulty)} color={colors.warning} />
            </Q>
            <Field label="Un mot sur ta journée (facultatif)" value={note} onChangeText={setNote} multiline />
            <Button label="Valider mon bilan" onPress={submitEvening} disabled={!eveningValid} />
          </>
        )}
      </Screen>
    </>
  );
}
