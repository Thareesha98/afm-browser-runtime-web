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
import { CONFIRM_MS, LEAVE_MS, phaseOnStatus } from "./use-ready-chip";

describe("the readiness chip over the editor", () => {
  it("shows while something is missing", () => {
    expect(phaseOnStatus("hidden", "ready", "missing", true)).toBe("missing");
    expect(phaseOnStatus("hidden", "missing", "missing", false)).toBe("missing");
  });

  it("turns green when the last thing is typed in", () => {
    expect(phaseOnStatus("missing", "missing", "ready", true)).toBe("confirm");
  });

  it("stays hidden when an agent that is already complete is opened", () => {
    expect(phaseOnStatus("missing", "missing", "ready", false)).toBe("hidden");
    expect(phaseOnStatus("hidden", "ready", "ready", false)).toBe("hidden");
  });

  it("comes back at once when something goes missing, even while it is green", () => {
    expect(phaseOnStatus("confirm", "ready", "missing", false)).toBe("missing");
    expect(phaseOnStatus("leaving", "ready", "missing", false)).toBe("missing");
  });

  it("shows nothing when the file cannot be read", () => {
    expect(phaseOnStatus("missing", "missing", "none", true)).toBe("hidden");
    expect(phaseOnStatus("confirm", "ready", "none", false)).toBe("hidden");
  });

  it("keeps the green state or the fade it is in", () => {
    expect(phaseOnStatus("confirm", "ready", "ready", false)).toBe("confirm");
    expect(phaseOnStatus("leaving", "ready", "ready", false)).toBe("leaving");
  });

  it("stays green for two seconds, then fades over a fifth of a second", () => {
    expect(CONFIRM_MS).toBe(2000);
    expect(LEAVE_MS).toBe(200);
  });
});
