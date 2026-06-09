import { describe, expect, it } from "vitest";

import { voiceKeeperAudit } from "./voice-keeper";

describe("voiceKeeperAudit", () => {
  it("strips a leading 'great,' preamble and flags it", () => {
    const r = voiceKeeperAudit("Great, here it is. the muse waited.");
    expect(r.text.startsWith("great")).toBe(false);
    expect(r.text).toContain("the muse waited");
    expect(r.violated).toBe(true);
  });

  it('strips a "here\'s a" preamble', () => {
    const r = voiceKeeperAudit("Here's a thought for you ... keep going.");
    expect(r.text).toBe("keep going.");
    expect(r.violated).toBe(true);
  });

  it('strips an "i\'d be happy to" preamble', () => {
    const r = voiceKeeperAudit("I'd be happy to help. write it down.");
    expect(r.text).toBe("write it down.");
  });

  it("replaces an em-dash with an ellipsis (and does not flag that alone)", () => {
    const r = voiceKeeperAudit("the page waited — patiently.");
    expect(r.text).not.toContain("—");
    expect(r.text).toContain("...");
    expect(r.violated).toBe(false);
  });

  it("replaces an en-dash with an ellipsis", () => {
    const r = voiceKeeperAudit("the page waited – patiently.");
    expect(r.text).not.toContain("–");
    expect(r.text).toContain("...");
  });

  it("lowercases the first character", () => {
    const r = voiceKeeperAudit("The muse waited.");
    expect(r.text).toBe("the muse waited.");
  });

  it("leaves a leading acronym (AI) and a lone 'I' uppercase", () => {
    expect(voiceKeeperAudit("AI sands your voice off.").text).toBe("AI sands your voice off.");
    expect(voiceKeeperAudit("I keep the comma.").text).toBe("I keep the comma.");
  });

  it("passes already-compliant one-sentence text unchanged + unflagged", () => {
    const r = voiceKeeperAudit("the comma you keep that the rule says to cut.", {
      oneSentence: true,
    });
    expect(r.text).toBe("the comma you keep that the rule says to cut.");
    expect(r.violated).toBe(false);
  });

  it("flags more than one sentence when oneSentence is required", () => {
    const r = voiceKeeperAudit("first thought. second thought.", {
      oneSentence: true,
    });
    expect(r.violated).toBe(true);
  });

  it("lowercases the first char of every paragraph", () => {
    const r = voiceKeeperAudit("First line.\n\nSecond line.");
    expect(r.text).toBe("first line.\n\nsecond line.");
  });
});
