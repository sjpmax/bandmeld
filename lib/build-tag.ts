/**
 * Short SHA of the deployment, or "dev" when running locally. Rendered in
 * the footer so a user can tell a reporter which build they were on when
 * a bug showed up.
 */
export function buildTag(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  return "dev";
}
