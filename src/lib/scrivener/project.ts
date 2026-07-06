// nova press · the mythos · the scrivener project assembler (pure).
//
// given the FILES of a .scriv project (a plain path -> bytes map ... the route
// unzips, this never touches a zip), find the binder, walk the draft, and
// attach each text document's prose (rtf -> paragraphs). the result is a
// clean tree the db import walks: folders become container nodes, text docs
// become leaves with paragraphs. pure + unit-tested against both scrivener 3
// (Files/Data/<UUID>/content.rtf) and scrivener 2 (Files/Docs/<ID>.rtf)
// layouts. every degrade is quiet: a text doc with no rtf on disk imports as
// an empty page rather than sinking the whole project.

import { parseBinder, type BinderItem } from "./binder";
import { rtfToParagraphs } from "./rtf";

export interface ImportedItem {
  title: string;
  isText: boolean;
  paragraphs: string[];
  children: ImportedItem[];
}

export interface ImportedProject {
  title: string;
  items: ImportedItem[];
  /** how many text documents carried prose ... the route reports it. */
  textCount: number;
}

/** decode rtf bytes as latin-1 ... rtf is 7-bit ascii with escaped high bytes,
 *  so a byte-per-char read preserves every escape for the extractor. */
function decodeLatin1(bytes: Uint8Array): string {
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/** find a project file by path suffix, so the zip's root folder name (or its
 *  absence) never matters. */
function findBySuffix(files: ReadonlyMap<string, Uint8Array>, suffix: string): Uint8Array | null {
  const want = suffix.toLowerCase();
  for (const [path, bytes] of files) {
    if (path.toLowerCase().endsWith(want)) return bytes;
  }
  return null;
}

function contentFor(files: ReadonlyMap<string, Uint8Array>, id: string): string[] {
  if (!id) return [];
  // scrivener 3, then scrivener 2.
  const bytes =
    findBySuffix(files, `/data/${id.toLowerCase()}/content.rtf`) ??
    findBySuffix(files, `/docs/${id.toLowerCase()}.rtf`);
  if (!bytes) return [];
  return rtfToParagraphs(decodeLatin1(bytes));
}

function walk(files: ReadonlyMap<string, Uint8Array>, items: BinderItem[]): ImportedItem[] {
  return items.map((item) => ({
    title: item.title.trim() || "untitled",
    isText: item.isText,
    paragraphs: item.isText ? contentFor(files, item.id) : [],
    children: walk(files, item.children),
  }));
}

function countText(items: ImportedItem[]): number {
  let n = 0;
  for (const item of items) {
    if (item.isText) n += 1;
    n += countText(item.children);
  }
  return n;
}

/**
 * assemble the whole import from the project's files. the title comes from
 * the .scrivx filename ("the seventh gate.scrivx" -> "the seventh gate").
 * returns null when no binder is found ... a zip that isn't a scrivener
 * project is a clean refusal, not a crash.
 */
export function assembleScrivenerProject(
  files: ReadonlyMap<string, Uint8Array>,
): ImportedProject | null {
  let scrivxPath: string | null = null;
  for (const path of files.keys()) {
    if (path.toLowerCase().endsWith(".scrivx")) {
      // prefer the shallowest ... a nested template can't shadow the project
      if (!scrivxPath || path.split("/").length < scrivxPath.split("/").length) {
        scrivxPath = path;
      }
    }
  }
  if (!scrivxPath) return null;

  const scrivx = files.get(scrivxPath);
  if (!scrivx) return null;
  const draft = parseBinder(new TextDecoder("utf-8").decode(scrivx));
  if (!draft) return null;

  const base = scrivxPath.split("/").pop() ?? scrivxPath;
  const title = base.replace(/\.scrivx$/i, "").trim() || "an imported manuscript";

  const items = walk(files, draft);
  return { title, items, textCount: countText(items) };
}
