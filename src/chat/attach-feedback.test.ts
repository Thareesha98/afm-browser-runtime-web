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
import { attachFeedback } from "./attach-feedback";

describe("what the message box says after files are added", () => {
  it("says nothing when nothing was added or skipped", () => {
    expect(attachFeedback([], [])).toBeNull();
  });

  it("names the files that were attached", () => {
    expect(attachFeedback(["notes.md", "plan.txt"], [])).toBe("Attached notes.md, plan.txt.");
  });

  it("names a skipped file and gives the reason", () => {
    expect(attachFeedback([], [{ name: "big.pdf", reason: "is larger than 15 MB" }])).toBe("big.pdf is larger than 15 MB.");
  });

  it("does not end a sentence with two full stops", () => {
    expect(attachFeedback([], [{ name: "x.pdf", reason: "couldn't be read: Invalid PDF structure." }])).toBe("x.pdf couldn't be read: Invalid PDF structure.");
  });

  it("says what was attached and what was not", () => {
    expect(attachFeedback(["a.md"], [{ name: "photo.png", reason: "is not a supported file type (PDF, Markdown, or plain text only)" }])).toBe(
      "Attached a.md. photo.png is not a supported file type (PDF, Markdown, or plain text only).",
    );
  });

  it("keeps a long list short", () => {
    expect(attachFeedback(["a", "b", "c", "d", "e"], [])).toBe("Attached a, b, c and 2 more.");
    const skipped = ["1", "2", "3", "4"].map((name) => ({ name, reason: "is too big" }));
    expect(attachFeedback([], skipped)).toBe("1 is too big. 2 is too big. 2 more skipped.");
  });
});
