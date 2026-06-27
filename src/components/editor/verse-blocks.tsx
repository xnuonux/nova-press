"use client";

/**
 * verse blocks ... poetry, kept flat like the lists.
 *
 * a poem is a run of sibling "verse_line" blocks, one line each (mirroring the
 * flat ul_li / ol_li model rather than a nested verse/stanza tree, so it never
 * fights slate's tab handling or the classic literal-tab indent). the slash menu
 * toggles a paragraph into a verse line with the same toggleBlock path the
 * headings + lists use; enter splits into the next verse line; enter on an empty
 * verse line leaves the poem (back to a paragraph), exactly like a list item. a
 * stanza is a grouping the reading view + the verse lenses derive (groupVerse):
 * a run of lines, broken by an empty line or a blank paragraph between runs.
 *
 * the block carries its own render component so the line paints in the editable;
 * the verse treatment (preserved breaks, tighter measure) is drawn in css off
 * the block class, so the dom stays a plain div and nothing fights the caret.
 */

import { createPlatePlugin, PlateElement, type PlateElementProps } from "platejs/react";

function VerseLine(props: PlateElementProps) {
  return <PlateElement {...props} as="div" className="np-verse-line" />;
}

export const VerseLinePlugin = createPlatePlugin({
  key: "verse_line",
  node: { isElement: true },
}).withComponent(VerseLine);
