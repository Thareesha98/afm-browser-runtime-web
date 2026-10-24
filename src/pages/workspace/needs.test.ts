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
import type { AgentMetadata } from "@afm/engine";
import { chipStatus, needsToRun, readiness, readinessSentence, runReason } from "./readiness";
import type { ReadinessInput } from "./readiness";

const WITH_MODEL = { name: "A", model: { provider: "openai", name: "gpt-4o" } } as AgentMetadata;
const NO_MODEL = { name: "A" } as AgentMetadata;

const needs = (role: string, instructions: string, metadata: AgentMetadata | null = WITH_MODEL) => needsToRun({ role, instructions, metadata });

describe("needsToRun", () => {
  it("lists Role, Instructions and Model in that order", () => {
    expect(needs("a", "b")!.items.map((item) => item.label)).toEqual(["Role", "Instructions", "Model"]);
  });

  it("marks what is there and counts it", () => {
    const n = needs("You are a tutor.", "")!;
    expect(n.items.map((item) => item.done)).toEqual([true, false, true]);
    expect(n.done).toBe(2);
    expect(n.allDone).toBe(false);
  });

  it("counts blank text as missing", () => {
    expect(needs("   ", "\n")!.done).toBe(1);
  });

  it("is complete when all three are there", () => {
    expect(needs("a", "b")!.allDone).toBe(true);
  });

  it("counts a missing model", () => {
    const n = needs("a", "b", NO_MODEL)!;
    expect(n.items.map((item) => item.done)).toEqual([true, true, false]);
  });

  it("says nothing when the settings at the top of the file cannot be read", () => {
    expect(needs("a", "b", null)).toBeNull();
  });
});

describe("runReason", () => {
  it("names a role and instructions together", () => {
    expect(runReason(needs("", "")!)).toBe("Add a role and instructions to run");
  });

  it("names only the role when only the role is missing", () => {
    expect(runReason(needs("", "b")!)).toBe("Add a role to run");
  });

  it("says the role is done when only the instructions are missing", () => {
    expect(runReason(needs("a", "")!)).toBe("Add instructions to run. Role is done.");
  });

  it("names a missing model", () => {
    expect(runReason(needs("a", "b", NO_MODEL)!)).toBe("Add a model to run");
  });

  it("lists all three", () => {
    expect(runReason(needs("", "", NO_MODEL)!)).toBe("Add a role, instructions and a model to run");
  });

  it("has nothing to say when nothing is missing", () => {
    expect(runReason(needs("a", "b")!)).toBeNull();
  });
});

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    role: "You are a tutor.",
    instructions: "Be brief.",
    metadata: WITH_MODEL,
    issues: [],
    status: "ready",
    current: false,
    failed: false,
    brokenServerIds: [],
    serverNameByUrl: new Map(),
    ...over,
  };
}

describe("chipStatus", () => {
  it("shows the chip while something is missing", () => {
    expect(chipStatus(needs("", "b"), readiness(input({ role: "" })))).toBe("missing");
  });

  it("is ready when all three are there and nothing else is wrong", () => {
    expect(chipStatus(needs("a", "b"), readiness(input()))).toBe("ready");
  });

  it("leaves it to the line under the editor when the file has another problem", () => {
    const problem = readiness(input({ issues: [{ severity: "error", message: "Unknown field 'x'.", field: "x", line: 2 }] }));
    expect(chipStatus(needs("a", "b"), problem)).toBe("none");
  });

  it("shows nothing when the settings cannot be read", () => {
    expect(chipStatus(null, readiness(input({ metadata: null })))).toBe("none");
  });
});

describe("the line under the editor and the chip", () => {
  it("lets the chip say what is missing", () => {
    expect(readiness(input({ role: "" })).chip).toBe(true);
    expect(readiness(input({ instructions: "" })).chip).toBe(true);
    expect(readiness(input({ metadata: NO_MODEL })).chip).toBe(true);
  });

  it("lets the chip say it is ready", () => {
    expect(readiness(input()).chip).toBe(true);
  });

  it("stays quiet under the banner that says the file is invalid", () => {
    const state = readiness(input({ metadata: null }));
    expect(readinessSentence(state)).toBe("Invalid AFM file");
    expect(state.chip).toBe(true);
  });

  it("keeps speaking for everything the chip does not cover", () => {
    expect(readiness(input({ status: "streaming" })).chip).toBeUndefined();
    expect(readiness(input({ current: true })).chip).toBeUndefined();
    expect(readiness(input({ failed: true })).chip).toBeUndefined();
    expect(readiness(input({ issues: [{ severity: "error", message: "x", field: "", line: null }] })).chip).toBeUndefined();
  });
});

describe("readinessSentence", () => {
  it("reads the lead, subject and tail as one line", () => {
    expect(readinessSentence({ tone: "bad", lead: "Has a problem - ", subject: "bad field" })).toBe("Has a problem - bad field");
    expect(readinessSentence({ tone: "ok", lead: "Ready" })).toBe("Ready");
  });
});
