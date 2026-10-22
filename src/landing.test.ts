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

import { describe, expect, it, vi } from "vitest";
import type { SavedAgent } from "./agents-store";
import { landingUrl, lastEditedAgent, openLastAgent } from "./landing";

const agent = (id: string, updatedAt: number): SavedAgent => ({
  id,
  name: id,
  description: "",
  source: "",
  origin: "blank",
  createdAt: 0,
  updatedAt,
});

const AGENTS = [agent("old", 100), agent("newest", 300), agent("middle", 200)];
const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash });

describe("the agent that opens when the site loads", () => {
  it("is the one edited most recently", () => {
    expect(lastEditedAgent(AGENTS)?.id).toBe("newest");
  });

  it("is nothing when no agent was ever saved", () => {
    expect(lastEditedAgent([])).toBeNull();
  });

  it("sends a plain visit to that agent", () => {
    expect(landingUrl("/", at("/"), AGENTS)).toBe("/?agentId=newest");
  });

  it("keeps the other parts of the address", () => {
    expect(landingUrl("/", at("/", "?utm=mail"), AGENTS)).toBe("/?utm=mail&agentId=newest");
  });

  it("works under the sub-folder the site is hosted in", () => {
    expect(landingUrl("/afm-browser-runtime-web/", at("/afm-browser-runtime-web/"), AGENTS)).toBe(
      "/afm-browser-runtime-web/?agentId=newest",
    );
    expect(landingUrl("/afm-browser-runtime-web/", at("/afm-browser-runtime-web"), AGENTS)).toBe(
      "/afm-browser-runtime-web?agentId=newest",
    );
  });

  it("leaves the Start dialog to a visitor with no saved agent", () => {
    expect(landingUrl("/", at("/"), [])).toBeNull();
  });

  it.each([
    ["an agent named in the address", at("/", "?agentId=old")],
    ["a file link", at("/", "?file=https%3A%2F%2Fexample.com%2Fa.afm.md")],
    ["an agent written into the address", at("/", "?afm=abc")],
    ["an agent written into the hash", at("/", "", "#afm=abc")],
    ["a chat link", at("/", "?view=chat")],
    ["a page that is not the app's front page", at("/elsewhere")],
  ])("leaves %s alone", (_label, where) => {
    expect(landingUrl("/", where, AGENTS)).toBeNull();
  });

  it("swaps the address in place, so Back does not return to the empty page", () => {
    const replace = vi.fn();
    openLastAgent({ base: "/", where: at("/"), agents: AGENTS, replace });
    expect(replace).toHaveBeenCalledWith("/?agentId=newest");
  });

  it("does nothing to the address when there is nowhere to go", () => {
    const replace = vi.fn();
    openLastAgent({ base: "/", where: at("/"), agents: [], replace });
    expect(replace).not.toHaveBeenCalled();
  });
});
