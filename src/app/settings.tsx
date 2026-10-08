import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { snapshotState, useStore } from '../data/store';
import { cloud, loadSession, saveSession, syncNow, type AuthSession } from '../services/cloud';
import { shareCsv, shareExport } from '../services/export';
import { requestNotificationPermission, rescheduleReminders } from '../services/notifications';
import { INTEGRATIONS } from '../integrations/registry';
import { dayLabel } from '../core/utils/date';
import { Button, Card, ChipGroup, Field, Muted, NumberStepper, Pill, Row, Screen, SectionTitle } from '../ui/components/primitives';
import { TimeStepper } from '../ui/components/TimeStepper';
import { Disclaimer } from '../ui/components/coach';
import { ACTIVITY_OPTIONS, DIET_OPTIONS, EQUIPMENT_OPTIONS, GOAL_OPTIONS, LEVEL_OPTIONS, LIMITATION_OPTIONS, ALLERGEN_OPTIONS } from '../ui/labels';
import { colors, font, space } from '../ui/theme';
import type { UserProfile } from '../core/types';

function confirm(title: string, msg: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${msg}`)) onOk();
    return;
  }
  Alert.alert(title, msg, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', style: 'destructive', onPress: onOk },
  ]);
}

function Account() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const importState = useStore((s) => s.importState);

  useEffect(() => {
    loadSession().then(setSession);
  }, []);

  if (!cloud.configured) {
    return (
      <Card>
        <Text style={{ ...font.h3, color: colors.text }}>Mode local</Text>
        <Muted style={{ marginTop: 4 }}>
          Tes données sont enregistrées sur cet appareil. La synchronisation cloud s’active dès qu’un serveur est configuré (variables EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY).
        </Muted>
      </Card>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const doSync = (s: AuthSession) =>
    run(async () => {
      const st = useStore.getState();
      const { result, session: fresh } = await syncNow(s, { data: snapshotState(st), updatedAt: st.updatedAt }, (data, updatedAt) => {
        importState(data);
        useStore.setState({ updatedAt });
      });
      setSession(fresh);
      setMsg(result === 'pulled' ? 'Données récupérées depuis le cloud.' : result === 'pushed' ? 'Données sauvegardées dans le cloud.' : 'Déjà à jour.');
    });

  if (session) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text style={{ ...font.h3, color: colors.text }}>Connecté · {session.email}</Text>
        <Row>
          <Button small label="Synchroniser" onPress={() => doSync(session)} loading={busy} style={{ flex: 1 }} />
          <Button
            small
            variant="secondary"
            label="Déconnexion"
            onPress={() =>
              run(async () => {
                await cloud.signOut(session);
                await saveSession(null);
                setSession(null);
              })
            }
          />
        </Row>
        {msg ? <Muted>{msg}</Muted> : null}
      </Card>
    );
  }

  const auth = (mode: 'in' | 'up') =>
    run(async () => {
      const r = mode === 'in' ? await cloud.signIn(email.trim(), password) : await cloud.signUp(email.trim(), password);
      if ('needsConfirmation' in r) {
        setMsg('Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.');
        return;
      }
      await saveSession(r);
      setSession(r);
      await doSync(r);
    });

  return (
    <Card>
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      <Row>
        <Button small label="Se connecter" onPress={() => auth('in')} loading={busy} style={{ flex: 1 }} disabled={!email || password.length < 6} />
        <Button small variant="secondary" label="Créer un compte" onPress={() => auth('up')} style={{ flex: 1 }} disabled={!email || password.length < 6} />
      </Row>
      {msg ? <Muted style={{ marginTop: space.sm }}>{msg}</Muted> : null}
    </Card>
  );
}

export default function Settings() {
  const store = useStore();
  const p = store.profile;
  if (!p) return null;
  const update = (patch: Partial<UserProfile>) => store.updateProfile(patch);

  const reschedule = () =>
    rescheduleReminders(snapshotState(useStore.getState()), (items) => useStore.getState().markReminderScheduled(items)).catch(() => 0);

  return (
    <Screen edges={[]}>
      <SectionTitle>Compte & synchronisation</SectionTitle>
      <Account />

      <SectionTitle>Objectif</SectionTitle>
      <ChipGroup options={GOAL_OPTIONS} value={p.goal} onChange={(v) => update({ goal: v as UserProfile['goal'] })} />
      <Row>
        <View style={{ flex: 1, gap: 6 }}>
          <Muted>Poids cible</Muted>
          <NumberStepper value={p.targetWeightKg} onChange={(v) => update({ targetWeightKg: v })} step={0.5} decimals={1} min={35} max={250} unit="kg" />
        </View>
      </Row>

      <SectionTitle>Entraînement</SectionTitle>
      <ChipGroup options={LEVEL_OPTIONS} value={p.level} onChange={(v) => update({ level: v as UserProfile['level'] })} />
      <Muted>Jours disponibles</Muted>
      <ChipGroup
        multi
        options={[0, 1, 2, 3, 4, 5, 6].map((i) => ({ id: i, label: dayLabel(i) }))}
        value={p.availableDays}
        onChange={(v) => (v as number[]).length && update({ availableDays: (v as number[]).sort() })}
      />
      <Row>
        <View style={{ flex: 1, gap: 6 }}>
          <Muted>Séances / semaine</Muted>
          <NumberStepper value={p.sessionsPerWeek} onChange={(v) => update({ sessionsPerWeek: v })} min={1} max={6} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Muted>Durée (min)</Muted>
          <NumberStepper value={p.sessionMinutes} onChange={(v) => update({ sessionMinutes: v })} step={5} min={15} max={120} />
        </View>
      </Row>
      <Muted>Équipement</Muted>
      <ChipGroup multi options={EQUIPMENT_OPTIONS} value={p.equipment} onChange={(v) => update({ equipment: v as UserProfile['equipment'] })} />
      <Muted>Limitations / blessures</Muted>
      <ChipGroup multi color={colors.warning} options={LIMITATION_OPTIONS} value={p.limitations} onChange={(v) => update({ limitations: v as UserProfile['limitations'] })} />

      <SectionTitle>Alimentation & quotidien</SectionTitle>
      <ChipGroup options={DIET_OPTIONS} value={p.diet} onChange={(v) => update({ diet: v as UserProfile['diet'] })} />
      <ChipGroup multi color={colors.danger} options={ALLERGEN_OPTIONS} value={p.allergies} onChange={(v) => update({ allergies: v as UserProfile['allergies'] })} />
      <ChipGroup options={ACTIVITY_OPTIONS} value={p.activityLevel} onChange={(v) => update({ activityLevel: v as UserProfile['activityLevel'] })} />

      <SectionTitle>Rappels intelligents</SectionTitle>
      <Muted>Maximum 5 par jour, jamais pendant ton sommeil, et pas de rappel pour une action déjà faite.</Muted>
      <Card style={{ gap: space.md }}>
        {store.reminders.map((r) => (
          <View key={r.id} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...font.h3, color: colors.text }}>{r.label}</Text>
                <Muted>{r.message}</Muted>
              </View>
              <Switch
                value={r.enabled}
                onValueChange={(enabled) => {
                  store.updateReminder(r.id, { enabled });
                  reschedule();
                }}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </Row>
            {r.enabled ? (
              <TimeStepper
                value={r.time}
                onChange={(time) => {
                  store.updateReminder(r.id, { time });
                  reschedule();
                }}
              />
            ) : null}
          </View>
        ))}
        <Button small variant="secondary" label="Autoriser les notifications" onPress={() => requestNotificationPermission().then(reschedule)} />
      </Card>

      <SectionTitle>Intégrations</SectionTitle>
      <Card style={{ gap: space.md }}>
        {INTEGRATIONS.map((i) => (
          <Row key={i.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...font.h3, fontSize: 15, color: colors.text }}>{i.name}</Text>
              <Muted>{i.description}</Muted>
            </View>
            <Pill label={i.status === 'active' ? 'Actif' : 'Bientôt'} color={i.status === 'active' ? colors.success : colors.textMute} />
          </Row>
        ))}
      </Card>

      <SectionTitle>Mes données</SectionTitle>
      <Row>
        <Button small variant="secondary" label="Export JSON" onPress={() => shareExport(snapshotState(useStore.getState()))} style={{ flex: 1 }} />
        <Button small variant="secondary" label="Export CSV" onPress={() => shareCsv(snapshotState(useStore.getState()))} style={{ flex: 1 }} />
      </Row>
      <Disclaimer />
      <Pressable
        onPress={() =>
          confirm('Tout effacer ?', 'Profil, historique et programme seront supprimés de cet appareil.', () => {
            store.reset();
            router.replace('/onboarding');
          })
        }
        style={{ alignItems: 'center', padding: space.md }}
      >
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Réinitialiser l’application</Text>
      </Pressable>
    </Screen>
  );
}
