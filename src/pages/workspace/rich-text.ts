// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
// Licensed under the Apache License, Version 2.0.

import { Schema } from "prosemirror-model";
import type { Node as DocumentNode } from "prosemirror-model";
import { schema as markdownSchema, defaultMarkdownParser, defaultMarkdownSerializer, MarkdownParser, MarkdownSerializer } from "prosemirror-markdown";
import { AllSelection, EditorState, TextSelection } from "prosemirror-state";
import type { Command as EditorCommand } from "prosemirror-state";
import { baseKeymap, chainCommands, lift, newlineInCode, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { inputRules, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";

export function safeHref(value: string): string | null {
  const href = value.trim();
  if (!href || /[\u0000-\u0020\u007f]/.test(href)) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
  return scheme === undefined || ["http", "https", "mailto"].includes(scheme) ? href : null;
}

const linkSpec = markdownSchema.spec.marks.get("link")!;
export const editorSchema = new Schema({
  nodes: markdownSchema.spec.nodes
    .update("list_item", { ...markdownSchema.spec.nodes.get("list_item")!, content: "paragraph block*" })
    .update("image", {
      ...markdownSchema.spec.nodes.get("image")!,
      // Keep imported image Markdown without fetching remote content in an agent editor.
      toDOM: (node) => ["span", { "data-markdown-image": "true", title: node.attrs.src }, `![${node.attrs.alt ?? ""}](${node.attrs.src})`],
      parseDOM: [],
    }),
  marks: markdownSchema.spec.marks
    .update("link", {
      ...linkSpec,
      parseDOM: [{ tag: "a[href]", getAttrs: (element) => {
        const href = safeHref(element.getAttribute("href") ?? "");
        return href === null ? false : { href, title: element.getAttribute("title") };
      } }],
      toDOM: (mark) => {
        const href = safeHref(mark.attrs.href);
        return href === null ? ["span", 0] : ["a", { href, title: mark.attrs.title, rel: "noopener noreferrer" }, 0];
      },
    })
    .addBefore("code", "strike", {
      parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }, { style: "text-decoration=line-through" }],
      toDOM: () => ["s", 0],
    }),
});

const parser = new MarkdownParser(editorSchema, defaultMarkdownParser.tokenizer.enable("strikethrough"), {
  ...defaultMarkdownParser.tokens,
  s: { mark: "strike" },
  // Preserve visible soft line breaks, including inside list items.
  softbreak: { node: "hard_break" },
});

const serializer = new MarkdownSerializer({
  ...defaultMarkdownSerializer.nodes,
  bullet_list: (state, node) => state.renderList(node, "  ", () => "- "),
}, {
  ...defaultMarkdownSerializer.marks,
  strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
});

export const parseMarkdown = (value: string): DocumentNode => parser.parse(value);
export const serializeMarkdown = (doc: DocumentNode): string => serializer.serialize(doc);

export type Command =
  | { kind: "inline"; command: string }
  | { kind: "block"; tag: string }
  | { kind: "list"; command: string }
  | { kind: "code" }
  | { kind: "link" }
  | { kind: "clear" };

function ancestor(state: EditorState, names: string[]): number {
  const { $from, $to } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if (names.includes($from.node(depth).type.name) && $to.pos <= $from.end(depth)) return depth;
  }
  return -1;
}

function toggleList(name: "bullet_list" | "ordered_list"): EditorCommand {
  return (state, dispatch) => {
    const depth = ancestor(state, ["bullet_list", "ordered_list"]);
    const type = editorSchema.nodes[name]!;
    if (depth < 0) return wrapInList(type, { tight: true })(state, dispatch);
    const current = state.selection.$from.node(depth);
    if (current.type === type) return liftListItem(editorSchema.nodes.list_item!)(state, dispatch);
    dispatch?.(state.tr.setNodeMarkup(state.selection.$from.before(depth), type, { ...current.attrs, tight: true }).scrollIntoView());
    return true;
  };
}

function textSelection(state: EditorState): EditorState {
  if (!(state.selection instanceof AllSelection)) return state;
  const from = TextSelection.atStart(state.doc).from;
  const to = TextSelection.atEnd(state.doc).to;
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

export function commandFor(command: Command, href?: string): EditorCommand {
  const run = documentCommand(command, href);
  return (state, dispatch, view) => run(textSelection(state), dispatch, view);
}

function documentCommand(command: Command, href?: string): EditorCommand {
  if (command.kind === "inline" || command.kind === "code") {
    const name = command.kind === "code" ? "code" : { bold: "strong", italic: "em", strikeThrough: "strike" }[command.command];
    return name === undefined ? () => false : toggleMark(editorSchema.marks[name]!);
  }
  if (command.kind === "list") return toggleList(command.command === "insertOrderedList" ? "ordered_list" : "bullet_list");
  if (command.kind === "block") {
    if (command.tag === "blockquote") return (state, dispatch) =>
      ancestor(state, ["blockquote"]) >= 0 ? lift(state, dispatch) : wrapIn(editorSchema.nodes.blockquote!)(state, dispatch);
    const level = Number(command.tag.slice(1));
    return (state, dispatch) => {
      const same = state.selection.$from.parent.type.name === "heading" && state.selection.$from.parent.attrs.level === level;
      return setBlockType(same ? editorSchema.nodes.paragraph! : editorSchema.nodes.heading!, same ? undefined : { level })(state, dispatch);
    };
  }
  if (command.kind === "link") return (state, dispatch) => {
    const url = safeHref(href ?? "");
    if (url === null || state.selection.empty) return false;
    dispatch?.(state.tr.addMark(state.selection.from, state.selection.to, editorSchema.marks.link!.create({ href: url })).scrollIntoView());
    return true;
  };
  return (state, dispatch) => {
    dispatch?.(state.tr.removeMark(state.selection.from, state.selection.to).setStoredMarks([]));
    return true;
  };
}

export function activeFormats(state: EditorState): Record<string, boolean> {
  state = textSelection(state);
  const { from, to, empty, $from } = state.selection;
  const active = (name: string) => empty
    ? editorSchema.marks[name]!.isInSet(state.storedMarks ?? $from.marks()) !== undefined
    : state.doc.rangeHasMark(from, to, editorSchema.marks[name]!);
  return {
    bold: active("strong"), italic: active("em"), strike: active("strike"), code: active("code"), link: active("link"),
    h2: $from.parent.type.name === "heading" && $from.parent.attrs.level === 2,
    h3: $from.parent.type.name === "heading" && $from.parent.attrs.level === 3,
    quote: ancestor(state, ["blockquote"]) >= 0,
    bullet: ancestor(state, ["bullet_list"]) >= 0,
    number: ancestor(state, ["ordered_list"]) >= 0,
  };
}

export function createEditorState(value: string): EditorState {
  const nodes = editorSchema.nodes;
  return EditorState.create({
    doc: parseMarkdown(value),
    plugins: [
      inputRules({ rules: [
        wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list!, { tight: true }),
        wrappingInputRule(/^(\d+)\.\s$/, nodes.ordered_list!, (match) => ({ order: Number(match[1]), tight: true })),
        wrappingInputRule(/^\s*>\s$/, nodes.blockquote!),
        textblockTypeInputRule(/^(#{2,6})\s$/, nodes.heading!, (match) => ({ level: match[1]!.length })),
        textblockTypeInputRule(/^```$/, nodes.code_block!),
      ] }),
      keymap({
        "Mod-b": toggleMark(editorSchema.marks.strong!), "Mod-i": toggleMark(editorSchema.marks.em!),
        "Mod-`": toggleMark(editorSchema.marks.code!),
        "Mod-z": undo, "Shift-Mod-z": redo, "Mod-y": redo, Backspace: undoInputRule,
        Enter: chainCommands(newlineInCode, splitListItem(nodes.list_item!), baseKeymap.Enter!),
        "Shift-Enter": (state, dispatch) => {
          dispatch?.(state.tr.replaceSelectionWith(nodes.hard_break!.create()).scrollIntoView());
          return true;
        },
        Tab: sinkListItem(nodes.list_item!), "Shift-Tab": liftListItem(nodes.list_item!),
      }),
      keymap(baseKeymap), history(),
    ],
  });
}
