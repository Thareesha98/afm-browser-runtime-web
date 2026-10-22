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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelPanel } from "./ModelPanel";

const CONTENT = `---
name: Tester
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

function panel(savedSecrets: string[], passkeySecrets: string[]): string {
  return renderToStaticMarkup(
    createElement(ModelPanel, {
      content: CONTENT,
      savedSecrets,
      passkeySecrets,
      issue: null,
      onApply: () => {},
      onSaveKey: async () => true,
      onClose: () => {},
    }),
  );
}

describe("the model panel's key", () => {
  it("says no key has been entered yet, and offers to keep one on this device", () => {
    const html = panel([], []);
    expect(html).toContain("not entered yet");
    expect(html).toContain("Keep on this device");
  });

  it("says a key typed in this session is only kept for the session", () => {
    const html = panel(["OPENAI_API_KEY"], []);
    expect(html).toContain("entered this session");
    expect(html).not.toContain("Keep on this device");
  });

  it("says a key sealed with a passkey is saved on this device", () => {
    const html = panel(["OPENAI_API_KEY"], ["OPENAI_API_KEY"]);
    expect(html).toContain("saved on this device");
    expect(html).not.toContain("entered this session");
  });

  it("ignores a key saved for another provider", () => {
    const html = panel(["ANTHROPIC_API_KEY"], ["ANTHROPIC_API_KEY"]);
    expect(html).toContain("not entered yet");
  });
});
