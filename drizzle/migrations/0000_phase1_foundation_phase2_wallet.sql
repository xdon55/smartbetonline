-- ============================================================================
-- PHASE 1 (FOUNDATION) + PHASE 2 (WALLET)
-- Accounts, roles, audit log, platform config, and a double-entry wallet ledger.
-- Money NEVER moves by updating a balance column: every movement is two ledger
-- rows inside one transaction. Balance is always derived.
-- ============================================================================

-- ── Roles ───────────────────────────────────────────────────────────────────
-- Roles live in their own table (never on profiles) to prevent privilege escalation.
CREATE TYPE public.app_role AS ENUM ('player', 'agent', 'cashier', 'trader', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── Profiles ────────────────────────────────────────────────────────────────
-- Player-facing account data. No FK to auth.users (managed schema).
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  phone text UNIQUE,
  country text NOT NULL DEFAULT 'UG',
  currency text NOT NULL DEFAULT 'UGX',
  date_of_birth date,
  kyc_status text NOT NULL DEFAULT 'unverified',
  account_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── Platform configuration ──────────────────────────────────────────────────
CREATE TABLE public.platform_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_config TO authenticated, anon;
GRANT ALL ON public.platform_config TO service_role;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config is publicly readable" ON public.platform_config
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.platform_config (key, value) VALUES
  ('min_age', '25'::jsonb),
  ('currency', '"UGX"'::jsonb),
  ('min_deposit', '1000'::jsonb),
  ('min_withdrawal', '5000'::jsonb),
  ('min_stake', '500'::jsonb),
  ('max_stake', '5000000'::jsonb),
  ('max_payout', '50000000'::jsonb);

-- ── Audit log ───────────────────────────────────────────────────────────────
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── Wallet ──────────────────────────────────────────────────────────────────
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'UGX',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Transactions: one business-level money movement (deposit, withdrawal, stake...).
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  direction text NOT NULL,                       -- 'credit' or 'debit' from the player's view
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'UGX',
  reference text,
  idempotency_key text NOT NULL UNIQUE,          -- every write is replay-safe
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_created_idx ON public.transactions (user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all transactions" ON public.transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Ledger: the accounting truth. Two rows per transaction, debits = credits.
CREATE TABLE public.ledger_entries (
  id bigserial PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  account text NOT NULL,          -- 'player_wallet' or a system account
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'UGX',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_wallet_idx ON public.ledger_entries (wallet_id);
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ledger_entries_id_seq TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own ledger" ON public.ledger_entries
  FOR SELECT TO authenticated USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

-- Derived balance: credits minus debits on the player's wallet leg.
CREATE OR REPLACE FUNCTION public.wallet_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount ELSE -le.amount END), 0)
  FROM public.ledger_entries le
  JOIN public.wallets w ON w.id = le.wallet_id
  WHERE w.user_id = _user_id;
$$;
GRANT EXECUTE ON FUNCTION public.wallet_balance(uuid) TO authenticated, service_role;

-- Atomic money movement. Locks the wallet row, enforces funds, writes the
-- transaction plus both ledger legs, and is idempotent on _idempotency_key.
CREATE OR REPLACE FUNCTION public.wallet_transact(
  _user_id uuid,
  _type text,
  _direction text,
  _amount numeric,
  _counter_account text,
  _idempotency_key text,
  _reference text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_existing uuid;
  v_balance numeric;
  v_tx_id uuid;
BEGIN
  IF _direction NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'invalid direction';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT id INTO v_existing FROM public.transactions WHERE idempotency_key = _idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;   -- replay: return the original transaction untouched
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet not found';
  END IF;
  IF v_wallet.status <> 'active' THEN
    RAISE EXCEPTION 'wallet is not active';
  END IF;

  IF _direction = 'debit' THEN
    SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)
      INTO v_balance FROM public.ledger_entries WHERE wallet_id = v_wallet.id;
    IF v_balance < _amount THEN
      RAISE EXCEPTION 'insufficient funds';
    END IF;
  END IF;

  INSERT INTO public.transactions (user_id, wallet_id, type, direction, amount, currency,
                                   reference, idempotency_key, metadata)
  VALUES (_user_id, v_wallet.id, _type, _direction, _amount, v_wallet.currency,
          _reference, _idempotency_key, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_tx_id;

  -- Player leg
  INSERT INTO public.ledger_entries (transaction_id, account, wallet_id, direction, amount, currency)
  VALUES (v_tx_id, 'player_wallet', v_wallet.id, _direction, _amount, v_wallet.currency);
  -- Counter leg (system account), opposite direction so the entry balances
  INSERT INTO public.ledger_entries (transaction_id, account, wallet_id, direction, amount, currency)
  VALUES (v_tx_id, _counter_account, NULL,
          CASE WHEN _direction = 'credit' THEN 'debit' ELSE 'credit' END,
          _amount, v_wallet.currency);

  RETURN v_tx_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.wallet_transact(uuid, text, text, numeric, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_transact(uuid, text, text, numeric, text, text, text, jsonb) TO service_role;
