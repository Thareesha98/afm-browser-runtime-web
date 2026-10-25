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
import { lineOfPath, pathFromText } from "./frontmatter-lines";

const FILE = `---
model:
  name: gpt-4o
  provider: openai
  authentication:
    typne: api-key
    api_key: \${env:OPENAI_API_KEY}
name: "GroceryGuide"
interfaces:
  - type: webchat
---
# Role

name: not a setting
type: neither is this
`;

describe("finding the line of a setting", () => {
  it("finds a key under its own parent, not the first key with that name", () => {
    expect(lineOfPath(FILE, ["interfaces", 0, "type"])).toBe(10);
    expect(lineOfPath(FILE, ["model", "authentication", "typne"])).toBe(6);
  });

  it("finds a top-level key, not a nested key of the same name", () => {
    expect(lineOfPath(FILE, ["name"])).toBe(8);
    expect(lineOfPath(FILE, ["model", "name"])).toBe(3);
  });

  it("gives the parent's line for a key that is missing", () => {
    expect(lineOfPath(FILE, ["model", "authentication", "type"])).toBe(5);
    expect(lineOfPath(FILE, ["model", "temperature"])).toBe(2);
  });

  it("gives the line of the opening --- for a missing top-level key", () => {
    expect(lineOfPath(FILE, ["description"])).toBe(1);
  });

  it("never looks below the settings block", () => {
    expect(lineOfPath(FILE, ["type"])).toBe(1);
  });

  it("gives nothing when there is no path, no settings block, or the block is not closed", () => {
    expect(lineOfPath(FILE, [])).toBeNull();
    expect(lineOfPath("# Role\n\nhi\n", ["name"])).toBeNull();
    expect(lineOfPath("---\nname: a\n# Role\n", ["name"])).toBeNull();
  });

  it("counts lines from the top of the file when it starts with blank lines", () => {
    expect(lineOfPath("\n\n---\nname: a\n---\n", ["name"])).toBe(4);
  });
});

describe("walking lists", () => {
  const TOOLS = `---
name: A
tools:
  mcp:
    - name: first
      transport:
        type: http
        url: https://one.example.com/mcp
    - name: second
      transport:
        type: http
        url: not-a-url
        authentication:
          type: jwt
interfaces:
- type: webchat
- type: slack
---
`;

  it("picks a list item by its position", () => {
    expect(lineOfPath(TOOLS, ["tools", "mcp", 0, "transport", "url"])).toBe(8);
    expect(lineOfPath(TOOLS, ["tools", "mcp", 1, "transport", "url"])).toBe(12);
    expect(lineOfPath(TOOLS, ["tools", "mcp", 1, "name"])).toBe(9);
  });

  it("finds the right authentication, not the first one in the file", () => {
    expect(lineOfPath(TOOLS, ["tools", "mcp", 1, "transport", "authentication"])).toBe(13);
    expect(lineOfPath(TOOLS, ["tools", "mcp", 0, "transport", "authentication"])).toBe(6);
  });

  it("gives the line of the item itself when the path ends on it", () => {
    expect(lineOfPath(TOOLS, ["tools", "mcp", 1])).toBe(9);
  });

  it("reads a list written at the same indent as its key", () => {
    expect(lineOfPath(TOOLS, ["interfaces", 1])).toBe(17);
    expect(lineOfPath(TOOLS, ["interfaces", 1, "type"])).toBe(17);
  });

  it("falls back to the list when the position does not exist", () => {
    expect(lineOfPath(TOOLS, ["tools", "mcp", 5, "name"])).toBe(4);
  });
});

describe("the ways a file can be written", () => {
  it("skips comments and blank lines", () => {
    const content = "---\n# the name\n\nname: A\n\nmodel:\n  # which one\n  name: gpt-4o\n---\n";
    expect(lineOfPath(content, ["name"])).toBe(4);
    expect(lineOfPath(content, ["model", "name"])).toBe(8);
  });

  it("reads quoted keys", () => {
    expect(lineOfPath('---\n"name": A\n\'model\':\n  name: x\n---\n', ["model", "name"])).toBe(4);
  });

  it("reads Windows line breaks", () => {
    expect(lineOfPath("---\r\nname: A\r\nmodel:\r\n  name: x\r\n---\r\n", ["model", "name"])).toBe(4);
  });

  it("does not take a line inside a long text for a key", () => {
    const content = "---\ndescription: |\n  name: inside the text\n  more text\nname: A\n---\n";
    expect(lineOfPath(content, ["name"])).toBe(5);
  });
});

describe("reading a path written as text", () => {
  it("splits names and list positions", () => {
    expect(pathFromText("tools.mcp[1].transport.authentication")).toEqual(["tools", "mcp", 1, "transport", "authentication"]);
    expect(pathFromText("interfaces[0]")).toEqual(["interfaces", 0]);
    expect(pathFromText("model.authentication")).toEqual(["model", "authentication"]);
  });

  it("gives an empty path for nothing", () => {
    expect(pathFromText(undefined)).toEqual([]);
    expect(pathFromText("")).toEqual([]);
  });
});
