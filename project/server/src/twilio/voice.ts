import { getTwilioClient, TWILIO_NUMBER } from './client.js';

const VOICE = 'Google.en-US-Chirp3-HD-Charon';

/**
 * Places a voice call that speaks `question` aloud using inline TwiML
 * (`twiml` param on calls.create -- ~4,096 char max, nothing to host, no
 * tunnel needed). Asks the person to reply by text since the rest of this
 * demo is polling-only, no webhooks -- so a spoken <Gather> response isn't
 * an option here.
 *
 * This is a real, irreversible action with a real charge -- Twilio's own
 * guidance for this call is to confirm intent before placing it and to
 * place it ONLY between 8am and 9pm in the recipient's local time -- that is
 * the permitted window, and calling outside it is off limits, not merely
 * discouraged. Fine for a single pre-confirmed presenter number in a demo; a
 * production version needs actual TCPA consent handling and a timezone check
 * on `to`, not just a comment saying so.
 */
export async function placeEscalationCall(to: string, question: string): Promise<string> {
  const client = getTwilioClient();
  const twiml = `
<Response>
  <Pause length="1"/>
  <Say voice="${VOICE}">${escapeForTwiml(question)}</Say>
  <Pause length="1"/>
  <Say voice="${VOICE}">Please reply by text with your decision. I'm listening.</Say>
</Response>`.trim();

  const call = await client.calls.create({
    to,
    from: TWILIO_NUMBER(),
    twiml,
  });
  return call.sid;
}

function escapeForTwiml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
