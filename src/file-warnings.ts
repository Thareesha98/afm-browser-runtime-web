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
import type { AfmIssue } from "./agent-validation";
import { lineOfPath, settingsRows } from "./frontmatter-lines";
import { BROWSER_PROVIDERS } from "./model-factory";

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, at) => at);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row.push(Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    previous = row;
  }
  return previous[b.length]!;
}

function parses(url: string): boolean {
  try {
    return new URL(url) instanceof URL;
  } catch {
    return false;
  }
}

function providerProblem(content: string, metadata: AgentMetadata): AfmIssue[] {
  const provider = metadata.model?.provider?.trim() ?? "";
  const lower = provider.toLowerCase();
  if (provider === "" || BROWSER_PROVIDERS.includes(lower)) return [];
  const close = BROWSER_PROVIDERS.find((known) => distance(lower, known) <= 2);
  const advice = close === undefined ? "Use `openai` or `anthropic`." : `Did you mean \`${close}\`?`;
  return [
    {
      severity: "error",
      message: `\`${provider}\` is not a model provider this app can run. ${advice}`,
      field: "model.provider",
      line: lineOfPath(content, ["model", "provider"]),
    },
  ];
}

function addressProblems(content: string, metadata: AgentMetadata): AfmIssue[] {
  const issues: AfmIssue[] = [];
  (metadata.tools?.mcp ?? []).forEach((server, at) => {
    if (server.transport.type !== "http") return;
    const url = server.transport.url;
    if (url.includes("${") || parses(url)) return;
    issues.push({
      severity: "error",
      message: `\`${url}\` is not a web address. Start it with \`https://\`.`,
      field: `tools.mcp.${at}.transport.url`,
      line: lineOfPath(content, ["tools", "mcp", at, "transport", "url"]),
    });
  });
  return issues;
}

function variableProblems(content: string): AfmIssue[] {
  const issues: AfmIssue[] = [];
  for (const { line, text } of settingsRows(content)) {
    for (let at = text.indexOf("${"); at !== -1; at = text.indexOf("${", at + 2)) {
      const end = text.indexOf("}", at);
      const shown = /^\$\{[^\s"']*/.exec(text.slice(at))?.[0] ?? "${";
      if (end === -1) {
        issues.push({ severity: "error", message: `\`${shown}\` is missing its closing \`}\`.`, field: "", line });
        break;
      }
      const name = text.slice(at + 2, end).replace(/^[a-z]+:/i, "").trim();
      if (name === "") issues.push({ severity: "error", message: `\`${text.slice(at, end + 1)}\` has no name in it.`, field: "", line });
    }
  }
  return issues;
}

export function quietMistakes(content: string, metadata: AgentMetadata): AfmIssue[] {
  return [...providerProblem(content, metadata), ...addressProblems(content, metadata), ...variableProblems(content)];
}
