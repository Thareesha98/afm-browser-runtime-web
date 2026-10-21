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

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ChipStatus } from "./readiness";

export type ChipPhase = "missing" | "confirm" | "leaving" | "hidden";

// An agent that is opened with something missing waits this long before the chip opens.
export const SHOW_DELAY_MS = 3000;
export const CONFIRM_MS = 3000;
// How long the closing animation takes (the CSS in workspace.css plays it; the chip is removed once it is done).
export const LEAVE_MS = 560;
// The readiness check settles a moment after typing stops, so "the person just typed it" has to allow for that.
export const EDIT_WINDOW_MS = 1500;

// How the chip reacts when what the agent needs changes.
// Opening an agent with something missing shows it after a short wait; while the person is typing it is there at once.
// When the last missing thing is filled in by typing, it turns green for a moment, then closes.
// Opening an agent that is already complete shows nothing.
export function phaseOnStatus(phase: ChipPhase, before: ChipStatus, status: ChipStatus, typedJustNow: boolean): ChipPhase {
  if (status === "missing") return phase !== "hidden" || typedJustNow ? "missing" : "hidden";
  if (status === "none") return "hidden";
  if (before === "missing" && typedJustNow) return "confirm";
  return phase === "confirm" || phase === "leaving" ? phase : "hidden";
}

export function useReadyChip(status: ChipStatus, lastEditAt: MutableRefObject<number>, held: boolean): ChipPhase {
  const [phase, setPhase] = useState<ChipPhase>("hidden");
  const before = useRef(status);

  useEffect(() => {
    const was = before.current;
    before.current = status;
    setPhase((current) => phaseOnStatus(current, was, status, Date.now() - lastEditAt.current < EDIT_WINDOW_MS));
  }, [status, lastEditAt]);

  // an agent opened with something missing: the chip opens after a short wait
  useEffect(() => {
    if (phase !== "hidden" || status !== "missing") return;
    const timer = window.setTimeout(() => setPhase("missing"), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, status]);

  // the green state stays for a few seconds, and waits while the pointer rests on the chip
  useEffect(() => {
    if (phase !== "confirm" || held) return;
    const timer = window.setTimeout(() => setPhase("leaving"), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [phase, held]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("hidden"), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return phase;
}
