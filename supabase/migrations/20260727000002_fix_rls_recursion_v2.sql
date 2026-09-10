/*
# Fix v2: RLS infinite recursion — add SET row_security = off to helper functions

## Why v1 didn't work
Supabase tables use FORCE ROW LEVEL SECURITY. This means that even SECURITY DEFINER
functions (which run as the function owner / postgres superuser) are still subject to
RLS policies. So the helper functions from v1 were triggering the same cycle:

  auth_uid_is_member_of  → queries merchant_members WITH RLS
                         → select_own_members policy applies
                         → calls auth_uid_owns_merchant
                         → queries merchants WITH RLS
                         → select_own_merchants policy applies
                         → calls auth_uid_is_member_of  ← loop!

## Fix
Add `SET row_security = off` to both helper functions. This explicitly disables RLS
during the function body, breaking the cycle. Security is still maintained because
the WHERE clauses filter by auth.uid() — only the calling user's own data is returned.
*/

CREATE OR REPLACE FUNCTION public.auth_uid_is_member_of(p_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off        -- ← bypass FORCE ROW LEVEL SECURITY
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.merchant_members
    WHERE  merchant_id = p_merchant_id
    AND    user_id     = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_uid_owns_merchant(p_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off        -- ← bypass FORCE ROW LEVEL SECURITY
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.merchants
    WHERE  id       = p_merchant_id
    AND    owner_id = auth.uid()
  );
$$;
