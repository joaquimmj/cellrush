import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { Platform } from "@cellrush/engine";
import { supabase, useAccount } from "../lib/supabase";

// Most common countries for the audience first; ISO 3166-1 alpha-2.
export const COUNTRIES: [string, string][] = [
  ["FR", "France"], ["BE", "Belgium"], ["CH", "Switzerland"], ["CA", "Canada"], ["GB", "United Kingdom"], ["US", "United States"],
  ["DE", "Germany"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["LU", "Luxembourg"], ["PT", "Portugal"],
  ["IE", "Ireland"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"], ["PL", "Poland"],
  ["AT", "Austria"], ["MA", "Morocco"], ["TN", "Tunisia"], ["DZ", "Algeria"], ["SN", "Senegal"], ["CI", "Côte d'Ivoire"],
  ["AE", "United Arab Emirates"], ["SG", "Singapore"], ["HK", "Hong Kong"], ["IN", "India"], ["CN", "China"], ["JP", "Japan"],
  ["AU", "Australia"], ["BR", "Brazil"], ["MX", "Mexico"],
];

interface School {
  id: number;
  name: string;
}

export default function Profile() {
  const { session, profile, setProfile, ready } = useAccount();
  const [schools, setSchools] = useState<School[]>([]);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [school, setSchool] = useState<string>("");
  const [other, setOther] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase?.from("schools").select("id, name").order("name").then(({ data }) => setSchools((data as School[]) ?? []));
  }, []);
  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name);
    setCountry(profile.country ?? "");
    setSchool(profile.school_id ? String(profile.school_id) : profile.school_other ? "other" : "");
    setOther(profile.school_other ?? "");
    setPlatform(profile.platform ?? "");
  }, [profile]);

  if (!supabase) return <p className="py-20 text-center text-sub">Accounts are not set up on this server.</p>;
  if (ready && !session) return <Navigate to="/login" replace />;
  if (!ready || !session) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const row = {
      id: session.user.id,
      display_name: name.trim(),
      country: country || null,
      school_id: school && school !== "other" ? Number(school) : null,
      school_other: school === "other" ? other.trim() || null : null,
      platform: platform || null,
    };
    const { error } = profile
      ? await supabase!.from("profiles").update(row).eq("id", row.id)
      : await supabase!.from("profiles").insert(row);
    if (error) {
      const text =
        error.code === "23505" ? "That name is taken."
        : error.code === "23514" ? "Names are 2–24 letters, digits, spaces or . _ ' - and must be polite."
        : error.message;
      setMsg({ ok: false, text });
      return;
    }
    setProfile({ ...row, platform: row.platform as Platform | null });
    setMsg({ ok: true, text: "Saved. Your next runs go to the leaderboards." });
  };

  const field = "mt-1 w-full rounded border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none";
  return (
    <section className="mx-auto max-w-md space-y-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        <button className="text-sm text-sub hover:text-text" onClick={() => supabase!.auth.signOut()}>sign out</button>
      </div>
      <p className="text-sm text-sub">Signed in as {session.user.email}. Only your display name, country and school are public.</p>
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm">
          <span className="text-xs text-sub">display name (public)</span>
          <input required minLength={2} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-sub">country (optional)</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
            <option value="">—</option>
            {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-sub">school (optional)</span>
          <select value={school} onChange={(e) => setSchool(e.target.value)} className={field}>
            <option value="">—</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="other">Other…</option>
          </select>
        </label>
        {school === "other" && (
          <label className="block text-sm">
            <span className="text-xs text-sub">school name (shown once approved)</span>
            <input maxLength={80} value={other} onChange={(e) => setOther(e.target.value)} className={field} />
          </label>
        )}
        <label className="block text-sm">
          <span className="text-xs text-sub">I mostly use</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform | "")} className={field}>
            <option value="">—</option>
            <option value="win">Windows</option>
            <option value="mac">macOS</option>
          </select>
        </label>
        <button type="submit" className="rounded border border-accent px-4 py-2 text-accent hover:bg-accent hover:text-bg">save</button>
        {msg && <p className={`text-sm ${msg.ok ? "text-accent" : "text-bad"}`} data-testid="profile-msg">{msg.text}</p>}
      </form>
    </section>
  );
}
