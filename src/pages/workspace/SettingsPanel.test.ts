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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { passkey } from "@afm/adapter-secret";
import type { useStandaloneSession } from "../../worker-client/useStandaloneSession";
import { SettingsPanel } from "./SettingsPanel";

const { support } = vi.hoisted(() => ({ support: vi.fn<() => passkey.PasskeySupport | null>() }));

vi.mock("../../passkey/usePasskeySupport", () => ({ usePasskeySupport: support }));
vi.mock("../../app/ThemeContext", () => ({ useThemeContext: () => ({ setting: "auto", setTheme: () => {} }) }));

function panel(savedSecrets: string[], passkeySecrets: string[]): string {
  const session = { state: { savedSecrets, passkeySecrets } } as unknown as ReturnType<typeof useStandaloneSession>;
  return renderToStaticMarkup(createElement(SettingsPanel, { session }));
}

const count = (html: string, text: string) => html.split(`>${text}</button>`).length - 1;

describe("the keys in Settings", () => {
  beforeEach(() => {
    support.mockReset();
    support.mockReturnValue({ usable: true });
  });

  it("says there is no key yet when nothing is saved", () => {
    expect(panel([], [])).toContain("No key yet.");
  });

  it("offers to remember a key typed this session, and to forget it", () => {
    const html = panel(["OPENAI_API_KEY"], []);
    expect(html).toContain("OPENAI_API_KEY");
    expect(count(html, "Remember")).toBe(1);
    expect(count(html, "Forget")).toBe(1);
  });

  it("does not offer to remember a key that is already saved on this device", () => {
    const html = panel(["OPENAI_API_KEY"], ["OPENAI_API_KEY"]);
    expect(count(html, "Remember")).toBe(0);
    expect(count(html, "Forget")).toBe(1);
  });

  it("lists a saved key that has not been opened yet, so it can still be forgotten", () => {
    const html = panel([], ["ANTHROPIC_API_KEY"]);
    expect(html).toContain("ANTHROPIC_API_KEY");
    expect(count(html, "Remember")).toBe(0);
    expect(count(html, "Forget")).toBe(1);
  });

  it("does not offer Remember where passkeys cannot be used", () => {
    support.mockReturnValue({ usable: false, reason: "This browser does not support passkeys." });
    expect(count(panel(["OPENAI_API_KEY"], []), "Remember")).toBe(0);
  });

  it("keeps sign-ins out of the list of keys", () => {
    const html = panel(["afm.oauth.[\"a\"].refresh"], ["afm.oauth.[\"a\"].refresh"]);
    expect(html).toContain("No key yet.");
  });
});
