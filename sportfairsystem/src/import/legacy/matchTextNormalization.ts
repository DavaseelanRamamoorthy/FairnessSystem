const CAPTAIN_MARKER_REGEX =
  /\(\s*c(?:apt)?(?:ain)?(?:\s*&\s*wk)?\s*\)|\(\s*c\s*&/i;
const WICKET_KEEPER_MARKER_REGEX =
  /\(\s*wk\s*\)|\(\s*c\s*&\s*wk\s*\)/i;

export function normalizeMatchWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function stripNameAnnotations(name: string) {
  return normalizeMatchWhitespace(
    name
      .replace(/\(.*?\)/g, "")
      .replace(/[()]/g, "")
  );
}

export function normalizeNameKey(name: string) {
  return stripNameAnnotations(name).toLowerCase();
}

export function normalizeLooseTextKey(value: string) {
  return stripNameAnnotations(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function uniqueNameKeys(names: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      names
        .map((name) => normalizeNameKey(name ?? ""))
        .filter(Boolean)
    )
  );
}

export function parseDelimitedPlayerList(listText: string) {
  return Array.from(
    new Set(
      listText
        .split(/\s*[,;]\s*/)
        .map((name) => stripNameAnnotations(name))
        .filter(Boolean)
    )
  );
}

export function hasCaptainMarker(rawName: string) {
  return CAPTAIN_MARKER_REGEX.test(rawName);
}

export function hasWicketKeeperMarker(rawName: string) {
  return WICKET_KEEPER_MARKER_REGEX.test(rawName);
}
