// A stand-in for Twilio, so you can build and test the escalation pattern
// with no account, no credentials, and no network calls. Chapter 02 swaps
// this for the real thing -- the shape of askHuman() doesn't change at all.

let replyArrivesAtMs = null; // ms since the text was sent; null = never replies

export function scenario(whenTheHumanRepliesMs) {
  replyArrivesAtMs = whenTheHumanRepliesMs;
}

export async function sendText(message) {
  console.log(`[text sent]    "${message}"`);
}

export async function checkForReply(sentAtMs) {
  const elapsed = Date.now() - sentAtMs;
  if (replyArrivesAtMs !== null && elapsed >= replyArrivesAtMs) {
    return 'archive it';
  }
  return null;
}

export async function placeCall(message) {
  console.log(`[calling...]   "${message}"`);
}
