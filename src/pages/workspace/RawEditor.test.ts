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
import { RawEditor } from "./EditorPane";

function raw(issues: Parameters<typeof RawEditor>[0]["issues"]): string {
  return renderToStaticMarkup(createElement(RawEditor, { content: "---\nname: A\n---\n", onChange: () => {}, issues }));
}

describe("the check under the Raw editor", () => {
  it("says No problems, with a capital, and nothing more", () => {
    const html = raw([]);
    expect(html).toContain("No problems");
    expect(html).not.toContain("no problems");
    expect(html).not.toContain("This file will run.");
  });

  it("lists the problems instead when there are some", () => {
    const html = raw([{ severity: "error", message: "A name is needed.", field: "name", line: 2 }]);
    expect(html).not.toContain("No problems");
    expect(html).toContain("Line 2");
  });
});
