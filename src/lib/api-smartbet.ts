/**
 * api-smartbet.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete type-safe API client for SmartBet Online.
 * Implements endpoints from the official SmartBet Online API Routes guide.
 *
 * Uses:
 * - gamesBaseUrl: https://api-games.smbet.net
 * - backendUrl: https://online.smartbet.ug
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { API_CONFIG } from "./api-config";

export interface PrematchMatchOdd {
  BetCategory: string;
  BetOption: string;
  Line: number | null;
  Odd: number;
  BookMakerId: number;
  MatchOddId: number;
}

export interface PrematchGame {
  OriginalMatchId: number;
  MatchNo: number;
  HomeTeamName: string;
  AwayTeamName: string;
  League: string;
  Country?: string;
  Sport?: string;
  StartTime: string;
  MatchOdds: PrematchMatchOdd[];
}

export interface CountryWithLeagues {
  CountryId?: number;
  CountryName: string;
  CountryCode?: string;
  Leagues: Array<{
    LeagueId: number;
    LeagueName: string;
    SportName?: string;
  }>;
}

export interface SmartBetUser {
  AccountId?: string | number;
  UserId: string;
  Balance: number;
  PhoneNumber: string;
  UserName?: string;
  Email?: string;
  Roles?: string[];
}

export interface BetLegPayload {
  betCategory: string;
  betOption: string;
  bookMakerId: number;
  line: number | null;
  matchId: number;
  matchOddId: number;
  odd: number;
  IsLive: boolean;
}

export interface TicketPayload {
  betData: BetLegPayload[];
  totalBonus: number;
  totalOdds: number;
  totalStake: number;
  isLive: boolean;
}

export interface BookingResponse {
  bookingCode?: string;
  BookingCode?: string;
  code?: string;
  Code?: string;
  success?: boolean;
  message?: string;
}

export interface DepositRequestPayload {
  phoneNumber: string;
  amount: number;
  PromoCode?: string | null;
}

export interface DepositStatusResponse {
  code: string;
  status: "OTP" | "PENDING" | "UNKNOWN" | "SUCCESSFUL" | "FAILED" | "REJECTED" | string;
  amount: number;
  balance?: number;
  updateTime?: string;
}

export interface WithdrawRequestPayload {
  requestId: string;
  amount: number;
  altPhone?: string;
}

export interface WithdrawResponse {
  status: "OTP" | "PENDING" | "UNKNOWN" | "SUCCESSFUL" | "FAILED" | "REJECTED" | string;
  challengeId?: string;
  transactionId?: string;
  message?: string;
}

export interface OnlineSettings {
  MinStake: number;
  MaxStake: number;
  MaxPayOut: number;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Clean URL builder ensuring no accidental double `/api` or trailing slashes.
 */
function buildUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Resilient JSON fetch with timeout, credential cookies, and error decoding.
 */
async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = API_CONFIG.defaultTimeoutMs,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Public gamesBaseUrl returns Access-Control-Allow-Origin: * so browsers reject credentials: 'include'.
    // Use credentials: 'omit' for public games feed, and 'include' for authenticated backend/proxy routes.
    const isPublicGamesFeed = url.includes("api-games.smbet.net");
    const credentialsMode: RequestCredentials = isPublicGamesFeed ? "omit" : "include";

    const response = await fetch(url, {
      ...options,
      credentials: credentialsMode,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    clearTimeout(timer);

    if (response.status === 204) {
      return null as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      let errMsg = `Request failed (${response.status})`;
      if (typeof data === "string") {
        errMsg = data || errMsg;
      } else if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        errMsg = (obj["message"] || obj["error"] || obj["Message"] || errMsg) as string;
      }
      throw new ApiError(errMsg, response.status, data);
    }

    return data as T;
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`Request timeout after ${timeoutMs / 1000}s`);
    }
    throw new ApiError(error instanceof Error ? error.message : "Network error");
  }
}

export const smartBetApi = {
  // ── 1. Prematch Games & Odds ──────────────────────────────────────────────
  async getPrematchFeed(): Promise<PrematchGame[]> {
    return fetchJson<PrematchGame[]>(buildUrl(API_CONFIG.gamesBaseUrl, "/"));
  },

  async getCountriesWithLeagues(): Promise<CountryWithLeagues[]> {
    return fetchJson<CountryWithLeagues[]>(
      buildUrl(API_CONFIG.gamesBaseUrl, "/api/Matches/GetCountriesWithLeagues"),
    );
  },

  async getTopMatches(page = 1, pageSize = 20, includeOdds = true): Promise<PrematchGame[]> {
    const params = new URLSearchParams({
      page: String(page),
      pagesize: String(pageSize),
      includeOdds: String(includeOdds),
    });
    return fetchJson<PrematchGame[]>(
      buildUrl(API_CONFIG.gamesBaseUrl, `/api/Matches/GetTopMatches?${params.toString()}`),
    );
  },

  async getSetCount(): Promise<{ count?: number; SetCount?: number } | number> {
    return fetchJson(buildUrl(API_CONFIG.gamesBaseUrl, "/api/Matches/GetSetCount"));
  },

  // ── 2. Authentication ─────────────────────────────────────────────────────
  async login(username: string, password: string, rememberMe = true): Promise<SmartBetUser> {
    return fetchJson<SmartBetUser>(buildUrl(API_CONFIG.backendUrl, "/api/Account/Login"), {
      method: "POST",
      body: JSON.stringify({ username, password, rememberMe }),
    });
  },

  async logOff(): Promise<void> {
    await fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Account/LogOff"), {
      method: "POST",
    });
  },

  async checkLogin(strict401 = false): Promise<SmartBetUser | null> {
    try {
      const url = strict401
        ? buildUrl(API_CONFIG.backendUrl, "/api/Account/CheckLogin?strict401=true")
        : buildUrl(API_CONFIG.backendUrl, "/api/Account/CheckLogin");
      return await fetchJson<SmartBetUser>(url);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 204)) {
        return null;
      }
      throw err;
    }
  },

  // ── 3. Registration & Password ───────────────────────────────────────────
  async checkUsername(value: string): Promise<{ available: boolean }> {
    return fetchJson<{ available: boolean }>(
      buildUrl(
        API_CONFIG.backendUrl,
        `/api/Account/CheckUsername?value=${encodeURIComponent(value)}`,
      ),
    );
  },

  async checkPhone(value: string): Promise<{ available: boolean }> {
    return fetchJson<{ available: boolean }>(
      buildUrl(API_CONFIG.backendUrl, `/api/Account/CheckPhone?value=${encodeURIComponent(value)}`),
    );
  },

  async checkEmail(value: string): Promise<{ available: boolean }> {
    return fetchJson<{ available: boolean }>(
      buildUrl(API_CONFIG.backendUrl, `/api/Account/CheckEmail?value=${encodeURIComponent(value)}`),
    );
  },

  async checkUserExists(userName: string): Promise<boolean> {
    return fetchJson<boolean>(
      buildUrl(
        API_CONFIG.backendUrl,
        `/api/Online/UserExists?userName=${encodeURIComponent(userName)}`,
      ),
    );
  },

  async register(payload: {
    email: string;
    phoneNumber: string;
    userName: string;
    NIN: string;
    dob: string;
    FirstName: string;
    SurName: string;
    PromoCode?: string | null;
  }): Promise<{ success: boolean; message?: string; otpExpiry?: string }> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Account/Register"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getOtp(phoneNumber: string): Promise<boolean> {
    return fetchJson<boolean>(
      buildUrl(
        API_CONFIG.backendUrl,
        `/api/Account/GetOTP?phoneNumber=${encodeURIComponent(phoneNumber)}`,
      ),
    );
  },

  async validateOtp(
    phoneNumber: string,
    otpCode: string,
  ): Promise<{ valid: boolean; message?: string }> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Account/validate-otp"), {
      method: "POST",
      body: JSON.stringify({ phoneNumber, otpCode }),
    });
  },

  async verifyOtpAndSetPassword(payload: {
    phoneNumber: string;
    otpCode: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ success: boolean; message?: string }> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Account/VerifyOtpAndSetPassword"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async setNewPassword(payload: {
    NewPassword: string;
    ConfirmPassword: string;
    username: string;
    Code: string;
  }): Promise<{ success: boolean; message?: string }> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Account/SetNewPassWord"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── 4. Online Account & Balance ───────────────────────────────────────────
  async getUserInfo(): Promise<SmartBetUser> {
    return fetchJson<SmartBetUser>(buildUrl(API_CONFIG.backendUrl, "/api/Online/UserInfo"));
  },

  async getBonuses(): Promise<unknown> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Account/Bonuses"));
  },

  async getStatement(userId: string): Promise<unknown[]> {
    return fetchJson<unknown[]>(
      buildUrl(API_CONFIG.backendUrl, `/api/Statement/User?userid=${encodeURIComponent(userId)}`),
    );
  },

  // ── 5. Tickets & Bets ────────────────────────────────────────────────────
  async submitTicket(
    ticket: TicketPayload,
  ): Promise<{ receiptId?: string | number; success: boolean; message?: string }> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Ticket"), {
      method: "POST",
      body: JSON.stringify(ticket),
    });
  },

  async createBooking(ticket: TicketPayload): Promise<BookingResponse> {
    return fetchJson<BookingResponse>(buildUrl(API_CONFIG.backendUrl, "/api/Ticket/Booking"), {
      method: "POST",
      body: JSON.stringify(ticket),
    });
  },

  async getMyBets(): Promise<unknown[]> {
    return fetchJson<unknown[]>(buildUrl(API_CONFIG.backendUrl, "/api/Online/MyBets"));
  },

  async getOpenBetsCount(): Promise<{ count: number } | number> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Online/OpenBetsCount"));
  },

  async getReceiptById(receiptId: string | number): Promise<unknown> {
    return fetchJson(
      buildUrl(API_CONFIG.backendUrl, `/api/Receipt/GetById/${encodeURIComponent(receiptId)}`),
    );
  },

  async getTicketSelections(receiptId: string | number): Promise<unknown> {
    return fetchJson(
      buildUrl(API_CONFIG.backendUrl, `/api/Bet/Receipt/${encodeURIComponent(receiptId)}`),
    );
  },

  // ── 6. Deposits & Withdrawals ─────────────────────────────────────────────
  async requestMobileMoneyDeposit(
    amount: number,
    phoneNumber: string,
    promoCode?: string | null,
  ): Promise<{ code: string; status: string; message?: string }> {
    return fetchJson(
      buildUrl(API_CONFIG.backendUrl, "/api/Online/MobileMoneyDepositRequest"),
      {
        method: "POST",
        body: JSON.stringify({
          amount,
          phoneNumber,
          PromoCode: promoCode ?? null,
        }),
      },
      API_CONFIG.paymentTimeoutMs,
    );
  },

  async getDepositStatus(code: string): Promise<DepositStatusResponse> {
    return fetchJson<DepositStatusResponse>(
      buildUrl(API_CONFIG.backendUrl, `/api/Online/DepositStatus/${encodeURIComponent(code)}`),
    );
  },

  async redeemDeposit(code: string): Promise<{ balance: number; message?: string }> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Online/redeem"), {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  async requestWithdrawal(
    requestId: string,
    amount: number,
    altPhone?: string,
  ): Promise<WithdrawResponse> {
    return fetchJson<WithdrawResponse>(
      buildUrl(API_CONFIG.backendUrl, "/api/Online/WithdrawRequest"),
      {
        method: "POST",
        body: JSON.stringify({
          requestId,
          amount,
          altPhone: altPhone || undefined,
        }),
      },
      API_CONFIG.paymentTimeoutMs,
    );
  },

  async confirmWithdrawalAlt(
    challengeId: string,
    otpCode: string,
  ): Promise<{ status: string; message?: string }> {
    return fetchJson(
      buildUrl(API_CONFIG.backendUrl, "/api/Online/ConfirmWithdrawAlt"),
      {
        method: "POST",
        body: JSON.stringify({ challengeId, otpCode }),
      },
      API_CONFIG.paymentTimeoutMs,
    );
  },

  async withdrawAtBranch(amount: number): Promise<{ code: string; message?: string }> {
    return fetchJson(buildUrl(API_CONFIG.backendUrl, "/api/Online/WithdrawAtBranch"), {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  },

  // ── 7. Online Settings ────────────────────────────────────────────────────
  async getOnlineSettings(): Promise<OnlineSettings> {
    return fetchJson<OnlineSettings>(
      buildUrl(API_CONFIG.backendUrl, "/api/CompanySettings/OnlineSettings"),
    );
  },
};
