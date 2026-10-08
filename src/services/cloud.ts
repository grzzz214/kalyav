import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from '../core/types';

/**
 * Authentification + synchronisation cloud.
 *
 * L'application fonctionne entièrement hors-ligne (« mode local »). Si
 * EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont définies,
 * le compte et les données sont synchronisés via l'API REST Supabase
 * (voir supabase/schema.sql). Tout autre backend peut implémenter
 * `CloudBackend`.
 */

export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface RemoteSnapshot {
  data: AppState;
  updatedAt: string;
}

export interface CloudBackend {
  readonly configured: boolean;
  signUp(email: string, password: string): Promise<AuthSession | { needsConfirmation: true }>;
  signIn(email: string, password: string): Promise<AuthSession>;
  refresh(session: AuthSession): Promise<AuthSession>;
  signOut(session: AuthSession): Promise<void>;
  pull(session: AuthSession): Promise<RemoteSnapshot | null>;
  push(session: AuthSession, data: AppState, updatedAt: string): Promise<void>;
}

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SESSION_KEY = 'kalyav-auth-session';

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email: string };
  error_description?: string;
  msg?: string;
}

async function authRequest(path: string, body: unknown): Promise<SupabaseAuthResponse> {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as SupabaseAuthResponse;
  if (!res.ok) throw new Error(json.error_description || json.msg || 'Erreur d’authentification');
  return json;
}

function toSession(r: SupabaseAuthResponse): AuthSession {
  if (!r.access_token || !r.user) throw new Error('Session invalide');
  return {
    userId: r.user.id,
    email: r.user.email,
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? '',
    expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
  };
}

export const supabaseBackend: CloudBackend = {
  configured: !!(URL && KEY),
  async signUp(email, password) {
    const r = await authRequest('signup', { email, password });
    return r.access_token ? toSession(r) : { needsConfirmation: true };
  },
  async signIn(email, password) {
    return toSession(await authRequest('token?grant_type=password', { email, password }));
  },
  async refresh(session) {
    if (session.expiresAt - Date.now() > 60_000) return session;
    return toSession(await authRequest('token?grant_type=refresh_token', { refresh_token: session.refreshToken }));
  },
  async signOut(session) {
    await fetch(`${URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${session.accessToken}` },
    }).catch(() => undefined);
  },
  async pull(session) {
    const res = await fetch(`${URL}/rest/v1/user_snapshots?select=data,updated_at&user_id=eq.${session.userId}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) throw new Error('Lecture cloud impossible');
    const rows = (await res.json()) as { data: AppState; updated_at: string }[];
    return rows[0] ? { data: rows[0].data, updatedAt: rows[0].updated_at } : null;
  },
  async push(session, data, updatedAt) {
    const res = await fetch(`${URL}/rest/v1/user_snapshots?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ user_id: session.userId, data, updated_at: updatedAt }),
    });
    if (!res.ok) throw new Error('Envoi cloud impossible');
  },
};

export const cloud: CloudBackend = supabaseBackend;

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: AuthSession | null) {
  if (s) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else await AsyncStorage.removeItem(SESSION_KEY);
}

export type SyncResult = 'pushed' | 'pulled' | 'up_to_date';

/**
 * Synchronisation « dernier écrit gagne » sur l'instantané complet.
 * Suffisant pour un usage mono-utilisateur multi-appareils ; une
 * synchronisation par enregistrement pourra la remplacer plus tard.
 */
export async function syncNow(
  session: AuthSession,
  local: { data: AppState; updatedAt: string },
  applyRemote: (data: AppState, updatedAt: string) => void,
): Promise<{ result: SyncResult; session: AuthSession }> {
  const fresh = await cloud.refresh(session);
  if (fresh !== session) await saveSession(fresh);
  const remote = await cloud.pull(fresh);
  if (remote && remote.updatedAt > local.updatedAt) {
    applyRemote(remote.data, remote.updatedAt);
    return { result: 'pulled', session: fresh };
  }
  if (!remote || remote.updatedAt < local.updatedAt) {
    await cloud.push(fresh, local.data, local.updatedAt);
    return { result: 'pushed', session: fresh };
  }
  return { result: 'up_to_date', session: fresh };
}
