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


import { describe, expect, it } from "vitest";
import type { AgentMetadata } from "@afm/engine";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRUST_COPY, TrustScreen, filterTools, linkedFileHost, serverTools, tickedSummary, toolCount } from "./TrustScreen";

const withServers = (mcp: unknown[]) => ({ name: "A", tools: { mcp } }) as AgentMetadata;

describe("serverTools", () => {
  it("is empty when the file names no servers", () => {
    expect(serverTools({ name: "A" } as AgentMetadata)).toEqual([]);
  });

  it("names each server with the host it talks to", () => {
    const metadata = withServers([
      { name: "notes", transport: { type: "http", url: "https://mcp.example.com/mcp" } },
      { name: "stock", transport: { type: "http", url: "https://sheets.example.org/v1" } },
    ]);
    expect(serverTools(metadata).map(({ name, host }) => [name, host])).toEqual([
      ["notes", "mcp.example.com"],
      ["stock", "sheets.example.org"],
    ]);
  });

  it("lists every tool the file allows to run without asking", () => {
    const metadata = withServers([
      { name: "notes", transport: { type: "http", url: "https://mcp.example.com/mcp" }, tool_filter: { allow: ["a", "b"] } },
      { name: "stock", transport: { type: "http", url: "https://sheets.example.org/v1" }, tool_filter: { allow: ["c"], deny: ["d"] } },
    ]);
    expect(serverTools(metadata).map(({ tools }) => tools)).toEqual([["a", "b"], ["c"]]);
  });

  it("lists no tools for a server whose file allows none", () => {
    const metadata = withServers([
      { name: "notes", transport: { type: "http", url: "https://mcp.example.com/mcp" } },
      { name: "stock", transport: { type: "http", url: "https://sheets.example.org/v1" }, tool_filter: { deny: ["d"] } },
    ]);
    expect(serverTools(metadata).map(({ tools }) => tools)).toEqual([[], []]);
  });

  it("has no host for a server that is not reached over http", () => {
    const metadata = withServers([{ name: "local", transport: { type: "stdio", command: "run" } }]);
    expect(serverTools(metadata)).toEqual([{ name: "local", url: null, host: null, tools: [] }]);
  });
});

describe("linkedFileHost", () => {
  it("is the host a ?file= link points at, with its port", () => {
    expect(linkedFileHost("https://files.example.com/a/b.afm.md")).toBe("files.example.com");
    expect(linkedFileHost("https://files.example.com:8443/a.afm.md")).toBe("files.example.com:8443");
  });

  it("is nothing when the agent did not come from a ?file= link", () => {
    expect(linkedFileHost(null)).toBeNull();
  });

  it("is nothing for a link that is not an https address", () => {
    expect(linkedFileHost("http://files.example.com/a.afm.md")).toBeNull();
    expect(linkedFileHost("not a url")).toBeNull();
  });
});

const TOOLS = ["notion-search", "notion-fetch", "notion-create-pages", "notion-update-page"];

const SOURCE = `---
name: Interview partner
model:
  provider: openai
  name: gpt-6.1-sol
  authentication:
    type: api-key
    api_key: \${env:OPENAI_API_KEY}
---

# Role
r
`;

const agent = (servers: unknown[], extra: Record<string, unknown> = {}) =>
  ({ name: "Interview partner", model: { provider: "openai", name: "gpt-6.1-sol" }, tools: { mcp: servers }, ...extra }) as AgentMetadata;

const notion = { name: "notion", transport: { type: "http", url: "https://mcp.notion.com/mcp" }, tool_filter: { allow: TOOLS } };

function screen(options: { servers?: unknown[]; savedSecrets?: string[]; fileUrl?: string | null; initialTools?: string | null; source?: string } = {}): string {
  return renderToStaticMarkup(
    createElement(TrustScreen, {
      metadata: agent(options.servers ?? [notion]),
      source: options.source ?? SOURCE,
      savedSecrets: options.savedSecrets ?? [],
      fileUrl: options.fileUrl ?? null,
      onRun: () => {},
      onOpenBuilder: () => {},
      initialTools: options.initialTools ?? null,
    }),
  );
}

describe("filterTools", () => {
  it("keeps every tool for an empty or blank search", () => {
    expect(filterTools(TOOLS, "")).toEqual(TOOLS);
    expect(filterTools(TOOLS, "   ")).toEqual(TOOLS);
  });

  it("keeps the tools whose name has the word in it, whatever its case", () => {
    expect(filterTools(TOOLS, "PAGE")).toEqual(["notion-create-pages", "notion-update-page"]);
  });

  it("keeps none when nothing matches", () => {
    expect(filterTools(TOOLS, "calendar")).toEqual([]);
  });
});

describe("tickedSummary", () => {
  it("says every listed tool asks first until one is ticked", () => {
    expect(tickedSummary(0, 4)).toBe("4 tools · all ask first");
  });

  it("says how many of the listed tools run without asking once some are ticked", () => {
    expect(tickedSummary(1, 4)).toBe("1 of 4 tools run without asking");
  });
});

describe("toolCount", () => {
  it("says tool once and tools otherwise", () => {
    expect(toolCount(1)).toBe("1 tool");
    expect(toolCount(0)).toBe("0 tools");
    expect(toolCount(38)).toBe("38 tools");
  });
});

describe("the window a shared agent opens in", () => {
  it("is a dialog named by the agent, with the sentence that says what it is", () => {
    const html = screen();
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Interview partner");
    expect(html).toContain(TRUST_COPY.lead);
  });

  it("shows the model with its provider written properly", () => {
    const html = screen();
    expect(html).toContain("GPT-6.1 Sol");
    expect(html).toContain("OpenAI");
    expect(html).not.toContain("· openai");
  });

  it("shows a server's tools as a count and a button, not as a flood of names", () => {
    const html = screen();
    expect(html).toContain("Notion");
    expect(html).toContain("mcp.notion.com");
    expect(html).toContain("4 tools · all ask first");
    expect(html).toContain("Choose tools");
    for (const tool of TOOLS) expect(html).not.toContain(tool);
  });

  it("says a server with no listed tools has none, and gives it no button", () => {
    const html = screen({ servers: [{ name: "github", transport: { type: "http", url: "https://api.githubcopilot.com/mcp" } }] });
    expect(html).toContain("No tools listed");
    expect(html).not.toContain("Choose tools");
  });

  it("gives each server with tools its own button", () => {
    const html = screen({ servers: [notion, { ...notion, name: "linear", transport: { type: "http", url: "https://mcp.linear.app/mcp" } }] });
    expect(html.match(/Choose tools/g)).toHaveLength(2);
  });

  it("says None when the file names no server", () => {
    const html = screen({ servers: [] });
    expect(html).toContain(">None<");
    expect(html).not.toContain(TRUST_COPY.toolsNote);
  });

  it("puts the note about asking under the tool servers", () => {
    expect(screen()).toContain(TRUST_COPY.toolsNote);
  });

  it("marks a key Entered or Not entered, with the note about keys under it", () => {
    expect(screen()).toContain("Not entered");
    expect(screen()).toContain(TRUST_COPY.keysNote);
    expect(screen({ savedSecrets: ["OPENAI_API_KEY"] })).toContain(">Entered<");
    expect(screen({ savedSecrets: ["OPENAI_API_KEY"] })).not.toContain("Not entered");
  });

  it("says Nothing when the file needs no key", () => {
    const html = screen({ source: "---\nname: A\n---\n" });
    expect(html).toContain(">Nothing<");
    expect(html).not.toContain(TRUST_COPY.keysNote);
  });

  it("shows where the file came from when it was opened from a link", () => {
    expect(screen({ fileUrl: "https://raw.githubusercontent.com/a/b/agent.afm.md" })).toContain("raw.githubusercontent.com");
    expect(screen()).not.toContain("File from");
  });

  it("shows the step limit", () => {
    expect(screen()).toContain("10 steps per answer");
  });

  it("keeps both buttons in the footer, beside the sentence that says nothing has run", () => {
    const html = screen();
    expect(html).toContain("u-dlg-foot act");
    expect(html).toContain(TRUST_COPY.footer);
    expect(html.indexOf(">Open in builder<")).toBeGreaterThan(html.indexOf(TRUST_COPY.footer));
    expect(html.indexOf(">Run it<")).toBeGreaterThan(html.indexOf(">Open in builder<"));
  });

  it("has no Close button and no Back link, so the two buttons are the two choices", () => {
    const html = screen();
    expect(html).not.toContain('aria-label="Close"');
    expect(html).not.toContain("u-dlg-back");
  });

  it("is a sheet from the bottom on a phone", () => {
    expect(screen()).toContain("is-sheet");
  });
});

describe("the list of a server's tools", () => {
  it("names the server, counts its tools and has a way back", () => {
    const html = screen({ initialTools: "notion" });
    expect(html).toContain("Notion");
    expect(html).toContain("The file lists 4 tools for mcp.notion.com. Tick the ones that may run without asking. The rest ask first.");
    expect(html).toContain("u-dlg-back");
  });

  it("gives every tool a tick box that starts unticked, so none runs without asking until the person ticks it", () => {
    const html = screen({ initialTools: "notion" });
    expect(html.match(/type="checkbox"/g)).toHaveLength(TOOLS.length);
    expect(html).not.toContain("checked");
    expect(html).toContain("Tick all");
  });

  it("lists every tool name, with a search box", () => {
    const html = screen({ initialTools: "notion" });
    for (const tool of TOOLS) expect(html).toContain(tool);
    expect(html).toContain('aria-label="Search tools"');
  });

  it("says tool for a single tool", () => {
    const html = screen({ servers: [{ ...notion, tool_filter: { allow: ["notion-search"] } }], initialTools: "notion" });
    expect(html).toContain("The file lists 1 tool for mcp.notion.com.");
  });

  it("ends with Done and the sentence that says what the list is", () => {
    const html = screen({ initialTools: "notion" });
    expect(html).toContain(TRUST_COPY.toolsFooter);
    expect(html).toContain(">Done<");
    expect(html).not.toContain(">Run it<");
  });

  it("falls back to the summary for a server the file does not have", () => {
    expect(screen({ initialTools: "ghost" })).toContain(">Run it<");
  });
});
