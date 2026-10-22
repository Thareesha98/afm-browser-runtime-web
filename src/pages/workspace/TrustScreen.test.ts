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
import { TrustScreen, linkedFileHost, serverTools } from "./TrustScreen";

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
    expect(serverTools(metadata)).toEqual([{ name: "local", host: null, tools: [] }]);
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

const SOURCE = `---
name: A
model:
  provider: openai
  name: gpt-4o
  authentication:
    type: api-key
    api_key: \${env:OPENAI_API_KEY}
---

# Role
r
`;

describe("TrustScreen", () => {
  const screen = (savedSecrets: string[]) =>
    renderToStaticMarkup(
      createElement(TrustScreen, {
        metadata: { name: "A", model: { provider: "openai", name: "gpt-4o", authentication: { type: "api-key", api_key: "${env:OPENAI_API_KEY}" } } } as AgentMetadata,
        source: SOURCE,
        savedSecrets,
        fileUrl: null,
        onRun: () => {},
        onOpenBuilder: () => {},
      }),
    );

  it("says a key stays in this tab unless it is saved on this device", () => {
    expect(screen([])).toContain("in memory for this tab unless you choose to save it on this device.");
  });

  it("marks a key as entered once the worker can answer for it, saved on the device or not", () => {
    expect(screen([])).toContain("not entered");
    expect(screen(["OPENAI_API_KEY"])).toContain("entered");
    expect(screen(["OPENAI_API_KEY"])).not.toContain("not entered");
  });
});
