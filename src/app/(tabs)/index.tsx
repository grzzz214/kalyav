import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../data/store';
import { useCoach } from '../../ui/useCoach';
import { Card, FadeIn, Muted, Pill, Row, Screen, SectionTitle, tap } from '../../ui/components/primitives';
import { Gauge, ProgressBar, Ring } from '../../ui/components/charts';
import { InsightCard } from '../../ui/components/coach';
import { currentStreak, levelFromXp, totalXp } from '../../core/gamification/progression';
import { prettyDate } from '../../core/utils/date';
import { GOAL_LABELS } from '../../core/training/programGenerator';
import { colors, font, radius, space } from '../../ui/theme';

function ScoreRow({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ ...font.small, color: colors.textDim }}>
          {emoji} {label}
        </Text>
        <Text style={{ ...font.small, color: colors.text, fontWeight: '800' }}>{value} %</Text>
      </Row>
      <ProgressBar value={value / 100} color={color} height={6} />
    </View>
  );
}

function QuickButton({ icon, label, onPress, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: space.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ ...font.small, color: colors.textDim, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  const data = useCoach();
  const addWater = useStore((s) => s.addWater);
  const acceptInsight = useStore((s) => s.acceptInsight);
  const dismissInsight = useStore((s) => s.dismissInsight);
  if (!data) return null;
  const { briefing, snapshot: snap, targets, analysis, profile, insights, state, date } = data;
  const s = snap.scores;
  const streak = currentStreak(state, targets, date);
  const level = levelFromXp(totalXp(state, targets));
  const startWeight = state.weights[0]?.kg ?? profile.weightKg;
  const current = analysis.weight.smoothed ?? analysis.weight.current ?? profile.weightKg;
  const goalProgress =
    startWeight === profile.targetWeightKg ? 1 : Math.max(0, Math.min(1, (startWeight - current) / (startWeight - profile.targetWeightKg)));
  const top = insights[0];

  return (
    <Screen
      subtitle={prettyDate(date)}
      title={briefing.greeting}
      right={
        <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
          <Ionicons name="settings-outline" size={24} color={colors.textDim} />
        </Pressable>
      }
    >
      {/* ——— Décision du jour ——— */}
      <FadeIn>
        <Card style={{ backgroundColor: colors.accent, borderColor: colors.accent }}>
          <Text style={{ ...font.tiny, color: colors.accentInk, opacity: 0.7 }}>Décision du coach</Text>
          <Text style={{ ...font.h2, color: colors.accentInk, marginTop: 4 }}>{briefing.headline}</Text>
          <Text style={{ ...font.body, color: colors.accentInk, opacity: 0.8, marginTop: 6 }}>{briefing.coachLine}</Text>
          {briefing.nextAction ? (
            <Pressable
              onPress={() => {
                tap();
                if (briefing.nextAction?.route) router.push(briefing.nextAction.route as never);
                else if (briefing.nextAction?.id === 'water') addWater(250);
              }}
              style={{ marginTop: space.md, backgroundColor: colors.accentInk, borderRadius: radius.pill, padding: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ color: colors.accent, fontWeight: '800' }}>
                {briefing.nextAction.emoji}  Prochaine action : {briefing.nextAction.label}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={colors.accent} />
            </Pressable>
          ) : (
            <Text style={{ ...font.h3, color: colors.accentInk, marginTop: space.md }}>✅ Journée complète. Bravo !</Text>
          )}
        </Card>
      </FadeIn>

      {/* ——— Progression du jour ——— */}
      <FadeIn delay={80}>
        <Card>
          <Row style={{ gap: space.lg }}>
            <Ring value={s.global / 100} size={112} stroke={11}>
              <Text style={{ ...font.number, color: colors.text }}>{s.global}%</Text>
              <Muted style={{ fontSize: 11 }}>du jour</Muted>
            </Ring>
            <View style={{ flex: 1, gap: 8 }}>
              <ScoreRow emoji="🥗" label="Nutrition" value={s.nutrition} color={colors.nutrition} />
              <ScoreRow emoji="🏋️" label="Sport" value={s.training} color={colors.sport} />
              <ScoreRow emoji="💧" label="Hydratation" value={s.hydration} color={colors.hydration} />
              <ScoreRow emoji="😴" label="Sommeil" value={s.sleep} color={colors.sleep} />
            </View>
          </Row>
        </Card>
      </FadeIn>

      {/* ——— Raccourcis ——— */}
      <Row>
        <QuickButton icon="water" label="+250 ml" color={colors.hydration} onPress={() => addWater(250)} />
        <QuickButton icon="restaurant" label="Repas" color={colors.nutrition} onPress={() => router.push('/food-search')} />
        <QuickButton icon="scale" label="Mesures" color={colors.accent} onPress={() => router.push('/log')} />
        <QuickButton icon="chatbubbles" label="Check-in" color={colors.sleep} onPress={() => router.push(`/checkin?mode=${new Date().getHours() < 16 ? 'morning' : 'evening'}`)} />
      </Row>

      {/* ——— Mission du jour ——— */}
      <SectionTitle>Mission du jour</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        {briefing.actions.map((a, i) => (
          <Pressable
            key={a.id}
            disabled={!a.route && a.id !== 'water'}
            onPress={() => {
              tap();
              if (a.route) router.push(a.route as never);
              else if (a.id === 'water') addWater(250);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2,
                borderColor: a.done ? colors.success : colors.border,
                backgroundColor: a.done ? colors.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {a.done ? <Ionicons name="checkmark" size={16} color={colors.bg} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...font.h3, color: a.done ? colors.textMute : colors.text, textDecorationLine: a.done ? 'line-through' : 'none' }}>
                {a.emoji} {a.label}
              </Text>
              {a.detail ? <Muted>{a.detail}</Muted> : null}
            </View>
            {a.route && !a.done ? <Ionicons name="chevron-forward" size={18} color={colors.textMute} /> : null}
          </Pressable>
        ))}
      </Card>

      {/* ——— Aujourd'hui ——— */}
      <SectionTitle action="Détails" onAction={() => router.push('/nutrition')}>
        Aujourd’hui
      </SectionTitle>
      <Card style={{ gap: space.md }}>
        <Gauge emoji="🔥" label="Calories" value={snap.consumed.kcal} target={targets.kcal} unit="kcal" color={colors.accent} />
        <Gauge emoji="🥩" label="Protéines" value={snap.consumed.protein} target={targets.protein} unit="g" color={colors.protein} />
        <Gauge emoji="🍚" label="Glucides" value={snap.consumed.carbs} target={targets.carbs} unit="g" color={colors.carbs} />
        <Gauge emoji="🥑" label="Lipides" value={snap.consumed.fat} target={targets.fat} unit="g" color={colors.fat} />
        <Gauge emoji="💧" label="Hydratation" value={snap.waterMl} target={targets.waterMl} unit="ml" color={colors.hydration} />
        <Gauge emoji="👟" label="Pas" value={snap.steps} target={targets.steps} unit="" color={colors.steps} />
      </Card>

      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} onPress={() => briefing.session && router.push(`/workout/${briefing.session.id}`)}>
          <Text style={{ ...font.tiny, color: colors.sport }}>Entraînement</Text>
          <Text style={{ ...font.h3, color: colors.text, marginTop: 4 }} numberOfLines={2}>
            {snap.workout ? `✅ ${snap.workout.title}` : briefing.session?.title ?? 'Repos'}
          </Text>
          <Muted>
            {snap.workout
              ? `${snap.workout.durationMin} min · ${snap.workout.kcal} kcal`
              : briefing.session
                ? `${briefing.session.durationMin} min · ~${briefing.session.estimatedKcal} kcal`
                : 'Récupération active'}
          </Muted>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/checkin?mode=morning')}>
          <Text style={{ ...font.tiny, color: colors.sleep }}>Sommeil</Text>
          <Text style={{ ...font.h3, color: colors.text, marginTop: 4 }}>
            {snap.sleepHours !== undefined ? `${String(snap.sleepHours).replace('.', ',')} h` : '—'}
          </Text>
          <Muted>objectif {targets.sleepHours} h</Muted>
        </Card>
      </Row>

      <Card onPress={() => router.push('/progress')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ ...font.tiny, color: colors.accent }}>Objectif · {GOAL_LABELS[profile.goal]}</Text>
            <Text style={{ ...font.h2, color: colors.text, marginTop: 4 }}>
              {(Math.round(current * 10) / 10).toLocaleString('fr-FR')} kg
              <Text style={{ ...font.body, color: colors.textMute }}> → {profile.targetWeightKg.toLocaleString('fr-FR')} kg</Text>
            </Text>
          </View>
          <Row>
            <Pill label={`🔥 ${streak} j`} color={colors.sport} />
            <Pill label={`🏆 ${level.name}`} color={colors.accent} />
          </Row>
        </Row>
        <View style={{ marginTop: space.md }}>
          <ProgressBar value={goalProgress} />
        </View>
        <Muted style={{ marginTop: 6 }}>
          {snap.weightKg ? 'Poids du jour enregistré.' : 'Pense à te peser le matin, à jeun, 3 fois par semaine.'}
        </Muted>
      </Card>

      {top ? (
        <>
          <SectionTitle action="Tout voir" onAction={() => router.push('/coach')}>
            Le coach a remarqué
          </SectionTitle>
          <InsightCard insight={top} onAccept={() => acceptInsight(top)} onDismiss={() => dismissInsight(top.id)} />
        </>
      ) : null}
    </Screen>
  );
}
