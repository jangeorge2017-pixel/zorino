-- public.users is a view over public.profiles (001_zorino_foundation.sql).
-- Views run with the owner's privileges by default, so anon/authenticated reads
-- bypass the profiles RLS policies and expose email, full_name, is_admin and
-- country_code. security_invoker makes the view honor the querying role's
-- permissions and the underlying RLS policies.
--
-- Non-destructive: no columns, rows, or objects are dropped.
alter view public.users set (security_invoker = true);
