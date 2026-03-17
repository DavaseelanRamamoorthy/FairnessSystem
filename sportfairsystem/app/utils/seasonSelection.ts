type SeasonOptionLike = {
  value: string;
};

export function getLatestSeasonValue<T extends SeasonOptionLike>(
  seasons: T[],
  fallback = "all"
) {
  return seasons[0]?.value ?? fallback;
}

export function sortSeasonLabelsDescending(labels: string[]) {
  return [...labels].sort((left, right) => right.localeCompare(left));
}
