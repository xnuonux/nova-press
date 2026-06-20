"use server";

import { revalidatePath } from "next/cache";

import { setActiveWritingFork } from "@/lib/db/user-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WriteAsResult = { ok: boolean };

// server action behind "write as this voice" in the voice timeline. sets (or
// clears) the active writing fork in nova's own settings ... a read-source switch
// that re-aims which strand's snapshot the partner / ghost / repurpose write in.
// it NEVER touches the shared voice_profiles row. a null label = back to your
// live voice. on success it revalidates /library so the switcher + the footer
// indicator reflect the new source; the editor rail reads it fresh on navigation.
export async function setWriteAsForkAction(label: string | null): Promise<WriteAsResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const result = await setActiveWritingFork(
    supabase,
    user.id,
    typeof label === "string" ? label : null,
  );
  if (result.ok) revalidatePath("/library");
  return result;
}
