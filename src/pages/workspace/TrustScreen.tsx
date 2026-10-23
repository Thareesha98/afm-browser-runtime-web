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

import { useState } from "react";
import type { ReactNode } from "react";
import { referencedSecretNames } from "@afm/engine";
import type { AgentMetadata } from "@afm/engine";
import { hostOf } from "../../load-paths";
import { findProvider, shortModelLabel } from "./model-catalog";
import { displayName } from "./setup-check";
import { DialogFrame } from "./DialogFrame";

interface Props {
  metadata: AgentMetadata;
  source: string;
  savedSecrets: string[];
  fileUrl: string | null;
  onRun: () => void;
  onOpenBuilder: () => void;
  initialTools?: string | null;
}

export interface ServerTools {
  name: string;
  host: string | null;
  tools: string[];
}

export const TRUST_COPY = {
  lead: "Someone shared this agent with you. Here is what the file sets up, before it runs.",
  footer: "Nothing runs until you press Run it.",
  toolsFooter: "These are the tools this file lists.",
  toolsNote: "Tools the file lists run without asking. Any other tool asks first, unless you allow it in this tab.",
  keysNote: "A key you enter stays in memory for this tab unless you choose to save it on this device.",
};

const ICONS = {
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  model: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z",
  tools: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  link: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z",
};

function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function serverTools(metadata: AgentMetadata): ServerTools[] {
  return (metadata.tools?.mcp ?? []).map((server) => ({
    name: server.name,
    host: server.transport.type === "http" ? hostOf(server.transport.url) : null,
    tools: server.tool_filter?.allow ?? [],
  }));
}

export function linkedFileHost(fileUrl: string | null): string | null {
  try {
    const url = new URL(fileUrl ?? "");
    return url.protocol === "https:" ? url.host : null;
  } catch {
    return null;
  }
}

export function filterTools(tools: string[], query: string): string[] {
  const wanted = query.trim().toLowerCase();
  return wanted === "" ? tools : tools.filter((tool) => tool.toLowerCase().includes(wanted));
}

export function toolCount(count: number): string {
  return count === 1 ? "1 tool" : `${count} tools`;
}

function Row({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="u-tr-row">
      <span className="u-tr-i">
        <Icon path={icon} />
      </span>
      <div className="u-tr-b">
        <span className="u-tr-k">{label}</span>
        {children}
      </div>
    </div>
  );
}

export function TrustScreen({ metadata, source, savedSecrets, fileUrl, onRun, onOpenBuilder, initialTools = null }: Props) {
  const [listed, setListed] = useState<string | null>(initialTools);
  const [query, setQuery] = useState("");
  const keys = referencedSecretNames(source);
  const servers = serverTools(metadata);
  const fileHost = linkedFileHost(fileUrl);
  const open = servers.find((server) => server.name === listed);

  if (open !== undefined) {
    const back = () => setListed(null);
    const shown = filterTools(open.tools, query);
    return (
      <DialogFrame
        title={displayName(open.name)}
        subtitle={`${toolCount(open.tools.length)} ${open.tools.length === 1 ? "runs" : "run"} without asking in this file. Any other tool asks first.`}
        footer={TRUST_COPY.toolsFooter}
        icon={<Icon path={ICONS.tools} size={17} />}
        actions={
          <button className="u-btn primary" onClick={back}>
            Done
          </button>
        }
        tall
        sheet
        focusKey="tools"
        onBack={back}
        onEscape={back}
      >
        <label className="u-tr-search">
          <Icon path={ICONS.search} size={15} />
          <input
            className="u-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools"
            aria-label="Search tools"
          />
        </label>
        {shown.length === 0 ? (
          <div className="u-tr-empty">
            <b>No tools match “{query.trim()}”</b>
            <button className="u-linkish" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="u-tr-names">
            {shown.map((tool) => (
              <span key={tool} className="u-tr-name">
                {tool}
              </span>
            ))}
          </div>
        )}
      </DialogFrame>
    );
  }

  return (
    <DialogFrame
      title={metadata.name ?? "Untitled agent"}
      subtitle={TRUST_COPY.lead}
      footer={TRUST_COPY.footer}
      icon={<Icon path={ICONS.shield} size={17} />}
      actions={
        <>
          <button className="u-btn ghost" onClick={onOpenBuilder}>
            Open in builder
          </button>
          <button className="u-btn primary" onClick={onRun}>
            Run it
          </button>
        </>
      }
      sheet
      focusKey="summary"
      onEscape={() => {}}
    >
      <div className="u-tr-list">
        {fileHost !== null && (
          <Row icon={ICONS.link} label="File from">
            <span className="u-tr-v">{fileHost}</span>
          </Row>
        )}
        <Row icon={ICONS.model} label="Model">
          <span className="u-tr-v">
            {shortModelLabel(metadata.model?.name ?? "-")}
            {metadata.model?.provider !== undefined && (
              <small> · {findProvider(metadata.model.provider)?.label ?? metadata.model.provider}</small>
            )}
          </span>
        </Row>
        <Row icon={ICONS.tools} label="Tool servers">
          {servers.length === 0 ? (
            <span className="u-tr-v">None</span>
          ) : (
            <>
              {servers.map((server) => (
                <div className="u-tr-srv" key={server.name}>
                  <span className="u-tr-v">
                    {displayName(server.name)}
                    {server.host !== null && <small> · {server.host}</small>}
                  </span>
                  <span className="u-tr-meta">{server.tools.length === 0 ? "No tools listed" : toolCount(server.tools.length)}</span>
                  {server.tools.length > 0 && (
                    <button
                      className="u-btn ghost sm"
                      onClick={() => {
                        setQuery("");
                        setListed(server.name);
                      }}
                    >
                      View tools
                    </button>
                  )}
                </div>
              ))}
              <span className="u-tr-note">{TRUST_COPY.toolsNote}</span>
            </>
          )}
        </Row>
        <Row icon={ICONS.key} label="Needs from you">
          {keys.length === 0 ? (
            <span className="u-tr-v">Nothing</span>
          ) : (
            <>
              {keys.map((name) => (
                <div className="u-tr-srv" key={name}>
                  <span className="u-tr-v">
                    <code>{name}</code>
                  </span>
                  <span className={`tag ${savedSecrets.includes(name) ? "ok" : ""}`}>
                    {savedSecrets.includes(name) ? "Entered" : "Not entered"}
                  </span>
                </div>
              ))}
              <span className="u-tr-note">{TRUST_COPY.keysNote}</span>
            </>
          )}
        </Row>
      </div>
    </DialogFrame>
  );
}
