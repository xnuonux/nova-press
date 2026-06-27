import { describe, expect, it } from "vitest";

import { detectPiece, detectWork, extractMentions } from "./detect";
import type { KnownName } from "./types";

const marik: KnownName = { entityId: "e1", name: "marik", aliases: ["the ferryman", "old marik"] };

describe("extractMentions", () => {
  it("records a proper noun's count + whether it ever appeared mid-sentence", () => {
    const m = extractMentions("the gate opened. and Sable waited, then Sable left.");
    expect(m.get("sable")).toMatchObject({ count: 2, midSentence: true });
  });

  it("marks a word only ever at a sentence start as NOT mid-sentence", () => {
    const m = extractMentions("Soren walked. Soren waited. Soren left.");
    expect(m.get("soren")).toMatchObject({ count: 3, midSentence: false });
  });

  it("is total over garbage", () => {
    expect(extractMentions("").size).toBe(0);
    // @ts-expect-error testing non-string tolerance
    expect(extractMentions(null).size).toBe(0);
  });
});

describe("detectPiece ... name-drift", () => {
  it("flags a mid-sentence near-miss of a bible name", () => {
    const out = detectPiece(
      "p1",
      "the gate stood open. the ferryman waited, and Marrik would not look up. much later Marrik took the coin, and still Marrik said nothing.",
      [marik],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "name_drift", entityId: "e1", pieceId: "p1" });
    expect(out[0]!.message).toContain('looks like a slip for "marik"');
  });

  it("resolves a near-miss through an ALIAS's anchor token", () => {
    const out = detectPiece(
      "p1",
      "the boat waited. and the Feryman would not speak. the Feryman took the coin. still the Feryman watched.",
      [marik],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "name_drift", entityId: "e1" });
    expect(out[0]!.message).toContain('slip for "ferryman"');
  });

  it("never flags a correctly-spelled known name", () => {
    const out = detectPiece(
      "p1",
      "the gate opened. and Marik stepped through. Marik said nothing.",
      [marik],
    );
    expect(out).toEqual([]);
  });

  it("never flags a genuinely different name as a drift", () => {
    // "Maria" is close-ish but below threshold ... she is her own person, not a slip.
    const out = detectPiece("p1", "the door opened. and Maria came in. Maria sat down.", [marik]);
    expect(out.filter((f) => f.kind === "name_drift")).toEqual([]);
  });

  it("treats a possessive of the canonical name as the name (no false unintroduced)", () => {
    const out = detectPiece(
      "p1",
      "the river took Marik's boat, and Marik's coin, and Marik's name.",
      [marik],
    );
    expect(out).toEqual([]);
  });

  it("still drifts a MISSPELLED possessive back to the bible name", () => {
    const out = detectPiece(
      "p1",
      "she found Marrik's boat. it held Marrik's coin. it was Marrik's all along.",
      [marik],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "name_drift", entityId: "e1" });
  });
});

describe("detectPiece ... unintroduced", () => {
  it("flags a recurring mid-sentence proper noun that isn't in the bible", () => {
    const out = detectPiece(
      "p1",
      "a woman named Sable watched. the dead followed Sable. and still Sable would cross. far off, Sable knew the way.",
      [marik],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "unintroduced", pieceId: "p1" });
    expect(out[0]!.message).toContain("turns up 4 times");
  });

  it("does NOT flag a one-off mention (below the recurrence floor)", () => {
    const out = detectPiece("p1", "the gate opened. and Sable passed through once.", [marik]);
    expect(out).toEqual([]);
  });

  it("does NOT flag a proper noun used only at sentence starts (the precision guard)", () => {
    // Soren leads every sentence ... ambiguous as a proper noun, so stay quiet.
    const out = detectPiece("p1", "Soren walked on. Soren waited there. Soren never spoke.", [
      marik,
    ]);
    expect(out).toEqual([]);
  });

  it("works with no bible at all (every recurring proper noun is unintroduced)", () => {
    const out = detectPiece(
      "p1",
      "the hall was cold. and Halvard spoke. then Halvard rose. Halvard left.",
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "unintroduced" });
  });

  it("does NOT flag a recurring calendar name (weekday / month)", () => {
    expect(
      detectPiece(
        "p1",
        "she dreaded every Monday. that Monday she was late. by Monday it was over.",
        [],
      ),
    ).toEqual([]);
    expect(
      detectPiece("p1", "April was cruel. that April she left. by April he was gone.", []),
    ).toEqual([]);
  });

  it("does NOT flag a tag-first dialogue opener as an unintroduced name", () => {
    // "Hush" sits right after an opening quote ... a dialogue opener, not a proper noun.
    const out = detectPiece("p1", 'she said, "Hush." he said, "Hush." they said, "Hush."', []);
    expect(out).toEqual([]);
  });
});

describe("detectWork", () => {
  it("runs the pass over every piece, tagging each finding's piece", () => {
    const out = detectWork(
      [
        { pieceId: "p1", text: "the gate. and Marrik waited. Marrik stayed. Marrik went." },
        { pieceId: "p2", text: "clean prose with no proper nouns at all here." },
      ],
      [marik],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "name_drift", pieceId: "p1" });
  });
});
