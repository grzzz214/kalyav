import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../data/store';
import { useCoach } from '../ui/useCoach';
import { generateMeals, MEAL_MODES, remainingSummary, type MealMode } from '../core/nutrition/mealGenerator';
import { FOODS } from '../core/nutrition/foods';
import type { MealSlot } from '../core/types';
import { Button, Card, ChipGroup, Muted, Pill, Row, Screen, SectionTitle } from '../ui/components/primitives';
import { SLOT_OPTIONS, defaultSlot } from '../ui/labels';
import { colors, font, space } from '../ui/theme';

const PANTRY = ['egg', 'chicken_breast', 'tuna_can', 'rice', 'pasta', 'oats', 'skyr', 'lentils', 'tofu', 'potato', 'broccoli', 'banana', 'bread_whole', 'milk'];

export default function MealGenerator() {
  const data = useCoach();
  const addFood = useStore((s) => s.addFood);
  const [modes, setModes] = useState<MealMode[]>([]);
  const [slot, setSlot] = useState<MealSlot>(defaultSlot());
  const [maxMinutes, setMaxMinutes] = useState<number>(0);
  const [maxCost, setMaxCost] = useState<number>(0);
  const [pantry, setPantry] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);

  const remaining = useMemo(() => {
    if (!data) return null;
    const t = data.targets;
    const c = data.snapshot.consumed;
    return { kcal: t.kcal - c.kcal, protein: t.protein - c.protein, carbs: t.carbs - c.carbs, fat: t.fat - c.fat, fiber: t.fiber - c.fiber };
  }, [data]);

  if (!data || !remaining) return null;
  const meals = generateMeals({
    remaining,
    slot,
    modes,
    maxMinutes: maxMinutes || undefined,
    maxCost: maxCost || undefined,
    availableFoodIds: pantry,
    profile: data.profile,
    customFoods: data.state.customFoods,
    customRecipes: data.state.customRecipes,
    excludeRecipeIds: seen,
  });

  return (
    <Screen edges={[]}>
      <Card accent={colors.nutrition}>
        <Text style={{ ...font.h2, color: colors.text }}>{remainingSummary(remaining)}</Text>
        <Muted style={{ marginTop: 4 }}>Je te propose 3 repas qui rentrent dans ton budget du jour.</Muted>
      </Card>

      <SectionTitle>Repas</SectionTitle>
      <ChipGroup options={SLOT_OPTIONS} value={slot} onChange={(v) => setSlot(v as MealSlot)} color={colors.nutrition} />
      <SectionTitle>Envie</SectionTitle>
      <ChipGroup multi options={MEAL_MODES.map((m) => ({ id: m.id, label: `${m.emoji} ${m.label}` }))} value={modes} onChange={(v) => setModes(v as MealMode[])} color={colors.nutrition} />
      <SectionTitle>Temps disponible</SectionTitle>
      <ChipGroup
        options={[{ id: 0, label: 'Peu importe' }, { id: 10, label: '≤ 10 min' }, { id: 20, label: '≤ 20 min' }, { id: 30, label: '≤ 30 min' }]}
        value={maxMinutes}
        onChange={(v) => setMaxMinutes(v as number)}
      />
      <SectionTitle>Budget</SectionTitle>
      <ChipGroup
        options={[{ id: 0, label: 'Peu importe' }, { id: 1, label: '€' }, { id: 2, label: '€€' }]}
        value={maxCost}
        onChange={(v) => setMaxCost(v as number)}
      />
      <SectionTitle>Ce que j’ai sous la main</SectionTitle>
      <ChipGroup
        multi
        options={PANTRY.map((id) => ({ id, label: FOODS.find((f) => f.id === id)!.name }))}
        value={pantry}
        onChange={(v) => setPantry(v as string[])}
      />

      <SectionTitle action="Autres idées" onAction={() => setSeen([...seen, ...meals.map((m) => m.recipe.id)])}>
        Propositions
      </SectionTitle>
      {meals.length === 0 ? (
        <Card>
          <Muted>Aucun repas ne correspond à tous ces filtres. Retire un critère{seen.length ? ' ou réinitialise les idées' : ''}.</Muted>
          {seen.length ? <Button small variant="secondary" label="Réinitialiser" onPress={() => setSeen([])} style={{ marginTop: space.sm }} /> : null}
        </Card>
      ) : null}
      {meals.map((m) => (
        <Card key={m.recipe.id}>
          <Text style={{ ...font.h2, color: colors.text }}>{m.recipe.name}</Text>
          <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
            <Pill label={`${m.macros.kcal} kcal`} color={colors.nutrition} />
            <Pill label={`P ${m.macros.protein} g`} color={colors.protein} />
            <Pill label={`G ${m.macros.carbs} g`} color={colors.carbs} />
            <Pill label={`L ${m.macros.fat} g`} color={colors.fat} />
            <Pill label={`⏱ ${m.recipe.prepMinutes} min`} color={colors.textDim} />
          </Row>
          <View style={{ marginTop: space.md, gap: 2 }}>
            {m.ingredients.map((i) => (
              <Muted key={i.food.id}>
                • {i.food.name} — {i.grams} g
              </Muted>
            ))}
          </View>
          <View style={{ marginTop: space.sm, gap: 2 }}>
            {m.recipe.steps.map((s, k) => (
              <Text key={k} style={{ ...font.small, color: colors.textDim }}>
                {k + 1}. {s}
              </Text>
            ))}
          </View>
          {m.why.length ? <Muted style={{ marginTop: space.sm, color: colors.nutrition }}>✓ {m.why.join(' · ')}</Muted> : null}
          <Button
            small
            label="Je mange ça"
            style={{ marginTop: space.md }}
            onPress={() => {
              addFood({ date: data.date, slot, name: m.recipe.name, quantityLabel: m.portionFactor === 1 ? '1 portion' : `${m.portionFactor} portion`, recipeId: m.recipe.id, ...m.macros });
              router.back();
            }}
          />
        </Card>
      ))}
    </Screen>
  );
}
