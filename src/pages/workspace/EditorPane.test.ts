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
import { EditorPane } from "./EditorPane";

const BODY = "\n# Role\nYou help people.\n\n# Instructions\nBe kind.\n";
const VALID = `---\nname: A\nmodel:\n  provider: openai\n  name: gpt-4o\n---\n${BODY}`;
const UNKNOWN_FIELD = `---\nnafme: A\nmodel:\n  provider: openai\n  name: gpt-4o\n---\n${BODY}`;

const editor = (content: string) =>
  renderToStaticMarkup(
    createElement(EditorPane, {
      content,
      onChange: () => {},
      activity: { phase: "idle", brokenServerIds: [], modelBroken: false },
      reach: { ok: [], failed: {} },
      onOpenModel: () => {},
      onOpenServer: () => {},
    }),
  );

describe("the Build view of a file that is not valid", () => {
  const html = editor(UNKNOWN_FIELD);

  it("says Invalid AFM file once, with a View button", () => {
    expect(html.match(/Invalid AFM file/g)).toHaveLength(1);
    expect(html).toMatch(/<button class="u-btn primary sm">View<\/button>/);
  });

  it("keeps Role and Instructions open for writing", () => {
    expect(html.match(/class="[^"]*u-field-text/g)).toHaveLength(2);
  });

  it("locks the Model and Tools boxes", () => {
    expect(html.match(/u-node is-locked/g)).toHaveLength(2);
    expect(html).toContain("Locked");
  });

  it("no longer says the settings cannot be read, or mentions a diagram", () => {
    expect(html).not.toMatch(/can.t be read/);
    expect(html).not.toContain("diagram");
  });
});

describe("the Build view of a valid file", () => {
  const html = editor(VALID);

  it("has no banner and no locked box", () => {
    expect(html).not.toContain("Invalid AFM file");
    expect(html).not.toContain("is-locked");
  });
});
