import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { AppState, ISODate, ReminderKind } from '../core/types';
import { planNotifications } from '../core/reminders/scheduler';
import { toISODate } from '../core/utils/date';

let handlerSet = false;

function ensureHandler() {
  if (handlerSet || Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerSet = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  ensureHandler();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Reprogramme les rappels des 48 prochaines heures. Appelé au lancement et
 * à chaque retour au premier plan : les rappels déjà « satisfaits »
 * (ex. eau déjà bue) disparaissent, ce qui évite le spam.
 */
export async function rescheduleReminders(
  state: AppState,
  onScheduled?: (items: { kind: ReminderKind; date: ISODate }[]) => void,
): Promise<number> {
  if (Platform.OS === 'web') return 0;
  ensureHandler();
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const planned = planNotifications(state, new Date());
  for (const n of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { kind: n.kind } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date },
    });
  }
  onScheduled?.(planned.map((n) => ({ kind: n.kind, date: toISODate(n.date) })));
  return planned.length;
}
