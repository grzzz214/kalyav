import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCoach } from '../../ui/useCoach';
import { Button, Card, ChipGroup, Muted, Row, Screen, SectionTitle } from '../../ui/components/primitives';
import { BarChart, ConsistencyGrid, LineChart, ProgressBar, type Point } from '../../ui/components/charts';
import { badges, bestStreak, currentStreak, levelFromXp, totalXp, weeklyGoals } from '../../core/gamification/progression';
import { exerciseHistory, personalRecords, trackedExercises } from '../../core/training/performance';
import { findExercise } from '../../core/training/exercises';
import { addDays, dateRange, dayLabel, shortDate, startOfWeek, weekdayIndex } from '../../core/utils/date';
import { colors, font, radius, space } from '../../ui/theme';

type Metric = 'weight' | 'waist' | 'body' | 'steps' | 'kcal' | 'cardio';
type Range = 30 | 90 | 365;

export default function Progress() {
  const data = useCoach();
  const [metric, setMetric] = useState<Metric>('weight');
  const [range, setRange] = useState<Range>(30);
  const [exercise, setExercise] = useState<string | undefined>();
  const state = data?.state;
  const date = data?.date ?? '';

  const charts = useMemo(() => {
    if (!state) return null;
    const from = addDays(date, -range + 1);
    const inRange = <T extends { date: string }>(xs: T[]) => xs.filter((x) => x.date >= from && x.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1));
    const pt = (d: string, v: number): Point => ({ label: shortDate(d), value: v });
    const weeks7 = dateRange(addDays(date, -6), date);
    const kcalByDay = (d: string) => state.foodLog.filter((f) => f.date === d).reduce((a, f) => a + f.kcal, 0);
    const cardio = inRange(state.workouts.filter((w) => ['cardio_z2', 'intervals', 'hiit'].includes(w.sessionType)));
    return {
      weight: inRange(state.weights).map((w) => pt(w.date, w.kg)),
      waist: inRange(state.measurements.filter((m) => m.waistCm)).map((m) => pt(m.date, m.waistCm!)),
      fat: inRange(state.measurements.filter((m) => m.bodyFatPct)).map((m) => pt(m.date, m.bodyFatPct!)),
      muscle: inRange(state.measurements.filter((m) => m.muscleMassKg)).map((m) => pt(m.date, m.muscleMassKg!)),
      steps: weeks7.map((d) => ({ label: dayLabel(weekdayIndex(d)).slice(0, 1), value: state.activity.find((a) => a.date === d)?.steps ?? 0 })),
      kcal: weeks7.map((d) => ({ label: dayLabel(weekdayIndex(d)).slice(0, 1), value: Math.round(kcalByDay(d)) })),
      cardio: cardio.map((w) => pt(w.date, w.durationMin)),
    };
  }, [state, date, range]);

  if (!data || !state || !charts) return null;
  const { targets, profile } = data;
  const streak = currentStreak(state, targets, date);
  const best = bestStreak(state, targets);
  const level = levelFromXp(totalXp(state, targets));
  const goals = weeklyGoals(state, targets, date);
  const allBadges = badges(state, targets, date);
  const prs = personalRecords(state.workouts).slice(0, 8);
  const tracked = trackedExercises(state.workouts);
  const exId = exercise ?? tracked[0];
  const perf = exId ? exerciseHistory(state.workouts, exId).map((p) => ({ label: shortDate(p.date), value: p.value })) : [];

  // régularité : 8 dernières semaines
  const gridStart = addDays(startOfWeek(date), -49);
  const grid = dateRange(gridStart, addDays(gridStart, 55)).map((d) => {
    const n =
      (state.workouts.some((w) => w.date === d && w.completed) ? 1 : 0) +
      (state.morningCheckIns.some((c) => c.date === d) ? 1 : 0) +
      (state.foodLog.some((f) => f.date === d) ? 1 : 0);
    return { date: d, level: (d > date ? 0 : n) as 0 | 1 | 2 | 3 };
  });

  return (
    <Screen subtitle="Tes résultats" title="Progression">
      {/* ——— Série & niveau ——— */}
      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26 }}>🔥</Text>
          <Text style={{ ...font.number, color: colors.text }}>{streak} j</Text>
          <Muted>Série actuelle · record {best} j</Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26 }}>🏆</Text>
          <Text style={{ ...font.h2, color: colors.text, marginTop: 4 }}>{level.name}</Text>
          <View style={{ marginVertical: 6 }}>
            <ProgressBar value={level.progress} height={6} />
          </View>
          <Muted>
            {level.xp} / {level.nextLevelXp} XP
          </Muted>
        </Card>
      </Row>

      <SectionTitle>Objectifs de la semaine</SectionTitle>
      <Card style={{ gap: space.md }}>
        {goals.map((g) => (
          <View key={g.id} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ ...font.small, color: g.done ? colors.success : colors.text }}>
                {g.done ? '✓' : '○'} {g.label}
              </Text>
              <Muted>
                {g.current.toLocaleString('fr-FR')} / {g.target.toLocaleString('fr-FR')}
              </Muted>
            </Row>
            <ProgressBar value={g.current / g.target} color={g.done ? colors.success : colors.accent} height={6} />
          </View>
        ))}
        <Muted>Ici, on récompense la régularité, pas seulement la balance.</Muted>
      </Card>

      {/* ——— Graphiques ——— */}
      <SectionTitle action="+ Saisir" onAction={() => router.push('/log')}>
        Évolution
      </SectionTitle>
      <ChipGroup
        options={[
          { id: 'weight', label: 'Poids' },
          { id: 'waist', label: 'Tour de taille' },
          { id: 'body', label: 'Composition' },
          { id: 'steps', label: 'Pas' },
          { id: 'kcal', label: 'Calories' },
          { id: 'cardio', label: 'Cardio' },
        ]}
        value={metric}
        onChange={(v) => setMetric(v as Metric)}
      />
      {['weight', 'waist', 'body', 'cardio'].includes(metric) ? (
        <ChipGroup
          options={[
            { id: 30, label: '30 j' },
            { id: 90, label: '3 mois' },
            { id: 365, label: '1 an' },
          ]}
          value={range}
          onChange={(v) => setRange(v as Range)}
          color={colors.textDim}
        />
      ) : null}
      <Card>
        {metric === 'weight' ? <LineChart data={charts.weight} target={profile.targetWeightKg} unit=" kg" /> : null}
        {metric === 'waist' ? <LineChart data={charts.waist} color={colors.carbs} unit=" cm" /> : null}
        {metric === 'body' ? (
          <View style={{ gap: space.lg }}>
            <Text style={{ ...font.small, color: colors.textDim }}>Masse grasse (%)</Text>
            <LineChart data={charts.fat} color={colors.protein} unit=" %" height={120} />
            <Text style={{ ...font.small, color: colors.textDim }}>Masse musculaire (kg)</Text>
            <LineChart data={charts.muscle} color={colors.nutrition} unit=" kg" height={120} />
          </View>
        ) : null}
        {metric === 'steps' ? <BarChart data={charts.steps} color={colors.steps} target={targets.steps} /> : null}
        {metric === 'kcal' ? <BarChart data={charts.kcal} color={colors.nutrition} target={targets.kcal} /> : null}
        {metric === 'cardio' ? <LineChart data={charts.cardio} color={colors.sport} unit=" min" decimals={0} /> : null}
        {metric === 'steps' || metric === 'kcal' ? <Muted style={{ marginTop: 6 }}>7 derniers jours · pointillés = objectif</Muted> : null}
      </Card>

      {/* ——— Force ——— */}
      <SectionTitle>Force & répétitions</SectionTitle>
      {tracked.length ? (
        <>
          <ChipGroup
            options={tracked.slice(0, 6).map((id) => ({ id, label: findExercise(id)?.name ?? id }))}
            value={exId}
            onChange={(v) => setExercise(v as string)}
            color={colors.sport}
          />
          <Card>
            <LineChart data={perf} color={colors.sport} decimals={1} />
            <Muted style={{ marginTop: 4 }}>Charges : 1RM estimé (kg). Poids du corps : meilleures répétitions.</Muted>
          </Card>
        </>
      ) : (
        <Card>
          <Muted>Enregistre tes séries (reps, charges) pendant tes séances pour suivre ta force ici.</Muted>
        </Card>
      )}

      <SectionTitle>Records personnels</SectionTitle>
      {prs.length ? (
        <Card style={{ paddingVertical: space.xs }}>
          {prs.map((p, i) => (
            <Row key={`${p.exerciseId}-${p.kind}`} style={{ paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...font.h3, fontSize: 15, color: colors.text }}>{p.name}</Text>
                <Muted>
                  {p.kind === 'e1rm' ? '1RM estimé' : p.kind === 'reps' ? 'Répétitions' : p.kind === 'duration' ? 'Durée' : 'Distance'} · {shortDate(p.date)}
                </Muted>
              </View>
              <Text style={{ ...font.h2, color: colors.accent }}>
                {p.value.toLocaleString('fr-FR')} {p.unit}
              </Text>
            </Row>
          ))}
        </Card>
      ) : (
        <Muted>Tes records apparaîtront ici.</Muted>
      )}

      <SectionTitle>Régularité · 8 semaines</SectionTitle>
      <Card>
        <ConsistencyGrid days={grid} />
        <Muted style={{ marginTop: space.sm }}>Chaque case : séance, check-in, alimentation suivie.</Muted>
      </Card>

      <SectionTitle>Badges</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {allBadges.map((b) => (
          <View
            key={b.id}
            style={{
              width: '31%',
              flexGrow: 1,
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: b.earned ? colors.accent + '88' : colors.border,
              opacity: b.earned ? 1 : 0.55,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 28 }}>{b.earned ? b.emoji : '🔒'}</Text>
            <Text style={{ ...font.small, color: colors.text, textAlign: 'center', fontWeight: '700' }}>{b.title}</Text>
            <Text style={{ fontSize: 11, color: colors.textMute, textAlign: 'center' }}>{b.description}</Text>
            {!b.earned ? (
              <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
                <ProgressBar value={b.progress} height={4} />
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <Button variant="secondary" label="📊 Bilans hebdomadaires" onPress={() => router.push('/weekly-review')} />
    </Screen>
  );
}
