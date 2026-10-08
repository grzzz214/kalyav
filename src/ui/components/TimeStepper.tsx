import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { shiftTime } from '../../core/utils/date';
import { colors } from '../theme';
import { styles, tap } from './primitives';

/** Sélecteur d'heure simple par pas de 15 minutes. */
export function TimeStepper({ value, onChange, step = 15 }: { value: string; onChange: (v: string) => void; step?: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => { tap(); onChange(shiftTime(value, -step)); }} hitSlop={6}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, { color: colors.text }]}>{value}</Text>
      <Pressable style={styles.stepBtn} onPress={() => { tap(); onChange(shiftTime(value, step)); }} hitSlop={6}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}
