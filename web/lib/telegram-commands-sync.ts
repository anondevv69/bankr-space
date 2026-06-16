import { kvGet, kvSet } from '@/lib/kv-store';
import { setTelegramBotCommands, telegramBotCommandsVersion } from '@/lib/telegram-bot';

const KV_KEY = 'tg:bot-commands-version';

/** Re-register slash commands with Telegram when the list changes (e.g. after deploy). */
export async function ensureTelegramBotCommandsSynced(): Promise<void> {
  const version = telegramBotCommandsVersion();
  const stored = await kvGet<string>(KV_KEY);
  if (stored === version) return;

  const result = await setTelegramBotCommands();
  const results = Array.isArray(result) ? result : [result];
  const ok = results.some(
    (item) => item && typeof item === 'object' && (item as { ok?: boolean }).ok === true
  );
  if (!ok) {
    console.error('[telegram] setMyCommands failed', result);
    return;
  }

  await kvSet(KV_KEY, version);
}
