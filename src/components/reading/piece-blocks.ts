/**
 * reading-view block grouping ... pure, no react, no dom.
 *
 * the editor stores lists as a flat run of list-item blocks (type "ul_li" for
 * bulleted, "ol_li" for numbered) rather than nested ul/ol element trees. that
 * keeps the editor model simple and never fights the classic tab-indent. but
 * the magazine reading view wants real semantic lists, so this walks the stored
 * value and collapses each consecutive run of same-kind items into one list
 * group. everything else passes through as a plain block, in order.
 *
 * kept pure (returns plain descriptors, no jsx) so the published artifact ...
 * nova's wedge ... is unit-tested headless, with zero browser in the loop.
 */

export const BULLET_ITEM = "ul_li";
export const NUMBER_ITEM = "ol_li";
export const VERSE_LINE = "verse_line";

export interface BodyBlock {
  type?: string;
  children?: unknown;
}

export interface ListItem {
  block: BodyBlock;
  index: number;
}

export type RenderGroup =
  | { kind: "block"; block: BodyBlock; index: number }
  | { kind: "list"; ordered: boolean; items: ListItem[] }
  // a poem ... a run of consecutive verse_line blocks. the lines render as a
  // verse block (preserved breaks); an empty line inside the run reads as a
  // stanza gap. multiple stanzas = multiple runs (this matches the verse lenses'
  // line-level grouping, so a form-shape finding's blockIndex lands on the line
  // the reader sees).
  | { kind: "verse"; items: ListItem[] };

export function isListType(type: unknown): boolean {
  return type === BULLET_ITEM || type === NUMBER_ITEM;
}

/**
 * collapse a stored plate value into ordered render groups. consecutive items
 * of the same kind merge into one list; a gap (any non-item block, or a switch
 * between bulleted and numbered) starts a fresh list. total over garbage: a
 * non-array degrades to no groups, a malformed entry degrades to {}.
 */
export function groupBodyBlocks(value: unknown): RenderGroup[] {
  if (!Array.isArray(value)) return [];
  const groups: RenderGroup[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const block = (value[i] ?? {}) as BodyBlock;
    if (block.type === BULLET_ITEM || block.type === NUMBER_ITEM) {
      const ordered = block.type === NUMBER_ITEM;
      const last = groups[groups.length - 1];
      if (last && last.kind === "list" && last.ordered === ordered) {
        last.items.push({ block, index: i });
      } else {
        groups.push({ kind: "list", ordered, items: [{ block, index: i }] });
      }
    } else if (block.type === VERSE_LINE) {
      const last = groups[groups.length - 1];
      if (last && last.kind === "verse") {
        last.items.push({ block, index: i });
      } else {
        groups.push({ kind: "verse", items: [{ block, index: i }] });
      }
    } else {
      groups.push({ kind: "block", block, index: i });
    }
  }
  return groups;
}
