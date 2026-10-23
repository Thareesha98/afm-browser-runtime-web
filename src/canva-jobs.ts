// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
// Licensed under the Apache License, Version 2.0.

import type { ToolCall, ToolPort, ToolResult } from "@afm/engine";

const CREATE = "create-design";
const POLL = "get-create-design-async-job";
const MAX_WAIT_MS = 120_000;
const MAX_CHECKS = 8;

type ObjectValue = Record<string, unknown>;
interface Job {
  id: string;
  status: string;
  token?: string;
  dueAt?: number;
  result: ToolResult;
}

function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// MCP may return pretty-printed text, structured JSON, or both. Read complete
// JSON objects without interpreting prose, URLs or continuation-token contents.
function* jsonObjects(text: string): Generator<ObjectValue> {
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let at = 0; at < text.length; at++) {
    const char = text[at];
    if (start === -1) {
      if (char === "{") { start = at; depth = 1; }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      try {
        const value: unknown = JSON.parse(text.slice(start, at + 1));
        if (object(value)) yield value;
      } catch { /* Other content is passed through unchanged. */ }
      start = -1;
    }
  }
}

function readJob(result: ToolResult): Job | undefined {
  if (!result.ok) return undefined;
  for (const value of jsonObjects(result.content)) {
    if (typeof value.job_id !== "string" || typeof value.status !== "string") continue;
    const seconds = object(value.polling_policy) ? value.polling_policy.wait_seconds : undefined;
    return {
      id: value.job_id,
      status: value.status,
      token: typeof value.continuation_token === "string" ? value.continuation_token : undefined,
      dueAt: typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
        ? Date.now() + Math.max(1_000, seconds * 1_000)
        : undefined,
      result,
    };
  }
  return undefined;
}

function pending(job: Job): boolean {
  return ["pending", "in_progress", "polled_too_early"].includes(job.status);
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const aborted = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, ms);
    signal.addEventListener("abort", aborted, { once: true });
  });
}

/** Coalesce read-only Canva status checks inside the requested polling call.
 * Creation and every other operation keep their original permission boundary.
 * No model round is spent merely waiting for the same generation job.
 */
export function canvaJobToolPort(inner: ToolPort, serverUrl: string): ToolPort {
  const host = new URL(serverUrl).hostname;
  if (host !== "mcp.canva.com" && host !== "api.canva.com") return inner;
  const jobs = new Map<string, Job>();
  const lifetime = new AbortController();

  function remember(result: ToolResult): Job | undefined {
    const job = readJob(result);
    if (job !== undefined) {
      jobs.delete(job.id);
      jobs.set(job.id, job);
      if (jobs.size > 32) jobs.delete(jobs.keys().next().value!);
    }
    return job;
  }

  return {
    list: () => inner.list(),
    async execute(call: ToolCall, signal: AbortSignal): Promise<ToolResult> {
      const active = AbortSignal.any([signal, lifetime.signal]);
      active.throwIfAborted();
      if (call.name !== POLL || !object(call.args) || typeof call.args.job_id !== "string") {
        const result = await inner.execute(call, active);
        if (call.name === CREATE) remember(result);
        return result;
      }

      const id = call.args.job_id;
      const deadline = Date.now() + MAX_WAIT_MS;
      let job = jobs.get(id);
      let nextCall = call;
      for (let checks = 0; checks < MAX_CHECKS; checks++) {
        active.throwIfAborted();
        if (job !== undefined) {
          if (job.status === "completed" || job.status === "failed") return job.result;
          if (job.dueAt !== undefined) {
            // Never shorten a service-requested interval to fit our own window.
            if (job.dueAt > deadline) return job.result;
            await wait(Math.max(0, job.dueAt - Date.now()), active);
          }
          if (job.token !== undefined) {
            nextCall = { ...call, args: { ...call.args, continuation_token: job.token } };
          }
        }
        active.throwIfAborted();
        const result = await inner.execute(nextCall, active);
        const returned = remember(result);
        if (returned?.id !== id || !pending(returned) || returned.dueAt === undefined || returned.token === undefined) {
          return result;
        }
        job = returned;
      }
      return job!.result;
    },
    async dispose(): Promise<void> {
      lifetime.abort();
      jobs.clear();
      await inner.dispose?.();
    },
  };
}
