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

import type { AgentMetadata } from "@afm/engine";

// A tool the file lists for one server, by the server's address and the tool's own name.
// A file someone else wrote can list tools, but they run without asking only once the person
// confirms them by name; until then they ask first, like any other tool.
export function listedToolKey(serverUrl: string, tool: string): string {
  return JSON.stringify([serverUrl, tool]);
}

function serverOf(key: string): string | null {
  try {
    const parsed: unknown = JSON.parse(key);
    return Array.isArray(parsed) && typeof parsed[0] === "string" ? parsed[0] : null;
  } catch {
    return null;
  }
}

export function listedTools(metadata: AgentMetadata | null): string[] {
  const keys: string[] = [];
  for (const server of metadata?.tools?.mcp ?? []) {
    if (server.transport.type !== "http") continue;
    for (const tool of server.tool_filter?.allow ?? []) keys.push(listedToolKey(server.transport.url, tool));
  }
  return [...new Set(keys)];
}

// saving a server in the server window confirms the tools ticked there for that server, and only those
export function confirmServer(confirmed: string[], metadata: AgentMetadata | null, serverUrl: string): string[] {
  const ticked = listedTools(metadata).filter((key) => serverOf(key) === serverUrl);
  return [...new Set([...confirmed.filter((key) => serverOf(key) !== serverUrl), ...ticked])];
}
