// nova press · the mythos · the scrivener binder parser (pure).
//
// a .scriv project's spine is one xml file (the .scrivx): a tree of
// BinderItem nodes ... folders and text documents, in manuscript order. this
// reads that tree with fast-xml-parser and hands back a plain structure the
// import can walk. scrivener 3 identifies items by UUID (content lives at
// Files/Data/<UUID>/content.rtf); scrivener 2 by ID (Files/Docs/<ID>.rtf) ...
// both attrs are kept so the project reader can try either path.
//
// only the draft matters: the DraftFolder (the manuscript) is the book; the
// research / trash / templates folders never import.

import { XMLParser } from "fast-xml-parser";

export interface BinderItem {
  /** scrivener 3's UUID or scrivener 2's numeric ID ... whichever the file had. */
  id: string;
  title: string;
  /** a folder holds structure; a text doc holds prose. anything else (research
   *  aliases, pdfs) is carried as a folder-ish shell so its children survive. */
  isText: boolean;
  children: BinderItem[];
}

interface RawItem {
  [key: string]: unknown;
  Title?: unknown;
  Children?: { BinderItem?: unknown };
}

function asArray(value: unknown): RawItem[] {
  if (Array.isArray(value)) return value as RawItem[];
  if (value && typeof value === "object") return [value as RawItem];
  return [];
}

function attr(item: RawItem, name: string): string {
  const v = item[`@_${name}`];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function mapItem(item: RawItem): BinderItem {
  const type = attr(item, "Type");
  return {
    id: attr(item, "UUID") || attr(item, "ID"),
    title: typeof item.Title === "string" ? item.Title : String(item.Title ?? ""),
    isText: type === "Text",
    children: asArray(item.Children?.BinderItem).map(mapItem),
  };
}

/**
 * parse a .scrivx document and return the DRAFT tree (the manuscript's
 * children, in order). a file that isn't a scrivener binder, or one with no
 * draft folder, returns null ... the route turns that into a clean 400,
 * never a crash.
 */
export function parseBinder(scrivx: string): BinderItem[] | null {
  let doc: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      // titles are text ... never coerce "1984" into a number
      parseTagValue: false,
      parseAttributeValue: false,
    });
    doc = parser.parse(scrivx);
  } catch {
    return null;
  }

  const project = (doc as { ScrivenerProject?: { Binder?: { BinderItem?: unknown } } })
    .ScrivenerProject;
  if (!project?.Binder) return null;

  const roots = asArray(project.Binder.BinderItem);
  const draft = roots.find((r) => {
    const type = attr(r, "Type");
    return type === "DraftFolder" || type === "Draft";
  });
  if (!draft) return null;

  return asArray(draft.Children?.BinderItem).map(mapItem);
}
