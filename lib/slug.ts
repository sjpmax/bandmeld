/** Shared slug normalizer — used by the create-band preview and the server
 *  action's final insert, so what the user sees matches what gets stored. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
