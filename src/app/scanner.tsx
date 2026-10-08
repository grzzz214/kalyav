import React, { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStore } from '../data/store';
import { openFoodFacts } from '../integrations/openFoodFacts';
import { getFood } from '../core/nutrition/foods';
import { Button, Card, Field, Muted, Screen } from '../ui/components/primitives';
import { colors, font, radius, space } from '../ui/theme';

/** Scan code-barres → Open Food Facts → fiche aliment pré-remplie. */
export default function Scanner() {
  const { slot } = useLocalSearchParams<{ slot?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const addCustomFood = useStore((s) => s.addCustomFood);
  const customFoods = useStore((s) => s.customFoods);
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound' | 'error'>('idle');
  const [manual, setManual] = useState('');
  const busy = useRef(false);

  const lookup = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setStatus('loading');
    try {
      const known = customFoods.find((f) => f.barcode === code);
      const food = known ?? (await openFoodFacts.findByBarcode(code));
      if (!food) {
        setStatus('notfound');
        return;
      }
      if (!getFood(food.id, customFoods)) addCustomFood(food);
      router.replace(`/food-search?foodId=${food.id}${slot ? `&slot=${slot}` : ''}`);
    } catch {
      setStatus('error');
    } finally {
      setTimeout(() => (busy.current = false), 1500);
    }
  };

  const cameraOk = Platform.OS !== 'web' && permission?.granted;

  return (
    <Screen edges={[]}>
      {cameraOk ? (
        <View style={{ height: 320, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => lookup(data)}
          />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', height: 80, borderWidth: 2, borderColor: colors.accent, borderRadius: radius.md }}
          />
        </View>
      ) : Platform.OS !== 'web' ? (
        <Card>
          <Text style={{ ...font.h3, color: colors.text }}>Accès à la caméra</Text>
          <Muted style={{ marginVertical: space.sm }}>Autorise la caméra pour scanner le code-barres de tes aliments.</Muted>
          <Button label="Autoriser la caméra" onPress={requestPermission} />
        </Card>
      ) : (
        <Muted>Le scan caméra est disponible sur mobile. Sur le web, saisis le code-barres ci-dessous.</Muted>
      )}

      {status === 'loading' ? <Muted>Recherche du produit…</Muted> : null}
      {status === 'notfound' ? (
        <Card accent={colors.warning}>
          <Text style={{ ...font.h3, color: colors.text }}>Produit introuvable</Text>
          <Muted>Tu peux le créer manuellement avec les valeurs de l’étiquette.</Muted>
          <Button small variant="secondary" label="Créer l’aliment" onPress={() => router.replace('/food-search')} style={{ marginTop: space.sm }} />
        </Card>
      ) : null}
      {status === 'error' ? <Muted style={{ color: colors.danger }}>Connexion impossible. Réessaie plus tard.</Muted> : null}

      <Field label="Code-barres" keyboardType="number-pad" value={manual} onChangeText={setManual} placeholder="3017620422003" />
      <Button label="Rechercher" onPress={() => lookup(manual.trim())} disabled={manual.trim().length < 8} />
      <Muted>Données nutritionnelles fournies par Open Food Facts (base collaborative).</Muted>
    </Screen>
  );
}
