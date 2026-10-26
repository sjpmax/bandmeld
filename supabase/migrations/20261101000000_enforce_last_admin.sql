-- =============================================================================
-- MIGRATION: Enforce last-admin guard on band_members
--
-- Prevents the only admin of a band from being removed or demoted. Covers:
--   - DELETE on band_members where the row is the last admin
--   - UPDATE that flips is_admin from TRUE to FALSE on the last admin
--
-- Doesn't block ON DELETE CASCADE from bands (the band is going away anyway);
-- detects that case by checking the parent band still exists in the trigger.
-- Cascade from profiles (user account deletion) is also allowed to pass —
-- there is no graceful way to stop a user from deleting their account just
-- because they're the only band admin somewhere. Document, don't block.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_last_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band_id    UUID;
  v_target_id  UUID;
  v_remaining  INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_band_id := OLD.band_id;
    v_target_id := OLD.id;
    -- Only guard when the row being removed IS an admin.
    IF OLD.is_admin IS NOT TRUE THEN
      RETURN OLD;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_band_id := NEW.band_id;
    v_target_id := NEW.id;
    -- Only guard when an admin is being DEMOTED to non-admin.
    IF NOT (OLD.is_admin IS TRUE AND NEW.is_admin IS NOT TRUE) THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  -- Let CASCADE from bands pass — the band row no longer exists at this point.
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id = v_band_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_remaining
  FROM public.band_members
  WHERE band_id = v_band_id
    AND is_admin = TRUE
    AND id <> v_target_id;

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last admin of a band. Promote another member first.'
      USING ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS band_members_enforce_last_admin ON public.band_members;

CREATE TRIGGER band_members_enforce_last_admin
BEFORE UPDATE OR DELETE ON public.band_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_last_admin();
