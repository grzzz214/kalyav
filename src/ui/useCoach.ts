import { useEffect, useMemo, useState } from 'react';
import { snapshotState, useStore } from '../data/store';
import { analyze } from '../core/coach/analysis';
import { evaluateRules } from '../core/coach/adaptationEngine';
import { dailySnapshot } from '../core/dashboard/daily';
import { dailyBriefing } from '../core/coach/briefing';
import { today } from '../core/utils/date';

/** Date du jour qui se met à jour après minuit si l'app reste ouverte. */
export function useToday() {
  const [d, setD] = useState(today());
  useEffect(() => {
    const t = setInterval(() => {
      const n = today();
      setD((prev) => (prev === n ? prev : n));
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  return d;
}

/** Point d'entrée unique de l'UI vers le moteur de coaching. */
export function useCoach() {
  const store = useStore();
  const date = useToday();
  return useMemo(() => {
    const state = snapshotState(store);
    if (!state.profile) return null;
    const analysis = analyze(state, date);
    const snapshot = dailySnapshot(state, date, analysis.targets);
    const insights = evaluateRules(state, analysis);
    const briefing = dailyBriefing(state, analysis, snapshot, new Date());
    return { state, profile: state.profile, date, analysis, targets: analysis.targets, snapshot, insights, briefing };
  }, [store, date]);
}

export type CoachData = NonNullable<ReturnType<typeof useCoach>>;
