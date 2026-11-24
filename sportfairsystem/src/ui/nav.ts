/** Only follow same-site paths, so a crafted link cannot bounce people elsewhere. */
export function safeNext(search: string) {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}
