/**
 * auth/phone-auth.functions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server functions for phone-first registration with OTP verification.
 *
 * FLOW
 *  1. `requestSignupOtp`  -> validates the phone, stores a 6-digit code, and
 *                            (for now) returns it so the UI can show it.
 *  2. `verifyOtpAndRegister` -> checks the code, then creates the auth user with
 *                            a synthetic email derived from the phone number.
 *                            The browser afterwards signs in with phone+password.
 *
 * SECURITY
 * - These are intentionally unauthenticated (pre-account) endpoints. They are
 *   rate-limited per phone by the `attempts` column and a 60s resend window.
 * - Codes live in `public.phone_otps`, which has RLS on and no policies, so only
 *   the service-role admin client (loaded inside the handlers) can read them.
 *
 * TODO(integration): replace `deliverCode` with a real SMS gateway (Twilio
 * Verify / Africa's Talking). Once live, stop returning `devCode` to the client.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone, phoneToAuthEmail } from "./phone";

/** How long a code stays valid. */
const OTP_TTL_MS = 10 * 60 * 1000;
/** Maximum wrong guesses before a code is burned. */
const MAX_ATTEMPTS = 5;

/** Cryptographically random 6-digit code. */
function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return n.toString().padStart(6, "0");
}

const requestSchema = z.object({ phone: z.string().min(5) });

/**
 * Step 1 — issue an OTP for a phone number that is not yet registered.
 */
export const requestSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Enter a valid phone number, e.g. 0772 000 000");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reject numbers that already have an account.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (existing) throw new Error("This phone number already has an account. Please sign in.");

    // Simple resend throttle: one code per minute per number.
    const { data: recent } = await supabaseAdmin
      .from("phone_otps")
      .select("created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      throw new Error("Please wait a minute before requesting another code.");
    }

    const code = generateCode();
    const { error } = await supabaseAdmin.from("phone_otps").insert({
      phone,
      code,
      purpose: "signup",
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });
    if (error) throw new Error(error.message);

    // TODO(integration): send `code` by SMS here and drop `devCode` from the response.
    return { phone, devCode: code };
  });

const verifySchema = z.object({
  phone: z.string().min(5),
  code: z.string().length(6),
  password: z.string().min(8),
  displayName: z.string().min(2),
  dateOfBirth: z.string().min(4),
  email: z.string().email().optional().or(z.literal("")),
  // National ID / NIN — required for KYC later; basic shape check only here.
  nationalId: z.string().min(5).max(30),
});

/**
 * Step 2 — verify the code and create the account.
 * The auth email is synthetic (derived from the phone); any real email the
 * player supplied is kept as contact detail on their profile.
 */
export const verifyOtpAndRegister = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Enter a valid phone number");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: otp } = await supabaseAdmin
      .from("phone_otps")
      .select("*")
      .eq("phone", phone)
      .eq("purpose", "signup")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("Request a new verification code.");
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      throw new Error("That code has expired. Request a new one.");
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new Error("Too many attempts. Request a new code.");
    }
    if (otp.code !== data.code) {
      await supabaseAdmin
        .from("phone_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      throw new Error("Incorrect code. Please try again.");
    }

    // Burn the code before creating anything so it can never be replayed.
    await supabaseAdmin
      .from("phone_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    const authEmail = phoneToAuthEmail(phone);
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.password,
      // The number was just proven, and the synthetic address cannot receive mail.
      email_confirm: true,
      user_metadata: {
        phone,
        display_name: data.displayName,
        date_of_birth: data.dateOfBirth,
        contact_email: data.email ? data.email : null,
        national_id: data.nationalId,
        phone_verified: true,
      },
    });
    if (error) {
      if (/already/i.test(error.message)) {
        throw new Error("This phone number already has an account. Please sign in.");
      }
      throw new Error(error.message);
    }

    // The profile / wallet / role rows are created lazily on first authenticated
    // request by `getCurrentUserProfile`.
    return { phone, authEmail };
  });
