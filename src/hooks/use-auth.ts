/**
 * hooks/use-auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook reading the global reactive AuthProvider context.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useAuthContext } from "@/lib/auth-context";

export function useAuth() {
  return useAuthContext();
}
