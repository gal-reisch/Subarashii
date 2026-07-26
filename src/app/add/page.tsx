import { BackButton } from "@/components/BackButton";
import { AddForm } from "@/components/AddForm";
import { BottomNav } from "@/components/BottomNav";

const TABS = ["link", "photo", "manual"] as const;
type Tab = (typeof TABS)[number];

// `searchParams` is a Promise in this version — the failing add actions
// redirect back here with `?tab=…&error=…` so the user lands on the tab they
// were using, with the reason shown, instead of on a blank default form.
export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { tab, error } = await searchParams;
  const initialTab = TABS.includes(tab as Tab) ? (tab as Tab) : "link";

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-xl px-5 pb-32 pt-6">
        <BackButton href="/" />
        <h1 className="mt-4 mb-6 text-3xl">Add a recipe</h1>
        <AddForm initialTab={initialTab} error={error} />
      </main>
      <BottomNav />
    </div>
  );
}
