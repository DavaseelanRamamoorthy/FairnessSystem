export const formatName = (name: string) => {
  if (!name) return "";

  return name
    .toLowerCase()
    .split(" ")
    .map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
};