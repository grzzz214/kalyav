import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../data/store';
import { useCoach } from '../../ui/useCoach';
import type { PlannedSession, SetLog } from '../../core/types';
import {
  adaptSessionForFatigue,
  estimateKcal,
  replaceExercise,
  SESSION_LABELS,
  toRecoverySession,
  eligibilityFromProfile,
} from '../../core/training/programGenerator';
import { findAlternatives, getExercise, SWAP_REASONS, type SwapReason } from '../../core/training/exercises';
import { prettyDate } from '../../core/utils/date';
import { Button, Card, ChipGroup, FadeIn, Muted, Pill, Row, Screen, ScalePicker, SectionTitle, tap } from '../../ui/components/primitives';
import { DIFFICULTY_STARS } from '../../ui/labels';
import { EMERGENCY_NOTE } from '../../core/coach/safety';
import { colors, font, radius, space } from '../../ui/theme';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  return (
    <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.xl, backgroundColor: colors.accent, borderRadius: radius.pill, padding: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.accentInk, fontWeight: '800', fontSize: 16 }}>⏱ Récupération : {Math.max(0, left)} s</Text>
      <Pressable onPress={onDone} hitSlop={10}>
        <Text style={{ color: colors.accentInk, fontWeight: '700' }}>Passer</Text>
      </Pressable>
    </View>
  );
}

function defaultSets(n: number, timed: boolean, workSec?: number): SetLog[] {
  return Array.from({ length: n }, () => (timed ? { durationSec: workSec, done: false } : { done: false }));
}

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useCoach();
  const updateSession = useStore((s) => s.updatePlannedSession);
  const saveWorkout = useStore((s) => s.saveWorkout);

  const planned = useMemo(() => data?.state.plans.flatMap((p) => p.sessions).find((s) => s.id === id), [data?.state.plans, id]);
  const isToday = planned?.date === data?.date;
  const initial = isToday && data?.briefing.session?.id === id ? data.briefing.session : planned;

  const [session, setSession] = useState<PlannedSession | undefined>(initial);
  const [logs, setLogs] = useState<Record<number, SetLog[]>>({});
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [swapReason, setSwapReason] = useState<SwapReason | null>(null);
  const [rest, setRest] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number | undefined>();
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!session && initial) setSession(initial);
  }, [initial, session]);

  if (!data || !session) {
    return (
      <Screen title="Séance introuvable">
        <Muted>Cette séance n’existe plus (programme régénéré).</Muted>
        <Button label="Retour" onPress={() => router.back()} />
      </Screen>
    );
  }
  const { profile } = data;
  const alreadyDone = data.state.workouts.some((w) => w.date === session.date && w.completed);
  const canLog = session.date <= data.date;

  const persist = (s: PlannedSession) => {
    setSession(s);
    updateSession(s);
  };

  const setsFor = (i: number) => {
    const e = session.exercises[i];
    return logs[i] ?? defaultSets(e.sets, getExercise(e.exerciseId).mode === 'time', e.workSec);
  };

  const toggleSet = (i: number, j: number) => {
    if (!startedAt.current) startedAt.current = Date.now();
    const sets = [...setsFor(i)];
    sets[j] = { ...sets[j], done: !sets[j].done };
    setLogs({ ...logs, [i]: sets });
    if (sets[j].done && session.exercises[i].restSec > 0) setRest(session.exercises[i].restSec);
  };

  const editSet = (i: number, j: number, patch: Partial<SetLog>) => {
    const sets = [...setsFor(i)];
    sets[j] = { ...sets[j], ...patch };
    setLogs({ ...logs, [i]: sets });
  };

  const fatigue = (severity: 'mild' | 'high') => {
    const next = severity === 'mild' ? adaptSessionForFatigue(session, profile, 'mild') : toRecoverySession(session, profile, 'fatigue');
    setLogs({});
    persist(next);
  };

  const askFatigue = () => {
    tap();
    if (Platform.OS === 'web') {
      const light = window.confirm('Version allégée (OK) ou séance de récupération (Annuler) ?');
      fatigue(light ? 'mild' : 'high');
      return;
    }
    Alert.alert('Je suis fatigué aujourd’hui', 'Comment veux-tu adapter ta séance ?', [
      { text: 'Version allégée', onPress: () => fatigue('mild') },
      { text: 'Récupération active', onPress: () => fatigue('high') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const painStop = () => {
    notify(
      'Douleur pendant l’effort',
      `Arrête l’exercice. Ne force jamais sur une douleur. Signale-la dans ton prochain check-in pour que j’adapte les séances, et consulte un professionnel si elle persiste.\n\n${EMERGENCY_NOTE}`,
    );
  };

  const swapTo = (newId: string) => {
    if (swapIndex === null) return;
    persist(replaceExercise(session, swapIndex, newId));
    const copy = { ...logs };
    delete copy[swapIndex];
    setLogs(copy);
    setSwapIndex(null);
    setSwapReason(null);
  };

  const finish = () => {
    const exercises = session.exercises.map((e, i) => ({ exerciseId: e.exerciseId, sets: setsFor(i) }));
    const doneSets = exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
    const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
    const elapsed = startedAt.current ? Math.round((Date.now() - startedAt.current) / 60000) : 0;
    const ratio = totalSets ? doneSets / totalSets : 1;
    const durationMin = elapsed >= 5 ? elapsed : Math.round(session.durationMin * Math.max(ratio, 0.3));
    saveWorkout({
      date: session.date,
      plannedSessionId: session.id,
      title: session.title,
      sessionType: session.type,
      durationMin,
      kcal: Math.round(estimateKcal(session.exercises, profile.weightKg) * Math.max(ratio, 0.3)),
      rpe: rpe ?? 6,
      completed: ratio >= 0.6,
      fatigueMode: !!session.adapted,
      exercises,
    });
    router.back();
  };

  const alternatives =
    swapIndex !== null && swapReason
      ? findAlternatives(session.exercises[swapIndex].exerciseId, swapReason, eligibilityFromProfile(profile), session.exercises.map((e) => e.exerciseId))
      : [];

  return (
    <>
      <Stack.Screen options={{ title: SESSION_LABELS[session.type] }} />
      <Screen edges={[]}>
        <FadeIn>
          <Text style={{ ...font.tiny, color: colors.sport }}>{prettyDate(session.date)}</Text>
          <Text style={{ ...font.h1, color: colors.text, marginTop: 4 }}>{session.title}</Text>
          <Muted>{session.focus}</Muted>
          <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
            <Pill label={`⏱ ${session.durationMin} min`} color={colors.text} />
            <Pill label={`🔥 ~${session.estimatedKcal} kcal`} color={colors.sport} />
            <Pill label={`Difficulté ${DIFFICULTY_STARS(session.difficulty)}`} color={colors.accent} />
          </Row>
        </FadeIn>

        {session.adapted ? (
          <Card accent={colors.warning}>
            <Text style={{ ...font.h3, color: colors.warning }}>
              {session.adapted === 'pain' ? '🛡️ Séance adaptée à ta douleur' : '🔋 Séance adaptée à ta fatigue'}
            </Text>
            <Muted style={{ marginTop: 4 }}>
              {session.adapted === 'pain'
                ? 'Les exercices qui sollicitent la zone douloureuse ont été retirés. Si la douleur persiste, consulte un professionnel de santé.'
                : 'Volume réduit et effort plafonné : tu entretiens ta régularité sans t’épuiser.'}
            </Muted>
          </Card>
        ) : !alreadyDone && canLog ? (
          <Row>
            <Button small variant="secondary" icon="🔋" label="Je suis fatigué aujourd’hui" onPress={askFatigue} style={{ flex: 1 }} />
          </Row>
        ) : null}

        {alreadyDone ? (
          <Card accent={colors.success}>
            <Text style={{ ...font.h3, color: colors.success }}>✅ Séance déjà enregistrée. Bravo !</Text>
          </Card>
        ) : null}

        {session.warmup.length && session.exercises.length ? (
          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <Text style={{ ...font.tiny, color: colors.textMute, marginBottom: 6 }}>Échauffement</Text>
            {session.warmup.map((w) => (
              <Muted key={w}>• {w}</Muted>
            ))}
          </Card>
        ) : null}

        {session.exercises.length === 0 ? (
          <Card>
            <Text style={{ ...font.h3, color: colors.text }}>Repos complet aujourd’hui</Text>
            <Muted>Ton corps a besoin de récupérer. Hydrate-toi, marche doucement si tu en as envie, et dors bien.</Muted>
          </Card>
        ) : null}

        {session.exercises.map((e, i) => {
          const ex = getExercise(e.exerciseId);
          const sets = setsFor(i);
          const timed = ex.mode === 'time';
          return (
            <Card key={`${e.exerciseId}-${i}`}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...font.tiny, color: colors.textMute }}>Exercice {i + 1}</Text>
                  <Text style={{ ...font.h2, color: colors.text, marginTop: 2 }}>{ex.name}</Text>
                  <Muted>{[...ex.primary, ...ex.secondary].join(' · ')}</Muted>
                </View>
                <Pressable
                  onPress={() => router.push(`/exercise/${ex.id}`)}
                  style={{ padding: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}
                  hitSlop={6}
                  accessibilityLabel="Voir la démonstration"
                >
                  <Ionicons name="play-circle" size={26} color={colors.accent} />
                </Pressable>
              </Row>
              <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
                <Pill label={`${e.sets} × ${e.reps}`} color={colors.accent} />
                {e.restSec ? <Pill label={`Repos ${e.restSec} s`} color={colors.textDim} /> : null}
                {e.swappedFrom ? <Pill label="Alternative" color={colors.warning} /> : null}
              </Row>
              {e.note ? <Muted style={{ marginTop: 6 }}>💡 {e.note}</Muted> : null}

              {canLog && !alreadyDone ? (
                <View style={{ marginTop: space.md, gap: 8 }}>
                  {sets.map((s, j) => (
                    <Row key={j}>
                      <Text style={{ width: 22, color: colors.textMute, fontWeight: '700' }}>{j + 1}</Text>
                      {timed ? (
                        <Text style={{ flex: 1, color: colors.textDim }}>{e.reps}</Text>
                      ) : (
                        <>
                          <TextInput
                            placeholder={e.reps.split(' ')[0]}
                            placeholderTextColor={colors.textMute}
                            keyboardType="number-pad"
                            value={s.reps ? String(s.reps) : ''}
                            onChangeText={(t) => editSet(i, j, { reps: parseInt(t, 10) || undefined })}
                            style={inputStyle}
                          />
                          <Text style={{ color: colors.textMute }}>reps</Text>
                          {ex.equipment.length ? (
                            <>
                              <TextInput
                                placeholder="kg"
                                placeholderTextColor={colors.textMute}
                                keyboardType="decimal-pad"
                                value={s.weightKg ? String(s.weightKg).replace('.', ',') : ''}
                                onChangeText={(t) => editSet(i, j, { weightKg: parseFloat(t.replace(',', '.')) || undefined })}
                                style={inputStyle}
                              />
                              <Text style={{ color: colors.textMute }}>kg</Text>
                            </>
                          ) : null}
                          <View style={{ flex: 1 }} />
                        </>
                      )}
                      <Pressable
                        onPress={() => {
                          tap();
                          toggleSet(i, j);
                        }}
                        hitSlop={6}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: s.done ? colors.success : colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: s.done ? colors.success : colors.border,
                        }}
                      >
                        <Ionicons name="checkmark" size={20} color={s.done ? colors.bg : colors.textMute} />
                      </Pressable>
                    </Row>
                  ))}
                </View>
              ) : null}

              {!alreadyDone ? (
                <Row style={{ marginTop: space.md }}>
                  <Pressable
                    onPress={() => {
                      tap();
                      setSwapIndex(swapIndex === i ? null : i);
                      setSwapReason(null);
                    }}
                    style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ ...font.small, color: colors.textDim }}>🔄 Je ne peux pas faire cet exercice</Text>
                  </Pressable>
                </Row>
              ) : null}

              {swapIndex === i ? (
                <View style={{ marginTop: space.md, gap: space.sm }}>
                  <Muted>Pourquoi ?</Muted>
                  <ChipGroup options={SWAP_REASONS} value={swapReason ?? undefined} onChange={(v) => setSwapReason(v as SwapReason)} color={colors.warning} />
                  {swapReason === 'pain' ? (
                    <Muted style={{ color: colors.warning }}>Ne force jamais sur une douleur. Si elle est vive ou persiste, arrête la séance.</Muted>
                  ) : null}
                  {alternatives.map((alt) => (
                    <Pressable
                      key={alt.id}
                      onPress={() => swapTo(alt.id)}
                      style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text style={{ ...font.h3, color: colors.text }}>{alt.name}</Text>
                      <Muted>
                        {alt.primary.join(' · ')} · niveau {alt.level} · {alt.equipment.length ? 'matériel requis' : 'sans matériel'}
                      </Muted>
                    </Pressable>
                  ))}
                  {swapReason && !alternatives.length ? <Muted>Aucune alternative sûre : passe cet exercice aujourd’hui.</Muted> : null}
                </View>
              ) : null}
            </Card>
          );
        })}

        {session.exercises.length ? (
          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <Text style={{ ...font.tiny, color: colors.textMute, marginBottom: 6 }}>Retour au calme</Text>
            {session.cooldown.map((w) => (
              <Muted key={w}>• {w}</Muted>
            ))}
          </Card>
        ) : null}

        {canLog && !alreadyDone && session.exercises.length ? (
          <>
            <Pressable onPress={painStop} style={{ alignItems: 'center', padding: space.sm }}>
              <Text style={{ ...font.small, color: colors.danger }}>⚠️ J’ai mal pendant l’effort</Text>
            </Pressable>
            {finishing ? (
              <Card>
                <SectionTitle>Effort ressenti</SectionTitle>
                <Muted style={{ marginBottom: space.sm }}>1 = très facile · 10 = effort maximal</Muted>
                <ScalePicker value={rpe} onChange={setRpe} color={colors.sport} />
                <Button label="Enregistrer la séance" onPress={finish} style={{ marginTop: space.lg }} disabled={rpe === undefined} />
              </Card>
            ) : (
              <Button label="Terminer la séance" onPress={() => setFinishing(true)} />
            )}
          </>
        ) : null}
        {!canLog ? <Muted style={{ textAlign: 'center' }}>Séance à venir : tu pourras l’enregistrer le jour J.</Muted> : null}
        <View style={{ height: rest ? 60 : 0 }} />
      </Screen>
      {rest ? <RestTimer seconds={rest} onDone={() => setRest(null)} /> : null}
    </>
  );
}

const inputStyle = {
  width: 56,
  paddingVertical: 8,
  paddingHorizontal: 8,
  borderRadius: 10,
  backgroundColor: colors.surfaceAlt,
  borderWidth: 1,
  borderColor: colors.border,
  color: colors.text,
  textAlign: 'center' as const,
  fontWeight: '700' as const,
};
