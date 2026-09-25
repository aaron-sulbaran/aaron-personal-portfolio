import type { LedgerEdit } from "@/lib/recruiting/edits";

// Files one ledger edit through POST /recruiting/edit. Shared by the edit
// dialog and the table's one-click "next step done".
export async function submitEdit(
  edit: LedgerEdit,
  company: string,
): Promise<{ data: { number: number }; error: null } | { data: null; error: string }> {
  try {
    const res = await fetch("/recruiting/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edit, company }),
    });
    const result = (await res.json().catch(() => null)) as
      | { data: { number: number }; error: null }
      | { data: null; error: string }
      | null;
    if (!result) return { data: null, error: `Request failed (${res.status})` };
    return result;
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}
