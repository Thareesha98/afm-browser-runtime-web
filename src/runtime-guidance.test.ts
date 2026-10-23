// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
// Licensed under the Apache License, Version 2.0.

import { describe, expect, it } from "vitest";
import { AgentSession } from "./session";
import { inPageToolPort } from "@afm/adapter-tool";
import { configSecretPort } from "@afm/adapter-secret";
import { allowAllPermissions } from "@afm/engine";

describe("runtime guidance with a short agent definition", () => {
  it("provides generic operating context without rewriting the user's agent", async () => {
    const systems: string[] = [];
    const afm = `---\nname: Interview partner\ninterfaces:\n  - type: webchat\n---\n# Role\nHelp me prepare for interviews.\n# Instructions\nUse my CV and the role. Be concise.\n`;
    const session = new AgentSession({
      createModel: async () => ({
        async *stream(request) {
          systems.push(request.system);
          yield { type: "text-delta" as const, text: "Ready." };
        },
      }),
      createTools: () => inPageToolPort([]),
      filesTools: inPageToolPort([]),
      describeAttachedFiles: () => "resume.pdf: two pages",
      secrets: configSecretPort({}),
      permission: allowAllPermissions,
      emit() {},
    });
    await session.load(afm);
    await session.send("Prepare me.");
    await session.send("Continue.");
    expect(systems).toHaveLength(2);
    for (const system of systems) {
      expect(system).toContain("# AFM runtime");
      expect(system).toContain("Use my CV and the role. Be concise.");
      expect(system).toContain("resume.pdf: two pages");
      expect(system).not.toContain("Canva");
      expect(system).not.toContain("GitHub");
      expect(system.match(/# AFM runtime/g)).toHaveLength(1);
    }
  });
});
