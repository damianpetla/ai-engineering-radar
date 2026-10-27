export const COLORS = [
  "#d6e8ad",
  "#a6bbf5",
  "#c5a7df",
  "#e7b28b",
  "#8bc9c7",
  "#d3c478",
];
export const date = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
