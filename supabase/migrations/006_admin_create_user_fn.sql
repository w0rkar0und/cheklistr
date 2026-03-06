-- ============================================================
-- Cheklistr: Admin Create User Function
-- Bypasses RLS since signUp() switches the active session
-- away from the admin to the newly created auth user.
-- ============================================================

-- SECURITY DEFINER runs with the privileges of the function
-- owner (postgres), bypassing RLS. The function verifies
-- the caller is an admin before proceeding.

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_user_id      UUID,
  p_login_id     TEXT,
  p_full_name    TEXT,
  p_email        TEXT,
  p_role         user_role,
  p_contractor_id TEXT DEFAULT NULL,
  p_site_code    TEXT DEFAULT NULL,
  p_admin_id     UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the provided admin ID belongs to an active admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_id
      AND role = 'admin'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorised: only active admins can create users';
  END IF;

  -- Insert the new user profile
  INSERT INTO public.users (id, login_id, full_name, email, role, contractor_id, site_code, is_active)
  VALUES (p_user_id, p_login_id, p_full_name, p_email, p_role, p_contractor_id, p_site_code, true);
END;
$$;

-- Grant execute to authenticated users (RLS-like check is inside the function)
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated;
