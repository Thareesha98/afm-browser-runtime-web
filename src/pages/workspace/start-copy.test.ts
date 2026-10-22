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
import { START_CARDS, START_FOOTERS, START_SUBTITLES, START_TITLES, templatesNote } from "./start-copy";
import type { StartStage } from "./start-copy";

const STAGES: StartStage[] = ["menu", "templates", "prompt", "import", "questions", "writing", "draft"];

describe("the words of the Start dialog", () => {
  it("gives every step a title and a footer", () => {
    for (const stage of STAGES) {
      expect(START_TITLES[stage]).not.toBe("");
      expect(START_FOOTERS[stage]).not.toBe("");
    }
  });

  it("writes every footer as full sentences that end with a full stop", () => {
    for (const stage of STAGES) expect(START_FOOTERS[stage]).toMatch(/^[A-Z].*\.$/);
  });

  it("keeps footers short enough to sit on two lines", () => {
    for (const stage of STAGES) expect(START_FOOTERS[stage].length).toBeLessThanOrEqual(110);
  });

  it("keeps key hints out of the footers", () => {
    for (const stage of STAGES) expect(START_FOOTERS[stage]).not.toMatch(/\bEsc\b/);
  });

  it("makes no claim about where agents are stored", () => {
    for (const stage of STAGES) expect(START_FOOTERS[stage]).not.toMatch(/stored|saved|this tab|installed/i);
  });

  it("ends every subtitle with a full stop", () => {
    for (const text of Object.values(START_SUBTITLES)) expect(text).toMatch(/\.$/);
  });

  it("names the number of templates in words", () => {
    expect(templatesNote(4)).toBe("Agents that already do something useful. Four to choose from.");
    expect(templatesNote(2)).toBe("Agents that already do something useful. Two to choose from.");
    expect(templatesNote(25)).toBe("Agents that already do something useful. 25 to choose from.");
  });

  it("says Generate with AI uses the person's own key", () => {
    expect(START_CARDS.generate).toContain("Uses your own API key.");
  });
});
