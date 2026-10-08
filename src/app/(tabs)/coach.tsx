import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useStore } from '../../data/store';
import { useCoach } from '../../ui/useCoach';
import { coachReply, QUICK_QUESTIONS, type ChatMessage } from '../../core/coach/chat';
import { conversationalCoach } from '../../integrations/registry';
import { reminderSuggestions } from '../../core/reminders/scheduler';
import { addDays } from '../../core/utils/date';
import { uid } from '../../core/utils/stats';
import { Button, Card, ChipGroup, FadeIn, Muted, Row, SectionTitle } from '../../ui/components/primitives';
import { Disclaimer, InsightCard } from '../../ui/components/coach';
import { colors, font, radius, space } from '../../ui/theme';

export default function Coach() {
  const data = useCoach();
  const acceptInsight = useStore((s) => s.acceptInsight);
  const dismissInsight = useStore((s) => s.dismissInsight);
  const updateReminder = useStore((s) => s.updateReminder);
  const snooze = useStore((s) => s.snoozeReminderSuggestion);
  const [tab, setTab] = useState<'insights' | 'chat'>('insights');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scroll = useRef<ScrollView>(null);
  if (!data) return null;
  const { insights, state, analysis, date } = data;
  const reminderTips = reminderSuggestions(state, date);
  const history = state.adjustments.history.slice(0, 5);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const user: ChatMessage = { id: uid('m'), from: 'user', text: t, at: new Date().toISOString() };
    const next = [...messages, user];
    setMessages(next);
    setInput('');
    let reply: string;
    try {
      reply = conversationalCoach
        ? await conversationalCoach.reply(next, { state, analysis })
        : coachReply(t, state, analysis, insights);
    } catch {
      reply = coachReply(t, state, analysis, insights);
    }
    setMessages([...next, { id: uid('m'), from: 'coach', text: reply, at: new Date().toISOString() }]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.md }}>
          <View>
            <Text style={{ ...font.tiny, color: colors.textMute }}>Ton coach personnel</Text>
            <Text style={{ ...font.h1, color: colors.text }}>Coach IA</Text>
          </View>
          <ChipGroup
            options={[
              { id: 'insights', label: `Analyses${insights.length ? ` (${insights.length})` : ''}` },
              { id: 'chat', label: 'Discuter' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as 'insights' | 'chat')}
          />
        </View>

        {tab === 'insights' ? (
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: 120 }}>
            <Card>
              <Text style={{ ...font.tiny, color: colors.accent }}>Ce que je surveille</Text>
              <View style={{ marginTop: space.sm, gap: 6 }}>
                <Muted>
                  ⚖️ Poids :{' '}
                  {analysis.weight.slope14 !== undefined
                    ? `${analysis.weight.slope14 > 0 ? '+' : ''}${analysis.weight.slope14.toFixed(2).replace('.', ',')} kg/sem. (14 j)`
                    : 'pèse-toi 3×/semaine pour activer l’analyse'}
                </Muted>
                <Muted>🥗 Suivi nutrition : {analysis.nutrition.daysLogged7}/7 jours</Muted>
                <Muted>
                  🏋️ Séances : {analysis.training.done14}/{analysis.training.planned14 || '—'} sur 14 jours
                </Muted>
                <Muted>😴 Sommeil moyen : {analysis.recovery.avgSleep7 ? `${analysis.recovery.avgSleep7.toFixed(1).replace('.', ',')} h` : '—'}</Muted>
                <Muted>
                  🔁 Régularité globale : {analysis.historyDays >= 3 ? `${Math.round(analysis.adherence * 100)} %` : 'en calcul (3 premiers jours)'}
                </Muted>
              </View>
            </Card>

            {insights.length === 0 ? (
              <Card>
                <Text style={{ ...font.h3, color: colors.text }}>Rien à corriger pour l’instant 👌</Text>
                <Muted style={{ marginTop: 4 }}>
                  Je raisonne sur des tendances de plusieurs jours : plus tu remplis tes check-ins et ton alimentation, plus mes conseils sont précis.
                </Muted>
              </Card>
            ) : null}
            {insights.map((i, k) => (
              <FadeIn key={i.id} delay={k * 60}>
                <InsightCard insight={i} onAccept={() => acceptInsight(i)} onDismiss={() => dismissInsight(i.id)} />
              </FadeIn>
            ))}

            {reminderTips.map((r) => (
              <Card key={r.kind} accent={colors.hydration}>
                <Text style={{ ...font.h3, color: colors.text }}>🔔 Ajuster un rappel</Text>
                <Muted style={{ marginTop: 4 }}>{r.message}</Muted>
                <Row style={{ marginTop: space.md }}>
                  {r.suggestedTime ? (
                    <Button small label={`Passer à ${r.suggestedTime}`} onPress={() => updateReminder(r.kind, { time: r.suggestedTime! })} style={{ flex: 1 }} />
                  ) : (
                    <Button small label="Désactiver" onPress={() => updateReminder(r.kind, { enabled: false })} style={{ flex: 1 }} />
                  )}
                  <Button small variant="secondary" label="Garder" onPress={() => snooze(r.kind, addDays(date, 14))} style={{ flex: 1 }} />
                </Row>
              </Card>
            ))}

            {history.length ? (
              <>
                <SectionTitle>Adaptations appliquées</SectionTitle>
                <Card style={{ gap: 8 }}>
                  {history.map((h, k) => (
                    <View key={k}>
                      <Text style={{ ...font.small, color: colors.text, fontWeight: '700' }}>{h.title}</Text>
                      <Muted>
                        {h.date} · {h.reason}
                      </Muted>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            <Button variant="secondary" label="📊 Bilan de la semaine" onPress={() => router.push('/weekly-review')} />
            <Disclaimer />
          </ScrollView>
        ) : (
          <>
            <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: space.lg }}>
              <Bubble from="coach" text={`Salut ${data.profile.firstName} ! Pose-moi une question sur ton entraînement, ta nutrition, ta fatigue ou ta motivation. Je réponds à partir de tes propres données.`} />
              {messages.map((m) => (
                <Bubble key={m.id} from={m.from} text={m.text} />
              ))}
              {messages.length === 0 ? (
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  {QUICK_QUESTIONS.map((q) => (
                    <Pressable key={q} onPress={() => send(q)} style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ ...font.small, color: colors.textDim }}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <Row style={{ padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Écris au coach…"
                placeholderTextColor={colors.textMute}
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
                style={{ flex: 1, color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 12 }}
              />
              <Pressable onPress={() => send(input)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up" size={22} color={colors.accentInk} />
              </Pressable>
            </Row>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ from, text }: { from: 'user' | 'coach'; text: string }) {
  const mine = from === 'user';
  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        backgroundColor: mine ? colors.accent : colors.surface,
        borderRadius: radius.lg,
        borderBottomRightRadius: mine ? 4 : radius.lg,
        borderBottomLeftRadius: mine ? radius.lg : 4,
        padding: space.md,
        borderWidth: mine ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ ...font.body, color: mine ? colors.accentInk : colors.text, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}
