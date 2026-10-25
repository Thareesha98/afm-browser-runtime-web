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

export type EscapeScope = "left" | "side" | "other" | "typing";

export type PanelTarget = "left" | "over" | "chat";

export interface PanelsOpen {
  left: boolean;
  side: boolean;
  over: boolean;
}

export function panelToClose(scope: EscapeScope, open: PanelsOpen): PanelTarget | null {
  if (scope === "typing") return null;
  const side: PanelTarget | null = !open.side ? null : open.over ? "over" : "chat";
  if (scope === "left") return open.left ? "left" : null;
  if (scope === "side") return side;
  return side ?? (open.left ? "left" : null);
}

export interface PanelSpot {
  top: string | null;
  depth: number;
}

export type FocusMove = "enter" | "swap" | "leave" | "none";

export function focusMove(before: PanelSpot, after: PanelSpot): FocusMove {
  if (after.depth > before.depth) return "enter";
  if (after.depth < before.depth) return "leave";
  return after.top !== before.top ? "swap" : "none";
}
