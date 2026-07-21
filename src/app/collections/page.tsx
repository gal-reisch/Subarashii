import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
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
      <main className="mx-auto max-w-2xl px-5 pb-32 pt-8">
        <h1 className="text-3xl">Shelves</h1>
        <p className="mt-1 text-muted">Group recipes however you like.</p>

        <form action={createCollectionAction} className="mt-5 flex gap-2">
          <input
            name="name"
            placeholder="New shelf name (e.g. Shabbat dinners)"
            required
            className="flex-1 rounded-2xl bg-card px-4 py-3 text-base shadow-[0px_6px_20px_rgba(0,0,0,0.05)] outline-none focus:shadow-[0px_0px_0px_2px_var(--accent)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-2xl bg-accent px-5 py-3 font-bold text-accent-ink shadow-[0px_10px_24px_rgba(191,74,26,0.4)] active:scale-95"
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
          <ul className="mt-6 space-y-3">
            {cols.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/collections/${c.id}`}
                  className="flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-[0px_10px_30px_rgba(0,0,0,0.06)] transition active:scale-[0.98]"
                >
                  <span className="font-bold">{c.name}</span>
                  <span className="text-sm font-semibold text-accent">
                    {counts.get(c.id) ?? 0}{" "}
                    {(counts.get(c.id) ?? 0) === 1 ? "recipe" : "recipes"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
