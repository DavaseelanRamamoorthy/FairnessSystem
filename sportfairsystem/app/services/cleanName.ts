export const cleanName = (name: string) => {
  if (!name) return "";
  return name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+(C|WK|CAPT|CAPTAIN|C\s*&\s*WK|WK\s*&\s*C)\b/gi, '')
    .trim()
    .toUpperCase();
};