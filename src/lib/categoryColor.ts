// Card skin (body background, label/title color, footer stat pill) for each
// recipe category, drawn from the 6-family color ramp in the user's Figma
// palette. Purely decorative/organizational — NOT the same system as the
// nutrition chips' protein/fat/sugar/fiber colors (--cat-*-bg/-text tokens),
// which carry a fixed nutrient-type meaning and must never be touched here.
//
// Color assignment is a deliberate one-to-one mapping between the six
// semantic buckets in `@/lib/category` and the six Figma color families,
// chosen so the hue reads as the food it represents:
//
//   meat    → rust    (browned/seared warm brown-orange)
//   fish    → blue    (sea)
//   veggie  → olive   (green)
//   pastry  → amber   (golden baked crust)
//   dessert → purple  (sweet/confection)
//   general → teal    (reserved neutral for anything uncategorized)
//
// "general" holding its own dedicated family is the point, not an accident:
// uncategorized recipes stay visually consistent with each other instead of
// borrowing a food color they don't belong to.

import type { RecipeCategory } from "./category";

// Complete, literal Tailwind class strings per category — never assemble
// these via template-string interpolation at a call site. Tailwind v4 has
// no `tailwind.config` content array in this repo (it scans source files
// for whole class-name tokens), so a dynamically-built class name like
// `bg-recipe-cat-${family}-light` would silently fail to generate any CSS.
export interface CategoryStyle {
  /** Card body background (family's "light" tone). */
  cardBg: string;
  /** Category label text color (family's "dark" tone). */
  labelText: string;
  /** Recipe title text color (family's "dark" tone). */
  titleText: string;
  /** Footer stat pill background (family's "mid" tone). */
  pillBg: string;
  /** Footer stat pill text (family's "pale" tone). */
  pillText: string;
  /** Filter-chip accent when that category's chip is active (family's "mid" tone). */
  chipActive: string;
  /** The card body's background as a *text* color, so the SVG tab drawn over
   *  the photo can fill with `currentColor` and match the body exactly.
   *  Same tone as cardBg — a `text-` utility rather than a `bg-` one. */
  waveFill: string;
}

export const CATEGORY_STYLES: Record<RecipeCategory, CategoryStyle> = {
  meat: {
    cardBg: "bg-recipe-cat-rust-light",
    labelText: "text-recipe-cat-rust-dark",
    titleText: "text-recipe-cat-rust-dark",
    pillBg: "bg-recipe-cat-rust-mid",
    pillText: "text-recipe-cat-rust-pale",
    chipActive: "text-recipe-cat-rust-dark",
    waveFill: "text-recipe-cat-rust-light",
  },
  fish: {
    cardBg: "bg-recipe-cat-blue-light",
    labelText: "text-recipe-cat-blue-dark",
    titleText: "text-recipe-cat-blue-dark",
    pillBg: "bg-recipe-cat-blue-mid",
    pillText: "text-recipe-cat-blue-pale",
    chipActive: "text-recipe-cat-blue-dark",
    waveFill: "text-recipe-cat-blue-light",
  },
  veggie: {
    cardBg: "bg-recipe-cat-olive-light",
    labelText: "text-recipe-cat-olive-dark",
    titleText: "text-recipe-cat-olive-dark",
    pillBg: "bg-recipe-cat-olive-mid",
    pillText: "text-recipe-cat-olive-pale",
    chipActive: "text-recipe-cat-olive-dark",
    waveFill: "text-recipe-cat-olive-light",
  },
  pastry: {
    cardBg: "bg-recipe-cat-amber-light",
    labelText: "text-recipe-cat-amber-dark",
    titleText: "text-recipe-cat-amber-dark",
    pillBg: "bg-recipe-cat-amber-mid",
    pillText: "text-recipe-cat-amber-pale",
    chipActive: "text-recipe-cat-amber-dark",
    waveFill: "text-recipe-cat-amber-light",
  },
  dessert: {
    cardBg: "bg-recipe-cat-purple-light",
    labelText: "text-recipe-cat-purple-dark",
    titleText: "text-recipe-cat-purple-dark",
    pillBg: "bg-recipe-cat-purple-mid",
    pillText: "text-recipe-cat-purple-pale",
    chipActive: "text-recipe-cat-purple-dark",
    waveFill: "text-recipe-cat-purple-light",
  },
  general: {
    cardBg: "bg-recipe-cat-teal-light",
    labelText: "text-recipe-cat-teal-dark",
    titleText: "text-recipe-cat-teal-dark",
    pillBg: "bg-recipe-cat-teal-mid",
    pillText: "text-recipe-cat-teal-pale",
    chipActive: "text-recipe-cat-teal-dark",
    waveFill: "text-recipe-cat-teal-light",
  },
};
