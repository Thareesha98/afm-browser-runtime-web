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
import { settingsRows } from "./frontmatter-lines";

function variableProblems(content: string): AfmIssue[] {
  const issues: AfmIssue[] = [];
  for (const { line, text } of settingsRows(content)) {
    for (let at = text.indexOf("${"); at !== -1; at = text.indexOf("${", at + 2)) {
      const end = text.indexOf("}", at);
      const shown = /^\$\{[^\s"']*/.exec(text.slice(at))?.[0] ?? "${";
      if (end === -1) {
        issues.push({ severity: "error", message: `Unclosed variable \`${shown}\`. Add the closing \`}\`.`, field: "", line });
        break;
      }
      const name = text.slice(at + 2, end).replace(/^[a-z]+:/i, "").trim();
      if (name === "") issues.push({ severity: "error", message: `Empty variable \`${text.slice(at, end + 1)}\`. Add a name.`, field: "", line });
    }
  }
  return issues;
}

export function quietMistakes(content: string, metadata: AgentMetadata): AfmIssue[] {
  void metadata;
  const preamble = content.split(/\r?\n/).findIndex((line) => /^ {0,3}# (?:Role|Instructions)\s*$/i.test(line));
  const lines = content.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim() !== "");
  const ignored = first !== -1 && lines[first]?.trim() !== "---" && preamble > first
    ? lines.slice(first, preamble).findIndex((line) => line.trim() !== "")
    : -1;
  const preambleIssues: AfmIssue[] = ignored === -1 ? [] : [{
    severity: lines.slice(first, preamble).some((line) => /^\s*[\w-]+\s*:/.test(line)) ? "error" : "warning",
    message: "Text before the first AFM heading is ignored. Add an opening '---' if these are settings.",
    field: "",
    line: first + ignored + 1,
  }];
  return [...preambleIssues, ...variableProblems(content)];
}
