"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dirFor } from "@/lib/lang";

export interface CardRecipe {
  id: string;
  title: string;
  cover_image_url: string | null;
  source_type: string;
  needs_review: boolean;
  total_time_min: number | null;
  cuisine: string | null;
}

type TimeFilter = "any" | "30" | "60" | "60+";

// Client-side search + quick filters over the already-fetched recipe list.
// Kept simple on purpose: the box is meant to stay small (a personal
// collection, not a public catalog), so no server round-trip is needed —
// filtering an array in memory is instant and works offline-ish in a PWA.
export function RecipeBrowser({ recipes }: { recipes: CardRecipe[] }) {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [time, setTime] = useState<TimeFilter>("any");

  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) if (r.cuisine) set.add(r.cuisine);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (time !== "any") {
        const t = r.total_time_min;
        if (t == null) return false;
        if (time === "30" && !(t <= 30)) return false;
        if (time === "60" && !(t > 30 && t <= 60)) return false;
        if (time === "60+" && !(t > 60)) return false;
      }
      return true;
    });
  }, [recipes, query, cuisine, time]);

  const filtersActive = query.trim() !== "" || cuisine !== null || time !== "any";

  return (
    <div>
      <div className="mt-6 flex items-center gap-3 rounded-full bg-card px-5 py-3.5 shadow-[0px_10px_30px_rgba(0,0,0,0.06)]">
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted/70"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
        <FilterChip active={time === "30"} onClick={() => setTime((t) => (t === "30" ? "any" : "30"))}>
          ≤ 30 min
        </FilterChip>
        <FilterChip active={time === "60"} onClick={() => setTime((t) => (t === "60" ? "any" : "60"))}>
          30–60 min
        </FilterChip>
        <FilterChip active={time === "60+"} onClick={() => setTime((t) => (t === "60+" ? "any" : "60+"))}>
          60+ min
        </FilterChip>
        {cuisines.map((c) => (
          <FilterChip
            key={c}
            active={cuisine === c}
            onClick={() => setCuisine((cur) => (cur === c ? null : c))}
          >
            {c}
          </FilterChip>
        ))}
        {filtersActive && (
          <button
            onClick={() => {
              setQuery("");
              setCuisine(null);
              setTime("any");
            }}
            className="text-sm font-semibold text-muted underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-4 text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-muted">No recipes match your search.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-5">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-1 text-[15px] font-semibold transition active:scale-95 ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-0.5 h-[3px] rounded-full bg-accent" />
      )}
    </button>
  );
}

function RecipeCard({ recipe }: { recipe: CardRecipe }) {
  return (
    <Link
      href={`/recipe/${recipe.id}`}
      className="group flex flex-col items-center rounded-[28px] bg-card px-4 pb-4 pt-6 text-center shadow-[0px_16px_40px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-accent/10">
        {recipe.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-accent/50">
            {recipe.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {recipe.needs_review && (
        <span className="mt-2 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn-text">
          Needs review
        </span>
      )}
      <p
        dir={dirFor(recipe.title)}
        className="mt-3 line-clamp-2 text-[15px] font-bold leading-snug"
      >
        {recipe.title}
      </p>
      {recipe.total_time_min && (
        <p className="mt-1 text-sm font-bold text-accent">{recipe.total_time_min} min</p>
      )}
    </Link>
  );
}
