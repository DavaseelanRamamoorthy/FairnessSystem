// Resolves outside names (Spond, CricHeroes, PDF, sheet) to members.
// Exact matches are applied automatically; anything else is only *suggested*
// and must be confirmed by a person, who then saves it as a new identity.

export type IdentitySource = "app_account" | "spond" | "cricheroes" | "sheet" | "pdf" | "manual";

export type Identity = {
  memberId: string;
  source: IdentitySource;
  externalId: string | null;
  nameKey: string;
};

export type MemberRef = { id: string; displayName: string };

export type Resolution =
  | { status: "matched"; memberId: string; via: "external_id" | "name" }
  | { status: "suggested"; suggestions: Array<{ memberId: string; displayName: string; why: string }> }
  | { status: "unresolved" };

/** Must stay identical to app_private.name_key() in the database. */
export function nameKey(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const tokens = (name: string) => nameKey(name).split(" ").filter(Boolean);

/** "Anir" ~ "Anirban", "R Kumar" ~ "Rajesh Kumar", "Davaseelan R" ~ "Davaseelan Ramamoorthy". */
function similarity(outside: string, member: string): string | null {
  const a = tokens(outside);
  const b = tokens(member);
  if (a.length === 0 || b.length === 0) return null;
  if (a.join(" ") === b.join(" ")) return "same name";

  const compatible = (x: string, y: string) =>
    x === y || (x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y)) ||
    (Math.min(x.length, y.length) >= 3 && (x.startsWith(y) || y.startsWith(x)));

  // every token of the shorter name lines up with a token of the longer one, in order
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let j = 0;
  for (const token of short) {
    while (j < long.length && !compatible(token, long[j])) j += 1;
    if (j === long.length) return null;
    j += 1;
  }
  return short.length === 1 ? "first-name match" : "initials / shortened name";
}

export function resolveName(
  outside: { name: string; externalId?: string | null },
  source: IdentitySource,
  identities: Identity[],
  members: MemberRef[]
): Resolution {
  if (outside.externalId) {
    const byId = identities.find((i) => i.source === source && i.externalId === outside.externalId);
    if (byId) return { status: "matched", memberId: byId.memberId, via: "external_id" };
  }
  const key = nameKey(outside.name);
  const byName = identities.filter((i) => i.source === source && i.nameKey === key);
  if (byName.length === 1) return { status: "matched", memberId: byName[0].memberId, via: "name" };

  // Suggestions look at every known name for each member, from any source.
  const suggestions = new Map<string, { memberId: string; displayName: string; why: string }>();
  for (const member of members) {
    const names = [member.displayName, ...identities.filter((i) => i.memberId === member.id).map((i) => i.nameKey)];
    for (const candidate of names) {
      const why = similarity(outside.name, candidate);
      if (why && !suggestions.has(member.id)) {
        suggestions.set(member.id, { memberId: member.id, displayName: member.displayName, why });
      }
    }
  }
  if (suggestions.size > 0) {
    return { status: "suggested", suggestions: [...suggestions.values()].sort((x, y) => x.displayName.localeCompare(y.displayName)) };
  }
  return { status: "unresolved" };
}
