import { Link, NavLink, Route, Routes } from "react-router-dom";
import { APP_NAME, DISCLAIMER } from "./config";
import Home from "./pages/Home";
import Keys from "./pages/Keys";
import Sandbox from "./pages/Sandbox";

const nav = ({ isActive }: { isActive: boolean }) => (isActive ? "text-text" : "text-sub hover:text-text");

export default function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Link to="/" className="text-xl font-bold tracking-tight">
          <span className="text-accent">▣</span> {APP_NAME}
        </Link>
        <nav className="flex gap-5 text-sm">
          <NavLink to="/" end className={nav}>play</NavLink>
          <NavLink to="/sandbox" className={nav}>sandbox</NavLink>
          <NavLink to="/keys" className={nav}>keys</NavLink>
        </nav>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/keys" element={<Keys />} />
          <Route path="/sandbox" element={<Sandbox />} />
          <Route path="*" element={<p className="py-20 text-center text-sub">404 — nothing in this cell.</p>} />
        </Routes>
      </main>
      <footer className="py-8 text-center text-xs text-sub">
        <p>{DISCLAIMER}</p>
      </footer>
    </div>
  );
}
