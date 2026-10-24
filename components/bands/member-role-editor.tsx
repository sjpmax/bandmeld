"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMemberRole } from "@/app/dashboard/bands/actions";

/**
 * Displays `role_in_band` and (if the viewer can edit — admin or self)
 * lets them inline-edit it. Submission goes through the set_member_role
 * SECURITY DEFINER RPC which allows either admin or self.
 */
export function MemberRoleEditor({
  bandId,
  profileId,
  currentRole,
  canEdit,
}: {
  bandId: string;
  profileId: string;
  currentRole: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentRole);
  const [pending, start] = useTransition();

  function save() {
    const next = value.trim().slice(0, 60);
    if (next === currentRole.trim()) {
      setEditing(false);
      return;
    }
    start(async () => {
      try {
        await setMemberRole(bandId, profileId, next);
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save role.");
      }
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{currentRole || "Member"}</span>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setValue(currentRole);
              setEditing(true);
            }}
            className="text-xs underline opacity-60 hover:opacity-100"
          >
            Edit
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        list="role-suggestions"
        maxLength={60}
        autoFocus
        disabled={pending}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit"
      />
      <datalist id="role-suggestions">
        <option value="Lead vocals" />
        <option value="Backing vocals" />
        <option value="Guitar" />
        <option value="Lead guitar" />
        <option value="Rhythm guitar" />
        <option value="Bass" />
        <option value="Drums" />
        <option value="Keys" />
        <option value="Synth" />
        <option value="Band leader" />
        <option value="Manager" />
      </datalist>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={pending}
        className="text-xs underline opacity-60 hover:opacity-100 disabled:opacity-40"
      >
        Cancel
      </button>
    </span>
  );
}
