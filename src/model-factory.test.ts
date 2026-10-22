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

import { describe, it, expect, vi, afterEach } from "vitest";
import { modelFromMetadata } from "./model-factory";
import { findProvider } from "./pages/workspace/model-catalog";

describe("modelFromMetadata", () => {
  it("builds an OpenAI model port", async () => {
    const port = await modelFromMetadata({
      provider: "openai",
      name: "gpt-4o",
      authentication: { type: "api-key", api_key: "sk-1" },
    });
    expect(typeof port.stream).toBe("function");
  });

  it("builds an Anthropic model port", async () => {
    const port = await modelFromMetadata({
      provider: "anthropic",
      authentication: { type: "api-key", api_key: "sk-1" },
    });
    expect(typeof port.stream).toBe("function");
  });

  it("defaults to OpenAI when no provider is given", async () => {
    const port = await modelFromMetadata({ authentication: { type: "bearer", token: "sk-1" } });
    expect(typeof port.stream).toBe("function");
  });

  it("throws when no key was resolved", async () => {
    await expect(modelFromMetadata({ provider: "openai" })).rejects.toThrow(/key/i);
  });

  it("treats a blank key as no key at all", async () => {
    await expect(
      modelFromMetadata({ provider: "openai", authentication: { type: "api-key", api_key: "" } }),
    ).rejects.toThrow(/key/i);
    await expect(
      modelFromMetadata({ provider: "openai", authentication: { type: "bearer", token: "   " } }),
    ).rejects.toThrow(/key/i);
  });

  it("throws for an unsupported provider", async () => {
    await expect(
      modelFromMetadata({ provider: "gemini", authentication: { type: "api-key", api_key: "k" } }),
    ).rejects.toThrow(/provider/i);
  });
});

describe("every OpenAI model in the list", () => {
  afterEach(() => vi.unstubAllGlobals());

  const request = {
    system: "You are helpful.",
    messages: [{ role: "user" as const, content: "hi" }],
    tools: [{ name: "search", description: "Search", inputSchema: { type: "object" as const, properties: { q: { type: "string" } } } }],
  };

  it("is sent by its own name to OpenAI's Responses endpoint, streaming, with the tools", async () => {
    const openai = findProvider("openai")!;
    for (const { id } of openai.models) {
      const seen: { url: string; body: Record<string, unknown> }[] = [];
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        seen.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
        return new Response("data: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
      });
      const port = await modelFromMetadata({ provider: "openai", name: id, authentication: { type: "api-key", api_key: "sk-1" } });
      for await (const event of port.stream(request as never, new AbortController().signal)) void event;
      expect(seen[0]?.url).toBe("https://api.openai.com/v1/responses");
      expect(seen[0]?.body.model).toBe(id);
      expect(seen[0]?.body.stream).toBe(true);
      expect(seen[0]?.body.tools).toHaveLength(1);
    }
  });

  it("is sent without settings that the newest models turn down", async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body ?? "{}"));
      return new Response("data: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const port = await modelFromMetadata({ provider: "openai", name: "gpt-6-astra", authentication: { type: "api-key", api_key: "sk-1" } });
    for await (const event of port.stream(request as never, new AbortController().signal)) void event;
    for (const setting of ["temperature", "top_p", "max_tokens", "max_completion_tokens", "max_output_tokens"]) {
      expect(body).not.toHaveProperty(setting);
    }
  });
});
