import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * Codex reads its skill from docs/skills/layerling-mcp-skill/SKILL.md; Claude
 * Code only looks under .claude/skills/<name>/SKILL.md; Antigravity looks
 * under .agents/skills/<name>/SKILL.md. A symlink would keep the copies in sync
 * automatically, but a Windows checkout without Developer Mode turns a symlink
 * into a text file containing the target path instead of the skill itself - so
 * this repo keeps real copies, and this test is what actually keeps them from drifting.
 */
describe("layerling MCP skill file", () => {
  it("is identical for Codex, Claude Code, and Antigravity", () => {
    const codex = readFileSync("docs/skills/layerling-mcp-skill/SKILL.md", "utf8");
    const claudeCode = readFileSync(".claude/skills/layerling-mcp-skill/SKILL.md", "utf8");
    const antigravity = readFileSync(".agents/skills/layerling-mcp-skill/SKILL.md", "utf8");
    expect(claudeCode).toBe(codex);
    expect(antigravity).toBe(codex);
  });
});
