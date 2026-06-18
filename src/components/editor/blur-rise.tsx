"use client";

/**
 * blur-rise ... the words come into focus as you write them.
 *
 * the just-typed character renders blurred + dim for a beat, then sharpens to
 * full ink. it's a per-character entrance, premium and quiet, the editor's
 * answer to "the page is alive".
 *
 * the trap this dodges (see memory plate-v49-decorations): a render-ONLY leaf
 * effect must NOT be written into the saved value. so it's a slate DECORATION,
 * never a mark ... decorate tags the one char behind the collapsed caret with
 * `fresh: true`, which lives only at render time and never reaches
 * editor.children. the leaf is routed to a component the standard mark way
 * (isLeaf + withComponent, the combination the first attempt never tried), which
 * applies a css class; the animation does the rest. decorations carry no slate
 * operation, so the shell's set_selection gate skips the re-render they cause and
 * there's no update loop.
 *
 * reduced-motion is honored globally (globals.css zeroes animation durations).
 */

import { createPlatePlugin, PlateLeaf, type PlateLeafProps } from "platejs/react";

function FreshLeaf(props: PlateLeafProps) {
  // only leaves the decoration tagged `fresh` are routed here, so the class is
  // unconditional ... the routing is the gate.
  return <PlateLeaf {...props} className="np-fresh" />;
}

export const BlurRisePlugin = createPlatePlugin({
  key: "fresh",
  node: { isLeaf: true },
  decorate: ({ editor, entry }) => {
    const [, path] = entry;
    const sel = editor.selection;
    if (!sel) return [];
    // collapsed caret only ... a real selection isn't active typing.
    if (sel.anchor.offset !== sel.focus.offset) return [];
    if (sel.anchor.path.join() !== sel.focus.path.join()) return [];
    const offset = sel.anchor.offset;
    if (offset < 1) return [];
    // is the caret inside this very text node? then tag the char behind it.
    if (sel.anchor.path.join() !== path.join()) return [];
    return [
      {
        anchor: { path, offset: offset - 1 },
        focus: { path, offset },
        fresh: true,
      },
    ];
  },
}).withComponent(FreshLeaf);
