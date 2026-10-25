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


import { afterEach, describe, expect, it, vi } from "vitest";
import { brief, briefMessage, logDetails } from "./brief-error";

const PROXY =
  "No MCP proxy is configured. AFM does not connect to external servers directly from the browser - set an MCP proxy (VITE_MCP_PROXY_URL) before connecting tools.";

describe("briefMessage", () => {
  it("turns the long proxy message into MCP error", () => {
    expect(briefMessage(PROXY)).toBe("MCP error");
  });

  it("names a rejected key", () => {
    expect(briefMessage("401 Incorrect API key provided: sk-abc. You can find your API key at https://platform.openai.com/account")).toBe("Key not accepted");
  });

  it("names a network failure, a slow answer and a busy server", () => {
    expect(briefMessage("TypeError: Failed to fetch")).toBe("Can't be reached");
    expect(briefMessage("The request timed out after 30000ms while waiting for the server to answer")).toBe("Took too long");
    expect(briefMessage("429 Too many requests, slow down and retry after a while please")).toBe("Busy right now");
  });

  it("keeps a message that is already short", () => {
    expect(briefMessage("Allow pop-ups to sign in.")).toBe("Allow pop-ups to sign in.");
    expect(briefMessage("Failed to fetch")).toBe("Can't be reached");
  });

  it("replaces anything else that is long", () => {
    expect(briefMessage("Unexpected token < in JSON at position 0 while parsing the response body from the model provider")).toBe("Something went wrong");
  });
});

describe("what reaches the console", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the full text once when it is shortened", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const text = `${PROXY} (once)`;
    brief(text);
    brief(text);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(text);
  });

  it("does not log a message that is shown as it is", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    brief("Nothing came back.");
    expect(spy).not.toHaveBeenCalled();
  });

  it("logs details for a label that is already short", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logDetails("detail only for the console");
    logDetails("detail only for the console");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
