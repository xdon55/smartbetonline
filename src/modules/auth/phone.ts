/**
 * auth/phone.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phone-number helpers shared by the browser and the server.
 *
 * SMARTBET is phone-first: the phone number IS the account identifier. Lovable
 * Cloud Auth credentials always need an email, so we derive a deterministic
 * synthetic address from the normalised phone number and use it for every
 * signUp / signInWithPassword call. The player never sees it.
 *
 * INTEGRATION NOTES:
 * - Default country is Uganda (+256). Local numbers such as "0772 000 000" are
 *   normalised to "+256772000000".
 * - The optional real email address the player gives at registration is stored
 *   on `profiles.email` — never used as a credential.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Domain used for the synthetic auth address. Not a deliverable mailbox. */
export const PHONE_AUTH_EMAIL_DOMAIN = "phone.smartbet.app";

/**
 * Normalise a user-typed phone number to E.164 (+256XXXXXXXXX for Uganda).
 * Returns null when the number cannot be understood.
 */
export function normalizePhone(input: string): string | null {
  const digits = (input ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;

  let msisdn: string;
  if (digits.startsWith("+")) {
    msisdn = digits.slice(1);
  } else if (digits.startsWith("00")) {
    msisdn = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // Local Ugandan format: 0772000000 -> 256772000000
    msisdn = `256${digits.slice(1)}`;
  } else if (digits.startsWith("256")) {
    msisdn = digits;
  } else {
    // Bare subscriber number, e.g. 772000000
    msisdn = `256${digits}`;
  }

  if (!/^\d{9,15}$/.test(msisdn)) return null;
  return `+${msisdn}`;
}

/** Deterministic credential email for a normalised phone number. */
export function phoneToAuthEmail(normalizedPhone: string): string {
  return `${normalizedPhone.replace("+", "")}@${PHONE_AUTH_EMAIL_DOMAIN}`;
}

/** Pretty display form used in the UI, e.g. +256 772 000 000. */
export function formatPhone(normalizedPhone: string): string {
  const m = /^\+256(\d{3})(\d{3})(\d{3})$/.exec(normalizedPhone);
  return m ? `+256 ${m[1]} ${m[2]} ${m[3]}` : normalizedPhone;
}
