import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCoach } from '../../ui/useCoach';
import { Button, Card, FadeIn, Muted, Pill, Row, Screen, SectionTitle, tap } from '../../ui/components/primitives';
import { dayLabel, shortDate, startOfWeek, weekdayIndex, addDays } from '../../core/utils/date';
import { GOAL_LABELS, SESSION_LABELS } from '../../core/training/programGenerator';
import { getExercise } from '../../core/training/exercises';
import { DIFFICULTY_STARS } from '../../ui/labels';
import { colors, font, radius, space } from '../../ui/theme';
import type { PlannedSession } from '../../core/types';

const TYPE_COLOR: Partial<Record<PlannedSession['type'], string>> = {
  hiit: colors.sport,
  intervals: colors.sport,
  cardio_z2: colors.steps,
  mobility: colors.sleep,
  recovery: colors.sleep,
  core: colors.carbs,
};

export default function Sport() {
  const data = useCoach();
  if (!data) return null;
  const { state, date, briefing, profile } = data;
  const weekStart = startOfWeek(date);
  const plan = state.plans.find((p) => p.weekStart === weekStart);
  const doneDates = new Set(state.workouts.filter((w) => w.completed).map((w) => w.date));
  const todayIdx = weekdayIndex(date);
  const nextPlan = state.plans.find((p) => p.weekStart === addDays(weekStart, 7));

  return (
    <Screen subtitle={`Programme · ${GOAL_LABELS[profile.goal]}`} title="Sport">
      {/* Semaine */}
      <Card style={{ paddingHorizontal: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const s = plan?.sessions.find((x) => x.dayIndex === i);
            const d = addDays(weekStart, i);
            const done = doneDates.has(d);
            const isToday = i === todayIdx;
            return (
              <Pressable
                key={i}
                disabled={!s}
                onPress={() => s && router.push(`/workout/${s.id}`)}
                style={{ alignItems: 'center', gap: 6, flex: 1 }}
              >
                <Text style={{ ...font.tiny, color: isToday ? colors.accent : colors.textMute }}>{dayLabel(i)}</Text>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? colors.success : s ? (TYPE_COLOR[s.type] ?? colors.accent) + '26' : colors.surfaceAlt,
                    borderWidth: isToday ? 2 : 0,
                    borderColor: colors.accent,
                  }}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={18} color={colors.bg} />
                  ) : s ? (
                    <Ionicons name="barbell" size={15} color={TYPE_COLOR[s.type] ?? colors.accent} />
                  ) : (
                    <Text style={{ color: colors.textMute, fontSize: 10 }}>—</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      {/* Séance du jour */}
      <SectionTitle>Aujourd’hui</SectionTitle>
      {briefing.session ? (
        <FadeIn>
          <Card accent={colors.sport} onPress={() => router.push(`/workout/${briefing.session!.id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill label={briefing.session.adapted ? 'Adaptée à ton check-in' : SESSION_LABELS[briefing.session.type]} color={briefing.session.adapted ? colors.warning : colors.sport} />
              <Text style={{ color: colors.textMute, letterSpacing: 2 }}>{DIFFICULTY_STARS(briefing.session.difficulty)}</Text>
            </Row>
            <Text style={{ ...font.h1, color: colors.text, marginTop: space.sm }}>{briefing.session.title}</Text>
            <Muted>{briefing.session.focus}</Muted>
            <Row style={{ marginTop: space.md, gap: space.lg }}>
              <Text style={{ ...font.small, color: colors.textDim }}>⏱ {briefing.session.durationMin} min</Text>
              <Text style={{ ...font.small, color: colors.textDim }}>🔥 ~{briefing.session.estimatedKcal} kcal</Text>
              <Text style={{ ...font.small, color: colors.textDim }}>📋 {briefing.session.exercises.length} exercices</Text>
            </Row>
            <Button
              label={data.snapshot.workout ? 'Séance terminée ✓' : 'Commencer la séance'}
              onPress={() => router.push(`/workout/${briefing.session!.id}`)}
              style={{ marginTop: space.lg }}
              variant={data.snapshot.workout ? 'secondary' : 'primary'}
            />
          </Card>
        </FadeIn>
      ) : (
        <Card>
          <Text style={{ ...font.h3, color: colors.text }}>🌿 Jour de récupération</Text>
          <Muted style={{ marginTop: 4 }}>
            La récupération fait partie du programme. 20–30 min de marche et un peu de mobilité suffisent.
          </Muted>
        </Card>
      )}

      {/* Semaine détaillée */}
      <SectionTitle action="Bilan hebdo" onAction={() => router.push('/weekly-review')}>
        Cette semaine
      </SectionTitle>
      {plan?.sessions.map((s) => {
        const done = doneDates.has(s.date);
        return (
          <Card key={s.id} onPress={() => router.push(`/workout/${s.id}`)} style={{ opacity: s.date < date && !done ? 0.55 : 1 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...font.tiny, color: TYPE_COLOR[s.type] ?? colors.accent }}>
                  {dayLabel(s.dayIndex)} {shortDate(s.date)} {done ? '· fait ✓' : s.date < date ? '· manquée' : ''}
                </Text>
                <Text style={{ ...font.h3, color: colors.text, marginTop: 2 }}>{s.title}</Text>
                <Muted numberOfLines={1}>{s.exercises.map((e) => getExercise(e.exerciseId).name).join(' · ')}</Muted>
              </View>
              <Text style={{ ...font.small, color: colors.textDim }}>{s.durationMin} min</Text>
            </Row>
          </Card>
        );
      })}

      {plan ? (
        <Card style={{ backgroundColor: colors.surfaceAlt }}>
          <Text style={{ ...font.tiny, color: colors.textMute, marginBottom: 6 }}>Pourquoi ce programme ?</Text>
          {plan.rationale.map((r) => (
            <Muted key={r} style={{ marginBottom: 4 }}>
              • {r}
            </Muted>
          ))}
          {plan.volumeModifier !== 1 ? (
            <Muted>• Volume ajusté à {Math.round(plan.volumeModifier * 100)} % par le coach.</Muted>
          ) : null}
        </Card>
      ) : null}

      {nextPlan ? (
        <Card onPress={() => router.push(`/workout/${nextPlan.sessions[0]?.id}`)}>
          <Text style={{ ...font.tiny, color: colors.accent }}>Semaine prochaine prête</Text>
          <Text style={{ ...font.h3, color: colors.text, marginTop: 4 }}>
            {nextPlan.sessions.length} séances · {nextPlan.sessions.map((s) => s.title).join(', ')}
          </Text>
        </Card>
      ) : null}

      <Pressable
        onPress={() => {
          tap();
          router.push('/settings');
        }}
        style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
      >
        <Text style={{ ...font.small, color: colors.textDim }}>Modifier jours, durée, équipement ou limitations →</Text>
      </Pressable>
    </Screen>
  );
}
