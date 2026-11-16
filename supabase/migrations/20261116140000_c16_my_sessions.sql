-- =============================================================================
-- G16: a member's sessions, listed and signed out one at a time
-- =============================================================================
-- Supabase Auth gives the browser no list of a member's sessions and no way to
-- end one other than its own. These two functions read and end rows in
-- auth.sessions for ONE user, and only the service role may call them: the
-- my-sessions edge function calls them with the user id from the caller's
-- verified token, never from the request body.
--
--   sessions_of_user(user_id)            that user's live sessions, newest activity first:
--                                        id, created_at, last_active, user_agent, aal. Never the IP
--                                        address and never a token.
--   revoke_user_session(user_id, id)     ends that session if it is that user's; its refresh
--                                        tokens go with it (ON DELETE CASCADE). True if one ended.
--
-- WHAT ENDING A SESSION DOES. The device can no longer refresh. The access
-- token it already holds keeps working until it expires (an hour by default),
-- and the Devices group says so.
--
-- Columns are read through to_jsonb(row), so a column this project's Auth
-- version lacks reads as null instead of failing. Safe to run twice; drops
-- nothing.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sessions_of_user(_user_id uuid)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
           'id', r ->> 'id',
           'created_at', r ->> 'created_at',
           'last_active', greatest(
             (r ->> 'refreshed_at')::timestamp AT TIME ZONE 'UTC',
             (r ->> 'updated_at')::timestamptz,
             (r ->> 'created_at')::timestamptz
           ),
           'user_agent', left(r ->> 'user_agent', 512),
           'aal', r ->> 'aal'
         )
  FROM (SELECT to_jsonb(s) AS r FROM auth.sessions AS s WHERE s.user_id = _user_id) AS rows
  WHERE _user_id IS NOT NULL
    AND (r ->> 'not_after' IS NULL OR (r ->> 'not_after')::timestamptz > now())
  ORDER BY greatest(
             (r ->> 'refreshed_at')::timestamp AT TIME ZONE 'UTC',
             (r ->> 'updated_at')::timestamptz,
             (r ->> 'created_at')::timestamptz
           ) DESC NULLS LAST
  LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_session(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _ended integer;
BEGIN
  IF _user_id IS NULL OR _session_id IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM auth.sessions WHERE id = _session_id AND user_id = _user_id;
  GET DIAGNOSTICS _ended = ROW_COUNT;
  RETURN _ended > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.sessions_of_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_user_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sessions_of_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid, uuid) TO service_role;
