-- Prevent authenticated users from self-elevating to admin via profiles.is_admin

CREATE OR REPLACE FUNCTION public.prevent_profile_admin_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF COALESCE(current_setting('role', true), '') <> 'service_role' THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_admin_escalation ON public.profiles;

CREATE TRIGGER profiles_prevent_admin_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_admin_escalation();
