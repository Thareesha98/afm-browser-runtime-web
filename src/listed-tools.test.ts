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
import type { AgentMetadata } from "@afm/engine";
import { confirmServer, listedToolKey, listedTools } from "./listed-tools";

const A = "https://a.example.com/mcp";
const B = "https://b.example.com/mcp";

const agent = (servers: unknown[]) => ({ name: "A", tools: { mcp: servers } }) as AgentMetadata;
const http = (name: string, url: string, allow?: string[]) => ({
  name,
  transport: { type: "http", url },
  ...(allow === undefined ? {} : { tool_filter: { allow } }),
});

describe("listedTools", () => {
  it("names every tool the file lists, by server address and tool", () => {
    expect(listedTools(agent([http("a", A, ["x", "y"]), http("b", B, ["x"])]))).toEqual([
      listedToolKey(A, "x"),
      listedToolKey(A, "y"),
      listedToolKey(B, "x"),
    ]);
  });

  it("is empty for no file, or servers that list no tools", () => {
    expect(listedTools(null)).toEqual([]);
    expect(listedTools(agent([http("a", A)]))).toEqual([]);
  });
});

describe("listedToolKey", () => {
  it("cannot be confused across servers when an address has the separator in it", () => {
    expect(listedToolKey(A, "x::y")).not.toBe(listedToolKey(`${A}::x`, "y"));
  });
});

describe("confirmServer", () => {
  it("confirms the tools now ticked for the saved server, and leaves other servers alone", () => {
    const confirmed = [listedToolKey(A, "old"), listedToolKey(B, "x")];
    expect(confirmServer(confirmed, agent([http("a", A, ["new"]), http("b", B, ["x", "y"])]), A)).toEqual([
      listedToolKey(B, "x"),
      listedToolKey(A, "new"),
    ]);
  });

  it("does not confirm another server whose address starts with the saved one", () => {
    const metadata = agent([http("a", A, ["x"]), http("b", `${A}::evil`, ["log"])]);
    expect(confirmServer([], metadata, A)).toEqual([listedToolKey(A, "x")]);
  });
});
