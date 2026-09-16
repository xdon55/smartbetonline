/**
 * auth/auth.functions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server functions for account/session management.
 *
 * INTEGRATION NOTES:
 * - Auth providers (email, phone, Google, Apple) are handled by Lovable Cloud
 *   Auth. These functions only deal with the post-auth application state:
 *   profile, wallet, default role, and platform configuration.
 * - `getCurrentUserProfile` lazily creates the `profiles`, `wallets`, and default
 *   `user_roles` rows the first time a signed-in user is seen, so every
 *   authenticated route can assume they exist.
 * - Privileged writes (audit_log, user_roles) use the server-only admin client
 *   loaded inside the handler so the service role key never reaches the browser.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable(),
  phone: z.string().nullable(),
  country: z.string(),
  currency: z.string(),
  date_of_birth: z.string().nullable(),
  kyc_status: z.string(),
  account_status: z.string(),
});

export type UserProfile = z.infer<typeof profileSchema>;

/**
 * Ensure the signed-in user has a profile, wallet, and default player role, then
 * return the profile. Called lazily from authenticated components so we never
 * rely on a trigger on the auth schema.
 */
export const getCurrentUserProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Try to read the existing profile first.
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      // Ensure a wallet exists even if the profile was created earlier.
      await supabase
        .from("wallets")
        .upsert({ user_id: userId, currency: "UGX" }, { onConflict: "user_id" });
      return profileSchema.parse(existing);
    }

    // Privileged inserts need the server-only admin client. We load it dynamically
    // because this module is reachable from the client bundle.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Copy registration metadata saved by the auth page into the profile.
    const {
      data: { user },
    } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;

    const displayName =
      typeof meta.display_name === "string" ? meta.display_name : null;
    const phone = typeof meta.phone === "string" ? meta.phone : null;
    const dateOfBirth =
      typeof meta.date_of_birth === "string" ? meta.date_of_birth : null;

    // Create profile and wallet in one go.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        display_name: displayName,
        phone,
        date_of_birth: dateOfBirth,
      })
      .select("*")
      .single();
    if (profileError) throw new Error(profileError.message);

    const { error: walletError } = await supabaseAdmin
      .from("wallets")
      .upsert({ user_id: userId, currency: "UGX" }, { onConflict: "user_id" });
    if (walletError) throw new Error(walletError.message);

    // Default every new account to the `player` role.
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "player",
    });
    if (roleError && roleError.code !== "23505") {
      // 23505 = unique violation (role already exists). Anything else is fatal.
      throw new Error(roleError.message);
    }

    // Audit trail: account opened.
    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      action: "account_opened",
      entity_type: "profile",
      entity_id: userId,
    });

    return profileSchema.parse(profile);
  });
