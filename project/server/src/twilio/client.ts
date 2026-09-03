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

/**
 * Guarantees a leading "+" (E.164) regardless of how the number was typed
 * into .env. Found on a real run: PRESENTER_PHONE_NUMBER without the "+"
 * still worked for outbound sends -- Twilio normalizes what it dials/texts
 * -- but every inbound reply comes back from Twilio's API *with* the "+",
 * so messaging.ts's exact-string match against the un-normalized env value
 * silently matched nothing, forever. No error, no timeout message -- the
 * poll just never saw a reply, no matter how fast the human replied.
 */
function normalizePhone(value: string): string {
  return value.startsWith('+') ? value : `+${value.replace(/\D/g, '')}`;
}

// The Twilio WhatsApp Sandbox number is shared across every Twilio account --
// this is the standard one. Override with TWILIO_WHATSAPP_NUMBER only if
// your Console's Sandbox page shows something different.
const DEFAULT_WHATSAPP_SANDBOX_NUMBER = '+14155238886';
export const WHATSAPP_NUMBER = () =>
  normalizePhone(process.env.TWILIO_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_SANDBOX_NUMBER);

export const TWILIO_NUMBER = () => normalizePhone(requireEnv('TWILIO_VOICE_NUMBER'));
export const PRESENTER_NUMBER = () => normalizePhone(requireEnv('PRESENTER_PHONE_NUMBER'));
