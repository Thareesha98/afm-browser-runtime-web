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
import { KeepOnDevice, ON_DEVICE, TAB_ONLY } from "./KeepOnDevice";

const { support } = vi.hoisted(() => ({ support: vi.fn<() => passkey.PasskeySupport | null>() }));

vi.mock("../../passkey/usePasskeySupport", () => ({ usePasskeySupport: support }));

function render(keep: boolean): string {
  return renderToStaticMarkup(createElement(KeepOnDevice, { keep, onChange: () => {} }));
}

describe("Keep on this device", () => {
  beforeEach(() => {
    support.mockReset();
  });

  it("offers the choice and says the key is gone with the tab while it is off", () => {
    support.mockReturnValue({ usable: true });
    const html = render(false);
    expect(html).toContain("Keep on this device");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("checked");
    expect(html).toContain(TAB_ONLY);
  });

  it("says what the device will ask for once it is on", () => {
    support.mockReturnValue({ usable: true });
    const html = render(true);
    expect(html).toContain("checked");
    expect(html).toContain(ON_DEVICE);
  });

  it("is switched off and gives the reason when passkeys cannot be used here", () => {
    support.mockReturnValue({ usable: false, reason: "This browser does not support passkeys." });
    const html = render(true);
    expect(html).toContain("disabled");
    expect(html).not.toContain("checked");
    expect(html).toContain(`${TAB_ONLY} This browser does not support passkeys.`);
  });

  it("stays off, with no reason yet, until the browser has been asked", () => {
    support.mockReturnValue(null);
    const html = render(true);
    expect(html).toContain("disabled");
    expect(html).toContain(`>${TAB_ONLY}</p>`);
  });
});
