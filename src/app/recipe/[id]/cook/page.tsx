import { notFound } from "next/navigation";
import { CookMode } from "@/components/cook/CookMode";
import type { TimerPreset } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipe")
    .select("id,title,household_id")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) notFound();

  const [{ data: steps }, { data: ingredients }, { data: presets }] = await Promise.all([
    supabase
      .from("step")
      .select("id,text,detected_timer_seconds")
      .eq("recipe_id", id)
      .eq("kind", "instruction")
      .order("position"),
    supabase.from("ingredient").select("id,raw_text").eq("recipe_id", id).order("position"),
    supabase
      .from("timer_preset")
      .select("id,label,default_seconds")
      .eq("household_id", recipe.household_id)
      .order("sort_order"),
  ]);

  return (
    <CookMode
      recipeId={recipe.id}
      title={recipe.title}
      steps={steps ?? []}
      ingredients={ingredients ?? []}
      presets={(presets ?? []) as TimerPreset[]}
    />
  );
}
