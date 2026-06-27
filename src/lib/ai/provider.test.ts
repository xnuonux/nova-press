import { describe, expect, it } from "vitest";

import { AUTHOR_CONFIG, isAuthorTask, isCommand, resolveProviderConfig } from "./provider";

describe("resolveProviderConfig", () => {
  it("defaults to deepseek when AI_PROVIDER is unset", () => {
    const cfg = resolveProviderConfig({ DEEPSEEK_API_KEY: "dk" });
    expect(cfg.provider).toBe("deepseek");
    expect(cfg.baseURL).toBe("https://api.deepseek.com");
    expect(cfg.modelId).toContain("deepseek");
    expect(cfg.apiKey).toBe("dk");
  });

  it("selects deepseek explicitly", () => {
    const cfg = resolveProviderConfig({
      AI_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "dk",
    });
    expect(cfg.provider).toBe("deepseek");
  });

  it("selects anthropic for production", () => {
    const cfg = resolveProviderConfig({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "ak",
    });
    expect(cfg.provider).toBe("anthropic");
    expect(cfg.modelId).toContain("claude");
    expect(cfg.apiKey).toBe("ak");
    expect(cfg.baseURL).toBeUndefined();
  });

  it("honors model overrides", () => {
    expect(
      resolveProviderConfig({
        AI_PROVIDER: "deepseek",
        DEEPSEEK_MODEL: "deepseek-reasoner",
      }).modelId,
    ).toBe("deepseek-reasoner");
    expect(
      resolveProviderConfig({
        AI_PROVIDER: "anthropic",
        ANTHROPIC_MODEL: "claude-opus-4-8",
      }).modelId,
    ).toBe("claude-opus-4-8");
  });

  it("reports the missing-key env var name for the selected provider", () => {
    expect(resolveProviderConfig({ AI_PROVIDER: "deepseek" }).apiKeyEnvVar).toBe(
      "DEEPSEEK_API_KEY",
    );
    expect(resolveProviderConfig({ AI_PROVIDER: "anthropic" }).apiKeyEnvVar).toBe(
      "ANTHROPIC_API_KEY",
    );
  });
});

describe("isAuthorTask + AUTHOR_CONFIG", () => {
  it("accepts the four author tasks, nothing else", () => {
    expect(isAuthorTask("expand")).toBe(true);
    expect(isAuthorTask("draft-beat")).toBe(true);
    expect(isAuthorTask("outline")).toBe(true);
    expect(isAuthorTask("coin")).toBe(true);
    expect(isAuthorTask("continue")).toBe(false); // a partner command, not a task
    expect(isAuthorTask("")).toBe(false);
    expect(isAuthorTask(42)).toBe(false);
    expect(isAuthorTask(null)).toBe(false);
    expect(isAuthorTask(undefined)).toBe(false);
  });

  it("keeps the author tasks and partner commands as separate namespaces", () => {
    // a task is never a command and vice versa ... the route validators can't cross.
    expect(isCommand("expand")).toBe(false);
    expect(isCommand("outline")).toBe(false);
    expect(isCommand("coin")).toBe(false);
    expect(isAuthorTask("respond")).toBe(false);
  });

  it("gives every task a sane generation budget + a known stop mode", () => {
    for (const cfg of Object.values(AUTHOR_CONFIG)) {
      expect(cfg.temperature).toBeGreaterThan(0);
      expect(cfg.temperature).toBeLessThanOrEqual(1);
      expect(cfg.maxTokens).toBeGreaterThan(0);
      expect(["paragraph", "line", "none"]).toContain(cfg.stop);
    }
  });

  it("stops each task at the right boundary", () => {
    expect(AUTHOR_CONFIG.expand.stop).toBe("paragraph");
    expect(AUTHOR_CONFIG["draft-beat"].stop).toBe("paragraph");
    expect(AUTHOR_CONFIG.outline.stop).toBe("none"); // a multi-line skeleton
    expect(AUTHOR_CONFIG.coin.stop).toBe("line"); // exactly one verse line
    // an outline needs the most room (a list of beats); a coin is a single line.
    expect(AUTHOR_CONFIG.outline.maxTokens).toBeGreaterThan(AUTHOR_CONFIG.expand.maxTokens);
    expect(AUTHOR_CONFIG.coin.maxTokens).toBeLessThan(AUTHOR_CONFIG.expand.maxTokens);
  });
});
