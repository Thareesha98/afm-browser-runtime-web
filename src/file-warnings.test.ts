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
import { collectAfmIssues } from "./agent-validation";

const BODY = "\n# Role\nr\n\n# Instructions\ni\n";

function file(model: string, tools = ""): string {
  return `---\nname: A\n${model}${tools}interfaces:\n  - type: webchat\n---\n${BODY}`;
}

const MODEL = "model:\n  provider: openai\n  name: gpt-4o\n  authentication:\n    type: api-key\n    api_key: ${env:OPENAI_API_KEY}\n";

const server = (url: string, transport = "http") =>
  `tools:\n  mcp:\n    - name: x\n      transport:\n        type: ${transport}\n        url: ${url}\n`;

describe("a file with no mistakes", () => {
  it("has nothing to warn about", () => {
    expect(collectAfmIssues(file(MODEL, server("https://x.example.com/mcp")))).toEqual([]);
  });
});

describe("a model provider the browser cannot run", () => {
  it("suggests the close word when it looks like a typo", () => {
    const [issue] = collectAfmIssues(file(MODEL.replace("provider: openai", "provider: openia")));
    expect(issue?.message).toBe("Unsupported model provider `openia`. Did you mean `openai`?");
    expect(issue?.severity).toBe("error");
    expect(issue?.line).toBe(4);
  });

  it("names the two it can run when nothing is close", () => {
    const [issue] = collectAfmIssues(file(MODEL.replace("provider: openai", "provider: mistral")));
    expect(issue?.message).toBe("Unsupported model provider `mistral`. Use `openai` or `anthropic`.");
  });

  it("accepts the two it can run in any case, and a file with no provider", () => {
    expect(collectAfmIssues(file(MODEL.replace("provider: openai", "provider: OpenAI")))).toEqual([]);
    expect(collectAfmIssues(file("model:\n  name: gpt-4o\n"))).toEqual([]);
  });
});

describe("a tool address that is invalid", () => {
  it("is marked on its own line", () => {
    const [issue] = collectAfmIssues(file(MODEL, server("not-a-url")));
    expect(issue?.message).toBe("Invalid tool address `not-a-url`. Start it with `https://`.");
    expect(issue?.field).toBe("tools.mcp.0.transport.url");
    expect(issue?.line).toBe(14);
  });

  it("catches an address that only lacks https://", () => {
    expect(collectAfmIssues(file(MODEL, server("example.com/mcp")))).toHaveLength(1);
  });

  it("leaves variables and other kinds of transport alone", () => {
    expect(collectAfmIssues(file(MODEL, server("${env:MCP_URL}")))).toEqual([]);
    const stdio = "tools:\n  mcp:\n    - name: x\n      transport:\n        type: stdio\n        command: npx\n";
    expect(collectAfmIssues(file(MODEL, stdio)).filter((issue) => issue.severity === "error")).toEqual([]);
  });
});

describe("a variable that is not written properly", () => {
  it("says which line has an unclosed variable", () => {
    const [issue] = collectAfmIssues(file(MODEL.replace("${env:OPENAI_API_KEY}", "${env:OPENAI_API_KEY")));
    expect(issue?.message).toBe("Unclosed variable `${env:OPENAI_API_KEY`. Add the closing `}`.");
    expect(issue?.line).toBe(8);
  });

  it("says when a variable has no name", () => {
    expect(collectAfmIssues(file(MODEL.replace("${env:OPENAI_API_KEY}", "${env:}"))).map((issue) => issue.message)).toEqual([
      "Empty variable `${env:}`. Add a name.",
    ]);
    expect(collectAfmIssues(file(MODEL.replace("${env:OPENAI_API_KEY}", "${}"))).map((issue) => issue.message)).toEqual([
      "Empty variable `${}`. Add a name.",
    ]);
  });

  it("accepts a variable with a prefix or without one", () => {
    expect(collectAfmIssues(file(MODEL.replace("${env:OPENAI_API_KEY}", "${OPENAI_API_KEY}")))).toEqual([]);
  });

  it("ignores comments and the writing below the settings", () => {
    const content = `---\nname: A\n# a note about \${env:\n${MODEL}interfaces:\n  - type: webchat\n---\n\n# Role\nUse \${x\n\n# Instructions\ni\n`;
    expect(collectAfmIssues(content)).toEqual([]);
  });
});
