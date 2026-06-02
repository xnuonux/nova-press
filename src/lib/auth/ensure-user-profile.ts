import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

// ensure nova's row in the shared user_profiles table.
//
// CRITICAL: writes ONLY nova's columns (user_id, is_nova_press_only,
// signup_surface). never touches is_lunari_user, is_gen_connect_only,
// is_lunari_company, or any other surface's flag. uses ignoreDuplicates
// so existing rows (lunari users signing into nova, gen connect users,
// etc.) are NOT overwritten ... first-writer-wins on signup_surface.
export async function ensureNovaUserProfile(
  userId: string,
  client: AdminClient = createSupabaseAdminClient(),
): Promise<void> {
  const { error } = await client.from("user_profiles").upsert(
    {
      user_id: userId,
      is_nova_press_only: true,
      signup_surface: "nova_press",
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    },
  );
  if (error) {
    throw new Error(`failed to ensure user_profiles row: ${error.message}`);
  }
}
