import { lazy, Suspense, useMemo, type ReactNode } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { APP_NAME } from "./config";
import { useT } from "./i18n";
import { currentEnv } from "./lib/browser-env";
import { supabase, useAccount } from "./lib/supabase";
import Play from "./pages/Play";

// Everything but the game itself loads on demand, so the landing page (= the game) stays light.
const Daily = lazy(() => import("./pages/Daily"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Learn = lazy(() => import("./pages/Learn"));
const Speedrun = lazy(() => import("./pages/Speedrun"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const Result = lazy(() => import("./pages/Result"));
const Keys = lazy(() => import("./pages/Keys"));
const Sandbox = lazy(() => import("./pages/Sandbox"));
const SettingsPage = lazy(() => import("./pages/Settings"));

const nav = ({ isActive }: { isActive: boolean }) => (isActive ? "text-text underline decoration-accent underline-offset-4" : "text-sub hover:text-text");

/** Phones and tablets get a friendly screen instead of a game they can't play. */
function NeedsKeyboard({ children }: { children: ReactNode }) {
  const t = useT();
  const env = useMemo(currentEnv, []);
  if (!env.mobile) return <>{children}</>;
  return (
    <section className="mx-auto max-w-md py-16 text-center" data-testid="mobile-notice">
      <p className="text-5xl" aria-hidden="true">⌨</p>
      <h1 className="mt-4 text-2xl font-bold">{t("mobile.title")}</h1>
      <p className="mt-3 text-sub">{t("mobile.body")}</p>
      <Link to="/leaderboard" className="mt-6 inline-block rounded border border-accent px-4 py-2 text-accent">{t("mobile.leaderboards")}</Link>
    </section>
  );
}

export default function App() {
  const t = useT();
  const game = (el: ReactNode) => <NeedsKeyboard>{el}</NeedsKeyboard>;
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 sm:px-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-panel focus:px-3 focus:py-1">
        {t("shell.skip")}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6">
        <Link to="/" className="text-xl font-bold tracking-tight">
          <span className="text-accent" aria-hidden="true">▣</span> {APP_NAME}
        </Link>
        <nav aria-label="main" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <NavLink to="/" end className={nav}>{t("nav.play")}</NavLink>
          <NavLink to="/daily" className={nav}>{t("nav.daily")}</NavLink>
          <NavLink to="/speedrun" className={nav}>{t("nav.speedrun")}</NavLink>
          <NavLink to="/learn" className={nav}>{t("nav.learn")}</NavLink>
          <NavLink to="/leaderboard" className={nav}>{t("nav.leaderboard")}</NavLink>
          <NavLink to="/sandbox" className={nav}>{t("nav.sandbox")}</NavLink>
          <NavLink to="/keys" className={nav}>{t("nav.keys")}</NavLink>
          <NavLink to="/settings" className={nav}>{t("nav.settings")}</NavLink>
          <AccountLink />
        </nav>
      </header>
      <main id="main" className="flex-1">
        <Suspense fallback={<p className="py-20 text-center text-sub">…</p>}>
          <Routes>
            <Route path="/" element={game(<Play />)} />
            <Route path="/daily" element={game(<Daily />)} />
            <Route path="/speedrun" element={game(<Speedrun />)} />
            <Route path="/learn" element={game(<Learn />)} />
            <Route path="/sandbox" element={game(<Sandbox />)} />
            <Route path="/keys" element={game(<Keys />)} />
            <Route path="/r/:id" element={<Result />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<p className="py-20 text-center text-sub">{t("shell.404")}</p>} />
          </Routes>
        </Suspense>
      </main>
      <footer className="py-8 text-center text-xs text-sub">
        <p>{t("shell.disclaimer")}</p>
      </footer>
    </div>
  );
}

function AccountLink() {
  const t = useT();
  const { session, profile } = useAccount();
  if (!supabase) return null;
  return session ? (
    <NavLink to="/profile" className={nav}>{profile?.display_name ?? t("nav.profile")}</NavLink>
  ) : (
    <NavLink to="/login" className={nav}>{t("nav.signIn")}</NavLink>
  );
}
