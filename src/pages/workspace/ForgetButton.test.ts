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
import { ForgetButton, ForgetConfirm } from "./ForgetButton";

describe("the Forget button beside a saved key", () => {
  const html = renderToStaticMarkup(createElement(ForgetButton, { name: "OPENAI_API_KEY", onForget: () => {} }));

  it("starts as one quiet button that names the key for a screen reader", () => {
    expect(html).toContain(">Forget<");
    expect(html).toContain('aria-label="Forget OPENAI_API_KEY"');
    expect(html).not.toContain("Cancel");
  });
});

describe("asking before a key is forgotten", () => {
  const html = renderToStaticMarkup(createElement(ForgetConfirm, { name: "OPENAI_API_KEY", onCancel: () => {}, onForget: () => {} }));

  it("offers Cancel and Forget, and names the key for a screen reader", () => {
    expect(html).toContain(">Cancel<");
    expect(html).toContain(">Forget<");
    expect(html).toContain('aria-label="Forget OPENAI_API_KEY?"');
  });

  it("lists Cancel first and marks Forget as the risky one", () => {
    expect(html.indexOf("Cancel")).toBeLessThan(html.indexOf(">Forget<"));
    expect(html).toMatch(/class="u-btn danger sm"[^>]*>Forget</);
  });
});
