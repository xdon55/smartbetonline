/**
 * hooks/use-payment-poller.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time Mobile Money USSD prompt poller for MTN MoMo & Airtel Money.
 *
 * Automatically monitors payment verification status via:
 *   GET /api/Online/DepositStatus/{code}
 * Tracks telecom USSD timeout countdown (90s window), live balance updates,
 * and optional Supabase ledger updates when configured.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { smartBetApi, type DepositStatusResponse } from "@/lib/api-smartbet";
import { updateTransactionStatus } from "@/lib/supabase-sportsbook";

export type PollerStatus = "idle" | "prompt_sent" | "polling" | "success" | "expired" | "failed";

export interface PollerState {
  status: PollerStatus;
  code: string | null;
  amount: number;
  phone: string;
  method: string;
  countdown: number;
  newBalance: number | null;
  errorMessage: string | null;
  checking: boolean;
}

const POLLING_INTERVAL_MS = 2500;
const INITIAL_COUNTDOWN_SECONDS = 90;

const isSupabaseConfigured =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env?.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY);

export function usePaymentPoller(onSuccess?: (amount: number, balance?: number) => void) {
  const [state, setState] = useState<PollerState>({
    status: "idle",
    code: null,
    amount: 0,
    phone: "",
    method: "mtn",
    countdown: INITIAL_COUNTDOWN_SECONDS,
    newBalance: null,
    errorMessage: null,
    checking: false,
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeCodeRef = useRef<string | null>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const cleanup = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    activeCodeRef.current = null;
  }, []);

  const checkStatus = useCallback(
    async (code: string, currentAmount: number, manual = false) => {
      if (!activeCodeRef.current || activeCodeRef.current !== code) return;

      if (manual) {
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setState((prev) => ({ ...prev, checking: true }));
      }

      try {
        const res: DepositStatusResponse = await smartBetApi.getDepositStatus(code);
        const remoteStatus = String(res?.status || res?.Status || "").toUpperCase();
        const remoteBalance =
          typeof res.balance === "number"
            ? res.balance
            : typeof res.Balance === "number"
              ? res.Balance
              : undefined;

        if (
          remoteStatus === "SUCCESSFUL" ||
          remoteStatus === "APPROVED" ||
          remoteStatus === "COMPLETED"
        ) {
          cleanup();
          setState((prev) => ({
            ...prev,
            status: "success",
            checking: false,
            newBalance: remoteBalance ?? null,
          }));

          if (isSupabaseConfigured) {
            updateTransactionStatus(code, "completed", {
              verifiedAt: new Date().toISOString(),
              status: "SUCCESSFUL",
              finalBalance: remoteBalance,
            }).catch(console.warn);
          }

          if (onSuccessRef.current) {
            onSuccessRef.current(res.amount || currentAmount, remoteBalance);
          }
          return;
        }

        if (
          remoteStatus === "FAILED" ||
          remoteStatus === "REJECTED" ||
          remoteStatus === "CANCELLED"
        ) {
          cleanup();
          setState((prev) => ({
            ...prev,
            status: "failed",
            checking: false,
            errorMessage: "USSD payment was declined or cancelled on the phone.",
          }));

          if (isSupabaseConfigured) {
            updateTransactionStatus(code, "failed", {
              failedAt: new Date().toISOString(),
              status: remoteStatus,
            }).catch(console.warn);
          }
          return;
        }

        if (manual) {
          setState((prev) => ({ ...prev, checking: false }));
        }

        // Still PENDING, OTP, or UNKNOWN -> queue next poll check
        if (activeCodeRef.current === code) {
          pollTimerRef.current = setTimeout(() => {
            void checkStatus(code, currentAmount);
          }, POLLING_INTERVAL_MS);
        }
      } catch {
        if (manual) {
          setState((prev) => ({ ...prev, checking: false }));
        }
        // Retry polling until countdown ends
        if (activeCodeRef.current === code) {
          pollTimerRef.current = setTimeout(() => {
            void checkStatus(code, currentAmount);
          }, POLLING_INTERVAL_MS);
        }
      }
    },
    [cleanup],
  );

  const startPolling = useCallback(
    (code: string, amount: number, phone: string, method = "mtn") => {
      cleanup();
      activeCodeRef.current = code;

      setState({
        status: "prompt_sent",
        code,
        amount,
        phone,
        method,
        countdown: INITIAL_COUNTDOWN_SECONDS,
        newBalance: null,
        errorMessage: null,
        checking: false,
      });

      countdownTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.countdown <= 1) {
            cleanup();
            return {
              ...prev,
              countdown: 0,
              checking: false,
              status: prev.status === "success" ? "success" : "expired",
            };
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);

      pollTimerRef.current = setTimeout(() => {
        setState((prev) => (prev.status === "prompt_sent" ? { ...prev, status: "polling" } : prev));
        void checkStatus(code, amount);
      }, 2000);
    },
    [cleanup, checkStatus],
  );

  const checkNow = useCallback(() => {
    if (state.code) {
      activeCodeRef.current = state.code;
      void checkStatus(state.code, state.amount, true);
    }
  }, [state.code, state.amount, checkStatus]);

  const reset = useCallback(() => {
    cleanup();
    setState({
      status: "idle",
      code: null,
      amount: 0,
      phone: "",
      method: "mtn",
      countdown: INITIAL_COUNTDOWN_SECONDS,
      newBalance: null,
      errorMessage: null,
      checking: false,
    });
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    startPolling,
    cancelPolling: reset,
    checkNow,
    reset,
    isWaitingApproval: state.status === "prompt_sent" || state.status === "polling",
  };
}
