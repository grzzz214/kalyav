import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, font, radius, space } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anneau de progression animé. */
export function Ring({
  value,
  size = 120,
  stroke = 12,
  color = colors.accent,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.max(0, Math.min(1, value)), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, anim]);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Barre de progression horizontale animée. */
export function ProgressBar({ value, color = colors.accent, height = 8, track = colors.surfaceAlt }: { value: number; color?: string; height?: number; track?: string }) {
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.max(0, Math.min(1, value)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, anim]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height,
          borderRadius: height,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

/** Jauge « Calories : 1 850 / 2 200 kcal ». */
export function Gauge({
  label,
  value,
  target,
  unit,
  color,
  emoji,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  emoji?: string;
}) {
  const over = value > target * 1.05;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...font.small, color: colors.textDim }}>
          {emoji ? `${emoji} ` : ''}
          {label}
        </Text>
        <Text style={{ ...font.small, color: over ? colors.warning : colors.text }}>
          <Text style={{ fontWeight: '800' }}>{Math.round(value).toLocaleString('fr-FR')}</Text>
          <Text style={{ color: colors.textMute }}> / {Math.round(target).toLocaleString('fr-FR')} {unit}</Text>
        </Text>
      </View>
      <ProgressBar value={target ? value / target : 0} color={over ? colors.warning : color} />
    </View>
  );
}

export interface Point {
  label: string;
  value: number;
}

function useWidth(initial = 300) {
  const [w, setW] = useState(initial);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.max(100, e.nativeEvent.layout.width));
  return { w, onLayout };
}

/** Courbe propre avec aire dégradée, valeurs min/max et cible optionnelle. */
export function LineChart({
  data,
  color = colors.accent,
  height = 160,
  target,
  unit = '',
  decimals = 1,
}: {
  data: Point[];
  color?: string;
  height?: number;
  target?: number;
  unit?: string;
  decimals?: number;
}) {
  const { w, onLayout } = useWidth();
  if (data.length < 2) {
    return (
      <View onLayout={onLayout} style={[chart.empty, { height }]}>
        <Text style={chart.emptyText}>Pas encore assez de données — reviens après quelques saisies.</Text>
      </View>
    );
  }
  const pad = { l: 8, r: 8, t: 16, b: 22 };
  const values = data.map((d) => d.value).concat(target !== undefined ? [target] : []);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-6) {
    max += 1;
    min -= 1;
  }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (data.length - 1);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  // courbe lissée (Catmull-Rom → Bézier)
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    path += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  const area = `${path} L ${pts[pts.length - 1][0]} ${height - pad.b} L ${pts[0][0]} ${height - pad.b} Z`;
  const last = data[data.length - 1];
  const fmt = (v: number) => (Math.round(v * 10 ** decimals) / 10 ** decimals).toLocaleString('fr-FR');
  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const gid = `g${color.replace('#', '')}`;

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {target !== undefined ? (
          <>
            <Line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke={colors.textMute} strokeDasharray="4 6" strokeWidth={1} />
            <SvgText x={w - pad.r} y={y(target) - 5} fill={colors.textMute} fontSize={10} textAnchor="end">
              objectif {fmt(target)}
              {unit}
            </SvgText>
          </>
        ) : null}
        <Path d={area} fill={`url(#${gid})`} />
        <Path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={5} fill={colors.bg} stroke={color} strokeWidth={2.5} />
        {labelIdx.map((i) => (
          <SvgText key={i} x={x(i)} y={height - 6} fill={colors.textMute} fontSize={10} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
            {data[i].label}
          </SvgText>
        ))}
      </Svg>
      <Text style={chart.lastValue}>
        Dernière valeur : <Text style={{ color, fontWeight: '800' }}>{fmt(last.value)}{unit}</Text>
      </Text>
    </View>
  );
}

/** Histogramme simple (pas, calories, régularité). */
export function BarChart({
  data,
  color = colors.accent,
  height = 140,
  target,
}: {
  data: Point[];
  color?: string;
  height?: number;
  target?: number;
}) {
  const { w, onLayout } = useWidth();
  if (!data.length) {
    return (
      <View onLayout={onLayout} style={[chart.empty, { height }]}>
        <Text style={chart.emptyText}>Aucune donnée pour l’instant.</Text>
      </View>
    );
  }
  const padB = 20;
  const max = Math.max(...data.map((d) => d.value), target ?? 0, 1) * 1.1;
  const gap = 6;
  const bw = (w - gap * (data.length - 1)) / data.length;
  const h = (v: number) => (v / max) * (height - padB);
  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        {data.map((d, i) => {
          const bh = Math.max(2, h(d.value));
          const reached = target === undefined || d.value >= target;
          return (
            <React.Fragment key={i}>
              <Rect x={i * (bw + gap)} y={height - padB - bh} width={bw} height={bh} rx={Math.min(6, bw / 2)} fill={reached ? color : color + '66'} />
              {data.length <= 14 ? (
                <SvgText x={i * (bw + gap) + bw / 2} y={height - 5} fill={colors.textMute} fontSize={10} textAnchor="middle">
                  {d.label}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
        {target !== undefined ? (
          <Line x1={0} x2={w} y1={height - padB - h(target)} y2={height - padB - h(target)} stroke={colors.textMute} strokeDasharray="4 6" />
        ) : null}
      </Svg>
    </View>
  );
}

/** Grille de régularité (type calendrier) sur N semaines. */
export function ConsistencyGrid({ days }: { days: { date: string; level: 0 | 1 | 2 | 3 }[] }) {
  const shades = [colors.surfaceAlt, colors.accent + '44', colors.accent + '99', colors.accent];
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {weeks.map((wk, i) => (
        <View key={i} style={{ gap: 4, flex: 1 }}>
          {wk.map((d) => (
            <View key={d.date} style={{ aspectRatio: 1, borderRadius: 4, backgroundColor: shades[d.level] }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const chart = StyleSheet.create({
  empty: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  emptyText: { ...font.small, color: colors.textMute, textAlign: 'center' },
  lastValue: { ...font.small, color: colors.textMute, marginTop: 4 },
});
