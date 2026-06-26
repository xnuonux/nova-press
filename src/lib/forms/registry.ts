// nova press · the mythos · the form registry.
//
// THE only place form knowledge lives. every form maps onto the one
// np_nodes tree; this registry sets its structure, its advisory craft
// lenses, its export targets, and the skeleton scaffolded at creation.
// adding a form is one object literal here ... never a migration.
//
// phase 0 ships a working spread across all five families; the deeper
// engines (scansion, the constrained coiner, citations) hang off these
// profiles in later phases without touching the schema.

import type { FormProfile, FormProfileKey, RecordSchema } from "./types";

// ---- shared record schemas (typed record-leaves) -------------------------

const LEXEME_SCHEMA: RecordSchema = {
  fields: [
    { key: "headword", label: "headword", type: "text", required: true },
    { key: "ipa", label: "pronunciation (ipa)", type: "ipa" },
    { key: "romanization", label: "romanization", type: "text" },
    {
      key: "partOfSpeech",
      label: "part of speech",
      type: "enum",
      options: ["noun", "verb", "adjective", "adverb", "particle", "affix", "pronoun", "other"],
    },
    { key: "etymology", label: "etymology", type: "text" },
    { key: "senses", label: "senses", type: "list", repeat: true },
    { key: "notes", label: "notes", type: "richtext" },
  ],
};

const INFOBOX_SCHEMA: RecordSchema = {
  fields: [
    { key: "headword", label: "title", type: "text", required: true },
    { key: "aka", label: "also known as", type: "list", repeat: true },
    { key: "classification", label: "classification", type: "text" },
    { key: "summary", label: "summary", type: "richtext" },
    { key: "attributes", label: "attributes", type: "list", repeat: true },
  ],
};

// ---- the registry --------------------------------------------------------

export const FORM_REGISTRY: Record<FormProfileKey, FormProfile> = {
  // ---- prose family ----
  prose: {
    key: "prose",
    label: "prose",
    family: "prose",
    binderIcon: "FileText",
    summary:
      "a single open page. the default ... whatever you are writing, with nothing in the way.",
    tree: {
      rootType: "document",
      levels: [
        {
          nodeType: "document",
          label: "document",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "prose",
        },
      ],
      maxDepth: 1,
    },
    leaf: { content: "prose", pieceKind: "prose" },
    constraints: [],
    exports: ["web", "markdown", "docx", "pdf_print"],
  },
  essay: {
    key: "essay",
    label: "essay",
    family: "prose",
    binderIcon: "PenLine",
    summary: "an argument with room to breathe. optional sections, one voice.",
    tree: {
      rootType: "essay",
      levels: [
        { nodeType: "essay", label: "essay", allowedChildTypes: ["section"] },
        {
          nodeType: "section",
          label: "section",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "prose",
        },
      ],
      maxDepth: 2,
    },
    leaf: { content: "prose", pieceKind: "prose" },
    constraints: [],
    exports: ["web", "newsletter", "markdown", "docx", "pdf_print"],
  },
  article: {
    key: "article",
    label: "article",
    family: "prose",
    binderIcon: "Newspaper",
    summary: "a piece for the world. one leaf, magazine reading view, repurpose-ready.",
    tree: {
      rootType: "article",
      levels: [
        {
          nodeType: "article",
          label: "article",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "article",
        },
      ],
      maxDepth: 1,
    },
    leaf: { content: "prose", pieceKind: "article" },
    constraints: [],
    exports: ["web", "newsletter", "markdown", "docx"],
  },
  newsletter: {
    key: "newsletter",
    label: "newsletter",
    family: "prose",
    binderIcon: "Mail",
    summary: "what lands in their inbox, voice-matched. one leaf, sent.",
    tree: {
      rootType: "newsletter",
      levels: [
        {
          nodeType: "newsletter",
          label: "newsletter",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "prose",
        },
      ],
      maxDepth: 1,
    },
    leaf: { content: "prose", pieceKind: "prose" },
    constraints: [],
    exports: ["newsletter", "web", "markdown"],
  },
  short_story: {
    key: "short_story",
    label: "short story",
    family: "prose",
    binderIcon: "BookOpen",
    summary: "scenes that add to one arc. a corkboard you can shuffle.",
    tree: {
      rootType: "manuscript",
      levels: [
        { nodeType: "manuscript", label: "manuscript", allowedChildTypes: ["scene"] },
        {
          nodeType: "scene",
          label: "scene",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "scene",
        },
      ],
      maxDepth: 2,
    },
    leaf: { content: "prose", pieceKind: "scene" },
    constraints: [
      {
        kind: "target_word_count",
        words: 7500,
        scope: "work",
        note: "a short story tends to run under ~7,500 words.",
      },
    ],
    exports: ["web", "markdown", "docx", "epub", "pdf_print"],
  },
  novella: {
    key: "novella",
    label: "novella",
    family: "prose",
    binderIcon: "Book",
    summary: "chapters, scenes inside them. the middle distance.",
    tree: {
      rootType: "manuscript",
      levels: [
        { nodeType: "manuscript", label: "manuscript", allowedChildTypes: ["chapter"] },
        {
          nodeType: "chapter",
          label: "chapter",
          allowedChildTypes: ["scene"],
          defaultPieceKind: "chapter",
        },
        {
          nodeType: "scene",
          label: "scene",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "scene",
        },
      ],
      maxDepth: 3,
    },
    leaf: { content: "prose", pieceKind: "scene" },
    constraints: [{ kind: "target_word_count", words: 40000, scope: "work" }],
    exports: ["web", "markdown", "docx", "epub", "pdf_print"],
  },
  novel: {
    key: "novel",
    label: "novel",
    family: "prose",
    binderIcon: "Library",
    summary: "parts, chapters, scenes. the full manuscript, with the binder and the bible.",
    tree: {
      rootType: "manuscript",
      levels: [
        { nodeType: "manuscript", label: "manuscript", allowedChildTypes: ["part", "chapter"] },
        { nodeType: "part", label: "part", allowedChildTypes: ["chapter"] },
        {
          nodeType: "chapter",
          label: "chapter",
          allowedChildTypes: ["scene"],
          defaultPieceKind: "chapter",
        },
        {
          nodeType: "scene",
          label: "scene",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "scene",
        },
      ],
      maxDepth: 4,
    },
    leaf: { content: "prose", pieceKind: "scene" },
    constraints: [
      { kind: "target_word_count", words: 90000, scope: "work" },
      {
        kind: "target_word_count",
        words: 2500,
        scope: "leaf",
        note: "a scene that runs long may want a split.",
      },
    ],
    exports: ["web", "markdown", "docx", "epub", "pdf_print"],
    skeleton: [
      {
        nodeType: "part",
        title: "act one",
        children: [
          {
            nodeType: "chapter",
            title: "chapter 1",
            children: [{ nodeType: "scene", title: "scene 1", isLeaf: true, pieceKind: "scene" }],
          },
        ],
      },
      { nodeType: "part", title: "act two" },
      { nodeType: "part", title: "act three" },
    ],
  },

  // ---- collection family ----
  series: {
    key: "series",
    label: "series",
    family: "collection",
    binderIcon: "Layers",
    summary: "a Work of Works. one shared bible, continuity across every book.",
    tree: {
      rootType: "series",
      levels: [
        { nodeType: "series", label: "series", allowedChildTypes: ["book"] },
        { nodeType: "book", label: "book", allowedChildTypes: [], isLeaf: true },
      ],
      maxDepth: 2,
    },
    leaf: { content: "prose", pieceKind: "prose" },
    constraints: [],
    exports: ["web", "epub", "pdf_print"],
  },

  // ---- poem family ----
  haiku: {
    key: "haiku",
    label: "haiku",
    family: "poem",
    binderIcon: "Feather",
    summary: "three lines, 5-7-5, one season turning.",
    tree: {
      rootType: "poem",
      levels: [
        {
          nodeType: "poem",
          label: "haiku",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "poem",
        },
      ],
      maxDepth: 1,
    },
    leaf: { content: "verse", pieceKind: "poem" },
    constraints: [
      { kind: "line_count", lines: 3, scope: "leaf" },
      { kind: "syllable_pattern", pattern: [5, 7, 5] },
    ],
    exports: ["web", "markdown", "pdf_print"],
  },
  sonnet: {
    key: "sonnet",
    label: "sonnet",
    family: "poem",
    binderIcon: "Feather",
    summary: "fourteen lines, a turn at the volta, iambic pentameter.",
    tree: {
      rootType: "poem",
      levels: [
        {
          nodeType: "poem",
          label: "sonnet",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "poem",
        },
      ],
      maxDepth: 1,
    },
    leaf: { content: "verse", pieceKind: "poem" },
    constraints: [
      { kind: "line_count", lines: 14, scope: "leaf" },
      { kind: "meter", foot: "iamb", perLine: 5 },
      {
        kind: "rhyme_scheme",
        scheme: "ABAB CDCD EFEF GG",
        note: "shakespearean; petrarchan is ABBAABBA + a sestet.",
      },
      { kind: "volta", afterLine: 8 },
    ],
    exports: ["web", "markdown", "pdf_print"],
    skeleton: [{ nodeType: "poem", title: "sonnet", isLeaf: true, pieceKind: "poem" }],
  },
  free_verse: {
    key: "free_verse",
    label: "free verse",
    family: "poem",
    binderIcon: "Feather",
    summary: "no fixed shape. lineation is yours; the lenses stay quiet.",
    tree: {
      rootType: "poem",
      levels: [
        {
          nodeType: "poem",
          label: "poem",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "poem",
        },
      ],
      maxDepth: 1,
    },
    leaf: { content: "verse", pieceKind: "poem" },
    constraints: [],
    exports: ["web", "markdown", "pdf_print"],
  },

  // ---- reference family ----
  encyclopaedia: {
    key: "encyclopaedia",
    label: "encyclopaedia",
    family: "reference",
    binderIcon: "BookMarked",
    summary: "categories of cross-referenced articles. infobox plus prose, with citations.",
    tree: {
      rootType: "encyclopaedia",
      levels: [
        {
          nodeType: "encyclopaedia",
          label: "encyclopaedia",
          allowedChildTypes: ["category", "article"],
        },
        { nodeType: "category", label: "category", allowedChildTypes: ["article"] },
        {
          nodeType: "article",
          label: "article",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "article",
        },
      ],
      maxDepth: 3,
    },
    leaf: { content: "record_prose", pieceKind: "article", recordSchema: INFOBOX_SCHEMA },
    constraints: [{ kind: "required_record_fields", fields: ["headword"] }],
    exports: ["web", "pdf_dictionary", "markdown"],
  },
  conlang: {
    key: "conlang",
    label: "constructed language",
    family: "reference",
    binderIcon: "Languages",
    summary: "a lexicon plus a grammar. words are coined to your phonotactics, never against them.",
    tree: {
      rootType: "language",
      levels: [
        { nodeType: "language", label: "language", allowedChildTypes: ["lexicon", "grammar"] },
        { nodeType: "lexicon", label: "lexicon", allowedChildTypes: ["lexeme"] },
        {
          nodeType: "lexeme",
          label: "word",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "lexeme",
        },
        { nodeType: "grammar", label: "grammar", allowedChildTypes: ["chapter"] },
        {
          nodeType: "chapter",
          label: "grammar chapter",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "chapter",
        },
      ],
      maxDepth: 3,
    },
    leaf: { content: "record", pieceKind: "lexeme", recordSchema: LEXEME_SCHEMA },
    constraints: [{ kind: "required_record_fields", fields: ["headword"] }],
    exports: ["web", "pdf_dictionary", "markdown"],
    skeleton: [
      { nodeType: "lexicon", title: "lexicon" },
      {
        nodeType: "grammar",
        title: "grammar",
        children: [{ nodeType: "chapter", title: "phonology", isLeaf: true, pieceKind: "chapter" }],
      },
    ],
  },
  dictionary: {
    key: "dictionary",
    label: "dictionary",
    family: "reference",
    binderIcon: "BookA",
    summary: "headwords, all the way down. the A-to-Z, sortable and indexed.",
    tree: {
      rootType: "dictionary",
      levels: [
        { nodeType: "dictionary", label: "dictionary", allowedChildTypes: ["lexeme"] },
        {
          nodeType: "lexeme",
          label: "entry",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "lexeme",
        },
      ],
      maxDepth: 2,
    },
    leaf: { content: "record", pieceKind: "lexeme", recordSchema: LEXEME_SCHEMA },
    constraints: [{ kind: "required_record_fields", fields: ["headword"] }],
    exports: ["web", "pdf_dictionary", "markdown"],
  },

  // ---- script family ----
  screenplay: {
    key: "screenplay",
    label: "screenplay",
    family: "script",
    binderIcon: "Clapperboard",
    summary: "scenes in fountain. sluglines, action, dialogue, the page that is also a blueprint.",
    tree: {
      rootType: "screenplay",
      levels: [
        { nodeType: "screenplay", label: "screenplay", allowedChildTypes: ["sequence", "scene"] },
        { nodeType: "sequence", label: "sequence", allowedChildTypes: ["scene"] },
        {
          nodeType: "scene",
          label: "scene",
          allowedChildTypes: [],
          isLeaf: true,
          defaultPieceKind: "screenplay",
        },
      ],
      maxDepth: 3,
    },
    leaf: { content: "prose", pieceKind: "screenplay" },
    constraints: [],
    exports: ["fountain", "pdf_print", "markdown"],
  },
};

export const FORM_KEYS = Object.keys(FORM_REGISTRY) as FormProfileKey[];

export function isFormKey(key: string): key is FormProfileKey {
  return Object.prototype.hasOwnProperty.call(FORM_REGISTRY, key);
}
