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
      <div className="mt-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search recipes…"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
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
            className="rounded-full px-3 py-2 text-sm font-semibold text-muted underline-offset-2 hover:underline"
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
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
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
      className={`rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-border bg-card text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function RecipeCard({ recipe }: { recipe: CardRecipe }) {
  return (
    <Link
      href={`/recipe/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition active:scale-[0.98]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-accent/10">
        {recipe.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-accent/50">
            {recipe.title.charAt(0).toUpperCase()}
          </div>
        )}
        {recipe.needs_review && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-accent">
            Needs review
          </span>
        )}
      </div>
      <div className="p-3">
        <p
          dir={dirFor(recipe.title)}
          className="line-clamp-2 text-sm font-semibold leading-snug"
        >
          {recipe.title}
        </p>
        {recipe.total_time_min && (
          <p className="mt-1 text-xs text-muted">{recipe.total_time_min} min</p>
        )}
      </div>
    </Link>
  );
}
