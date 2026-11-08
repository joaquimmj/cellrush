import { Link } from "react-router-dom";
import { APP_TAGLINE } from "../config";

export default function Home() {
  return (
    <section className="py-24 text-center">
      <h1 className="text-3xl font-bold">{APP_TAGLINE}</h1>
      <p className="mt-4 text-sub">The timed game arrives in milestone M3.</p>
      <p className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/sandbox" className="rounded border border-accent px-4 py-2 text-accent hover:bg-accent hover:text-bg">
          Try the sandbox grid →
        </Link>
        <Link to="/keys" className="rounded border border-line px-4 py-2 hover:border-accent hover:text-accent">
          Test which shortcuts your browser lets through →
        </Link>
      </p>
    </section>
  );
}
