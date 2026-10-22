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
import { StartDialog } from "./StartDialog";

type Props = Parameters<typeof StartDialog>[0];

function render(props: Partial<Props> = {}): string {
  return renderToStaticMarkup(
    createElement(StartDialog, {
      title: "Start a new agent",
      footer: "A footer sentence.",
      focusKey: "menu",
      onEscape: () => {},
      children: createElement("p", null, "inside"),
      ...props,
    }),
  );
}

describe("the Start dialog frame", () => {
  it("is a modal dialog named by its title", () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Start a new agent");
  });

  it("describes itself with its subtitle when it has one", () => {
    const html = render({ subtitle: "Pick how you want to begin." });
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Pick how you want to begin.");
    expect(render()).not.toContain("aria-describedby");
  });

  it("shows the footer sentence under the content", () => {
    const html = render();
    expect(html.indexOf("inside")).toBeLessThan(html.indexOf("A footer sentence."));
  });

  it("offers Close only when it can be closed", () => {
    expect(render({ onClose: () => {} })).toContain('aria-label="Close"');
    expect(render()).not.toContain('aria-label="Close"');
  });

  it("offers Back only when there is somewhere to go back to", () => {
    expect(render({ onBack: () => {} })).toContain("Back");
    expect(render()).not.toContain("u-dlg-back");
  });

  it("can be made narrower for steps without cards", () => {
    expect(render({ narrow: true })).toContain('class="u-dlg narrow"');
    expect(render()).toContain('class="u-dlg"');
  });
});
