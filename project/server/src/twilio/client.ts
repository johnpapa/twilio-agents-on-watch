import twilio from 'twilio';

let client: ReturnType<typeof twilio> | null = null;

/**
 * Auth is API Key + Secret, not the account auth token. The auth token is
 * a root credential for the whole account; an API key can be scoped and
 * revoked without rotating everything else that depends on the account.
 */
export function getTwilioClient() {
  if (client) return client;

  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const apiKeySid = requireEnv('TWILIO_API_KEY_SID');
  const apiKeySecret = requireEnv('TWILIO_API_KEY_SECRET');

  client = twilio(apiKeySid, apiKeySecret, { accountSid });
  return client;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill in your Twilio credentials, or run with MOCK=1.`,
    );
  }
  return value;
}

// The Twilio WhatsApp Sandbox number is shared across every Twilio account --
// this is the standard one. Override with TWILIO_WHATSAPP_NUMBER only if
// your Console's Sandbox page shows something different.
const DEFAULT_WHATSAPP_SANDBOX_NUMBER = '+14155238886';
export const WHATSAPP_NUMBER = () =>
  process.env.TWILIO_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_SANDBOX_NUMBER;

export const TWILIO_NUMBER = () => requireEnv('TWILIO_VOICE_NUMBER');
export const PRESENTER_NUMBER = () => requireEnv('PRESENTER_PHONE_NUMBER');
