/*
# Fix: Infinite recursion in merchants / merchant_members RLS policies

## Root cause
Two SELECT policies formed a cycle:

  select_own_merchants  →  queries merchant_members (triggers its SELECT policy)
  select_own_members    →  queries merchants        (triggers its SELECT policy)
                                                     ↑ back to start → infinite loop

This caused every operation that checked table ownership (INSERT channels, etc.)
to fail with "infinite recursion detected in policy for relation merchants".

## Fix
Replace the inlined cross-table subqueries with SECURITY DEFINER helper functions.
SECURITY DEFINER bypasses RLS on the tables the function accesses, breaking the cycle.
*/

-- ─── Helper 1: is the current user a member of a merchant? ────────────────────
-- Used inside merchants SELECT policy to check membership WITHOUT triggering
-- the merchant_members SELECT policy (and thus without looping back to merchants).
CREATE OR REPLACE FUNCTION auth_uid_is_member_of(p_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   merchant_members
    WHERE  merchant_id = p_merchant_id
    AND    user_id     = auth.uid()
  );
$$;

-- ─── Helper 2: does the current user own a merchant? ─────────────────────────
-- Used inside merchant_members SELECT policy to check ownership WITHOUT
-- triggering the merchants SELECT policy (and thus without looping back to
-- merchant_members).
CREATE OR REPLACE FUNCTION auth_uid_owns_merchant(p_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   merchants
    WHERE  id        = p_merchant_id
    AND    owner_id  = auth.uid()
  );
$$;

-- ─── Recreate merchants SELECT policy (no more inline merchant_members query) ──
DROP POLICY IF EXISTS "select_own_merchants" ON merchants;
CREATE POLICY "select_own_merchants" ON merchants FOR SELECT
  TO authenticated USING (
    owner_id = auth.uid()
    OR auth_uid_is_member_of(id)        -- SECURITY DEFINER: no RLS on merchant_members
  );

-- ─── Recreate merchant_members SELECT policy (no more inline merchants query) ──
DROP POLICY IF EXISTS "select_own_members" ON merchant_members;
CREATE POLICY "select_own_members" ON merchant_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR auth_uid_owns_merchant(merchant_id)  -- SECURITY DEFINER: no RLS on merchants
  );
