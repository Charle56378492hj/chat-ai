-- Add a privileged RPC that gets or creates a merchant for the current user,
-- bypassing RLS entirely. This eliminates the race condition and RLS failures
-- that caused the false "يرجى تسجيل الدخول" error in the connections page.

-- Ensure every existing user has a merchant record.
INSERT INTO merchants (owner_id, company_name)
SELECT id, 'متجري'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM merchants m WHERE m.owner_id = u.id);

-- Prevent duplicate merchants per owner going forward.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchants_owner_id_key'
  ) THEN
    ALTER TABLE merchants ADD CONSTRAINT merchants_owner_id_key UNIQUE (owner_id);
  END IF;
END $$;

-- Drop and recreate the RPC function (idempotent).
DROP FUNCTION IF EXISTS get_or_create_merchant();

CREATE OR REPLACE FUNCTION get_or_create_merchant()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_id uuid;
BEGIN
  SELECT id INTO m_id FROM merchants WHERE owner_id = auth.uid() LIMIT 1;
  IF m_id IS NULL THEN
    INSERT INTO merchants (owner_id, company_name)
    VALUES (auth.uid(), 'متجري')
    ON CONFLICT (owner_id) DO NOTHING
    RETURNING id INTO m_id;

    IF m_id IS NULL THEN
      SELECT id INTO m_id FROM merchants WHERE owner_id = auth.uid() LIMIT 1;
    END IF;
  END IF;
  RETURN m_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_merchant() TO authenticated;
