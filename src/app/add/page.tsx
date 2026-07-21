import { BackButton } from "@/components/BackButton";
import { AddForm } from "@/components/AddForm";
import { BottomNav } from "@/components/BottomNav";

export default function AddPage() {
  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-xl px-5 pb-32 pt-6">
        <BackButton href="/" />
        <h1 className="mt-4 mb-6 text-3xl">Add a recipe</h1>
        <AddForm />
      </main>
      <BottomNav />
    </div>
  );
}
