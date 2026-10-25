import { describe, expect, it } from "vitest";
import { previewAgent } from "../../agent-validation";
import { runConfirmations } from "./run-confirmations";

const SOURCE = `---
name: Portable assistant
model:
  provider: openai
  name: gpt-4o
  url: https://models.example.com/v1
interfaces:
  - type: platformchat
    platform: slack
    mode: notification
    prompt: "Event: \${http:payload.event}"
  - type: webhook
    subscription:
      protocol: websub
  - type: webchat
    signature:
      input:
        type: object
tools:
  mcp:
    - name: local-files
      transport:
        type: stdio
        command: npx
skills:
  - type: local
    path: ./skills
---
# Role
Assist with work.
# Instructions
Answer clearly.
`;

describe("browser Run choices", () => {
  it("offers each supported browser fallback in file order", () => {
    const preview = previewAgent(SOURCE);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.plan.runnable).toBe(true);
    const choices = runConfirmations(preview.metadata, preview.plan.issues);
    expect(choices.map((choice) => choice.title)).toEqual([
      "slack platform chat cannot run here",
      "webhook cannot run here",
      "Structured chat unavailable",
      "Custom model URL unavailable",
      "local-files cannot run here",
      "Local skill unavailable",
    ]);
    expect(choices[0]?.text).toContain("web chat preview");
    expect(choices[4]?.text).toContain("Run without this tool server");
  });
});
