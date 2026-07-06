import { describe, it, expect } from "vitest";

import { parseBinder } from "./binder";
import { assembleScrivenerProject } from "./project";
import { rtfToText, rtfToParagraphs } from "./rtf";

const EMDASH = String.fromCharCode(0x2014);
const RQUOTE = String.fromCharCode(0x2019);
const LDBL = String.fromCharCode(0x201c);
const RDBL = String.fromCharCode(0x201d);
const EACUTE = String.fromCharCode(0xe9);

describe("rtfToText pulls prose out of rtf plumbing", () => {
  it("reads paragraphs and drops the font/color/stylesheet tables", () => {
    const rtf =
      "{\\rtf1\\ansi\\ansicpg1252{\\fonttbl{\\f0\\froman Times New Roman;}}" +
      "{\\colortbl;\\red0\\green0\\blue0;}{\\stylesheet{\\s0 Normal;}}" +
      "\\pard\\plain \\f0 the water remembers.\\par what the living forget.\\par}";
    const text = rtfToText(rtf);
    expect(text).toContain("the water remembers.");
    expect(text).toContain("what the living forget.");
    expect(text).not.toContain("Times");
    expect(text).not.toContain("Normal");
  });

  it("renders the typographic escapes as the writer's own glyphs", () => {
    const rtf =
      "{\\rtf1 she said \\ldblquote go\\rdblquote " +
      "\\emdash it\\rquote s late \\u8230 ?fine.\\par}";
    const text = rtfToText(rtf);
    expect(text).toContain(`${LDBL}go${RDBL}`);
    expect(text).toContain(EMDASH);
    expect(text).toContain(`it${RQUOTE}s late`);
    expect(text).toContain("…fine.");
  });

  it("decodes hex bytes and unicode with the uc fallback skipped", () => {
    expect(rtfToText("{\\rtf1 caf\\'e9\\par}")).toContain(`caf${EACUTE}`);
    // \uc1: the ? after ၕ is the ansi fallback and must be swallowed
    expect(rtfToText("{\\rtf1\\uc1 \\u1055?ushkin\\par}")).toContain(
      `${String.fromCharCode(1055)}ushkin`,
    );
  });

  it("skips ignorable destinations and pictures whole", () => {
    const rtf =
      "{\\rtf1 kept{\\*\\expandedcolortbl;;}{\\pict\\pngblip 89504e47}" + " and still kept\\par}";
    const text = rtfToText(rtf);
    expect(text).toContain("kept and still kept");
    expect(text).not.toContain("89504e47");
  });

  it("never throws on truncated garbage", () => {
    expect(() => rtfToText("{\\rtf1 \\u")).not.toThrow();
    expect(() => rtfToText("half open {\\fonttbl")).not.toThrow();
  });

  it("rtfToParagraphs trims and drops empties", () => {
    expect(rtfToParagraphs("{\\rtf1 one\\par \\par  two \\par}")).toEqual(["one", "two"]);
  });
});

const SCRIVX = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="2.0">
  <Binder>
    <BinderItem UUID="AAA-1" Type="DraftFolder" Created="x" Modified="x">
      <Title>Manuscript</Title>
      <Children>
        <BinderItem UUID="BBB-1" Type="Folder"><Title>act one</Title>
          <Children>
            <BinderItem UUID="CCC-1" Type="Text"><Title>the ferry</Title></BinderItem>
            <BinderItem UUID="CCC-2" Type="Text"><Title>the gate</Title></BinderItem>
          </Children>
        </BinderItem>
      </Children>
    </BinderItem>
    <BinderItem UUID="RRR-1" Type="ResearchFolder"><Title>Research</Title>
      <Children>
        <BinderItem UUID="RRR-2" Type="Text"><Title>notes</Title></BinderItem>
      </Children>
    </BinderItem>
  </Binder>
</ScrivenerProject>`;

describe("parseBinder reads the draft tree only", () => {
  it("returns the manuscript children, folders + texts, in order", () => {
    const draft = parseBinder(SCRIVX);
    expect(draft).not.toBeNull();
    expect(draft!.length).toBe(1);
    expect(draft![0]!.title).toBe("act one");
    expect(draft![0]!.isText).toBe(false);
    expect(draft![0]!.children.map((c) => c.title)).toEqual(["the ferry", "the gate"]);
    expect(draft![0]!.children.every((c) => c.isText)).toBe(true);
  });

  it("returns null for a non-binder xml and for garbage", () => {
    expect(parseBinder("<html></html>")).toBeNull();
    expect(parseBinder("not xml at all <<<")).toBeNull();
  });
});

function projectFiles(): Map<string, Uint8Array> {
  const enc = new TextEncoder();
  return new Map<string, Uint8Array>([
    ["the seventh gate.scriv/the seventh gate.scrivx", enc.encode(SCRIVX)],
    [
      "the seventh gate.scriv/Files/Data/CCC-1/content.rtf",
      enc.encode("{\\rtf1 marik stood at the water.\\par the crossing was silent.\\par}"),
    ],
    // CCC-2 has no rtf on disk ... imports as an empty page, never a failure
  ]);
}

describe("assembleScrivenerProject builds the import tree", () => {
  it("titles from the scrivx name and attaches prose per text doc", () => {
    const project = assembleScrivenerProject(projectFiles());
    expect(project).not.toBeNull();
    expect(project!.title).toBe("the seventh gate");
    expect(project!.textCount).toBe(2);
    const act = project!.items[0]!;
    expect(act.title).toBe("act one");
    expect(act.children[0]!.paragraphs).toEqual([
      "marik stood at the water.",
      "the crossing was silent.",
    ]);
    expect(act.children[1]!.paragraphs).toEqual([]);
  });

  it("returns null when the zip holds no scrivener binder", () => {
    const enc = new TextEncoder();
    expect(assembleScrivenerProject(new Map([["readme.txt", enc.encode("hello")]]))).toBeNull();
  });
});
