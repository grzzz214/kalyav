import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../data/store';
import { useCoach } from '../ui/useCoach';
import { Button, Card, Field, Muted, NumberStepper, Row, Screen, SectionTitle } from '../ui/components/primitives';
import { colors, font, space } from '../ui/theme';

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Saisie rapide : poids, mensurations, composition, pas. */
export default function LogScreen() {
  const data = useCoach();
  const logWeight = useStore((s) => s.logWeight);
  const logMeasurement = useStore((s) => s.logMeasurement);
  const setSteps = useStore((s) => s.setSteps);
  const last = data?.state.measurements.at(-1);
  const [weight, setWeight] = useState(Math.round((data?.analysis.weight.current ?? data?.profile.weightKg ?? 70) * 10) / 10);
  const [steps, setStepsValue] = useState(data?.snapshot.steps ?? 0);
  const [m, setM] = useState({ waist: '', hip: '', chest: '', arm: '', thigh: '', fat: '', muscle: '' });

  if (!data) return null;

  const save = () => {
    logWeight(weight, data.date);
    setSteps(steps, data.date);
    const measurement = {
      date: data.date,
      waistCm: num(m.waist),
      hipCm: num(m.hip),
      chestCm: num(m.chest),
      armCm: num(m.arm),
      thighCm: num(m.thigh),
      bodyFatPct: num(m.fat),
      muscleMassKg: num(m.muscle),
    };
    if (Object.entries(measurement).some(([k, v]) => k !== 'date' && v !== undefined)) logMeasurement(measurement);
    router.back();
  };

  const half = (label: string, key: keyof typeof m, placeholder?: string) => (
    <View style={{ flex: 1 }}>
      <Field label={label} keyboardType="decimal-pad" value={m[key]} onChangeText={(t) => setM({ ...m, [key]: t })} placeholder={placeholder} />
    </View>
  );

  return (
    <Screen edges={[]}>
      <SectionTitle>Poids du jour</SectionTitle>
      <NumberStepper value={weight} onChange={setWeight} step={0.1} min={30} max={300} decimals={1} unit="kg" />
      <Muted>Le coach lit la tendance sur 2 à 4 semaines : une pesée isolée ne change rien à ton plan.</Muted>

      <SectionTitle>Pas du jour</SectionTitle>
      <NumberStepper value={steps} onChange={setStepsValue} step={500} min={0} max={60000} />
      <Muted>Bientôt synchronisés automatiquement avec Apple Santé / Health Connect.</Muted>

      <SectionTitle>Mensurations (cm)</SectionTitle>
      <Card>
        <Row>
          {half('Tour de taille', 'waist', last?.waistCm ? String(last.waistCm) : undefined)}
          {half('Hanches', 'hip', last?.hipCm ? String(last.hipCm) : undefined)}
        </Row>
        <Row>
          {half('Poitrine', 'chest', last?.chestCm ? String(last.chestCm) : undefined)}
          {half('Bras', 'arm', last?.armCm ? String(last.armCm) : undefined)}
        </Row>
        <Row>{half('Cuisse', 'thigh', last?.thighCm ? String(last.thighCm) : undefined)}<View style={{ flex: 1 }} /></Row>
      </Card>

      <SectionTitle>Composition (si disponible)</SectionTitle>
      <Card>
        <Row>
          {half('Masse grasse (%)', 'fat')}
          {half('Masse musculaire (kg)', 'muscle')}
        </Row>
        <Text style={{ ...font.small, color: colors.textMute }}>Balance à impédance : mesure-toi toujours dans les mêmes conditions.</Text>
      </Card>
      <Button label="Enregistrer" onPress={save} style={{ marginTop: space.md }} />
    </Screen>
  );
}
