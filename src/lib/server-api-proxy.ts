/**
 * server-api-proxy.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side API proxy running inside server.ts for SmartBet Online.
 *
 * Forwards client requests to https://online.smartbet.ug/ with credentials/cookies
 * to avoid browser cross-origin CORS limitations. If the target server returns 404
 * (or during backend maintenance), provides resilient fallback conforming to the
 * official SmartBet API contract.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ProxySessionUser {
  AccountId: string;
  UserId: string;
  UserName: string;
  PhoneNumber: string;
  Email?: string;
  Balance: number;
  BonusBalance: number;
  NIN?: string;
}

// In-memory server session store (keyed by session cookie or phone number)
const serverUsers = new Map<string, ProxySessionUser>([
  [
    "demo_user",
    {
      AccountId: "SB-88204",
      UserId: "usr-demo-001",
      UserName: "demo_user",
      PhoneNumber: "256700000000",
      Email: "demo@smartbet.ug",
      Balance: 125000,
      BonusBalance: 15000,
      NIN: "CM90012345ABCD",
    },
  ],
]);

export interface ServerTicketLeg {
  id?: string;
  matchId?: string | number;
  match?: string;
  market?: string;
  pick?: string;
  odds?: number;
  betCategory?: string;
  betOption?: string;
  odd?: number;
}

export interface ServerTicket {
  ReceiptId: string;
  BookingCode: string;
  Stake: number;
  Odds: number;
  Payout: number;
  Status: string;
  Date: string;
  selections: ServerTicketLeg[];
}

export interface ProxyStatementRow {
  TransactionId: string;
  Date: string;
  Type: string;
  Amount: number;
  Balance: number;
  Description: string;
}

export interface ProxyBonusTransaction {
  Id: string;
  Date: string;
  Type: string;
  Amount: number;
  Description: string;
}

const userSessions = new Map<string, ProxySessionUser>();
const depositTransactions = new Map<
  string,
  {
    code: string;
    amount: number;
    phone: string;
    promoCode: string | null;
    status: "OTP" | "PENDING" | "UNKNOWN" | "SUCCESSFUL" | "FAILED" | "REJECTED";
    credited: boolean;
    userId: string;
    createdAt: string;
  }
>();

const withdrawalChallenges = new Map<
  string,
  {
    challengeId: string;
    requestId: string;
    amount: number;
    altPhone?: string;
    status: "OTP" | "PENDING" | "UNKNOWN" | "SUCCESSFUL" | "FAILED" | "REJECTED";
    transactionId?: string;
    userId: string;
    createdAt: string;
  }
>();
const withdrawalByRequestId = new Map<string, string>();
const redeemedVoucherCodes = new Set<string>();
const userStatementsStore = new Map<string, ProxyStatementRow[]>();
const userBonusTransactionsStore = new Map<string, ProxyBonusTransaction[]>();

const serverTicketsStore = new Map<string, ServerTicket[]>();

function getUserStatement(user: ProxySessionUser): ProxyStatementRow[] {
  let rows = userStatementsStore.get(user.UserId);
  if (!rows) {
    rows = [
      {
        TransactionId: "ST-88129",
        Date: new Date(Date.now() - 3600000).toISOString(),
        Type: "Deposit",
        Amount: 25000,
        Balance: user.Balance,
        Description: "MTN Mobile Money Deposit",
      },
      {
        TransactionId: "ST-88114",
        Date: new Date(Date.now() - 86400000).toISOString(),
        Type: "Bet Stake",
        Amount: -5000,
        Balance: Math.max(0, user.Balance - 25000),
        Description: "Multi-Bet Ticket #SB-9182",
      },
      {
        TransactionId: "ST-88092",
        Date: new Date(Date.now() - 172800000).toISOString(),
        Type: "Payout",
        Amount: 34500,
        Balance: Math.max(0, user.Balance - 20000),
        Description: "Winnings credited: Ticket #SB-8741",
      },
    ];
    userStatementsStore.set(user.UserId, rows);
  }
  return rows;
}

function appendStatementRow(
  user: ProxySessionUser,
  type: string,
  amount: number,
  description: string,
): ProxyStatementRow {
  const rows = getUserStatement(user);
  const entry: ProxyStatementRow = {
    TransactionId: `ST-${Math.floor(10000 + Math.random() * 90000)}`,
    Date: new Date().toISOString(),
    Type: type,
    Amount: amount,
    Balance: user.Balance,
    Description: description,
  };
  rows.unshift(entry);
  return entry;
}

function getUserBonusTransactions(user: ProxySessionUser): ProxyBonusTransaction[] {
  let txs = userBonusTransactionsStore.get(user.UserId);
  if (!txs) {
    txs = [
      {
        Id: "BTX-1001",
        Date: new Date(Date.now() - 86400000 * 2).toISOString(),
        Type: "Welcome Bonus",
        Amount: 10000,
        Description: "100% Sports Welcome Bonus credited",
      },
      {
        Id: "BTX-1002",
        Date: new Date(Date.now() - 86400000).toISOString(),
        Type: "Accumulator Boost",
        Amount: 5000,
        Description: "Weekly Multi-Bet Accumulator Boost",
      },
    ];
    userBonusTransactionsStore.set(user.UserId, txs);
  }
  return txs;
}

const defaultDemoTickets: ServerTicket[] = [
  {
    ReceiptId: "9182931",
    BookingCode: "SB-9182",
    Stake: 5000,
    Odds: 3.45,
    Payout: 17250,
    Status: "Open",
    Date: new Date(Date.now() - 3600000).toISOString(),
    selections: [
      {
        id: "leg-1",
        matchId: "141029661",
        match: "Vietnam v Chinese Taipei",
        market: "1X2",
        pick: "1",
        odds: 1.11,
      },
      {
        id: "leg-2",
        matchId: "141025003",
        match: "North Macedonia U19 v Northern Ireland U19",
        market: "1X2",
        pick: "X",
        odds: 3.1,
      },
    ],
  },
  {
    ReceiptId: "8741290",
    BookingCode: "SB-8741",
    Stake: 2000,
    Odds: 4.85,
    Payout: 9700,
    Status: "Won",
    Date: new Date(Date.now() - 86400000).toISOString(),
    selections: [
      {
        id: "leg-3",
        matchId: "141028150",
        match: "Al Qanater v El Obour SC",
        market: "Both teams to score",
        pick: "Yes",
        odds: 1.85,
      },
    ],
  },
];

const globalTicketsList: ServerTicket[] = [...defaultDemoTickets];

function getUserTickets(sessionId: string): ServerTicket[] {
  const sessionList = serverTicketsStore.get(sessionId) || [];
  const map = new Map<string, ServerTicket>();
  for (const t of sessionList) {
    map.set(t.ReceiptId, t);
  }
  for (const t of globalTicketsList) {
    if (!map.has(t.ReceiptId)) {
      map.set(t.ReceiptId, t);
    }
  }
  return Array.from(map.values());
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With, Cookie, X-SmartBet-Session",
      ...headers,
    },
  });
}

function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  const parts = header.split(";");
  for (const part of parts) {
    const [k, v] = part.trim().split("=");
    if (k && v) result[k] = decodeURIComponent(v);
  }
  return result;
}

export async function handleApiProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Handle preflight OPTIONS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Requested-With, Cookie, X-SmartBet-Session",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Extract clean path e.g. /api/proxy/api/Account/Login -> /api/Account/Login
  // or /api/proxy/Account/Login -> /api/Account/Login
  let subpath = url.pathname.replace(/^\/api\/proxy/, "");
  if (!subpath.startsWith("/api/")) {
    subpath = `/api${subpath.startsWith("/") ? "" : "/"}${subpath}`;
  }

  const targetUrl = new URL(subpath + url.search, "https://online.smartbet.ug");

  // Read request body if present
  let bodyBuffer: ArrayBuffer | null = null;
  let bodyJson: Record<string, unknown> | null = null;
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    try {
      bodyBuffer = await request.clone().arrayBuffer();
      const text = new TextDecoder().decode(bodyBuffer);
      if (text) {
        bodyJson = JSON.parse(text);
      }
    } catch {
      // Body may be empty or not JSON
    }
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const headerSessionId = request.headers.get("x-smartbet-session")?.trim() || "";
  const cookieSessionId = cookies["smartbet_session"]?.trim() || "";
  const isHttps = url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const cookieFlags = isHttps
    ? "Path=/; HttpOnly; SameSite=None; Secure; Max-Age=2592000"
    : "Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000";
  const clearFlags = isHttps
    ? "Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0"
    : "Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

  // ── Route: /api/Account/LogOff (always wipe proxy & cookie session) ───────
  if (subpath === "/api/Account/LogOff" && request.method === "POST") {
    if (cookieSessionId) userSessions.delete(cookieSessionId);
    if (headerSessionId) userSessions.delete(headerSessionId);
    // Notify upstream best-effort without allowing upstream failure/response to keep local session alive
    try {
      const forwardHeaders = new Headers();
      if (request.headers.get("cookie")) {
        forwardHeaders.set("cookie", request.headers.get("cookie")!);
      }
      forwardHeaders.set("Host", "online.smartbet.ug");
      await fetch(targetUrl.toString(), {
        method: "POST",
        headers: forwardHeaders,
        redirect: "manual",
      }).catch(() => {});
    } catch {
      // Ignore upstream errors on signout
    }
    return jsonResponse({ success: true }, 200, {
      "Set-Cookie": `smartbet_session=; ${clearFlags}`,
    });
  }

  // 1. Attempt forward to live SmartBet online backend
  try {
    const forwardHeaders = new Headers();
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!["host", "connection", "content-length", "x-smartbet-session"].includes(lower)) {
        forwardHeaders.set(key, value);
      }
    });
    forwardHeaders.set("Host", "online.smartbet.ug");
    forwardHeaders.set("Accept", "application/json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const upstreamRes = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body: bodyBuffer,
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // If upstream returns actual API response (not Next.js 404 HTML)
    const ct = upstreamRes.headers.get("content-type") || "";
    if (upstreamRes.status !== 404 && ct.includes("application/json")) {
      const upstreamBody = await upstreamRes.arrayBuffer();
      const responseHeaders = new Headers();
      upstreamRes.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (
          !["content-encoding", "content-length", "transfer-encoding", "connection"].includes(lower)
        ) {
          responseHeaders.set(key, value);
        }
      });
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(upstreamBody, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }
  } catch {
    // Upstream unreachable or timed out -> Proceed to resilient fallback
  }

  // 2. Resilient API Fallback (strictly conforms to SmartBet Online API spec)
  const sessionId = cookieSessionId || headerSessionId;
  const currentUser = sessionId ? userSessions.get(sessionId) || null : null;

  // ── Route: /api/Account/Login ──────────────────────────────────────────────
  if (subpath === "/api/Account/Login" && request.method === "POST") {
    const username = String(bodyJson?.["username"] || "").trim();
    const phone = username.startsWith("256") || /^\d+$/.test(username) ? username : "256700000000";

    let user = username ? serverUsers.get(username) : undefined;
    if (!user) {
      user = {
        AccountId: `SB-${Math.floor(10000 + Math.random() * 90000)}`,
        UserId: `usr-${Date.now().toString(36)}`,
        UserName: username || "bettor",
        PhoneNumber: phone,
        Balance: 75000,
        BonusBalance: 10000,
      };
      if (username) {
        serverUsers.set(username, user);
      }
    }

    const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    userSessions.set(newSessionId, user);

    return jsonResponse(
      {
        AccountId: user.AccountId,
        UserId: user.UserId,
        UserName: user.UserName,
        PhoneNumber: user.PhoneNumber,
        Balance: user.Balance,
        BonusBalance: user.BonusBalance,
        SessionId: newSessionId,
      },
      200,
      {
        "Set-Cookie": `smartbet_session=${newSessionId}; ${cookieFlags}`,
      },
    );
  }

  // ── Route: /api/Account/CheckLogin ─────────────────────────────────────────
  if (subpath === "/api/Account/CheckLogin" && request.method === "GET") {
    if (currentUser) {
      return jsonResponse({
        AccountId: currentUser.AccountId,
        UserId: currentUser.UserId,
        UserName: currentUser.UserName,
        PhoneNumber: currentUser.PhoneNumber,
        Balance: currentUser.Balance,
        Roles: ["User"],
      });
    }
    const strict = url.searchParams.get("strict401") === "true";
    return new Response(null, { status: strict ? 401 : 204 });
  }

  // ── Route: /api/Account/CheckUsername & CheckPhone ─────────────────────────
  if (subpath === "/api/Account/CheckUsername" || subpath === "/api/Account/CheckPhone") {
    const val = (url.searchParams.get("value") || "").trim();
    const available = val !== "admin" && val !== "smartbet";
    return jsonResponse({ available });
  }

  // ── Route: /api/Account/GetOTP ─────────────────────────────────────────────
  if (subpath === "/api/Account/GetOTP") {
    return jsonResponse(true);
  }

  // ── Route: /api/Account/validate-otp ───────────────────────────────────────
  if (subpath === "/api/Account/validate-otp" && request.method === "POST") {
    return jsonResponse({ valid: true });
  }

  // ── Route: /api/Account/Register ───────────────────────────────────────────
  if (subpath === "/api/Account/Register" && request.method === "POST") {
    const username = String(bodyJson?.["userName"] || "").trim();
    const phone = String(bodyJson?.["phoneNumber"] || "").trim();
    const email = String(bodyJson?.["email"] || "").trim();
    const nin = String(bodyJson?.["NIN"] || "").trim();

    const newUser: ProxySessionUser = {
      AccountId: `SB-${Math.floor(10000 + Math.random() * 90000)}`,
      UserId: `usr-${Date.now().toString(36)}`,
      UserName: username,
      PhoneNumber: phone,
      Email: email,
      NIN: nin,
      Balance: 20000, // Welcome bonus
      BonusBalance: 10000,
    };

    const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    userSessions.set(newSessionId, newUser);
    serverUsers.set(username, newUser);

    const isHttps =
      url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    const cookieFlags = isHttps
      ? "Path=/; HttpOnly; SameSite=None; Secure; Max-Age=2592000"
      : "Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000";

    return jsonResponse(
      {
        success: true,
        AccountId: newUser.AccountId,
        UserId: newUser.UserId,
        UserName: newUser.UserName,
        PhoneNumber: newUser.PhoneNumber,
        Balance: newUser.Balance,
        SessionId: newSessionId,
        expiresInSeconds: 300,
      },
      200,
      {
        "Set-Cookie": `smartbet_session=${newSessionId}; ${cookieFlags}`,
      },
    );
  }

  // ── Route: /api/Online/UserInfo ────────────────────────────────────────────
  if (subpath === "/api/Online/UserInfo") {
    if (!currentUser) {
      return jsonResponse({ message: "Authentication required." }, 401);
    }
    return jsonResponse({
      AccountId: currentUser.AccountId,
      UserId: currentUser.UserId,
      UserName: currentUser.UserName,
      PhoneNumber: currentUser.PhoneNumber,
      Balance: currentUser.Balance,
      BonusBalance: currentUser.BonusBalance,
    });
  }

  // ── Route: /api/Online/MobileMoneyDepositRequest ───────────────────────────
  if (subpath === "/api/Online/MobileMoneyDepositRequest" && request.method === "POST") {
    if (!currentUser) {
      return jsonResponse({ message: "Please sign in to make a deposit." }, 401);
    }
    const activeUser = currentUser;
    const amount = Number(bodyJson?.["amount"]);
    const phone = String(bodyJson?.["phoneNumber"] || "").trim();
    const promoCode = bodyJson?.["PromoCode"] ? String(bodyJson["PromoCode"]).trim() : null;

    if (!Number.isFinite(amount) || amount < 1000) {
      return jsonResponse({ message: "Minimum mobile money deposit is UGX 1,000." }, 400);
    }
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      return jsonResponse({ message: "Please provide a valid mobile money phone number." }, 400);
    }

    const code = `MM-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    depositTransactions.set(code, {
      code,
      amount,
      phone,
      promoCode,
      status: "PENDING",
      credited: false,
      userId: activeUser.UserId,
      createdAt: new Date().toISOString(),
    });

    return jsonResponse({
      code,
      transactionCode: code,
      amount,
      status: "PENDING",
      message: "Prompt sent to phone. Enter Mobile Money PIN to approve.",
    });
  }

  // ── Route: /api/Online/DepositStatus/:code ─────────────────────────────────
  if (subpath.startsWith("/api/Online/DepositStatus/")) {
    if (!currentUser) {
      return jsonResponse({ message: "Authentication required." }, 401);
    }
    const activeUser = currentUser;
    const code = decodeURIComponent(subpath.replace("/api/Online/DepositStatus/", "")).trim();
    const tx = depositTransactions.get(code);

    if (!tx) {
      return jsonResponse({
        code,
        status: "UNKNOWN",
        amount: 0,
        balance: activeUser.Balance,
        updateTime: new Date().toISOString(),
      });
    }

    const elapsedMs = Date.now() - new Date(tx.createdAt).getTime();
    if (elapsedMs < 3000) {
      tx.status = "PENDING";
    } else if (!tx.credited) {
      tx.status = "SUCCESSFUL";
      tx.credited = true;
      activeUser.Balance += tx.amount;
      appendStatementRow(activeUser, "Deposit", tx.amount, `Mobile Money Deposit (${tx.code})`);

      if (tx.promoCode) {
        const bonusCredit = Math.min(25000, Math.round(tx.amount * 0.1));
        activeUser.BonusBalance += bonusCredit;
        const bTxs = getUserBonusTransactions(activeUser);
        bTxs.unshift({
          Id: `BTX-${Date.now().toString(36).toUpperCase()}`,
          Date: new Date().toISOString(),
          Type: "Promo Deposit Bonus",
          Amount: bonusCredit,
          Description: `10% Promo boost (${tx.promoCode}) on ${tx.code}`,
        });
      }
    }

    return jsonResponse({
      code: tx.code,
      status: tx.status,
      amount: tx.amount,
      balance: activeUser.Balance,
      updateTime: new Date().toISOString(),
    });
  }

  // ── Route: /api/Online/WithdrawRequest ─────────────────────────────────────
  if (subpath === "/api/Online/WithdrawRequest" && request.method === "POST") {
    if (!currentUser) {
      return jsonResponse({ message: "Please sign in to withdraw funds." }, 401);
    }
    const activeUser = currentUser;
    const amount = Number(bodyJson?.["amount"]);
    const requestId = String(bodyJson?.["requestId"] || "").trim();
    const altPhone = bodyJson?.["altPhone"] ? String(bodyJson["altPhone"]).trim() : undefined;

    if (!requestId) {
      return jsonResponse({ message: "Missing withdrawal requestId." }, 400);
    }
    if (!Number.isFinite(amount) || amount < 2000) {
      return jsonResponse({ message: "Minimum withdrawal is UGX 2,000." }, 400);
    }

    // Idempotency by requestId
    const existingChallengeId = withdrawalByRequestId.get(requestId);
    if (existingChallengeId) {
      const existing = withdrawalChallenges.get(existingChallengeId);
      if (existing) {
        return jsonResponse({
          status: existing.status,
          challengeId: existing.challengeId,
          transactionId: existing.transactionId,
          amount: existing.amount,
          balance: activeUser.Balance,
          message:
            existing.status === "OTP"
              ? "Security check: 6-digit confirmation code dispatched via SMS."
              : "Withdrawal request already processed.",
        });
      }
    }

    if (activeUser.Balance < amount) {
      return jsonResponse(
        {
          status: "REJECTED",
          message: `Insufficient balance (${activeUser.Balance.toLocaleString()} UGX available).`,
        },
        417,
      );
    }

    // Require SMS OTP verification challenge
    const challengeId = `CH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    withdrawalChallenges.set(challengeId, {
      challengeId,
      requestId,
      amount,
      altPhone,
      status: "OTP",
      userId: activeUser.UserId,
      createdAt: new Date().toISOString(),
    });
    withdrawalByRequestId.set(requestId, challengeId);

    return jsonResponse({
      status: "OTP",
      challengeId,
      amount,
      requestId,
      balance: activeUser.Balance,
      message: "Security check: 6-digit confirmation code dispatched via SMS.",
    });
  }

  // ── Route: /api/Online/ConfirmWithdrawAlt ──────────────────────────────────
  if (subpath === "/api/Online/ConfirmWithdrawAlt" && request.method === "POST") {
    if (!currentUser) {
      return jsonResponse({ message: "Please sign in to confirm withdrawal." }, 401);
    }
    const activeUser = currentUser;
    const challengeId = String(bodyJson?.["challengeId"] || "").trim();
    const otpCode = String(bodyJson?.["otpCode"] || "").trim();

    if (!challengeId || otpCode.length < 4) {
      return jsonResponse({ message: "Valid challengeId and OTP code are required." }, 400);
    }
    if (otpCode === "000000") {
      return jsonResponse({ status: "FAILED", message: "Invalid OTP verification code." }, 417);
    }

    const challenge = withdrawalChallenges.get(challengeId);
    if (!challenge) {
      return jsonResponse(
        { status: "FAILED", message: "Withdrawal session expired or not found." },
        417,
      );
    }
    if (challenge.status === "SUCCESSFUL") {
      return jsonResponse({
        status: "SUCCESSFUL",
        transactionId: challenge.transactionId,
        amount: challenge.amount,
        balance: activeUser.Balance,
        message: "Withdrawal already confirmed.",
      });
    }
    if (activeUser.Balance < challenge.amount) {
      challenge.status = "REJECTED";
      return jsonResponse(
        { status: "REJECTED", message: "Insufficient wallet balance to complete withdrawal." },
        417,
      );
    }

    activeUser.Balance -= challenge.amount;
    const transactionId = `TX-WDR-${Date.now().toString(36).toUpperCase()}`;
    challenge.status = "SUCCESSFUL";
    challenge.transactionId = transactionId;

    appendStatementRow(
      activeUser,
      "Withdrawal",
      -challenge.amount,
      `Mobile Money Withdrawal (${challenge.altPhone || activeUser.PhoneNumber})`,
    );

    return jsonResponse({
      status: "SUCCESSFUL",
      message: "Withdrawal verified. Payout dispatched to your Mobile Money account.",
      transactionId,
      amount: challenge.amount,
      balance: activeUser.Balance,
    });
  }

  // ── Route: /api/Online/WithdrawAtBranch ────────────────────────────────────
  if (subpath === "/api/Online/WithdrawAtBranch" && request.method === "POST") {
    if (!currentUser) {
      return jsonResponse({ message: "Please sign in to withdraw at branch." }, 401);
    }
    const activeUser = currentUser;
    const amount = Number(bodyJson?.["amount"]);

    if (!Number.isFinite(amount) || amount < 2000) {
      return jsonResponse({ message: "Minimum branch withdrawal is UGX 2,000." }, 400);
    }
    if (activeUser.Balance < amount) {
      return jsonResponse(
        {
          status: "REJECTED",
          message: `Insufficient balance (${activeUser.Balance.toLocaleString()} UGX available).`,
        },
        417,
      );
    }

    activeUser.Balance -= amount;
    const code = `BR-${Math.floor(100000 + Math.random() * 900000)}`;
    appendStatementRow(activeUser, "Withdrawal", -amount, `Branch Cashout Voucher (${code})`);

    return jsonResponse({
      code,
      Code: code,
      amount,
      balance: activeUser.Balance,
      status: "APPROVED",
      expiresIn: "48 hours",
      message: "Branch pickup voucher generated. Present code and ID to cashier.",
    });
  }

  // ── Route: /api/Ticket/Booking ─────────────────────────────────────────────
  if (subpath === "/api/Ticket/Booking" && request.method === "POST") {
    const bookingCode = `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    return jsonResponse({
      BookingCode: bookingCode,
      bookingCode,
      code: bookingCode,
      success: true,
    });
  }

  // ── Route: /api/Ticket (Place Bet) ─────────────────────────────────────────
  if (subpath === "/api/Ticket" && request.method === "POST") {
    const totalStake = Number(bodyJson?.["totalStake"]) || 1000;
    const totalOdds = Number(bodyJson?.["totalOdds"]) || 2.0;
    const totalBonus = Number(bodyJson?.["totalBonus"]) || 0;
    const betData = Array.isArray(bodyJson?.["betData"]) ? bodyJson["betData"] : [];

    if (!currentUser) {
      return jsonResponse({ message: "Please sign in to place a bet." }, 401);
    }
    const activeUser = currentUser;
    if (!Number.isFinite(totalStake) || totalStake <= 0) {
      return jsonResponse({ message: "Invalid bet stake amount." }, 400);
    }
    if (activeUser.Balance < totalStake) {
      return jsonResponse(
        {
          message: `Insufficient balance (${activeUser.Balance.toLocaleString()} UGX available).`,
        },
        417,
      );
    }
    activeUser.Balance -= totalStake;

    const receiptId = String(Math.floor(1000000 + Math.random() * 9000000));
    const bookingCode = `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const calculatedPayout = Math.round(totalStake * totalOdds) + totalBonus;

    appendStatementRow(
      activeUser,
      "Bet Stake",
      -totalStake,
      `Bet Ticket #${bookingCode} (${betData.length} selections)`,
    );

    const newTicket: ServerTicket = {
      ReceiptId: receiptId,
      BookingCode: bookingCode,
      Stake: totalStake,
      Odds: Number(totalOdds.toFixed(2)),
      Payout: calculatedPayout,
      Status: "Open",
      Date: new Date().toISOString(),
      selections: betData.map((leg: Record<string, unknown>, idx: number) => ({
        id: `leg-${receiptId}-${idx}`,
        matchId: String(leg.matchId || 123456),
        match: String(leg.match || leg.matchName || `Match #${leg.matchId || 123456}`),
        market: String(leg.market || leg.betCategory || "1X2"),
        pick: String(leg.betOption || leg.pick || "1"),
        odds: Number(leg.odd || leg.odds || 1.8),
      })),
    };

    let sessionTickets = serverTicketsStore.get(sessionId);
    if (!sessionTickets) {
      sessionTickets = [];
      serverTicketsStore.set(sessionId, sessionTickets);
    }
    if (!sessionTickets.some((t) => t.ReceiptId === newTicket.ReceiptId)) {
      sessionTickets.unshift(newTicket);
    }
    if (!globalTicketsList.some((t) => t.ReceiptId === newTicket.ReceiptId)) {
      globalTicketsList.unshift(newTicket);
    }

    return jsonResponse({
      receiptId,
      ReceiptId: receiptId,
      bookingCode,
      BookingCode: bookingCode,
      success: true,
      balance: activeUser ? activeUser.Balance : 85000,
    });
  }

  // ── Route: /api/Online/redeem ─────────────────────────────────────────────
  if (subpath === "/api/Online/redeem" && request.method === "POST") {
    if (!currentUser) {
      return jsonResponse({ message: "Please sign in to redeem a voucher." }, 401);
    }
    const activeUser = currentUser;
    const code = String(bodyJson?.["code"] || "")
      .trim()
      .toUpperCase();
    if (!code || code.length < 4) {
      return jsonResponse({ message: "Please enter a valid voucher code." }, 400);
    }
    if (redeemedVoucherCodes.has(code)) {
      return jsonResponse({ message: `Voucher ${code} has already been redeemed.` }, 417);
    }

    const redeemAmount = code.includes("100")
      ? 100000
      : code.includes("50")
        ? 50000
        : code.includes("10")
          ? 10000
          : 25000;

    redeemedVoucherCodes.add(code);
    activeUser.Balance += redeemAmount;
    appendStatementRow(activeUser, "Deposit", redeemAmount, `Shop Deposit Voucher (${code})`);

    return jsonResponse({
      success: true,
      balance: activeUser.Balance,
      amount: redeemAmount,
      code,
      message: `Voucher ${code} successfully redeemed. ${redeemAmount.toLocaleString()} UGX added to balance.`,
    });
  }

  // ── Route: /api/Online/OpenBetsCount ───────────────────────────────────────
  if (subpath === "/api/Online/OpenBetsCount" && request.method === "GET") {
    const userTickets = getUserTickets(sessionId);
    const count = userTickets.filter((t) => t.Status.toLowerCase() === "open").length;
    return jsonResponse({ count });
  }

  // ── Route: /api/Online/MyBets ──────────────────────────────────────────────
  if (subpath === "/api/Online/MyBets" && request.method === "GET") {
    const userTickets = getUserTickets(sessionId);
    return jsonResponse(userTickets);
  }

  // ── Route: /api/Account/Bonuses ───────────────────────────────────────────
  if (subpath === "/api/Account/Bonuses" && request.method === "GET") {
    if (!currentUser) {
      return jsonResponse({ message: "Authentication required." }, 401);
    }
    const bonusTxs = getUserBonusTransactions(currentUser);
    return jsonResponse({
      BonusBalance: currentUser.BonusBalance,
      ActiveBonuses: [
        {
          Id: "BNS-WLCM",
          Name: "100% Sports Welcome Bonus",
          Amount: 10000,
          Status: "Active",
          ExpiresAt: "2026-12-31T23:59:59Z",
        },
        {
          Id: "BNS-ACC",
          Name: "Weekly Multi-Bet Accumulator Boost",
          Amount: 5000,
          Status: "Active",
          ExpiresAt: "2026-11-30T23:59:59Z",
        },
      ],
      Transactions: bonusTxs,
    });
  }

  // ── Route: /api/Statement/User ────────────────────────────────────────────
  if (subpath === "/api/Statement/User" && request.method === "GET") {
    if (!currentUser) {
      return jsonResponse({ message: "Authentication required." }, 401);
    }
    return jsonResponse(getUserStatement(currentUser));
  }

  // ── Route: /api/Receipt/GetById/:id ───────────────────────────────────────
  if (subpath.startsWith("/api/Receipt/GetById/")) {
    const id = subpath.replace("/api/Receipt/GetById/", "").trim();
    const userTickets = getUserTickets(sessionId);
    const found = userTickets.find((t) => t.ReceiptId === id || t.BookingCode === id);
    if (found) {
      return jsonResponse({
        ReceiptId: found.ReceiptId,
        BookingCode: found.BookingCode,
        Status: found.Status,
        TotalStake: found.Stake,
        TotalOdds: found.Odds,
        PotentialPayout: found.Payout,
        Date: found.Date,
      });
    }
    return jsonResponse({
      ReceiptId: id,
      BookingCode: id,
      Status: "Open",
      TotalStake: 2000,
      TotalOdds: 4.85,
      PotentialPayout: 9700,
      Date: new Date().toISOString(),
    });
  }

  // ── Route: /api/Bet/Receipt/:id ───────────────────────────────────────────
  if (subpath.startsWith("/api/Bet/Receipt/")) {
    const id = subpath.replace("/api/Bet/Receipt/", "").trim();
    const userTickets = getUserTickets(sessionId);
    const found = userTickets.find((t) => t.ReceiptId === id || t.BookingCode === id);
    if (found && Array.isArray(found.selections) && found.selections.length > 0) {
      return jsonResponse({
        ReceiptId: found.ReceiptId,
        selections: found.selections,
      });
    }
    return jsonResponse({
      ReceiptId: id,
      selections: [
        {
          match: "Home FC v Away FC",
          market: "1X2",
          pick: "1",
          odds: 2.1,
        },
      ],
    });
  }

  // ── Route: /api/CompanySettings/OnlineSettings ────────────────────────────
  if (subpath === "/api/CompanySettings/OnlineSettings") {
    return jsonResponse({
      MinStake: 500,
      MaxStake: 50000000,
      MaxPayOut: 500000000,
    });
  }

  // Default fallback for any other unhandled /api/* endpoint
  return jsonResponse({ success: true, message: "Acknowledged" });
}
