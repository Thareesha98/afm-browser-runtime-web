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
import type { ReactNode } from "react";
import { brief, logDetails } from "../../brief-error";
import { EXAMPLES } from "../../examples";
import { MODEL_PROVIDERS, findProvider } from "./model-catalog";
import type { AgentModelRef } from "../../protocol";
import type { ChatState } from "../../chat-state";
import { resolveContent, normalizeAgentFileUrl } from "../../load-paths";
import { McpProxyRequiredError, agentFileFetch } from "../../tool-factory";
import { DialogFrame } from "./DialogFrame";
import { START_CARDS, START_FOOTERS, START_SUBTITLES, START_TITLES, templatesNote } from "./start-copy";
import type { StartStage } from "./start-copy";
import { canClose, escapeAction, outsideClickAction, stageOf } from "./start-flow";
import { SECRET_INPUT } from "./secret-input";
import { HIDDEN_FILE_INPUT } from "../../chat/hidden-file-input";

function SetupColumn({ children, slide = false }: { children: ReactNode; slide?: boolean }) {
  return (
    <div className="u-setup">
      <div className={slide ? "u-setup-col panel-slide-in" : "u-setup-col"}>{children}</div>
    </div>
  );
}

const ICON_PATHS = {
  blank: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6",
  generate: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z",
  template: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  file: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  back: "M19 12H5M12 19l-7-7 7-7",
  warn: "M12 9v5M12 17.4h.01M10.3 3.9L2.4 17.4A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3.1L13.7 3.9a2 2 0 00-3.4 0z",
};

function Glyph({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function StartOption({ icon, name, desc, onClick, on = false }: { icon: ReactNode; name: string; desc: string; onClick: () => void; on?: boolean }) {
  return (
    <button className={on ? "u-start-opt on" : "u-start-opt"} onClick={onClick}>
      <span className="u-start-ico" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="u-start-name">{name}</span>
        <span className="u-start-desc">{desc}</span>
      </span>
    </button>
  );
}

export type StartView = "menu" | "templates" | "prompt" | "import";

interface CardItem {
  key: string;
  icon: ReactNode;
  name: string;
  desc: string;
  onPick: () => void;
}

function Cards({ items, row = false }: { items: CardItem[]; row?: boolean }) {
  const [active, setActive] = useState(0);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  function move(from: number, key: string) {
    const to = key === "ArrowRight" ? from + 1 : key === "ArrowLeft" ? from - 1 : key === "ArrowDown" ? from + 2 : from - 2;
    if (to >= 0 && to < items.length) cards.current[to]?.focus();
  }

  return (
    <div className="u-dlg-grid">
      {items.map((item, index) => (
        <button
          key={item.key}
          ref={(element) => {
            cards.current[index] = element;
          }}
          className={`u-dlg-card${row ? " row" : ""}${index === active ? " on" : ""}`}
          data-autofocus={index === 0 ? "" : undefined}
          onMouseEnter={() => setActive(index)}
          onFocus={() => setActive(index)}
          onKeyDown={(event) => {
            if (!event.key.startsWith("Arrow")) return;
            event.preventDefault();
            move(index, event.key);
          }}
          onClick={item.onPick}
        >
          <span className="u-dlg-ico" aria-hidden="true">
            {item.icon}
          </span>
          <span>
            <span className="u-dlg-name">{item.name}</span>
            <span className="u-dlg-desc">{item.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

interface Props {
  state: ChatState;
  dialog?: boolean;
  initialView?: StartView;
  onUseSource: (source: string) => void;
  onGenerate: (prompt: string, model: AgentModelRef, final?: boolean) => void;
  onDismissDraft: () => void;
  onSaveKey: (name: string, value: string) => void;
  onBlank: () => void;
}

export function StartHere({
  state,
  onUseSource,
  onGenerate,
  onSaveKey,
  onDismissDraft,
  onBlank,
  dialog = false,
  initialView = "menu",
}: Props) {
  const [view, setView] = useState<StartView>(initialView);
  const [prompt, setPrompt] = useState("");
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [key, setKey] = useState("");
  const [answers, setAnswers] = useState("");
  const [link, setLink] = useState("");
  const [dropping, setDropping] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [writing, setWriting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const provider = findProvider(providerId);
  const keySaved = provider !== undefined && state.savedSecrets.includes(provider.secretName);

  const answered =
    state.generatedDraft !== null || state.clarifyQuestions.length > 0 || state.draftError !== null;
  useEffect(() => {
    if (answered) setWriting(false);
  }, [answered]);

  function writeFile(final = false, request = prompt.trim()) {
    if (request === "" || provider === undefined || modelId === "") return;
    setWriting(true);
    if (!keySaved && key.trim() !== "") onSaveKey(provider.secretName, key.trim());
    const authoringModel = {
      provider: provider.id,
      name: modelId,
      authentication: { type: "api-key", api_key: `\${env:${provider.secretName}}` },
    } as AgentModelRef;
    onGenerate(request, authoringModel, final);
  }

  async function openFile(file: File | undefined) {
    if (file === undefined) return;
    onUseSource(await file.text());
  }

  async function openLink() {
    const normalized = normalizeAgentFileUrl(link.trim());
    if (!normalized.ok) {
      setImportError(normalized.error);
      return;
    }
    setFetching(true);
    setImportError(null);
    try {
      const text = await resolveContent({ kind: "remote", url: normalized.url }, agentFileFetch());
      if (text === null) {
        setImportError("Nothing came back from that address.");
        return;
      }
      onUseSource(text);
    } catch (error) {
      if (error instanceof McpProxyRequiredError) {
        // opening a link needs the proxy; this is not an MCP problem, so it does not say MCP
        logDetails(error.message);
        setImportError("Opening links is unavailable");
      } else {
        setImportError(brief(error instanceof Error ? error.message : String(error)));
      }
    } finally {
      setFetching(false);
    }
  }

  const stage = stageOf(view, {
    writing,
    hasDraft: state.generatedDraft !== null,
    hasQuestions: state.clarifyQuestions.length > 0,
  });

  function escape() {
    const action = escapeAction(stage);
    if (action === "close") onBlank();
    else if (action === "back") setView("menu");
    else if (action === "restart") {
      onDismissDraft();
      setView("prompt");
    }
  }

  const actions = dialog ? "u-dlg-actions" : "u-panel-foot";

  function frame(
    which: StartStage,
    content: ReactNode,
    sheet: { title?: string; note?: ReactNode; slide?: boolean; back?: boolean },
    narrow = false,
  ) {
    if (!dialog) {
      return (
        <SetupColumn slide={sheet.slide}>
          {sheet.back === true && <BackLink onClick={() => setView("menu")} />}
          {sheet.title !== undefined && <h3 className="u-setup-title">{sheet.title}</h3>}
          {sheet.note}
          {content}
        </SetupColumn>
      );
    }
    return (
      <DialogFrame
        title={START_TITLES[which]}
        subtitle={START_SUBTITLES[which]}
        footer={START_FOOTERS[which]}
        narrow={narrow}
        focusKey={which}
        onBack={sheet.back === true ? () => setView("menu") : undefined}
        onClose={canClose(which) ? onBlank : undefined}
        onEscape={escape}
        onOutside={outsideClickAction(which) === "close" ? onBlank : undefined}
      >
        {content}
      </DialogFrame>
    );
  }

  if (view === "import") {
    return frame("import", (
      <>
        <div
          className={`u-drop ${dropping ? "on" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            void openFile(event.dataTransfer.files[0]);
          }}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") fileInput.current?.click();
          }}
        >
          <span className="u-drop-ico" aria-hidden="true">
            <Glyph path={ICON_PATHS.file} size={17} />
          </span>
          Drop an <code>.afm.md</code> here, or choose one
        </div>

        <div className="u-divider" />
        <label className="u-group">
          <span className="u-label">Or paste a link to one</span>
          <div className="u-input-row">
            <input
              className="u-input"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://…/agent.afm.md"
              onKeyDown={(event) => {
                if (event.key === "Enter") void openLink();
              }}
            />
            <button className="u-btn ghost" disabled={link.trim() === "" || fetching} onClick={() => void openLink()}>
              {fetching ? "Opening…" : "Open"}
            </button>
          </div>
        </label>
        {importError !== null && <p className="u-errcard">{importError}</p>}

        <input
          ref={fileInput}
          type="file"
          accept=".md,.afm.md,text/markdown,text/plain"
          {...HIDDEN_FILE_INPUT}
          onChange={(event) => void openFile(event.target.files?.[0])}
        />
      </>
    ), { title: "Import a file", slide: true, back: true }, true);
  }

  if (view === "templates") {
    return frame("templates", dialog ? (
      <Cards
        row
        items={EXAMPLES.map((example) => ({
          key: example.title,
          icon: example.icon,
          name: example.title,
          desc: example.description,
          onPick: () => onUseSource(example.content),
        }))}
      />
    ) : (
      <div className="u-start-list">
        {EXAMPLES.map((example) => (
          <StartOption
            key={example.title}
            icon={example.icon}
            name={example.title}
            desc={example.description}
            onClick={() => onUseSource(example.content)}
          />
        ))}
      </div>
    ), { title: "Pick a starting point", slide: true, back: true });
  }

  if (writing) {
    return frame("writing", (
      <p className="u-generating">
        <span className="u-spinner" aria-hidden="true" />
        Generating…
      </p>
    ), { title: "Writing the file" }, true);
  }

  if (state.generatedDraft !== null) {
    const draft = state.generatedDraft;
    return frame("draft", (
      <>
        <pre className="u-draft">{draft}</pre>
        <div className={actions}>
          <button
            className="u-btn ghost"
            onClick={() => {
              onDismissDraft();
              setView("prompt");
            }}
          >
            Write it again
          </button>
          <button className="u-btn primary" onClick={() => onUseSource(draft)}>
            Use this file
          </button>
        </div>
      </>
    ), {
      title: "Here is the file it wrote",
      note: (
        <p className="u-setup-note">
          Nothing has been changed yet. Using it puts this in the editor, where you can read it and
          edit it before pressing Run.
        </p>
      ),
    });
  }

  if (state.clarifyQuestions.length > 0) {
    return frame("questions", (
      <>
        <ul className="u-rows">
          {state.clarifyQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
        <form
          className="u-group"
          onSubmit={(event) => {
            event.preventDefault();
            if (answers.trim() === "") return;
            writeFile(true, `${prompt.trim()}\n\nAnswers to your questions:\n${answers.trim()}`);
            setAnswers("");
          }}
        >
          <textarea
            className="u-area"
            value={answers}
            onChange={(event) => setAnswers(event.target.value)}
            placeholder="Answer in your own words…"
            rows={4}
            autoFocus
          />
          <div className={actions}>
            <button
              className="u-btn ghost"
              type="button"
              disabled={writing}
              onClick={() => {
                writeFile(true, prompt.trim());
                setAnswers("");
              }}
            >
              Skip
            </button>
            <button className="u-btn primary" type="submit" disabled={answers.trim() === "" || writing}>
              {writing ? "Writing the file…" : "Write the agent file"}
            </button>
          </div>
        </form>
      </>
    ), { title: "A couple of questions first" }, true);
  }

  if (view === "prompt") {
    const chosen = provider !== undefined && modelId !== "";
    const canWrite = prompt.trim() !== "" && chosen && (keySaved || key.trim() !== "") && !writing;
    return frame("prompt", (
      <>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            writeFile();
          }}
          className="u-group"
        >
          <textarea
            className="u-area"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A support agent for a coffee roastery that answers questions about beans and delivery…"
            rows={5}
            autoFocus
          />

          <div className="u-label">Model that writes the file</div>
          <div className="u-input-row">
            <label className="u-group u-input-col">
              <span className="u-label">Provider</span>
              <select
                className={`u-input${provider === undefined ? " is-placeholder" : ""}`}
                value={providerId}
                onChange={(event) => {
                  setProviderId(event.target.value);
                  setModelId("");
                }}
              >
                <option value="" disabled>
                  Choose a provider
                </option>
                {MODEL_PROVIDERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="u-group u-input-col">
              <span className="u-label">Model</span>
              <select
                className={`u-input${modelId === "" ? " is-placeholder" : ""}`}
                value={modelId}
                disabled={provider === undefined}
                onChange={(event) => setModelId(event.target.value)}
              >
                <option value="" disabled>
                  Choose a model
                </option>
                {provider?.models.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {chosen && !keySaved && (
            <label className="u-group">
              <span className="u-label">{provider.label} API key</span>
              <input
                className="u-input"
                type="password"
                {...SECRET_INPUT}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={`Paste your ${provider.label} key`}
              />
            </label>
          )}

          {provider !== undefined && (
            <p className="u-usage-note">
              <Glyph path={ICON_PATHS.warn} size={15} />
              <span>
                Your <strong>{provider.label}</strong> API usage will be used to write this file.
              </span>
            </p>
          )}

          <button className="u-btn primary wide" type="submit" disabled={!canWrite}>
            {writing ? "Writing the file…" : "Write the agent file"}
          </button>
        </form>
        {state.draftError !== null && <p className="u-errcard">{brief(state.draftError)}</p>}
      </>
    ), {
      title: "Describe the agent you want",
      note: (
        <p className="u-setup-note">
          Say what it should do and how it should behave. The file appears in the editor for you to read
          before anything runs.
        </p>
      ),
      slide: true,
      back: true,
    });
  }

  if (dialog) {
    return frame("menu", (
      <Cards
        items={[
          { key: "blank", icon: <Glyph path={ICON_PATHS.blank} />, name: "Blank", desc: START_CARDS.blank, onPick: onBlank },
          { key: "generate", icon: <Glyph path={ICON_PATHS.generate} />, name: "Generate with AI", desc: START_CARDS.generate, onPick: () => setView("prompt") },
          { key: "templates", icon: <Glyph path={ICON_PATHS.template} />, name: "From a template", desc: templatesNote(EXAMPLES.length), onPick: () => setView("templates") },
          { key: "import", icon: <Glyph path={ICON_PATHS.file} />, name: "Import a file", desc: START_CARDS.import, onPick: () => setView("import") },
        ]}
      />
    ), {});
  }

  return (
    <SetupColumn>
      <p className="u-setup-note">
        The empty agent is already beside you. Fill it in yourself, or start from one of these.
        <br />
        Nothing is installed. Everything stays in this tab.
      </p>

      <div className="u-start-list">
        <StartOption icon={<Glyph path={ICON_PATHS.blank} />} name="Blank" onClick={onBlank} on
          desc="Write the role and instructions yourself. It is already in the editor." />
        <StartOption icon={<Glyph path={ICON_PATHS.generate} />} name="Generate with AI" onClick={() => setView("prompt")}
          desc="Describe what you want and get a first version to edit." />
        <StartOption icon={<Glyph path={ICON_PATHS.template} />} name="From a template" onClick={() => setView("templates")}
          desc="Agents that already do something useful." />
        <StartOption icon={<Glyph path={ICON_PATHS.file} />} name="Import a file" onClick={() => setView("import")}
          desc="Open an .afm.md you were sent, or paste a link to one." />
      </div>
    </SetupColumn>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button className="u-back" onClick={onClick}>
      <Glyph path={ICON_PATHS.back} size={14} />
      Back
    </button>
  );
}
