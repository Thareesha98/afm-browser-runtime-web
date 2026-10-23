// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
// Licensed under the Apache License, Version 2.0.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowAllPermissions, runAgentTurn } from "@afm/engine";
import type { LoopEvent, ModelPort, ToolCall, ToolPort, ToolResult } from "@afm/engine";
import { canvaJobToolPort } from "./canva-jobs";

const CREATE = "create-design";
const POLL = "get-create-design-async-job";
const endpoint = "https://mcp.canva.com/mcp";
const signal = () => new AbortController().signal;
const call = (name = POLL, id = "job-a"): ToolCall => ({
  id: "call", name, args: { job_id: id, continuation_token: "token-0" },
});
const pending = (token: string, seconds = 15, id = "job-a", status = "in_progress"): ToolResult => ({
  ok: true,
  content: JSON.stringify({ job_id: id, status, continuation_token: token, polling_policy: { wait_seconds: seconds } }),
});
const completed = (): ToolResult => ({ ok: true, content: JSON.stringify({
  job_id: "job-a", status: "completed", design: { id: "design-a", edit_url: "https://www.canva.com/design/design-a/edit" },
}) });
function server(results: ToolResult[]) {
  const calls: { call: ToolCall; at: number }[] = [];
  const inner: ToolPort = {
    list: async () => [CREATE, POLL].map((name) => ({ name, inputSchema: {} })),
    execute: vi.fn(async (requested) => {
      calls.push({ call: requested, at: Date.now() });
      const result = results.shift();
      if (result === undefined) throw new Error("Unexpected additional network call");
      return result;
    }),
    dispose: vi.fn(),
  };
  return { inner, calls, port: canvaJobToolPort(inner, endpoint) };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe("Canva asynchronous generation", () => {
  it("waits before the first check and follows rotated tokens without repeated model rounds", async () => {
    const { port, calls } = server([pending("token-1"), pending("token-2"), completed()]);
    await port.execute(call(CREATE), signal());
    const checking = port.execute(call(), signal());
    await vi.advanceTimersByTimeAsync(14_999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.call.args).toEqual({ job_id: "job-a", continuation_token: "token-1" });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await checking).toEqual(completed());
    expect(calls[2]!.call.args).toEqual({ job_id: "job-a", continuation_token: "token-2" });
    expect(calls.map(({ at }) => at)).toEqual([0, 15_000, 30_000]);
    expect(await port.execute(call(), signal())).toEqual(completed());
    expect(calls).toHaveLength(3);
  });

  it("lets the real agent loop return the finished link within the existing token budget", async () => {
    const { port, calls } = server([
      pending("token-1"), ...Array.from({ length: 5 }, (_, i) => pending(`token-${i + 2}`)), completed(),
    ]);
    let rounds = 0;
    const model: ModelPort = {
      async *stream(request) {
        rounds++;
        const last = request.messages.at(-1);
        if (last?.role === "tool" && last.content.includes('"status":"completed"')) {
          yield { type: "text-delta", text: "Created: https://www.canva.com/design/design-a/edit" };
          yield { type: "usage", inputTokens: 159_000, outputTokens: 1_000 };
          yield { type: "finish", reason: "stop" };
        } else {
          const next = rounds === 1 ? call(CREATE) : call();
          yield { type: "tool-call", id: `call-${rounds}`, name: next.name, args: next.args };
          yield { type: "usage", inputTokens: 159_000, outputTokens: 1_000 };
          yield { type: "finish", reason: "tool-calls" };
        }
      },
    };
    const events: LoopEvent[] = [];
    const running = (async () => {
      for await (const event of runAgentTurn({
        system: "Create a project presentation.", messages: [{ role: "user", content: "Create the presentation." }],
        model, tools: port, permission: allowAllPermissions,
        budget: { maxTokens: 1_000_000 },
      })) events.push(event);
    })();
    await vi.runAllTimersAsync();
    await running;
    expect(rounds).toBe(3);
    expect(calls).toHaveLength(7);
    expect(events.filter((e) => e.type === "tool-call")).toHaveLength(2);
    expect(events).toContainEqual({ type: "text-delta", text: "Created: https://www.canva.com/design/design-a/edit" });
    expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
  });

  it("cancels a scheduled check without sending another request", async () => {
    const { port, calls } = server([pending("token-1"), completed()]);
    await port.execute(call(CREATE), signal());
    const controller = new AbortController();
    const checking = port.execute(call(), controller.signal);
    const rejected = expect(checking).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    await vi.runAllTimersAsync();
    expect(calls).toHaveLength(1);
  });

  it("disposes the pending wait and closes the underlying connection", async () => {
    const { port, inner, calls } = server([pending("token-1"), completed()]);
    await port.execute(call(CREATE), signal());
    const checking = port.execute(call(), signal());
    const rejected = expect(checking).rejects.toMatchObject({ name: "AbortError" });
    await port.dispose?.();
    await rejected;
    expect(inner.dispose).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(1);
  });

  it("returns a pending job rather than polling before a long service interval", async () => {
    const result = pending("token-long", 180);
    const { port, calls } = server([result]);
    await port.execute(call(CREATE), signal());
    expect(await port.execute(call(), signal())).toEqual(result);
    expect(calls).toHaveLength(1);
  });

  it("bounds polling and returns the real latest pending state for later continuation", async () => {
    const { port, calls } = server(Array.from({ length: 10 }, (_, i) => pending(`token-${i}`)));
    await port.execute(call(CREATE), signal());
    const checking = port.execute(call(), signal());
    await vi.runAllTimersAsync();
    const result = await checking;
    expect(calls).toHaveLength(9);
    expect(Date.now()).toBe(120_000);
    expect(JSON.parse(result.content).continuation_token).toBe("token-8");
  });

  it("honours a too-early response and never recreates the design", async () => {
    const { port, calls } = server([pending("token-1", 20, "job-a", "polled_too_early"), completed()]);
    const checking = port.execute(call(), signal());
    await vi.runAllTimersAsync();
    expect(await checking).toEqual(completed());
    expect(calls.map(({ at }) => at)).toEqual([0, 20_000]);
    expect(calls.every(({ call: requested }) => requested.name === POLL)).toBe(true);
  });

  it("supports duplicated pretty-printed MCP JSON without copying opaque token contents", async () => {
    const result = pending('opaque-{"nested":true}', 2);
    const json = JSON.stringify(JSON.parse(result.content), null, 2);
    const { port, calls } = server([{ ok: true, content: `${json}\n${result.content}` }, completed()]);
    await port.execute(call(CREATE), signal());
    const checking = port.execute(call(), signal());
    await vi.runAllTimersAsync();
    expect(await checking).toEqual(completed());
    expect(calls[1]!.call.args).toEqual({ job_id: "job-a", continuation_token: 'opaque-{"nested":true}' });
  });

  it.each([
    { ok: false, content: "Authentication failed" },
    { ok: true, content: '{"job_id":"job-a","status":"failed","failure":{"code":"generation_failed"}}' },
    { ok: true, content: '{"job_id":"job-a","status":"in_progress","continuation_token":"no-policy"}' },
    { ok: true, content: "A result without job metadata" },
    pending("wrong-job", 15, "different-job"),
  ])("does not retry a failure, incomplete policy or unrelated job: %j", async (result) => {
    const { port, calls } = server([result]);
    expect(await port.execute(call(), signal())).toEqual(result);
    expect(calls).toHaveLength(1);
  });

  it("leaves other servers, tools and the offered schemas unchanged", async () => {
    const { inner, port, calls } = server([pending("token-1")]);
    expect(canvaJobToolPort(inner, "https://other.example/mcp")).toBe(inner);
    expect(await port.list()).toEqual(await inner.list());
    expect(await port.execute(call("export-design"), signal())).toEqual(pending("token-1"));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.call.name).toBe("export-design");
  });
});
