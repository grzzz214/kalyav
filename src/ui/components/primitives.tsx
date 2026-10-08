import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, space } from '../theme';

export function tap() {
  Haptics.selectionAsync().catch(() => undefined);
}

export function Screen({
  children,
  title,
  subtitle,
  right,
  scroll = true,
  edges = ['top'],
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const header =
    title || right ? (
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
          {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
        </View>
        {right}
      </View>
    ) : null;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

/** Apparition douce (fondu + léger glissement). */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export function Card({
  children,
  style,
  onPress,
  accent,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accent?: string;
}) {
  const content = (
    <View style={[styles.card, accent ? { borderColor: accent + '55' } : null, style]}>{children}</View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.92 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function SectionTitle({ children, action, onAction }: { children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg =
    variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surfaceAlt : variant === 'danger' ? colors.danger + '22' : 'transparent';
  const fg = variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.accent,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[styles.chip, selected && { backgroundColor: color + '22', borderColor: color }]}
    >
      <Text style={[styles.chipText, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  multi,
  color,
}: {
  options: { id: T; label: string }[];
  value: T | T[] | undefined;
  onChange: (v: T | T[]) => void;
  multi?: boolean;
  color?: string;
}) {
  const selected = (id: T) => (Array.isArray(value) ? value.includes(id) : value === id);
  return (
    <View style={styles.chipGroup}>
      {options.map((o) => (
        <Chip
          key={String(o.id)}
          label={o.label}
          color={color}
          selected={selected(o.id)}
          onPress={() => {
            if (!multi) return onChange(o.id);
            const arr = Array.isArray(value) ? value : [];
            onChange(arr.includes(o.id) ? arr.filter((x) => x !== o.id) : [...arr, o.id]);
          }}
        />
      ))}
    </View>
  );
}

/** Échelle 1 – N en pastilles (énergie, fatigue, motivation…). */
export function ScalePicker({
  value,
  onChange,
  max = 10,
  min = 1,
  color = colors.accent,
  lowLabel,
  highLabel,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  max?: number;
  min?: number;
  color?: string;
  lowLabel?: string;
  highLabel?: string;
}) {
  const items = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <View>
      <View style={styles.scaleRow}>
        {items.map((n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => {
                tap();
                onChange(n);
              }}
              style={[styles.scaleItem, on && { backgroundColor: color, borderColor: color }]}
            >
              <Text style={[styles.scaleText, on && { color: colors.accentInk }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      {lowLabel || highLabel ? (
        <View style={styles.scaleLabels}>
          <Text style={styles.muted}>{lowLabel}</Text>
          <Text style={styles.muted}>{highLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMute} {...props} style={[styles.input, props.style]} />
      {hint ? <Text style={[styles.muted, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

/** Champ numérique avec boutons − / +. */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  decimals = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 10 ** decimals) / 10 ** decimals)));
  // saisie libre : on ne borne la valeur qu'à la validation
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => { tap(); set(value - step); }} hitSlop={6}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <TextInput
        style={styles.stepValue}
        keyboardType="decimal-pad"
        value={draft ?? String(value).replace('.', ',')}
        onChangeText={setDraft}
        onEndEditing={() => {
          const n = parseFloat((draft ?? '').replace(',', '.'));
          if (!Number.isNaN(n)) set(n);
          setDraft(null);
        }}
        onBlur={() => {
          const n = parseFloat((draft ?? '').replace(',', '.'));
          if (draft !== null && !Number.isNaN(n)) set(n);
          setDraft(null);
        }}
      />
      {unit ? <Text style={styles.stepUnit}>{unit}</Text> : null}
      <Pressable style={styles.stepBtn} onPress={() => { tap(); set(value + step); }} hitSlop={6}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export function Pill({ label, color = colors.textDim }: { label: string; color?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '1F' }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, paddingBottom: 120, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space.sm, marginTop: space.sm },
  headerTitle: { ...font.h1, color: colors.text },
  headerSub: { ...font.tiny, color: colors.textMute, marginBottom: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md },
  sectionTitle: { ...font.h2, color: colors.text },
  sectionAction: { ...font.small, color: colors.accent },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: space.lg },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { ...font.small, color: colors.textDim },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  scaleItem: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  scaleText: { color: colors.text, fontWeight: '700' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  fieldLabel: { ...font.small, color: colors.textDim, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: colors.text, fontSize: 22, fontWeight: '600' },
  stepValue: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 22, fontWeight: '800', minWidth: 50 },
  stepUnit: { color: colors.textDim, marginRight: space.sm },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  muted: { ...font.small, color: colors.textMute },
  body: { ...font.body, color: colors.textDim, lineHeight: 22 },
  h2: { ...font.h2, color: colors.text },
});
