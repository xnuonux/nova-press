// nova press · the mythos · the docx arm of the io spine (word in + out).
//
// Slate/Plate JSON stays the single source of truth. OUT: a piece or a whole
// Work -> a real .docx, built block-for-block off the Slate value with the
// `docx` lib (headings, the basic marks, blockquote, hr, ul/ol, links). IN: a
// .docx -> Slate, by letting `mammoth` lift the document to markdown and reusing
// the existing markdownToSlate hub, so word import rides the same one converter
// every other format does. pure-ish (no server-only): the routes are the server
// boundary; these are just transforms, unit-tested.

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import mammoth from "mammoth";
import type { Value } from "platejs";

import { coercePlateValue } from "@/components/editor/plate-text";
import { isSafeHref } from "@/components/reading/sanitize-href";
import { markdownToSlate } from "./markdown";

const OL_REF = "np-ordered";

interface Leaf {
  text?: unknown;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

function textRun(leaf: Leaf): TextRun {
  return new TextRun({
    text: typeof leaf.text === "string" ? leaf.text : "",
    bold: leaf.bold === true,
    italics: leaf.italic === true,
    underline: leaf.underline === true ? {} : undefined,
    strike: leaf.strikethrough === true,
    ...(leaf.code === true ? { font: "Courier New" } : {}),
  });
}

// a block's children -> docx runs. an inline link becomes an ExternalHyperlink
// (only for a safe url; otherwise the words survive, the wrapper is dropped).
function runsFromChildren(children: unknown): (TextRun | ExternalHyperlink)[] {
  if (!Array.isArray(children)) return [];
  const runs: (TextRun | ExternalHyperlink)[] = [];
  for (const child of children) {
    const node = (child ?? {}) as { type?: unknown; url?: unknown; children?: unknown };
    if (typeof node.type === "string") {
      const inner = leafRuns(node.children);
      if (node.type === "a" && isSafeHref(node.url)) {
        runs.push(new ExternalHyperlink({ children: inner, link: node.url as string }));
      } else {
        runs.push(...inner);
      }
      continue;
    }
    runs.push(textRun(node as Leaf));
  }
  return runs;
}

// a link's children are always leaves (no nested inline elements), so they map
// to plain TextRuns ... an ExternalHyperlink only accepts runs.
function leafRuns(children: unknown): TextRun[] {
  if (!Array.isArray(children)) return [];
  return children.map((c) => textRun((c ?? {}) as Leaf));
}

function headingForDepth(depth: number) {
  if (depth <= 0) return HeadingLevel.HEADING_1;
  if (depth === 1) return HeadingLevel.HEADING_2;
  if (depth === 2) return HeadingLevel.HEADING_3;
  if (depth === 3) return HeadingLevel.HEADING_4;
  return HeadingLevel.HEADING_5;
}

// carried while appending blocks: the base depth body headings shift to (so a
// leaf's h1 never outranks the section heading above it), and the ordered-list
// run state (a fresh concrete `instance` per list, so each ol restarts at 1).
interface AppendState {
  headingShift: number;
  olInstance: number;
  prevOl: boolean;
}

// one Slate block -> one docx Paragraph. headings shift by the section depth;
// lists + blockquote + hr map to their native docx shape; else a plain paragraph.
function paragraphFromBlock(
  block: { type?: string; children?: unknown },
  state: AppendState,
): Paragraph {
  const children = runsFromChildren(block.children);
  switch (block.type) {
    case "h1":
      return new Paragraph({ children, heading: headingForDepth(state.headingShift) });
    case "h2":
      return new Paragraph({ children, heading: headingForDepth(state.headingShift + 1) });
    case "h3":
      return new Paragraph({ children, heading: headingForDepth(state.headingShift + 2) });
    case "blockquote":
      return new Paragraph({ children, indent: { left: 720 } });
    case "hr":
      return new Paragraph({ thematicBreak: true });
    case "ul_li":
      return new Paragraph({ children, bullet: { level: 0 } });
    case "ol_li":
      return new Paragraph({
        children,
        numbering: { reference: OL_REF, level: 0, instance: state.olInstance },
      });
    default:
      return new Paragraph({ children });
  }
}

// append a Slate value's blocks, advancing the ordered-list instance whenever a
// new ol run begins (so two separate lists don't number continuously).
function appendBlocks(out: Paragraph[], value: Value, state: AppendState): void {
  if (!Array.isArray(value)) return;
  for (const node of value) {
    const block = (node ?? {}) as { type?: string; children?: unknown };
    if (block.type === "ol_li") {
      if (!state.prevOl) state.olInstance += 1;
      state.prevOl = true;
    } else {
      state.prevOl = false;
    }
    out.push(paragraphFromBlock(block, state));
  }
}

function titleParagraph(title: string, heading = HeadingLevel.TITLE): Paragraph {
  return new Paragraph({ text: title, heading });
}

function buildDocument(children: Paragraph[]): Document {
  return new Document({
    numbering: {
      config: [
        {
          reference: OL_REF,
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
}

/** a single piece's Slate Value -> a .docx buffer, with the title as the doc heading. */
export async function slateToDocx(value: Value, title?: string): Promise<Buffer> {
  const state: AppendState = { headingShift: 0, olInstance: -1, prevOl: false };
  const body: Paragraph[] = [];
  appendBlocks(body, coercePlateValue(value), state);
  const children = title && title.trim() ? [titleParagraph(title.trim()), ...body] : body;
  return Packer.toBuffer(buildDocument(children.length > 0 ? children : [new Paragraph({})]));
}

/** a reading section for the work-level docx (a leaf carries its body jsonb). */
export interface DocxWorkSection {
  title: string;
  depth: number;
  isLeaf: boolean;
  body: unknown;
}

/** a whole Work -> a .docx: the work title, then each section in reading order
 *  (a container is a heading; a leaf is its heading + its prose). */
export async function sectionsToDocx(
  title: string,
  sections: readonly DocxWorkSection[],
): Promise<Buffer> {
  const children: Paragraph[] = [titleParagraph(title.trim() || "untitled")];
  // one state across the whole document: ordered lists keep distinct instances
  // across leaves, and each leaf's body headings shift below its own heading.
  const state: AppendState = { headingShift: 0, olInstance: -1, prevOl: false };
  for (const s of sections) {
    children.push(new Paragraph({ text: s.title, heading: headingForDepth(s.depth) }));
    state.prevOl = false; // a structural heading ends any open list run
    if (s.isLeaf) {
      state.headingShift = s.depth + 1; // a leaf's body sits one level below its title
      appendBlocks(children, coercePlateValue(s.body), state);
    }
  }
  return Packer.toBuffer(buildDocument(children));
}

/** a .docx buffer -> a Slate Value, via mammoth (docx -> markdown) + the existing
 *  markdown hub. a valid-but-empty doc degrades to an empty value; a corrupt /
 *  non-docx buffer throws (mammoth rejects), which the import route maps to a 502. */
export async function docxToSlate(buffer: Buffer): Promise<Value> {
  const result = await mammoth.convertToMarkdown({ buffer });
  return markdownToSlate(result.value ?? "");
}
