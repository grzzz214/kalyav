import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../data/store';
import type { MealSlot, MealTag, Recipe } from '../core/types';
import { getFood, searchFoods } from '../core/nutrition/foods';
import { recipeMacros } from '../core/nutrition/mealGenerator';
import { roundMacros } from '../core/nutrition/calculator';
import { uid } from '../core/utils/stats';
import { today } from '../core/utils/date';
import { Button, Card, ChipGroup, Field, Muted, NumberStepper, Row, Screen, SectionTitle, styles as ui } from '../ui/components/primitives';
import { SLOT_OPTIONS } from '../ui/labels';
import { colors, font, space } from '../ui/theme';

/** Créer ses propres repas / enregistrer une recette réutilisable. */
export default function RecipeEditor() {
  const store = useStore();
  const [name, setName] = useState('');
  const [items, setItems] = useState<{ foodId: string; grams: number }[]>([]);
  const [q, setQ] = useState('');
  const [slots, setSlots] = useState<MealSlot[]>(['lunch', 'dinner']);
  const [prep, setPrep] = useState(15);
  const [tags, setTags] = useState<MealTag[]>([]);

  const draft: Recipe = { id: uid('rc'), name: name.trim(), ingredients: items, prepMinutes: prep, cost: 2, tags, slots, steps: [], custom: true };
  const macros = useMemo(() => roundMacros(recipeMacros(draft, 1, store.customFoods)), [items, store.customFoods]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = q ? searchFoods(q, store.customFoods, 6) : [];

  const save = (andLog: boolean) => {
    store.addCustomRecipe(draft);
    if (andLog) {
      store.addFood({ date: today(), slot: slots[0] ?? 'lunch', name: draft.name, quantityLabel: '1 portion', recipeId: draft.id, ...macros });
    }
    router.back();
  };

  return (
    <Screen edges={[]}>
      <Field label="Nom du repas" value={name} onChangeText={setName} placeholder="Ex. Mon bowl du midi" />
      <SectionTitle>Ingrédients</SectionTitle>
      {items.map((it, i) => {
        const f = getFood(it.foodId, store.customFoods)!;
        return (
          <Card key={`${it.foodId}-${i}`} style={{ padding: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ ...font.h3, color: colors.text, flex: 1 }}>{f.name}</Text>
              <Pressable onPress={() => setItems(items.filter((_, k) => k !== i))} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={colors.textMute} />
              </Pressable>
            </Row>
            <View style={{ marginTop: space.sm }}>
              <NumberStepper value={it.grams} onChange={(g) => setItems(items.map((x, k) => (k === i ? { ...x, grams: g } : x)))} step={10} min={1} max={2000} unit="g" />
            </View>
          </Card>
        );
      })}
      <TextInput placeholder="Ajouter un ingrédient…" placeholderTextColor={colors.textMute} value={q} onChangeText={setQ} style={ui.input} />
      {results.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => {
            setItems([...items, { foodId: f.id, grams: f.portion.grams }]);
            setQ('');
          }}
          style={{ paddingVertical: 10 }}
        >
          <Text style={{ color: colors.text }}>+ {f.name}</Text>
        </Pressable>
      ))}

      <Card>
        <Text style={{ ...font.h3, color: colors.text }}>
          {macros.kcal} kcal · P {macros.protein} g · G {macros.carbs} g · L {macros.fat} g · F {macros.fiber} g
        </Text>
        <Muted>Pour 1 portion</Muted>
      </Card>

      <SectionTitle>Moments du repas</SectionTitle>
      <ChipGroup multi options={SLOT_OPTIONS} value={slots} onChange={(v) => setSlots(v as MealSlot[])} />
      <SectionTitle>Temps de préparation</SectionTitle>
      <NumberStepper value={prep} onChange={setPrep} step={5} min={0} max={180} unit="min" />
      <SectionTitle>Étiquettes</SectionTitle>
      <ChipGroup
        multi
        options={[
          { id: 'quick', label: 'Rapide' },
          { id: 'budget', label: 'Économique' },
          { id: 'high_protein', label: 'Protéiné' },
          { id: 'vegetarian', label: 'Végétarien' },
          { id: 'gourmet', label: 'Gourmand' },
          { id: 'meal_prep', label: 'Meal prep' },
        ]}
        value={tags}
        onChange={(v) => setTags(v as MealTag[])}
      />
      <Row style={{ marginTop: space.lg }}>
        <Button label="Enregistrer" onPress={() => save(false)} disabled={!name.trim() || !items.length} style={{ flex: 1 }} />
        <Button variant="secondary" label="Enregistrer + manger" onPress={() => save(true)} disabled={!name.trim() || !items.length} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
