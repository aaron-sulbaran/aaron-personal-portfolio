export interface Leaf { path: string; text: string }

// Every string inside a value, with a readable path; functions are skipped.
export function walkStrings(value: unknown, path = ""): Leaf[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => walkStrings(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => walkStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
