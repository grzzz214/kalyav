export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const round = (v: number, step = 1) => Math.round(v / step) * step;

export function mean(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Régression linéaire simple. Retourne la pente (unité de y par unité de x).
 * Utilisée pour dégager une tendance plutôt que réagir à un point isolé.
 */
export function linearSlope(points: { x: number; y: number }[]): number | undefined {
  if (points.length < 2) return undefined;
  const mx = mean(points.map((p) => p.x))!;
  const my = mean(points.map((p) => p.y))!;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Moyenne mobile exponentielle (lisse les variations d'eau du poids). */
export function ema(values: number[], alpha = 0.25): number[] {
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1]));
  return out;
}

export function pct(value: number, target: number): number {
  if (target <= 0) return 0;
  return clamp(value / target, 0, 1);
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
