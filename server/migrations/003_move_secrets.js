// API keys move out of the synced center settings into center_secrets (encrypted),
// and the old demo developer API key records are removed.
import { SECRET_SETTINGS_FIELDS } from '../../js/sync-rules.js';
import { canEncrypt, encryptSecret } from '../secrets.js';

export default async function moveSecrets(db) {
  const r = await db.query(`SELECT center_id, id, data FROM records WHERE collection = 'centerSettings'`);
  let moved = 0;
  let dropped = 0;
  for (const row of r.rows) {
    const s = row.data || {};
    if (!SECRET_SETTINGS_FIELDS.some((f) => f in s)) continue;
    const openai = (s.openaiApiKey || '').trim();
    const wa = (s.whatsappApiKey || '').trim();
    const phoneId = (s.whatsappPhoneId || '').trim();
    if (openai || wa || phoneId) {
      if (canEncrypt()) {
        await db.query(
          `INSERT INTO center_secrets (center_id, openai_api_key_enc, whatsapp_token_enc, whatsapp_phone_id)
           VALUES ($1, $2, $3, $4) ON CONFLICT (center_id) DO NOTHING`,
          [row.center_id, openai ? encryptSecret(openai) : null, wa ? encryptSecret(wa) : null, phoneId || null],
        );
        moved += 1;
      } else {
        dropped += 1;
      }
    }
    const clean = Object.fromEntries(Object.entries(s).filter(([k]) => !SECRET_SETTINGS_FIELDS.includes(k)));
    await db.query(
      `UPDATE records SET data = $4, version = version + 1, updated_at = NOW()
       WHERE center_id = $1 AND collection = $2 AND id = $3`,
      [row.center_id, 'centerSettings', row.id, clean],
    );
  }
  const keys = await db.query(`DELETE FROM records WHERE collection = 'apiKeys'`);
  return `moved ${moved} centers' secrets, dropped ${dropped} (no SECRETS_ENCRYPTION_KEY), removed ${keys.rowCount} old API key records`;
}
