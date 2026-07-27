import { versionLabel } from "@/lib/version";

// The build marker, parked in the top-right corner of the home page.
//
// Hierarchy is the whole design here: this is a diagnostic, not content. It
// wants to be findable when you go looking for it and invisible when you
// aren't, so it's the smallest type in the app, in the muted grey, at 60%
// on top of that — legible if you hold the phone still, not something the eye
// stops on while reading the greeting next to it.
//
// Mono because it's a hash. Proportional digits in a hash make it hard to
// compare against `git log` character by character, which is the one thing
// anyone ever does with it.
//
// It sits absolutely rather than in the flow so it can't push the greeting
// down or reserve a line of its own on a narrow screen. `select-all` because
// the realistic interaction is copying it into a message that says "I'm seeing
// caa57d3, is that what you pushed?" — a single tap grabs the whole string
// instead of a word of it.
//
// Hidden from screen readers: it says nothing about the recipe box, and a
// hash read aloud character by character at the top of every visit would be a
// small cruelty.
export function VersionMarker() {
  return (
    <span
      aria-hidden
      className="pointer-events-auto absolute right-5 top-3 select-all font-mono text-[10px] leading-none text-muted/60"
    >
      {versionLabel()}
    </span>
  );
}
