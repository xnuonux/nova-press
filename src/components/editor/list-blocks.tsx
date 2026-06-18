"use client";

/**
 * list blocks ... the classic bulleted + numbered list, kept deliberately flat.
 *
 * rather than nested ul/ol element trees (which fight slate's tab handling and
 * the classic literal-tab indent nova keeps), a list is just a run of sibling
 * blocks: "ul_li" for a bullet, "ol_li" for a number. the slash menu toggles a
 * paragraph into one with the same toggleBlock path the headings already use,
 * pressing enter splits into another item of the same kind, and the reading
 * view (groupBodyBlocks) stitches consecutive items back into real ul/ol.
 *
 * each plugin carries its own render component so the item actually paints in
 * the editable ... the marker itself is drawn in css off the block class, so
 * the dom stays a plain div and the caret never lands on a bullet.
 */

import { createPlatePlugin, PlateElement, type PlateElementProps } from "platejs/react";

function BulletItem(props: PlateElementProps) {
  return <PlateElement {...props} as="div" className="np-li np-li-bullet" />;
}

function NumberItem(props: PlateElementProps) {
  return <PlateElement {...props} as="div" className="np-li np-li-number" />;
}

export const BulletItemPlugin = createPlatePlugin({
  key: "ul_li",
  node: { isElement: true },
}).withComponent(BulletItem);

export const NumberItemPlugin = createPlatePlugin({
  key: "ol_li",
  node: { isElement: true },
}).withComponent(NumberItem);
