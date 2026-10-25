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
import { Composer } from "./Composer";

const composer = (disabled: boolean) =>
  renderToStaticMarkup(
    createElement(Composer, { onSend: () => {}, onStop: () => {}, onAttach: async () => ({ attached: [], skipped: [] }), streaming: false, disabled }),
  );

describe("the message box", () => {
  it("has a name of its own, whatever the hint inside it says", () => {
    for (const disabled of [false, true]) {
      expect(composer(disabled)).toMatch(/<textarea[^>]*aria-label="Message the agent"/);
    }
  });
});

describe("the file boxes behind the Attach menu", () => {
  const inputs = composer(false).match(/<input[^>]*type="file"[^>]*>/g) ?? [];

  it("are three, and invisible", () => {
    expect(inputs).toHaveLength(3);
  });

  it("stay out of the Tab order and away from screen readers", () => {
    for (const input of inputs) {
      expect(input).toContain('tabindex="-1"');
      expect(input).toContain('aria-hidden="true"');
    }
  });
});
