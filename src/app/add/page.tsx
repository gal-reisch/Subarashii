import Link from "next/link";
import { AddForm } from "@/components/AddForm";
import { AppHeader } from "@/components/AppHeader";

export default function AddPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-xl px-5 py-6">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back to the box
        </Link>
        <h1 className="mt-4 mb-6 text-3xl font-semibold">Add a recipe</h1>
        <AddForm />
      </main>
    </div>
  );
}
