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

import type { Needs } from "./readiness";
import type { ChipPhase } from "./use-ready-chip";

const TICK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const RING = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <circle cx="12" cy="12" r="7.5" />
  </svg>
);

const RING_LENGTH = 2 * Math.PI * 9;

// The small circle the chip opens from and closes back into: a ring that fills as the agent gets ready, then a tick.
function Dot({ done, total, ready }: { done: number; total: number; ready: boolean }) {
  const filled = ready ? RING_LENGTH : (RING_LENGTH * done) / total;
  return (
    <span className="u-need-dot" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <circle className="u-need-track" cx="12" cy="12" r="9" />
        <circle
          className="u-need-arc"
          cx="12"
          cy="12"
          r="9"
          transform="rotate(-90 12 12)"
          style={{ strokeDasharray: `${filled} ${RING_LENGTH}`, opacity: filled === 0 ? 0 : 1 }}
        />
        {ready && <path d="M8.2 12.4l2.7 2.7 5-5.2" stroke="currentColor" strokeWidth="2.2" />}
      </svg>
    </span>
  );
}

// What a screen reader hears when the chip changes (the chip itself is not a live region, because it comes and goes).
export function chipAnnouncement(needs: Needs, phase: ChipPhase): string {
  if (phase === "confirm") return "Ready to run";
  if (phase !== "missing") return "";
  const missing = needs.items.filter((item) => !item.done).map((item) => item.label);
  return `${needs.done} of ${needs.items.length} ready. ${missing.join(" and ")} missing.`;
}

export function ReadinessChip({ needs, phase, onHold }: { needs: Needs; phase: ChipPhase; onHold: (held: boolean) => void }) {
  if (phase === "hidden") return null;
  const ready = phase === "confirm" || phase === "leaving";
  return (
    <div
      className={`u-need${ready ? " ready" : ""}${phase === "leaving" ? " is-leaving" : ""}`}
      onMouseEnter={() => onHold(true)}
      onMouseLeave={() => onHold(false)}
    >
      <Dot done={needs.done} total={needs.items.length} ready={ready} />
      <span className="u-need-body">
        <span className="u-need-in">
          <span className="u-need-lead">{ready ? "Ready to run" : `Ready: ${needs.done}/${needs.items.length}`}</span>
          {needs.items.map((item) => {
            const done = ready || item.done;
            return (
              <span key={item.id} className={`u-need-item ${done ? "done" : "todo"}`}>
                {done ? TICK : RING}
                <span>{item.label}</span>
              </span>
            );
          })}
        </span>
      </span>
    </div>
  );
}
