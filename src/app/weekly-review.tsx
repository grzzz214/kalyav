import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCoach } from '../ui/useCoach';
import { buildWeeklyReview } from '../core/coach/weeklyReview';
import { addDays, shortDate, startOfWeek } from '../core/utils/date';
import { Button, Card, ChipGroup, Muted, Row, Screen, SectionTitle } from '../ui/components/primitives';
import { colors, font, space } from '../ui/theme';

const fmt = (n?: number, d = 1) => (n === undefined ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR'));

export default function WeeklyReviewScreen() {
  const data = useCoach();
  const current = data ? startOfWeek(data.date) : '';
  const weeks = useMemo(() => {
    if (!data) return [];
    const stored = data.state.reviews.map((r) => r.weekStart);
    return [...new Set([current, ...stored])].sort().reverse().slice(0, 8);
  }, [data, current]);
  const [week, setWeek] = useState(current);

  if (!data) return null;
  const stored = data.state.reviews.find((r) => r.weekStart === week);
  // la semaine en cours est un bilan « en direct » ; les semaines passées sont figées
  const review = week === current || !stored ? buildWeeklyReview(data.state, week) : stored;
  const nextPlan = data.state.plans.find((p) => p.weekStart === addDays(week, 7));

  return (
    <Screen edges={[]}>
      <ChipGroup
        options={weeks.map((w) => ({ id: w, label: w === current ? 'Cette semaine' : `Sem. du ${shortDate(w)}` }))}
        value={week}
        onChange={(v) => setWeek(v as string)}
      />
      <Text style={{ ...font.h1, color: colors.text }}>
        Du {shortDate(review.weekStart)} au {shortDate(review.weekEnd)}
      </Text>
      {week === current ? <Muted>Bilan provisoire — il sera finalisé dimanche, avec le programme de la semaine suivante.</Muted> : null}

      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <Muted>Poids</Muted>
          <Text style={{ ...font.h2, color: colors.text }}>
            {fmt(review.startWeight)} → {fmt(review.endWeight)} kg
          </Text>
          <Text style={{ ...font.small, color: (review.weightChange ?? 0) <= 0 ? colors.success : colors.carbs }}>
            {review.weightChange !== undefined ? `${review.weightChange > 0 ? '+' : ''}${fmt(review.weightChange)} kg` : 'Pas assez de pesées'}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>Entraînements</Muted>
          <Text style={{ ...font.h2, color: colors.text }}>
            {review.workoutsDone} / {review.workoutsPlanned || '—'}
          </Text>
          <Muted>séances réalisées</Muted>
        </Card>
      </Row>
      <Card style={{ gap: 6 }}>
        <Muted>🥗 Nutrition : {review.nutritionDaysLogged}/7 jours suivis · {fmt(review.avgKcal, 0)} kcal · {fmt(review.avgProtein, 0)} g de protéines en moyenne</Muted>
        <Muted>😴 Sommeil moyen : {fmt(review.avgSleep)} h</Muted>
        <Muted>👟 Activité : {fmt(review.avgSteps, 0)} pas/jour</Muted>
        <Muted>✅ Check-ins : {review.checkIns}</Muted>
      </Card>

      <SectionTitle>Points positifs</SectionTitle>
      <Card accent={colors.success} style={{ gap: 6 }}>
        {review.positives.map((p) => (
          <Text key={p} style={{ ...font.body, color: colors.text }}>
            ✓ {p}
          </Text>
        ))}
      </Card>

      {review.weaknesses.length ? (
        <>
          <SectionTitle>À améliorer</SectionTitle>
          <Card accent={colors.warning} style={{ gap: 6 }}>
            {review.weaknesses.map((p) => (
              <Text key={p} style={{ ...font.body, color: colors.text }}>
                → {p}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Recommandations</SectionTitle>
      <Card style={{ gap: 8 }}>
        {review.recommendations.map((p, i) => (
          <Row key={p} style={{ alignItems: 'flex-start' }}>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>{i + 1}.</Text>
            <Text style={{ ...font.body, color: colors.text, flex: 1 }}>{p}</Text>
          </Row>
        ))}
      </Card>

      {nextPlan ? (
        <Card accent={colors.accent}>
          <Text style={{ ...font.tiny, color: colors.accent }}>Programme suivant généré</Text>
          <View style={{ marginTop: space.sm, gap: 4 }}>
            {nextPlan.rationale.map((r) => (
              <Muted key={r}>• {r}</Muted>
            ))}
          </View>
          <Button small label="Voir le programme" onPress={() => router.push('/sport')} style={{ marginTop: space.md }} />
        </Card>
      ) : null}
    </Screen>
  );
}
