// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, it, expect } from "vitest";
import { getSection, setSection } from "./pages/workspace/agent-source-edit";
import { buildableAgent, collectAfmIssues, previewAgent } from "./agent-validation";

const FILE = `---
name: Code explain Agent
model:
  provider: anthropic
  name: claude-sonnet-5
---

# Role

You are a helper.

# Instructions

Answer clearly.
`;

describe("the Build view stays put while a field is empty", () => {
  for (const field of ["Role", "Instructions"] as const) {
    it(`survives ${field} being cleared`, () => {
      const cleared = setSection(FILE, field, "");
      expect(buildableAgent(cleared).ok).toBe(true);
      expect(getSection(cleared, field)).toBe("");
    });

    it(`lets ${field} be typed back in`, () => {
      const cleared = setSection(FILE, field, "");
      const retyped = setSection(cleared, field, "A poet.");
      expect(getSection(retyped, field)).toBe("A poet.");
      expect(previewAgent(retyped).ok).toBe(true);
    });

    it(`keeps the other section intact while ${field} is empty`, () => {
      const other = field === "Role" ? "Instructions" : "Role";
      const before = getSection(FILE, other);
      expect(getSection(setSection(FILE, field, ""), other)).toBe(before);
    });
  }

  it("survives both being empty at once, settings and all", () => {
    const drawable = buildableAgent(setSection(setSection(FILE, "Role", ""), "Instructions", ""));
    expect(drawable.ok).toBe(true);
    if (drawable.ok) {
      expect(drawable.metadata.name).toBe("Code explain Agent");
      expect(drawable.metadata.model?.name).toBe("claude-sonnet-5");
    }
  });

  it("still refuses to run a file with no role", () => {
    expect(previewAgent(setSection(FILE, "Role", "")).ok).toBe(false);
  });

  it("falls back to Raw only when the settings block is broken", () => {
    expect(buildableAgent("---\nmodel: [not, a, map]\n---\n\n# Role\n\nx\n").ok).toBe(false);
  });
});

const ROLE_AND_INSTRUCTIONS = "# Role\nA helper.\n\n# Instructions\nAnswer clearly.\n";

describe("the line a problem is shown on", () => {
  it("marks the block that is missing its type, not a line with the same word elsewhere", () => {
    const content = [
      "---",
      "model:",
      "  name: gpt-4o",
      "  provider: openai",
      "  authentication:",
      "    typne: api-key",
      "    api_key: ${env:OPENAI_API_KEY}",
      'name: "GroceryGuide"',
      "interfaces:",
      "  - type: webchat",
      "---",
      ROLE_AND_INSTRUCTIONS,
    ].join("\n");
    const issues = collectAfmIssues(content);
    expect(issues.map((issue) => issue.field)).toEqual(["model.authentication.type"]);
    expect(issues[0]!.line).toBe(5);
  });

  it("marks an unknown setting on its own line", () => {
    const issues = collectAfmIssues(`---\nnafme: A\nmodel:\n  provider: openai\n  name: gpt-4o\n---\n${ROLE_AND_INSTRUCTIONS}`);
    expect(issues.map((issue) => [issue.message, issue.line])).toEqual([["Unknown field 'nafme'.", 2]]);
  });

  it("marks an unknown setting inside a block, under the block it is in", () => {
    const content = `---\nname: A\ninterfaces:\n  - type: webchat\nmodel:\n  provider: openai\n  name: gpt-4o\n  colour: blue\n---\n${ROLE_AND_INSTRUCTIONS}`;
    const found = collectAfmIssues(content).find((issue) => issue.field === "model.colour");
    expect(found?.line).toBe(8);
  });

  it("marks the second tool server's authentication, not the model's", () => {
    const content = [
      "---",
      "name: A",
      "model:",
      "  provider: openai",
      "  name: gpt-4o",
      "  authentication:",
      "    type: api-key",
      "    api_key: ${env:OPENAI_API_KEY}",
      "tools:",
      "  mcp:",
      "    - name: one",
      "      transport:",
      "        type: http",
      "        url: https://one.example.com/mcp",
      "    - name: two",
      "      transport:",
      "        type: http",
      "        url: https://two.example.com/mcp",
      "        authentication:",
      "          type: jwt",
      "          issuer: https://issuer.example.com",
      "          signing_key: ${env:SIGNING_KEY}",
      "---",
      ROLE_AND_INSTRUCTIONS,
    ].join("\n");
    const issue = collectAfmIssues(content).find((found) => found.field === "tools.mcp[1].transport.authentication");
    expect(issue?.severity).toBe("warning");
    expect(issue?.line).toBe(19);
  });

  it("marks the second tool server's authentication block when a required field is missing from it", () => {
    const content = [
      "---",
      "name: A",
      "model:",
      "  provider: openai",
      "  name: gpt-4o",
      "  authentication:",
      "    type: api-key",
      "    api_key: ${env:OPENAI_API_KEY}",
      "tools:",
      "  mcp:",
      "    - name: one",
      "      transport:",
      "        type: http",
      "        url: https://one.example.com/mcp",
      "    - name: two",
      "      transport:",
      "        type: http",
      "        url: https://two.example.com/mcp",
      "        authentication:",
      "          type: jwt",
      "          issuer: https://issuer.example.com",
      "---",
      ROLE_AND_INSTRUCTIONS,
    ].join("\n");
    const issue = collectAfmIssues(content).find((found) => found.message.includes("signing_key"));
    expect(issue?.field).toBe("tools.mcp.1.transport.authentication");
    expect(issue?.line).toBe(19);
  });

  it("marks the interface that cannot run in a browser by its position", () => {
    const content = `---\nname: A\nmodel:\n  provider: openai\n  name: gpt-4o\ninterfaces:\n  - type: webchat\n  - type: consolechat\n---\n${ROLE_AND_INSTRUCTIONS}`;
    const issue = collectAfmIssues(content).find((found) => found.field === "interfaces[1]");
    expect(issue?.severity).toBe("warning");
    expect(issue?.line).toBe(8);
  });

  it("accepts a valid platform trigger but rejects an invalid mode-specific field", () => {
    const file = (extra: string) => `---\nname: A\nmodel:\n  provider: openai\n  name: gpt-4o\ninterfaces:\n  - type: platformchat\n    platform: slack\n    mode: polling\n${extra}---\n${ROLE_AND_INSTRUCTIONS}`;
    expect(previewAgent(file("    polling:\n      interval: 30\n")).ok).toBe(true);
    const issues = collectAfmIssues(file("    signature:\n      output:\n        type: string\n"));
    expect(issues.some((issue) => issue.severity === "error" && issue.message.includes("must not set signature.output"))).toBe(true);
  });

  it("gives no line for a broken settings block, since the block cannot be read", () => {
    const issues = collectAfmIssues(`---\nname: [Trip\nmodel: x\n---\n${ROLE_AND_INSTRUCTIONS}`);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.line).toBeNull();
  });
});
