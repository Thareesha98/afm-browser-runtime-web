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

import type { StartStage } from "./start-copy";

type StartView = "menu" | "templates" | "prompt" | "import";

export function stageOf(view: StartView, flow: { writing: boolean; hasDraft: boolean; hasQuestions: boolean }): StartStage {
  if (view === "import" || view === "templates") return view;
  if (flow.writing) return "writing";
  if (flow.hasDraft) return "draft";
  if (flow.hasQuestions) return "questions";
  return view;
}

export type EscapeAction = "close" | "back" | "restart" | "none";

export function escapeAction(stage: StartStage): EscapeAction {
  switch (stage) {
    case "menu":
      return "close";
    case "templates":
    case "prompt":
    case "import":
      return "back";
    case "questions":
    case "draft":
      return "restart";
    case "writing":
      return "none";
  }
}

export function outsideClickAction(stage: StartStage): "close" | "none" {
  return stage === "menu" ? "close" : "none";
}

export function canClose(stage: StartStage): boolean {
  return stage !== "writing";
}
