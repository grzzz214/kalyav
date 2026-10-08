import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../data/store';
import { useCoach } from '../../ui/useCoach';
import { Card, Muted, Row, Screen, SectionTitle, tap } from '../../ui/components/primitives';
import { Gauge, Ring } from '../../ui/components/charts';
import { SLOT_LABEL } from '../../ui/labels';
import { remainingSummary } from '../../core/nutrition/mealGenerator';
import { getFood, macrosFor } from '../../core/nutrition/foods';
import type { MealSlot } from '../../core/types';
import { colors, font, radius, space } from '../../ui/theme';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

function Action({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.nutrition} />
      <Text style={{ ...font.small, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

export default function Nutrition() {
  const data = useCoach();
  const removeFood = useStore((s) => s.removeFood);
  const addFood = useStore((s) => s.addFood);
  if (!data) return null;
  const { snapshot: snap, targets, state, date } = data;
  const c = snap.consumed;
  const remaining = { kcal: targets.kcal - c.kcal, protein: targets.protein - c.protein, carbs: targets.carbs - c.carbs, fat: targets.fat - c.fat, fiber: targets.fiber - c.fiber };
  const entries = state.foodLog.filter((f) => f.date === date);
  const favorites = state.favoriteFoodIds.map((id) => getFood(id, state.customFoods)).filter((f): f is NonNullable<typeof f> => !!f);

  return (
    <Screen subtitle="Suivi alimentaire" title="Nutrition">
      <Card>
        <Row style={{ gap: space.lg }}>
          <Ring value={c.kcal / targets.kcal} size={120} color={c.kcal > targets.kcal * 1.05 ? colors.warning : colors.nutrition}>
            <Text style={{ ...font.number, color: colors.text, fontSize: 24 }}>{Math.max(0, Math.round(remaining.kcal))}</Text>
            <Muted style={{ fontSize: 11 }}>kcal restantes</Muted>
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ ...font.h3, color: colors.text }}>{remainingSummary(remaining)}</Text>
            <Muted>
              {Math.round(c.kcal).toLocaleString('fr-FR')} / {targets.kcal.toLocaleString('fr-FR')} kcal consommées
            </Muted>
          </View>
        </Row>
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Gauge label="Calories" value={c.kcal} target={targets.kcal} unit="kcal" color={colors.nutrition} />
          <Gauge label="Protéines" value={c.protein} target={targets.protein} unit="g" color={colors.protein} />
          <Gauge label="Glucides" value={c.carbs} target={targets.carbs} unit="g" color={colors.carbs} />
          <Gauge label="Lipides" value={c.fat} target={targets.fat} unit="g" color={colors.fat} />
          <Gauge label="Fibres" value={c.fiber} target={targets.fiber} unit="g" color={colors.steps} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Action icon="search" label="Rechercher" onPress={() => router.push('/food-search')} />
        <Action icon="barcode-outline" label="Scanner" onPress={() => router.push('/scanner')} />
        <Action icon="sparkles" label="Idées de repas" onPress={() => router.push('/meal-generator')} />
        <Action icon="create-outline" label="Créer un repas" onPress={() => router.push('/recipe')} />
      </View>

      {favorites.length ? (
        <>
          <SectionTitle>Favoris · ajout rapide</SectionTitle>
          <Row style={{ flexWrap: 'wrap' }}>
            {favorites.slice(0, 8).map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  tap();
                  const m = macrosFor(f, f.portion.grams);
                  addFood({ date, slot: data.snapshot.consumed.kcal < 300 ? 'breakfast' : 'snack', name: f.name, quantityLabel: f.portion.label, foodId: f.id, ...m });
                }}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ ...font.small, color: colors.text }}>⭐ {f.name}</Text>
              </Pressable>
            ))}
          </Row>
        </>
      ) : null}

      {SLOTS.map((slot) => {
        const items = entries.filter((e) => e.slot === slot);
        const total = items.reduce((a, e) => a + e.kcal, 0);
        return (
          <View key={slot} style={{ gap: space.sm }}>
            <SectionTitle action="+ Ajouter" onAction={() => router.push(`/food-search?slot=${slot}`)}>
              {SLOT_LABEL[slot]}
              {total ? <Text style={{ ...font.small, color: colors.textMute }}>{`  ${Math.round(total)} kcal`}</Text> : null}
            </SectionTitle>
            {items.length ? (
              <Card style={{ paddingVertical: space.xs }}>
                {items.map((e, i) => (
                  <Row key={e.id} style={{ paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...font.h3, color: colors.text, fontSize: 15 }}>{e.name}</Text>
                      <Muted>
                        {e.quantityLabel} · P {Math.round(e.protein)} g · G {Math.round(e.carbs)} g · L {Math.round(e.fat)} g
                      </Muted>
                    </View>
                    <Text style={{ ...font.small, color: colors.text, fontWeight: '700' }}>{Math.round(e.kcal)}</Text>
                    <Pressable onPress={() => removeFood(e.id)} hitSlop={10} accessibilityLabel="Supprimer">
                      <Ionicons name="close-circle" size={20} color={colors.textMute} />
                    </Pressable>
                  </Row>
                ))}
              </Card>
            ) : (
              <Muted>Rien pour l’instant.</Muted>
            )}
          </View>
        );
      })}
    </Screen>
  );
}
