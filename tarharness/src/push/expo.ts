// The closed-phone bell: Expo push (FCM underneath on Android). Sent only on
// urgent inbox rows; the badge on the Canvas tells the rest of the truth.

export interface PushEnv { readonly EXPO_ACCESS_TOKEN?: string }

interface PushTokenRow { token: string; platform: string }

export async function sendPush(env: PushEnv, tokens: readonly PushTokenRow[], title: string, body: string): Promise<void> {
  if (!tokens.length || !env.EXPO_ACCESS_TOKEN) return;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map((token) => ({ to: token.token, title, body, sound: 'default' }))),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) console.error(JSON.stringify({ event: 'push.send.failed', status: response.status }));
  } catch (cause) {
    console.error(JSON.stringify({ event: 'push.send.failed', error: cause instanceof Error ? cause.message : String(cause) }));
  }
}

export async function tokensFor(control: D1Database, users: readonly string[]): Promise<PushTokenRow[]> {
  if (!users.length) return [];
  const results = await Promise.all(users.map(async (user) => {
    const rows = await control.prepare('SELECT token, platform FROM push_tokens WHERE user=?').bind(user).all<{ token: string; platform: string }>();
    return rows.results;
  }));
  return results.flat();
}
