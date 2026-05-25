// barrel for types only. factories live in ./client, ./server, ./admin
// and must be imported from there directly ... mixing them in one barrel
// pulls next/headers into the browser bundle and breaks the build.

export type { Database } from "@/types/supabase";
export type { Session, SupabaseClient, User } from "@supabase/supabase-js";
