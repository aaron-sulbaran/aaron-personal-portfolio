// Where a Connect handle may wrap: after an at sign, but never right after a
// leading one, so "@handle" does not leave a lone "@" at the end of a line.
export function splitAfterAt(value: string): string[] {
  return value.split(/(?<=.@)/);
}
