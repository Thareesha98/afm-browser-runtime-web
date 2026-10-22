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
import { SetupPane } from "./SetupPane";
import type { KeysState, SetupRow } from "./setup-check";

const ROWS: SetupRow[] = [{ id: "model", kind: "model", name: "gpt-4o", state: "ready", note: "" }];

function pane(keys: KeysState, ready = true): string {
  return renderToStaticMarkup(
    createElement(SetupPane, {
      rows: ROWS,
      keys,
      provider: "openai",
      ready,
      onConfigure: () => {},
      onCheckAgain: () => {},
      onRetryKeys: () => {},
      onRun: () => {},
    }),
  );
}

describe("the saved keys on the setup screen", () => {
  it("shows no row when nothing was saved on this device", () => {
    expect(pane("none")).not.toContain("u-run-keys");
  });

  it("says the device is asking while the keys open, and keeps Check again off", () => {
    const html = pane("opening", false);
    expect(html).toContain("Opening your saved keys");
    expect(html).toContain("Your device is asking.");
    expect(html).toContain("Waiting");
    expect(html).not.toContain("Try again");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Check again/);
  });

  it("says Opened once the keys are open", () => {
    const html = pane("opened");
    expect(html).toContain("Saved keys");
    expect(html).toContain("Opened");
    expect(html).not.toContain("is-bad");
  });

  it("says the device did not confirm, and offers Try again", () => {
    const html = pane("declined", false);
    expect(html).toContain("Your device didn&#x27;t confirm");
    expect(html).toContain("Nothing was opened.");
    expect(html).toContain("Try again");
    expect(html).toContain("u-run-keys is-bad");
  });
});
