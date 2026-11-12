/**
 * src/lib/supabase-sportsbook.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase Data & Persistence Layer for SMARTBET:
 * - Authentication & User Profile Management (profiles, wallets)
 * - Booking Code Persistence & Retrieval (platform_config, audit_log, local cache)
 * - Bet Receipt & Ticket Persistence & Retrieval (transactions, audit_log)
 * - Wallet Transactions (deposits, stakes, payouts, withdrawals)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "@/integrations/supabase/client";
import type { PlacedBet, Selection } from "./betslip";

export type SupabaseUserProfile = {
  id: string;
  email?: string;
  displayName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  nin?: string | null;
  country: string;
  currency: string;
  kycStatus: string;
  accountStatus: string;
};

export type SavedBookingCode = {
  code: string;
  selections: Selection[];
  stake: number;
  totalOdds: number;
  createdAt: string;
  userId?: string | null;
};

export type SportsbookTransaction = {
  id: string;
  userId: string;
  walletId: string;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  currency: string;
  status: string;
  reference: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const STORAGE_KEY_BOOKINGS = "smartbet_saved_booking_codes";
const STORAGE_KEY_TICKETS = "smartbet_placed_bets";

// ─────────────────────────────────────────────────────────────────────────────
// 1. USER INFORMATION & PROFILE STORAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures user has a row in `profiles` and `wallets`.
 * Creates or updates profile information including phone, NIN, and DOB.
 */
export async function syncUserProfile(params: {
  userId: string;
  displayName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  nin?: string | null;
  email?: string;
}): Promise<SupabaseUserProfile> {
  const { userId, displayName, phone, dateOfBirth, nin, email } = params;

  try {
    // 1. Upsert profile in Supabase profiles table
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: displayName || email?.split("@")[0] || "Player",
          phone: phone || null,
          date_of_birth: dateOfBirth || null,
          country: "UG",
          currency: "UGX",
          kyc_status: nin ? "verified" : "pending",
          account_status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (profileError) {
      console.warn("[Supabase] Profile upsert warning:", profileError.message);
    }

    // 2. Ensure wallet row exists
    const { error: walletError } = await supabase.from("wallets").upsert(
      {
        user_id: userId,
        currency: "UGX",
        status: "active",
      },
      { onConflict: "user_id" },
    );

    if (walletError) {
      console.warn("[Supabase] Wallet upsert warning:", walletError.message);
    }

    // 3. Log audit event
    try {
      await supabase.from("audit_log").insert({
        actor_id: userId,
        action: "profile_synced",
        entity_type: "profile",
        entity_id: userId,
        metadata: {
          phone,
          ninMasked: nin ? `***${nin.slice(-4)}` : null,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch {
      // Non-fatal
    }

    const res: SupabaseUserProfile = {
      id: userId,
      email,
      displayName: profileData?.display_name || displayName || "Player",
      phone: profileData?.phone || phone || null,
      dateOfBirth: profileData?.date_of_birth || dateOfBirth || null,
      nin: nin || null,
      country: profileData?.country || "UG",
      currency: profileData?.currency || "UGX",
      kycStatus: profileData?.kyc_status || (nin ? "verified" : "pending"),
      accountStatus: profileData?.account_status || "active",
    };

    return res;
  } catch (err) {
    console.warn("[Supabase] syncUserProfile fallback:", err);
    return {
      id: userId,
      email,
      displayName: displayName || "Player",
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      nin: nin || null,
      country: "UG",
      currency: "UGX",
      kycStatus: nin ? "verified" : "pending",
      accountStatus: "active",
    };
  }
}

/**
 * Fetches user profile from Supabase by user ID.
 */
export async function fetchUserProfile(userId: string): Promise<SupabaseUserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      displayName: data.display_name,
      phone: data.phone,
      dateOfBirth: data.date_of_birth,
      country: data.country,
      currency: data.currency,
      kycStatus: data.kyc_status,
      accountStatus: data.account_status,
    };
  } catch (err) {
    console.warn("[Supabase] fetchUserProfile error:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BOOKING CODES (STORAGE & RETRIEVAL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves a booking code with selections and stake to Supabase (platform_config, audit_log, and local cache).
 */
export async function saveBookingCode(params: {
  code: string;
  selections: Selection[];
  stake: number;
  totalOdds: number;
  userId?: string | null;
}): Promise<SavedBookingCode> {
  const { code, selections, stake, totalOdds, userId } = params;
  const cleanCode = code.trim().toUpperCase();
  const createdAt = new Date().toISOString();

  const record: SavedBookingCode = {
    code: cleanCode,
    selections,
    stake,
    totalOdds: Number(totalOdds.toFixed(2)),
    createdAt,
    userId: userId || null,
  };

  // 1. Cache in browser localStorage for offline & immediate access
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKINGS);
    const map: Record<string, SavedBookingCode> = raw ? JSON.parse(raw) : {};
    map[cleanCode] = record;
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(map));
  } catch {
    // Storage quota or SSR
  }

  // 2. Store in Supabase platform_config table
  try {
    await supabase.from("platform_config").upsert(
      {
        key: `booking:${cleanCode}`,
        value: record as unknown as Record<string, unknown>,
        updated_at: createdAt,
      },
      { onConflict: "key" },
    );
  } catch (err) {
    console.warn("[Supabase] Booking save to platform_config warning:", err);
  }

  // 3. Store in Supabase audit_log table
  try {
    await supabase.from("audit_log").insert({
      actor_id: userId || null,
      action: "booking_code_created",
      entity_type: "booking_code",
      entity_id: cleanCode,
      metadata: {
        code: cleanCode,
        selectionsCount: selections.length,
        totalOdds: Number(totalOdds.toFixed(2)),
        stake,
        selections: selections.map((s) => ({
          id: s.id,
          matchId: s.matchId,
          match: s.match,
          market: s.market,
          pick: s.pick,
          odds: s.odds,
        })),
        createdAt,
      },
    });
  } catch (err) {
    console.warn("[Supabase] Booking save to audit_log warning:", err);
  }

  return record;
}

/**
 * Retrieves a booking code from Supabase (checking platform_config, audit_log, and local storage).
 */
export async function retrieveBookingCode(code: string): Promise<SavedBookingCode | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return null;

  // 1. Try Supabase platform_config table
  try {
    const { data, error } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", `booking:${cleanCode}`)
      .maybeSingle();

    if (!error && data?.value) {
      const val = data.value as unknown as SavedBookingCode;
      if (val && Array.isArray(val.selections) && val.selections.length > 0) {
        return val;
      }
    }
  } catch (err) {
    console.warn("[Supabase] Error querying platform_config for booking code:", err);
  }

  // 2. Try Supabase audit_log table
  try {
    const { data: auditData, error: auditError } = await supabase
      .from("audit_log")
      .select("metadata, created_at")
      .eq("entity_id", cleanCode)
      .eq("action", "booking_code_created")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!auditError && auditData?.metadata) {
      const meta = auditData.metadata as Record<string, unknown>;
      if (meta && Array.isArray(meta.selections) && meta.selections.length > 0) {
        return {
          code: cleanCode,
          selections: meta.selections as Selection[],
          stake: typeof meta.stake === "number" ? meta.stake : 2000,
          totalOdds: typeof meta.totalOdds === "number" ? meta.totalOdds : 1.0,
          createdAt: auditData.created_at,
          userId: (meta.userId as string) || null,
        };
      }
    }
  } catch (err) {
    console.warn("[Supabase] Error querying audit_log for booking code:", err);
  }

  // 3. Fallback to local storage cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKINGS);
    if (raw) {
      const map: Record<string, SavedBookingCode> = JSON.parse(raw);
      if (map[cleanCode]) {
        return map[cleanCode];
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BET RECEIPTS / TICKETS (STORAGE & RETRIEVAL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves a placed bet receipt into Supabase transactions, audit_log, and local cache.
 */
export async function saveBetTicket(ticket: PlacedBet, userId?: string | null): Promise<PlacedBet> {
  const currentUserId = userId || "guest_player";
  const createdAt = new Date().toISOString();

  // 1. Save to local storage for instant availability
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TICKETS);
    const existing: PlacedBet[] = raw ? JSON.parse(raw) : [];
    if (!existing.some((b) => b.id === ticket.id || b.code === ticket.code)) {
      localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify([ticket, ...existing]));
    }
  } catch {
    // Ignore storage errors
  }

  // 2. Query user wallet or fallback
  let walletId = crypto.randomUUID();
  try {
    if (userId) {
      const { data: w } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (w?.id) walletId = w.id;
    }
  } catch {
    // Fallback wallet ID
  }

  // 3. Store in Supabase transactions table
  try {
    const txRow = {
      id: crypto.randomUUID(),
      user_id: currentUserId,
      wallet_id: walletId,
      type: "stake",
      direction: "debit",
      amount: ticket.stake,
      currency: "UGX",
      status: ticket.status,
      reference: ticket.code,
      idempotency_key: `bet_placement:${ticket.id}:${Date.now()}`,
      metadata: {
        ticketId: ticket.id,
        code: ticket.code,
        placedAt: ticket.placedAt,
        totalOdds: ticket.totalOdds,
        potential: ticket.potential,
        selections: ticket.selections,
      } as unknown as Record<string, unknown>,
      created_at: createdAt,
    };

    await supabase.from("transactions").insert(txRow);
  } catch (err) {
    console.warn("[Supabase] Bet ticket save to transactions warning:", err);
  }

  // 4. Log to Supabase audit_log
  try {
    await supabase.from("audit_log").insert({
      actor_id: userId || null,
      action: "ticket_placed",
      entity_type: "ticket",
      entity_id: ticket.id,
      metadata: {
        code: ticket.code,
        stake: ticket.stake,
        totalOdds: ticket.totalOdds,
        potential: ticket.potential,
        selectionsCount: ticket.selections.length,
        placedAt: ticket.placedAt,
        selections: ticket.selections,
      },
    });
  } catch (err) {
    console.warn("[Supabase] Bet ticket save to audit_log warning:", err);
  }

  return ticket;
}

/**
 * Fetches all bet receipts for the user from Supabase transactions + audit_log,
 * merged with local storage.
 */
export async function fetchUserBetTickets(userId?: string | null): Promise<PlacedBet[]> {
  const result: PlacedBet[] = [];
  const seenIds = new Set<string>();

  // 1. Fetch from Supabase transactions table
  try {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("type", "stake")
      .order("created_at", { ascending: false })
      .limit(50);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: rows, error } = await query;

    if (!error && Array.isArray(rows)) {
      for (const row of rows) {
        const meta = (row.metadata || {}) as Record<string, unknown>;
        const ticketId = String(meta.ticketId || row.id);
        const code = String(meta.code || row.reference || `SB${ticketId.slice(0, 5)}`);

        if (!seenIds.has(ticketId) && !seenIds.has(code)) {
          seenIds.add(ticketId);
          seenIds.add(code);

          const selections = Array.isArray(meta.selections) ? (meta.selections as Selection[]) : [];
          result.push({
            id: ticketId,
            code,
            placedAt: String(meta.placedAt || new Date(row.created_at).toLocaleDateString()),
            stake: Number(row.amount || 1000),
            totalOdds: Number(meta.totalOdds || 2.0),
            potential: Number(meta.potential || (row.amount || 1000) * 2),
            status: (row.status === "won" ? "won" : row.status === "lost" ? "lost" : "open") as
              "open" | "won" | "lost",
            selections,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Supabase] Error loading bet receipts from transactions:", err);
  }

  // 2. Fetch from Supabase audit_log table (fallback/supplement)
  try {
    let query = supabase
      .from("audit_log")
      .select("*")
      .eq("action", "ticket_placed")
      .order("created_at", { ascending: false })
      .limit(30);

    if (userId) {
      query = query.eq("actor_id", userId);
    }

    const { data: auditRows, error: auditError } = await query;
    if (!auditError && Array.isArray(auditRows)) {
      for (const row of auditRows) {
        const meta = (row.metadata || {}) as Record<string, unknown>;
        const ticketId = String(row.entity_id || meta.code || `t-${row.id}`);
        const code = String(meta.code || `SB${ticketId.slice(0, 5)}`);

        if (!seenIds.has(ticketId) && !seenIds.has(code)) {
          seenIds.add(ticketId);
          seenIds.add(code);

          const selections = Array.isArray(meta.selections) ? (meta.selections as Selection[]) : [];
          result.push({
            id: ticketId,
            code,
            placedAt: String(meta.placedAt || new Date(row.created_at).toLocaleDateString()),
            stake: Number(meta.stake || 1000),
            totalOdds: Number(meta.totalOdds || 2.0),
            potential: Number(meta.potential || 2000),
            status: "open",
            selections,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Supabase] Error loading bet receipts from audit_log:", err);
  }

  // 3. Merge with local storage tickets
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TICKETS);
    if (raw) {
      const localTickets: PlacedBet[] = JSON.parse(raw);
      if (Array.isArray(localTickets)) {
        for (const t of localTickets) {
          if (!seenIds.has(t.id) && !seenIds.has(t.code)) {
            seenIds.add(t.id);
            seenIds.add(t.code);
            result.push(t);
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TRANSACTIONS (DEPOSITS, WITHDRAWALS, STAKES, PAYOUTS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records a wallet financial transaction in Supabase `transactions`.
 */
export async function recordWalletTransaction(params: {
  userId: string;
  type: "deposit" | "withdrawal" | "stake" | "payout" | "internal_deposit" | "internal_withdrawal";
  amount: number;
  direction: "credit" | "debit";
  reference?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<SportsbookTransaction> {
  const { userId, type, amount, direction, reference, metadata } = params;
  const createdAt = new Date().toISOString();

  let walletId = crypto.randomUUID();
  try {
    const { data: w } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (w?.id) walletId = w.id;
  } catch {
    // Fallback
  }

  const txId = crypto.randomUUID();
  const txRecord: SportsbookTransaction = {
    id: txId,
    userId,
    walletId,
    type,
    direction,
    amount,
    currency: "UGX",
    status: "completed",
    reference: reference || null,
    metadata: metadata || {},
    createdAt,
  };

  try {
    await supabase.from("transactions").insert({
      id: txId,
      user_id: userId,
      wallet_id: walletId,
      type,
      direction,
      amount,
      currency: "UGX",
      status: "completed",
      reference: reference || null,
      idempotency_key: `tx:${type}:${userId}:${Date.now()}`,
      metadata: (metadata || {}) as unknown as Record<string, unknown>,
      created_at: createdAt,
    });
  } catch (err) {
    console.warn("[Supabase] recordWalletTransaction warning:", err);
  }

  return txRecord;
}

/**
 * Updates an existing transaction status in Supabase by its reference code
 */
export async function updateTransactionStatus(
  reference: string,
  status: "pending" | "completed" | "failed" | "rejected",
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase
      .from("transactions")
      .update({
        status,
        ...(metadata ? { metadata } : {}),
      })
      .eq("reference", reference);
  } catch (err) {
    console.warn("[Supabase] updateTransactionStatus notice:", err);
  }
}
