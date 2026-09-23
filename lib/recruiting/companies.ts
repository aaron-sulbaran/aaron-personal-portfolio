// A hover list of companies that stays small: repeats collapse to "Google ×3",
// the most repeated first, then alphabetical, capped with a count of the rest.
export function summarizeCompanies(
  names: ReadonlyArray<string>,
  cap = 12,
): { items: string[]; more: number } {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const items = sorted.slice(0, cap).map(([name, n]) => (n > 1 ? `${name} ×${n}` : name));
  return { items, more: Math.max(0, sorted.length - cap) };
}
