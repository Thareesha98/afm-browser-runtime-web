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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BuildPane } from "./BuildPane";
import { ReadinessChip, chipAnnouncement } from "./ReadinessChip";
import type { Needs } from "./readiness";
import type { ChipPhase } from "./use-ready-chip";
import type { OpenPanel, ServerReach } from "./BuildPane";
import type { AgentActivity } from "./agent-activity";
import { buildableAgent, collectAfmIssues } from "../../agent-validation";
import { ModeSwitch } from "./ViewControls";
import type { EditorMode } from "./ViewControls";
import type { BuildableAgent } from "../../agent-validation";

import { downloadAgentFile } from "../../download-agent-file";
import { getFrontmatterScalar } from "./agent-source-edit";
import { FileCheckPanel } from "./FileCheckPanel";
import { CodeEditor } from "./CodeEditor";

interface EditableProps {
  content: string;
  onChange: (content: string) => void;
}

interface Props extends EditableProps {
  activity: AgentActivity;
  reach: ServerReach;
  onOpenModel: () => void;
  onOpenServer: (name: string | null) => void;
  showRaw?: number;
  onOpenPanel?: (panel: "model" | "tools") => void;
  chip?: { needs: Needs; phase: ChipPhase; onHold: (held: boolean) => void };
  // buttons that sit at the end of the Build / Raw row on a narrow window (they are in the header otherwise)
  toolbarExtras?: ReactNode;
  openPanel?: OpenPanel;
}

function agentFilename(content: string): string | undefined {
  const name = getFrontmatterScalar(content, "name").trim();
  if (name === "") return undefined;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug === "" ? "agent" : slug}.afm.md`;
}

export function EditorPane({ content, onChange, activity, reach, onOpenModel, onOpenServer, showRaw = 0, onOpenPanel, chip, toolbarExtras, openPanel }: Props) {
  const [mode, setMode] = useState<EditorMode>("simple");
  const firstRaw = useRef(showRaw);
  useEffect(() => {
    if (showRaw !== firstRaw.current) setMode("raw");
  }, [showRaw]);
  const buildable = buildableAgent(content);
  const issues = collectAfmIssues(content);
  const filename = agentFilename(content);

  // The readiness chip floats in this row, centred over the card (or over the row when there is no card, as in Raw).
  const top = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = top.current;
    if (row === null) return;
    const card = row.parentElement?.querySelector<HTMLElement>(".u-brief") ?? null;
    const place = () => {
      if (card === null) return row.style.removeProperty("--need-x");
      const r = row.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      row.style.setProperty("--need-x", `${c.left + c.width / 2 - r.left}px`);
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(row);
    if (card !== null) watch.observe(card);
    return () => watch.disconnect();
  }, [mode, buildable.ok]);

  return (
    <>
      <div className="u-stage-top" ref={top}>
        <ModeSwitch mode={mode} onMode={setMode} />
        {mode === "raw" && (
          <>
            <span className="u-spacer" />
            <span className="u-raw-file">{filename ?? "agent.afm.md"}</span>
            <button className="u-btn ghost sm" onClick={() => downloadAgentFile(content, filename)}>
              Download
            </button>
          </>
        )}
        {toolbarExtras !== undefined && <span className="u-stage-tools">{toolbarExtras}</span>}
        {chip !== undefined && (
          <>
            <ReadinessChip needs={chip.needs} phase={chip.phase} onHold={chip.onHold} />
            <span className="visually-hidden" role="status" aria-live="polite">
              {chipAnnouncement(chip.needs, chip.phase)}
            </span>
          </>
        )}
      </div>

      {mode === "raw" ? (
        <RawEditor content={content} onChange={onChange} issues={issues} />
      ) : (
        <SimpleEditor
          content={content}
          onChange={onChange}
          buildable={buildable}
          issues={issues}
          onFix={(target) => {
            if (target === "model" || target === "tools") onOpenPanel?.(target);
            else setMode("raw");
          }}
          activity={activity}
          reach={reach}
          onOpenModel={onOpenModel}
          onOpenServer={onOpenServer}
          openPanel={openPanel}
        />
      )}
    </>
  );
}

export function RawEditor({
  content,
  onChange,
  issues,
}: EditableProps & { issues: ReturnType<typeof collectAfmIssues> }) {
  const errorLines = new Set(
    issues.filter((issue) => issue.severity === "error" && issue.line !== null).map((issue) => issue.line as number),
  );
  return (
    <div className="u-stage-canvas">
      <div className="u-rawwrap">
        <CodeEditor value={content} onChange={onChange} errorLines={errorLines} />
        {issues.length === 0 ? (
          <div className="u-checks">
            <span className="u-chip ok">
              <span className="u-dot" aria-hidden="true" />
              No problems
            </span>
          </div>
        ) : (
          <FileCheckPanel issues={issues} />
        )}
      </div>
    </div>
  );
}

function SimpleEditor({
  content,
  onChange,
  buildable,
  issues,
  activity,
  reach,
  onOpenModel,
  onOpenServer,
  onFix,
  openPanel,
}: EditableProps & {
  buildable: BuildableAgent;
  issues: ReturnType<typeof collectAfmIssues>;
  activity: AgentActivity;
  reach: ServerReach;
  onOpenModel: () => void;
  onOpenServer: (name: string | null) => void;
  onFix: (target: import("./issue-words").IssueTarget) => void;
  openPanel?: OpenPanel;
}) {
  if (!buildable.ok) {
    return (
      <div className="u-stage-canvas u-stage-canvas-centre">
        <div className="fallback">
          <span className="fallback-ico" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v5M12 17.4h.01" />
              <path d="M10.3 3.9L2.4 17.4A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3.1L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
          </span>
          <h4>The settings at the top can&apos;t be read</h4>
          <p>Something in the block above <code>---</code> is not valid, so the diagram cannot be drawn from it. The rest of your writing is untouched.</p>
        </div>
        <FileCheckPanel issues={issues} plain onFix={onFix} />
      </div>
    );
  }

  return (
    <div className="u-stage-canvas">
      <BuildPane
          content={content}
          onChange={onChange}
          metadata={buildable.metadata}
          onOpenModel={onOpenModel}
          onOpenServer={onOpenServer}
          activity={activity}
          reach={reach}
          openPanel={openPanel}
      />
    </div>
  );
}
