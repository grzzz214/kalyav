import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../data/store';
import type { Food, MealSlot, Recipe } from '../core/types';
import { macrosFor, searchFoods } from '../core/nutrition/foods';
import { RECIPES } from '../core/nutrition/recipes';
import { recipeMacros } from '../core/nutrition/mealGenerator';
import { roundMacros } from '../core/nutrition/calculator';
import { openFoodFacts } from '../integrations/openFoodFacts';
import { today } from '../core/utils/date';
import { uid } from '../core/utils/stats';
import { Button, Card, ChipGroup, Field, Muted, NumberStepper, Row, Screen, SectionTitle, styles as ui, tap } from '../ui/components/primitives';
import { SLOT_OPTIONS, defaultSlot } from '../ui/labels';
import { colors, font, radius, space } from '../ui/theme';

type Tab = 'foods' | 'recipes' | 'create';

export default function FoodSearch() {
  const params = useLocalSearchParams<{ slot?: MealSlot; foodId?: string }>();
  const store = useStore();
  const [slot, setSlot] = useState<MealSlot>(params.slot ?? defaultSlot());
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('foods');
  const [selected, setSelected] = useState<Food | null>(
    params.foodId ? store.customFoods.find((f) => f.id === params.foodId) ?? null : null,
  );
  const [grams, setGrams] = useState<number>(selected?.portion.grams ?? 100);
  const [online, setOnline] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '', portion: '100' });

  const favorites = store.favoriteFoodIds;
  const results = useMemo(() => {
    const list = searchFoods(q, store.customFoods, 40);
    return q ? list : [...list.filter((f) => favorites.includes(f.id)), ...list.filter((f) => !favorites.includes(f.id))];
  }, [q, store.customFoods, favorites]);

  const recipes: Recipe[] = [...store.customRecipes, ...RECIPES].filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const date = today();

  const pick = (f: Food) => {
    tap();
    setSelected(f);
    setGrams(f.portion.grams);
  };

  const add = () => {
    if (!selected) return;
    const m = macrosFor(selected, grams);
    if (!store.customFoods.some((f) => f.id === selected.id) && selected.custom) store.addCustomFood(selected);
    store.addFood({ date, slot, name: selected.name, quantityLabel: `${grams} g`, foodId: selected.id, ...m });
    router.back();
  };

  const addRecipe = (r: Recipe) => {
    const m = roundMacros(recipeMacros(r, 1, store.customFoods));
    store.addFood({ date, slot, name: r.name, quantityLabel: '1 portion', recipeId: r.id, ...m });
    router.back();
  };

  const searchOnline = async () => {
    setLoading(true);
    try {
      setOnline(await openFoodFacts.search!(q));
    } catch {
      setOnline([]);
    } finally {
      setLoading(false);
    }
  };

  const createFood = () => {
    const n = (s: string) => parseFloat(s.replace(',', '.')) || 0;
    const food: Food = {
      id: uid('cf'),
      name: custom.name.trim(),
      per100: { kcal: n(custom.kcal), protein: n(custom.protein), carbs: n(custom.carbs), fat: n(custom.fat), fiber: n(custom.fiber) },
      portion: { label: `${n(custom.portion) || 100} g`, grams: n(custom.portion) || 100 },
      category: 'snack',
      allergens: [],
      custom: true,
    };
    store.addCustomFood(food);
    setTab('foods');
    pick(food);
  };

  const m = selected ? roundMacros(macrosFor(selected, grams)) : null;

  return (
    <Screen edges={[]}>
      <ChipGroup options={SLOT_OPTIONS} value={slot} onChange={(v) => setSlot(v as MealSlot)} color={colors.nutrition} />

      {selected && m ? (
        <Card accent={colors.nutrition}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ ...font.h2, color: colors.text, flex: 1 }}>{selected.name}</Text>
            <Pressable onPress={() => store.toggleFavorite(selected.id)} hitSlop={10} accessibilityLabel="Favori">
              <Ionicons name={favorites.includes(selected.id) ? 'star' : 'star-outline'} size={24} color={colors.carbs} />
            </Pressable>
          </Row>
          <Muted>
            Pour 100 g : {selected.per100.kcal} kcal · P {selected.per100.protein} g · G {selected.per100.carbs} g · L {selected.per100.fat} g
          </Muted>
          <View style={{ marginTop: space.md, gap: space.sm }}>
            <Row style={{ flexWrap: 'wrap' }}>
              {[0.5, 1, 1.5, 2].map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setGrams(Math.round(selected.portion.grams * k))}
                  style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}
                >
                  <Text style={{ ...font.small, color: colors.textDim }}>
                    {k === 1 ? selected.portion.label : `${k} × ${selected.portion.label}`}
                  </Text>
                </Pressable>
              ))}
            </Row>
            <NumberStepper value={grams} onChange={setGrams} step={10} min={1} max={2000} unit="g" />
          </View>
          <Row style={{ justifyContent: 'space-around', marginVertical: space.md }}>
            {[
              ['kcal', m.kcal, colors.nutrition],
              ['prot.', m.protein, colors.protein],
              ['gluc.', m.carbs, colors.carbs],
              ['lip.', m.fat, colors.fat],
              ['fibres', m.fiber, colors.steps],
            ].map(([l, v, c]) => (
              <View key={l as string} style={{ alignItems: 'center' }}>
                <Text style={{ ...font.h2, color: c as string }}>{v as number}</Text>
                <Muted>{l as string}</Muted>
              </View>
            ))}
          </Row>
          <Row>
            <Button label="Ajouter" onPress={add} style={{ flex: 1 }} />
            <Button label="Annuler" variant="secondary" onPress={() => setSelected(null)} />
          </Row>
        </Card>
      ) : null}

      <TextInput
        placeholder="Rechercher un aliment ou un repas…"
        placeholderTextColor={colors.textMute}
        value={q}
        onChangeText={(t) => {
          setQ(t);
          setOnline([]);
        }}
        style={ui.input}
        returnKeyType="search"
      />
      <ChipGroup
        options={[
          { id: 'foods', label: 'Aliments' },
          { id: 'recipes', label: 'Repas & recettes' },
          { id: 'create', label: '+ Nouvel aliment' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />
      <Button small variant="secondary" icon="📷" label="Scanner un code-barres" onPress={() => router.push(`/scanner?slot=${slot}`)} />

      {tab === 'foods' ? (
        <>
          <Card style={{ paddingVertical: space.xs }}>
            {results.map((f, i) => (
              <Pressable key={f.id} onPress={() => pick(f)} style={{ paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...font.h3, fontSize: 15, color: colors.text }}>
                      {favorites.includes(f.id) ? '⭐ ' : ''}
                      {f.name}
                    </Text>
                    <Muted>
                      {f.portion.label} · {Math.round((f.per100.kcal * f.portion.grams) / 100)} kcal · P {Math.round((f.per100.protein * f.portion.grams) / 100)} g
                    </Muted>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.nutrition} />
                </Row>
              </Pressable>
            ))}
            {!results.length ? <Muted style={{ paddingVertical: space.md }}>Aucun résultat dans la base locale.</Muted> : null}
          </Card>
          {q.length >= 3 ? (
            <Button small variant="secondary" label="Chercher dans Open Food Facts" onPress={searchOnline} loading={loading} />
          ) : null}
          {loading ? <ActivityIndicator color={colors.accent} /> : null}
          {online.length ? (
            <>
              <SectionTitle>Résultats en ligne</SectionTitle>
              <Card style={{ paddingVertical: space.xs }}>
                {online.map((f, i) => (
                  <Pressable key={f.id} onPress={() => pick(f)} style={{ paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                    <Text style={{ ...font.h3, fontSize: 15, color: colors.text }}>{f.name}</Text>
                    <Muted>{f.per100.kcal} kcal / 100 g · P {f.per100.protein} g</Muted>
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'recipes' ? (
        <Card style={{ paddingVertical: space.xs }}>
          {recipes.map((r, i) => {
            const rm = roundMacros(recipeMacros(r, 1, store.customFoods));
            return (
              <Pressable key={r.id} onPress={() => addRecipe(r)} style={{ paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...font.h3, fontSize: 15, color: colors.text }}>
                      {r.custom ? '👤 ' : ''}
                      {r.name}
                    </Text>
                    <Muted>
                      {rm.kcal} kcal · P {rm.protein} g · {r.prepMinutes} min
                    </Muted>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.nutrition} />
                </Row>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {tab === 'create' ? (
        <Card>
          <Muted style={{ marginBottom: space.md }}>Valeurs pour 100 g (indiquées sur l’emballage).</Muted>
          <Field label="Nom" value={custom.name} onChangeText={(t) => setCustom({ ...custom, name: t })} />
          <Row>
            <View style={{ flex: 1 }}>
              <Field label="Calories" keyboardType="decimal-pad" value={custom.kcal} onChangeText={(t) => setCustom({ ...custom, kcal: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Protéines (g)" keyboardType="decimal-pad" value={custom.protein} onChangeText={(t) => setCustom({ ...custom, protein: t })} />
            </View>
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Field label="Glucides (g)" keyboardType="decimal-pad" value={custom.carbs} onChangeText={(t) => setCustom({ ...custom, carbs: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Lipides (g)" keyboardType="decimal-pad" value={custom.fat} onChangeText={(t) => setCustom({ ...custom, fat: t })} />
            </View>
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Field label="Fibres (g)" keyboardType="decimal-pad" value={custom.fiber} onChangeText={(t) => setCustom({ ...custom, fiber: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Portion (g)" keyboardType="decimal-pad" value={custom.portion} onChangeText={(t) => setCustom({ ...custom, portion: t })} />
            </View>
          </Row>
          <Button label="Créer l’aliment" onPress={createFood} disabled={!custom.name.trim() || !custom.kcal} />
        </Card>
      ) : null}
    </Screen>
  );
}
