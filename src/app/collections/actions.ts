"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getHouseholdId } from "@/lib/recipes";
import { createServiceClient } from "@/lib/supabase/service";

// No per-user auth check anymore (task #24 PIN-auth migration) — the proxy
// already gates every non-public route behind the shared-PIN session cookie,
// so any Server Action reachable from the UI is already behind that gate.
async function requireHousehold() {
  const supabase = createServiceClient();
  const householdId = await getHouseholdId(supabase);
  if (!householdId) throw new Error("No household found");
  return { supabase, householdId };
}

// Create a new shelf. If a recipe_id is included (called from the recipe
// page's "add to collection" panel), the recipe is added to it immediately —
// "create and file" in one tap instead of two.
export async function createCollectionAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { supabase, householdId } = await requireHousehold();

  const { data: maxRow } = await supabase
    .from("collection")
    .select("sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: created, error } = await supabase
    .from("collection")
    .insert({ household_id: householdId, name, sort_order: nextOrder })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to create collection");

  const recipeId = String(formData.get("recipe_id") ?? "");
  if (recipeId) {
    await supabase
      .from("recipe_collection")
      .insert({ recipe_id: recipeId, collection_id: created.id });
    revalidatePath(`/recipe/${recipeId}`);
  }

  revalidatePath("/collections");
}

export async function renameCollectionAction(formData: FormData) {
  const id = String(formData.get("collection_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const { supabase } = await requireHousehold();
  await supabase.from("collection").update({ name }).eq("id", id);
  revalidatePath("/collections");
  revalidatePath(`/collections/${id}`);
}

export async function deleteCollectionAction(formData: FormData) {
  const id = String(formData.get("collection_id") ?? "");
  if (!id) return;

  const { supabase } = await requireHousehold();
  await supabase.from("collection").delete().eq("id", id);
  revalidatePath("/collections");
  redirect("/collections");
}

// Toggle a recipe's membership in one collection. Rendered as one small
// <form> per collection row on the recipe page, so it works with plain
// submits (progressive enhancement) instead of needing client JS.
export async function toggleRecipeInCollectionAction(formData: FormData) {
  const recipeId = String(formData.get("recipe_id") ?? "");
  const collectionId = String(formData.get("collection_id") ?? "");
  const isMember = formData.get("is_member") === "true";
  if (!recipeId || !collectionId) return;

  const { supabase } = await requireHousehold();
  if (isMember) {
    await supabase
      .from("recipe_collection")
      .delete()
      .eq("recipe_id", recipeId)
      .eq("collection_id", collectionId);
  } else {
    await supabase
      .from("recipe_collection")
      .insert({ recipe_id: recipeId, collection_id: collectionId });
  }
  revalidatePath(`/recipe/${recipeId}`);
  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
}

export async function removeRecipeFromCollectionAction(formData: FormData) {
  const recipeId = String(formData.get("recipe_id") ?? "");
  const collectionId = String(formData.get("collection_id") ?? "");
  if (!recipeId || !collectionId) return;

  const { supabase } = await requireHousehold();
  await supabase
    .from("recipe_collection")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("collection_id", collectionId);
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/collections");
}
