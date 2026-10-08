import React from 'react';
import { Text, View } from 'react-native';
import type { CoachInsight } from '../../core/coach/adaptationEngine';
import { MEDICAL_DISCLAIMER } from '../../core/coach/safety';
import { colors, font, radius, space } from '../theme';
import { Button, Card, Row } from './primitives';

const TONE: Record<CoachInsight['tone'], string> = {
  positive: colors.success,
  neutral: colors.accent,
  warning: colors.warning,
};

const CATEGORY_EMOJI: Record<CoachInsight['category'], string> = {
  safety: '🛡️',
  nutrition: '🥗',
  training: '🏋️',
  recovery: '😴',
  habit: '🔁',
  motivation: '🔥',
};

export function InsightCard({
  insight,
  onAccept,
  onDismiss,
  compact,
}: {
  insight: CoachInsight;
  onAccept?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  const c = TONE[insight.tone];
  return (
    <Card accent={c}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{CATEGORY_EMOJI[insight.category]}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ ...font.h3, color: colors.text }}>{insight.title}</Text>
          <Text style={{ ...font.body, color: colors.textDim, lineHeight: 21 }}>{insight.message}</Text>
        </View>
      </Row>
      {!compact && insight.actions.length ? (
        <View style={{ marginTop: space.md, gap: 6 }}>
          {insight.actions.map((a, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <Text style={{ color: c, fontWeight: '800' }}>{i + 1}.</Text>
              <Text style={{ ...font.body, color: colors.text, flex: 1 }}>{a}</Text>
            </Row>
          ))}
        </View>
      ) : null}
      {!compact ? (
        <View style={{ marginTop: space.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: space.md }}>
          <Text style={{ ...font.tiny, color: colors.textMute, marginBottom: 2 }}>Pourquoi ?</Text>
          <Text style={{ ...font.small, color: colors.textDim }}>{insight.reason}</Text>
        </View>
      ) : null}
      {onAccept || onDismiss ? (
        <Row style={{ marginTop: space.md }}>
          {onAccept ? (
            <Button small label={insight.adjustment ? 'Appliquer' : 'C’est noté'} onPress={onAccept} style={{ flex: 1 }} />
          ) : null}
          {onDismiss && insight.adjustment ? <Button small variant="secondary" label="Plus tard" onPress={onDismiss} style={{ flex: 1 }} /> : null}
        </Row>
      ) : null}
    </Card>
  );
}

export function Disclaimer() {
  return (
    <View style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ ...font.small, color: colors.textMute, lineHeight: 18 }}>⚕️ {MEDICAL_DISCLAIMER}</Text>
    </View>
  );
}
