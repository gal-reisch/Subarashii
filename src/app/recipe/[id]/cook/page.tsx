import { notFound } from "next/navigation";
import { CookMode } from "@/components/cook/CookMode";
import type { TimerPreset } from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/service";
import { mergeUnclosedParens } from "@/lib/parser/mergeSteps";
import { classifyStepKind } from "@/lib/parser/stepKind";

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: recipe } = await supabase
    .from("recipe")
    .select("id,title,household_id")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) notFound();

  const [{ data: steps }, { data: ingredients }, { data: presets }] = await Promise.all([
    // NOTE: deliberately not filtered by the stored `kind` column in SQL.
    // `kind` is only written at save time, so every recipe saved before the
    // step classifier shipped has `kind = 'instruction'` on all of its rows —
    // including author cross-promotion like "click here for my meringue
    // recipe". Filtering in the database would march the cook through those
    // as if they were real steps. Classifying from the text here instead
    // applies the current rules to old and new recipes alike.
    supabase
      .from("step")
      .select("id,text,detected_timer_seconds")
      .eq("recipe_id", id)
      .order("position"),
    supabase.from("ingredient").select("id,raw_text").eq("recipe_id", id).order("position"),
    supabase
      .from("timer_preset")
      .select("id,label,default_seconds")
      .eq("household_id", recipe.household_id)
      .order("sort_order"),
  ]);

  // Stitch back any step the parser tore in half mid-parenthetical before
  // classifying, so Cook Mode shows the same step list as the detail page.
  const whole = mergeUnclosedParens(
    steps ?? [],
    (s) => s.text,
    (prev, next) => ({
      ...prev,
      text: `${prev.text} ${next.text}`,
      detected_timer_seconds: prev.detected_timer_seconds ?? next.detected_timer_seconds,
    }),
  );

  const instructions = whole.filter((s) => classifyStepKind(s.text) === "instruction");

  return (
    <CookMode
      recipeId={recipe.id}
      title={recipe.title}
      steps={instructions}
      ingredients={ingredients ?? []}
      presets={(presets ?? []) as TimerPreset[]}
    />
  );
}
