"use client";

/**
 * link block ... the classic inline anchor.
 *
 * plate ships @platejs/link with the hard parts already solved (upsertLink
 * wraps the selected range, url validation, paste-to-link, the "a" inline
 * element normalization), but it deliberately does NOT ship a render
 * component. so we attach our own: a plain <a> styled to nova's golden accent.
 * the plugin injects the href/target onto the element, so this stays a thin
 * wrapper.
 *
 * insertion lives in the bubble toolbar (a link button on a text selection),
 * which captures the slate range before the url prompt and restores it after,
 * so the selection survives the prompt's blur. the public reading view renders
 * its own sanitized <a> ... it never imports this client component.
 */

import { LinkPlugin } from "@platejs/link/react";
import { PlateElement, type PlateElementProps } from "platejs/react";

function LinkElement(props: PlateElementProps) {
  return <PlateElement {...props} as="a" className="np-link" />;
}

export const NovaLinkPlugin = LinkPlugin.withComponent(LinkElement);
