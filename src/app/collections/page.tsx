import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { createCollectionAction } from "./actions";

interface CollectionRow {
  id: string;
  name: string;
  sort_order: number;
}

export default async function CollectionsPage() {
  const supabase = await createClient();

  const { data: collections } = await supabase
    .from("collection")
    .select("id,name,sort_order")
    .order("sort_order");

  const cols = (collections ?? []) as CollectionRow[];
  const ids = cols.map((c) => c.id);

  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: memberships } = await supabase
      .from("recipe_collection")
      .select("collection_id")
      .in("collection_id", ids);
    for (const m of memberships ?? []) {
      counts.set(m.collection_id, (counts.get(m.collection_id) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-5 py-6">
        <h1 className="text-3xl font-semibold">Shelves</h1>
        <p className="mt-1 text-muted">Group recipes however you like.</p>

        <form action={createCollectionAction} className="mt-5 flex gap-2">
          <input
            name="name"
            placeholder="New shelf name (e.g. Shabbat dinners)"
            required
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink active:scale-95"
          >
            Create
          </button>
        </form>

        {cols.length === 0 ? (
          <p className="mt-10 text-center text-muted">
            No shelves yet — create one above, or add a recipe to a shelf from
            its page.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {cols.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/collections/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 transition active:scale-[0.98]"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm text-muted">
                    {counts.get(c.id) ?? 0}{" "}
                    {(counts.get(c.id) ?? 0) === 1 ? "recipe" : "recipes"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
