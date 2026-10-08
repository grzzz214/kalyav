import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { findExercise, type Pattern } from '../../core/training/exercises';
import { Card, Muted, Pill, Row, Screen, SectionTitle, tap } from '../../ui/components/primitives';
import { EQUIPMENT_OPTIONS } from '../../ui/labels';
import { colors, font, radius, space } from '../../ui/theme';

const PATTERN_EMOJI: Record<Pattern, string> = {
  squat: '🏋️',
  lunge: '🦵',
  hinge: '🍑',
  h_push: '💪',
  v_push: '🙌',
  h_pull: '🚣',
  v_pull: '🧗',
  core: '🧱',
  arms: '💪',
  calves: '🦶',
  conditioning: '⚡',
  steady_cardio: '🏃',
  mobility: '🧘',
};

/**
 * Démonstration guidée : les étapes défilent au rythme du mouvement.
 * Une vidéo pourra être ajoutée par exercice (champ prévu dans la base).
 */
export default function ExerciseDemo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = findExercise(id);
  const [step, setStep] = useState(0);
  const pulse = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (!ex) return;
    const t = setInterval(() => setStep((s) => (s + 1) % ex.cues.length), 2800);
    return () => clearInterval(t);
  }, [ex]);

  if (!ex) return <Screen title="Exercice introuvable">{null}</Screen>;
  const equip = ex.equipment.map((e) => EQUIPMENT_OPTIONS.find((o) => o.id === e)?.label ?? e);

  return (
    <>
      <Stack.Screen options={{ title: ex.name }} />
      <Screen edges={[]}>
        <Card style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.lg }}>
          <Animated.Text
            style={{
              fontSize: 72,
              transform: [
                { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, ex.pattern === 'squat' || ex.pattern === 'lunge' ? 18 : -10] }) },
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
              ],
            }}
          >
            {PATTERN_EMOJI[ex.pattern]}
          </Animated.Text>
          <View style={{ minHeight: 64, justifyContent: 'center' }}>
            <Text style={{ ...font.tiny, color: colors.accent, textAlign: 'center' }}>
              Étape {step + 1}/{ex.cues.length}
            </Text>
            <Text style={{ ...font.h3, color: colors.text, textAlign: 'center', marginTop: 6 }}>{ex.cues[step]}</Text>
          </View>
          <Row>
            {ex.cues.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  tap();
                  setStep(i);
                }}
                hitSlop={8}
                style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? colors.accent : colors.border }}
              />
            ))}
          </Row>
        </Card>

        <SectionTitle>Muscles sollicités</SectionTitle>
        <Row style={{ flexWrap: 'wrap' }}>
          {ex.primary.map((m) => (
            <Pill key={m} label={m} color={colors.accent} />
          ))}
          {ex.secondary.map((m) => (
            <Pill key={m} label={m} color={colors.textDim} />
          ))}
        </Row>

        <SectionTitle>Exécution</SectionTitle>
        <Card style={{ gap: space.sm }}>
          {ex.cues.map((c, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ ...font.body, color: colors.text, flex: 1 }}>{c}</Text>
            </Row>
          ))}
        </Card>

        <Card accent={colors.warning}>
          <Text style={{ ...font.tiny, color: colors.warning }}>Erreur fréquente</Text>
          <Text style={{ ...font.body, color: colors.text, marginTop: 4 }}>{ex.pitfall}</Text>
        </Card>

        <Row style={{ gap: space.md }}>
          <View style={{ flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface }}>
            <Muted>Matériel</Muted>
            <Text style={{ ...font.h3, color: colors.text }}>{equip.length ? equip.join(', ') : 'Aucun'}</Text>
          </View>
          <View style={{ flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface }}>
            <Muted>Niveau</Muted>
            <Text style={{ ...font.h3, color: colors.text }}>{['', 'Débutant', 'Intermédiaire', 'Avancé'][ex.level]}</Text>
          </View>
        </Row>
        <Muted>En cas de douleur, arrête l’exercice et utilise « Je ne peux pas faire cet exercice » pour obtenir une alternative.</Muted>
      </Screen>
    </>
  );
}
