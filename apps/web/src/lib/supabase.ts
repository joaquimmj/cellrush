import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { Platform } from "@cellrush/engine";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null when the backend isn't configured: the game still works fully for guests. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

/** Comma-separated OAuth providers enabled on the backend, e.g. "github,google". */
export const OAUTH_PROVIDERS = ((import.meta.env.VITE_OAUTH_PROVIDERS as string | undefined) ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s): s is "github" | "google" => s === "github" || s === "google");

export interface Profile {
  id: string;
  display_name: string;
  country: string | null;
  school_id: number | null;
  school_other: string | null;
  platform: Platform | null;
}

/** Current session + profile; `ready` turns true after the first check. */
export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    const load = async (s: Session | null) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setReady(true);
        return;
      }
      const { data } = await supabase!.from("profiles").select("id, display_name, country, school_id, school_other, platform").eq("id", s.user.id).maybeSingle();
      setProfile((data as Profile | null) ?? null);
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => void load(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, profile, setProfile, ready };
}
