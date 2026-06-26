// nova press · the mythos · the form system types.
//
// a "form profile" is the only place that knows what a sonnet is. the
// database stores a universal tree (np_nodes); the registry below maps any
// form onto that one tree, sets its constraints (advisory lenses, never db
// checks), and lists its export targets. adding a villanelle or a recipe is
// one object literal in registry.ts, never a migration.

import type { FormFamily, PieceKind } from "../../types/works";

/** the form vocabulary. one key per form profile. */
export type FormProfileKey =
  | "prose"
  | "essay"
  | "article"
  | "newsletter"
  | "short_story"
  | "novella"
  | "novel"
  | "series"
  | "haiku"
  | "sonnet"
  | "free_verse"
  | "encyclopaedia"
  | "conlang"
  | "dictionary"
  | "screenplay";

/** which node_type lives at a level of the tree, and what may nest under it. */
export interface NodeLevelSpec {
  nodeType: string;
  label: string;
  /** the node_types allowed as children. an empty list marks a leaf level. */
  allowedChildTypes: string[];
  isLeaf?: boolean;
  defaultPieceKind?: PieceKind;
}

export interface RecordFieldSpec {
  key: string;
  label: string;
  type: "text" | "richtext" | "ipa" | "number" | "list" | "ref" | "enum";
  required?: boolean;
  options?: string[];
  repeat?: boolean;
}

/** the shape of a typed record-leaf (a lexeme, an infobox, a character sheet). */
export interface RecordSchema {
  fields: RecordFieldSpec[];
}

/**
 * an advisory craft constraint ... a lens, NOT a db check, NOT a save-blocker.
 * a haiku that is not 5-7-5 still saves; the lens surfaces a descriptive
 * finding (a mirror, never a verdict). the deterministic engines that produce
 * the metrics these read (scansion, rhyme keys) land in a later phase; the
 * constraint metadata + the structural checks ship now.
 */
export type FormConstraint =
  | { kind: "line_count"; lines: number; scope: "leaf" | "stanza"; note?: string }
  | { kind: "syllable_pattern"; pattern: number[]; note?: string }
  | { kind: "stanza_count"; stanzas: number; note?: string }
  | { kind: "line_length_range"; min?: number; max?: number; note?: string }
  | { kind: "rhyme_scheme"; scheme: string; note?: string }
  | {
      kind: "meter";
      foot: "iamb" | "trochee" | "anapest" | "dactyl" | "spondee";
      perLine: number;
      note?: string;
    }
  | { kind: "volta"; afterLine: number; note?: string }
  | { kind: "refrain"; lines: number[]; note?: string }
  | { kind: "target_word_count"; words: number; scope: "leaf" | "work"; note?: string }
  | { kind: "required_record_fields"; fields: string[]; note?: string };

export type ExportTarget =
  | "web"
  | "newsletter"
  | "epub"
  | "pdf_print"
  | "pdf_dictionary"
  | "docx"
  | "markdown"
  | "fountain";

/** a node scaffolded at Work creation (a sonnet's line slots, a novel's acts). */
export interface NodeSeed {
  nodeType: string;
  title: string;
  isLeaf?: boolean;
  pieceKind?: PieceKind;
  children?: NodeSeed[];
}

/** the only place form knowledge lives. */
export interface FormProfile {
  key: FormProfileKey;
  label: string;
  family: FormFamily;
  /** a lucide icon name for the binder. */
  binderIcon: string;
  summary: string;
  tree: {
    rootType: string;
    levels: NodeLevelSpec[];
    maxDepth: number;
  };
  leaf: {
    content: "prose" | "verse" | "record" | "record_prose";
    pieceKind: PieceKind;
    recordSchema?: RecordSchema;
  };
  /** advisory craft lenses. */
  constraints: FormConstraint[];
  exports: ExportTarget[];
  /** scaffolded into the tree when the Work is created. */
  skeleton?: NodeSeed[];
}
