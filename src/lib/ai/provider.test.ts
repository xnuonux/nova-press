import { describe, expect, it } from "vitest";

import { resolveProviderConfig } from "./provider";

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
