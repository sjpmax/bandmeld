"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { setBandAssetUrl } from "@/app/dashboard/bands/actions";

type Kind = "logo" | "press" | "rider" | "epk";

const KIND_MIME: Record<Kind, string> = {
  logo: "image/png,image/jpeg,image/webp,image/svg+xml",
  press: "image/jpeg,image/png,image/webp",
  rider: "application/pdf",
  epk: "application/pdf",
};

const MAX_BYTES = 20 * 1024 * 1024; // matches bucket limit

export function AssetUploader({
  bandId,
  kind,
  label,
  helper,
  currentUrl,
  preview,
}: {
  bandId: string;
  kind: Kind;
  label: string;
  helper?: string;
  currentUrl: string | null;
  preview?: "image" | "link";
}) {
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(`File is too large (max ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB).`);
      e.target.value = "";
      return;
    }

    setPending(true);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${bandId}/${kind}/f-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("band-assets")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) {
      toast.error(upErr.message);
      setPending(false);
      e.target.value = "";
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("band-assets").getPublicUrl(path);

    const result = await setBandAssetUrl(bandId, kind, publicUrl);
    if (!result.ok) toast.error(result.error);
    else toast.success(result.message ?? "Uploaded.");

    setPending(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onRemove() {
    setPending(true);
    const result = await setBandAssetUrl(bandId, kind, null);
    if (!result.ok) toast.error(result.error);
    else toast.success(result.message ?? "Removed.");
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{label}</h3>
          {helper && <p className="text-xs opacity-60">{helper}</p>}
        </div>
        {currentUrl && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="text-sm text-red-600 hover:underline disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>

      {currentUrl && preview === "image" && (
        <img
          src={currentUrl}
          alt={label}
          className="max-h-32 w-fit rounded-md border border-black/10 object-contain dark:border-white/10"
        />
      )}
      {currentUrl && preview === "link" && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener"
          className="text-sm underline opacity-80 hover:opacity-100"
        >
          View current file ↗
        </a>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          ref={inputRef}
          type="file"
          accept={KIND_MIME[kind]}
          onChange={onChange}
          disabled={pending}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90 disabled:opacity-60"
        />
      </label>
    </div>
  );
}
