import type { Lang } from "./lang";
import type { StepKind } from "./parser/stepKind";

export type SourceType =
  | "blog"
  | "instagram"
  | "tiktok"
  | "screenshot"
  | "manual"
  | "other";

export interface ParsedIngredient {
  raw_text: string;
  language: Lang;
}

export interface ParsedStep {
  text: string;
  detected_timer_seconds: number | null;
  kind: StepKind;
}

// Normalized shape produced by every capture path before it is saved.
export interface ParsedRecipe {
  title: string;
  source_url: string | null;
  source_type: SourceType;
  cover_image_url: string | null;
  servings: number | null;
  total_time_min: number | null;
  cuisine: string | null;
  primary_language: Lang | null;
  ingredients: ParsedIngredient[];
  steps: ParsedStep[];
  needs_review: boolean;
  raw_capture: string | null;
}

export interface TimerPreset {
  id: string;
  label: string;
  default_seconds: number;
}

// A saved recipe row plus its children (for detail views).
export interface RecipeRow {
  id: string;
  household_id: string;
  title: string;
  source_url: string | null;
  source_type: SourceType;
  cover_image_url: string | null;
  servings: number | null;
  total_time_min: number | null;
  cuisine: string | null;
  primary_language: Lang | null;
  status: "to_try" | "made";
  needs_review: boolean;
  notes: string | null;
  created_at: string;
}
