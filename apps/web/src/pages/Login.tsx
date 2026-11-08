import { useState } from "react";
import { Navigate } from "react-router-dom";
import { OAUTH_PROVIDERS, supabase, useAccount } from "../lib/supabase";

export default function Login() {
  const { session, ready } = useAccount();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabase) return <p className="py-20 text-center text-sub">Accounts are not set up on this server. You can still play as a guest.</p>;
  if (ready && session) return <Navigate to="/profile" replace />;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/profile` } });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <section className="mx-auto max-w-sm space-y-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-sub">Playing needs no account. Signing in puts your runs on the leaderboards.</p>
      </div>
      {sent ? (
        <p className="rounded border border-line bg-panel p-4 text-sm" data-testid="link-sent">
          Check your inbox: we sent a sign-in link to <b>{email}</b>.
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <label className="block text-sm">
            <span className="text-xs text-sub">email</span>
            <input
              type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
            />
          </label>
          <button type="submit" className="w-full rounded border border-accent px-3 py-2 text-accent hover:bg-accent hover:text-bg">
            email me a sign-in link
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </form>
      )}
      {OAUTH_PROVIDERS.length > 0 && (
        <div className="space-y-2">
          <p className="text-center text-xs text-sub">or</p>
          {OAUTH_PROVIDERS.map((p) => (
            <button
              key={p}
              className="w-full rounded border border-line px-3 py-2 hover:border-text"
              onClick={() => supabase!.auth.signInWithOAuth({ provider: p, options: { redirectTo: `${window.location.origin}/profile` } })}
            >
              continue with {p === "github" ? "GitHub" : "Google"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
