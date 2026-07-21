-- EPF-03 Payment Processing Platform — Enum Extensions
-- Sprint 3 — Separate migration to allow safe use of new enum values in functions.
--
-- PostgreSQL does not allow new enum values to be used in stored functions within
-- the same transaction that adds them. This migration is applied first, then the
-- main EPF-03 migration can reference the values safely.

-- ============================================================================
-- 1. EXTEND EXISTING PAYMENT STATUS ENUM
-- ============================================================================

-- Extend payment_status enum with values that genuinely belong to payment
-- processing, without conflating them with invoice lifecycle statuses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'resident.payment_status'::regtype
      AND enumlabel = 'partially_confirmed'
  ) THEN
    ALTER TYPE resident.payment_status ADD VALUE 'partially_confirmed' AFTER 'confirmed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'resident.payment_status'::regtype
      AND enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE resident.payment_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- ============================================================================
-- 2. NEW EPF-03 ENUMS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider_capability') THEN
    CREATE TYPE resident.payment_provider_capability AS ENUM (
      'pix_generation',
      'dynamic_qrcode',
      'static_qrcode',
      'boleto_generation',
      'webhooks',
      'refund',
      'cancellation',
      'payment_status_lookup',
      'settlement_lookup',
      'cnab_support'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider_environment') THEN
    CREATE TYPE resident.payment_provider_environment AS ENUM (
      'sandbox',
      'production'
    );
  END IF;
END $$;

-- ============================================================================
-- 3. EXTEND TENANT PERMISSIONS FOR PAYMENTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'resident.tenant_permission'::regtype
      AND enumlabel = 'payments:read'
  ) THEN
    ALTER TYPE resident.tenant_permission ADD VALUE 'payments:read';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'resident.tenant_permission'::regtype
      AND enumlabel = 'payments:write'
  ) THEN
    ALTER TYPE resident.tenant_permission ADD VALUE 'payments:write';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_signature_status') THEN
    CREATE TYPE resident.webhook_signature_status AS ENUM (
      'valid',
      'invalid',
      'missing',
      'not_applicable'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_replay_status') THEN
    CREATE TYPE resident.webhook_replay_status AS ENUM (
      'accepted',
      'duplicate',
      'expired',
      'not_applicable'
    );
  END IF;
END $$;

COMMENT ON TYPE resident.payment_status IS 'Extended in EPF-03 with partially_confirmed to support explicit partial payment semantics.';
COMMENT ON TYPE resident.payment_provider_capability IS 'Declared capabilities of a payment provider. Used for runtime capability discovery and enforcement.';
