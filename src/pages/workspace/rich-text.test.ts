// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
// Licensed under the Apache License, Version 2.0.

import { describe, it, expect } from "vitest";
import { TextSelection } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import { undo, redo } from "prosemirror-history";
import { sinkListItem, liftListItem, splitListItem } from "prosemirror-schema-list";
import { activeFormats, commandFor, createEditorState, editorSchema, parseMarkdown, safeHref, serializeMarkdown } from "./rich-text";

const samples = [
  "", "Answer clearly.", "Answer **clearly** and *briefly*.",
  "**Purpose**\n\n- Use my CV.\n- Check **my contribution**.\n\n**Style**\n\n- Keep it brief.",
  "- first\n  - nested **bold**\n    1. deeper\n  - sibling\n- last",
  "3. third\n4. fourth\n\n- separate list", "- first\n\n  A second paragraph.\n\n- second",
  "> ## A heading\n>\n> - a quote\n>   - nested quote list",
  "Paragraph with **bold and *italic*** plus ~~strike~~ and ``a ` backtick``.",
  "See [the docs](https://example.com/path_(one)) and <https://github.com>.",
  "```ts\nconst a = '**not bold**';\n// # Role stays code\n```",
  "Line one\nline two\n\n---\n\nLast paragraph.",
  "<script>alert('not HTML')</script>", "![an image](https://example.com/image.png)",
];

describe("structured Markdown document round trips", () => {
  it.each(samples)("keeps the document structure through repeated reloads: %j", (value) => {
    const first = parseMarkdown(value);
    let saved = serializeMarkdown(first);
    for (let pass = 0; pass < 5; pass++) {
      const restored = parseMarkdown(saved);
      expect(restored.toJSON()).toEqual(first.toJSON());
      expect(serializeMarkdown(restored)).toBe(saved);
      saved = serializeMarkdown(restored);
    }
  });

  it("does not turn Markdown-looking code into marks or lists", () => {
    const doc = parseMarkdown("```\n- one\n**two**\n```");
    expect(doc.firstChild?.type.name).toBe("code_block");
    expect(doc.firstChild?.textContent).toBe("- one\n**two**");
  });
});

function editing(value: string) {
  let state = createEditorState(value);
  const dispatch = (transaction: Transaction) => { state = state.apply(transaction); };
  const select = (text: string) => {
    let from = -1;
    state.doc.descendants((node, pos) => {
      if (from < 0 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text);
    });
    if (from < 0) throw new Error(`Text not found: ${text}`);
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, from + text.length)));
  };
  return {
    get state(): EditorState { return state; }, dispatch, select,
    markdown: () => serializeMarkdown(state.doc),
    command: (command: Parameters<typeof commandFor>[0], href?: string) => commandFor(command, href)(state, dispatch),
  };
}

describe("formatting transactions and history", () => {
  it("turns selected paragraphs into persistent bullets, even without typing or blur", () => {
    const editor = editing("One\n\nTwo");
    editor.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, editor.state.doc.content.size - 1)));
    expect(editor.command({ kind: "list", command: "insertUnorderedList" })).toBe(true);
    expect(editor.markdown()).toBe("- One\n- Two");
    expect(parseMarkdown(editor.markdown()).firstChild?.type.name).toBe("bullet_list");
    expect(activeFormats(editor.state).bullet).toBe(true);
    expect(undo(editor.state, editor.dispatch)).toBe(true);
    expect(editor.markdown()).toBe("One\n\nTwo");
    expect(redo(editor.state, editor.dispatch)).toBe(true);
    expect(editor.markdown()).toBe("- One\n- Two");
  });

  it("toggles list types and removes bullets without flattening the words", () => {
    const editor = editing("- One\n- Two");
    editor.select("One");
    editor.command({ kind: "list", command: "insertOrderedList" });
    expect(editor.markdown()).toBe("1. One\n2. Two");
    editor.command({ kind: "list", command: "insertOrderedList" });
    expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(editor.state.doc.textContent).toBe("OneTwo");
  });

  it("indents, outdents and splits list items using document transactions", () => {
    const editor = editing("- One\n- Two");
    editor.select("Two");
    expect(sinkListItem(editorSchema.nodes.list_item!)(editor.state, editor.dispatch)).toBe(true);
    expect(editor.markdown()).toBe("- One\n  - Two");
    expect(liftListItem(editorSchema.nodes.list_item!)(editor.state, editor.dispatch)).toBe(true);
    expect(editor.markdown()).toBe("- One\n- Two");
    const end = editor.state.selection.to;
    editor.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end)));
    expect(splitListItem(editorSchema.nodes.list_item!)(editor.state, editor.dispatch)).toBe(true);
    expect(editor.state.doc.firstChild?.childCount).toBe(3);
  });

  it("keeps bold, italic, strike, code and link edits across document reloads", () => {
    const editor = editing("Bold italic outdated code docs");
    for (const [text, command] of [["Bold", "bold"], ["italic", "italic"], ["outdated", "strikeThrough"]]) {
      editor.select(text!);
      editor.command({ kind: "inline", command: command! });
    }
    editor.select("code"); editor.command({ kind: "code" });
    editor.select("docs"); editor.command({ kind: "link" }, "https://github.com");
    expect(editor.markdown()).toBe("**Bold** *italic* ~~outdated~~ `code` [docs](https://github.com)");
    expect(parseMarkdown(editor.markdown()).toJSON()).toEqual(editor.state.doc.toJSON());
  });

  it("preserves the selection bookmark while editing a link destination", () => {
    const editor = editing("Read the docs here");
    editor.select("the docs");
    const saved = editor.state.selection.getBookmark();
    editor.dispatch(editor.state.tr.setSelection(TextSelection.atStart(editor.state.doc)));
    editor.dispatch(editor.state.tr.setSelection(saved.resolve(editor.state.doc)));
    editor.command({ kind: "link" }, "https://example.com");
    expect(editor.markdown()).toBe("Read [the docs](https://example.com) here");
  });

  it("clears marks and toggles headings and quotes", () => {
    const editor = editing("**Title**");
    editor.select("Title");
    editor.command({ kind: "clear" });
    expect(editor.markdown()).toBe("Title");
    editor.command({ kind: "block", tag: "h2" });
    expect(editor.markdown()).toBe("## Title");
    editor.command({ kind: "block", tag: "h2" });
    editor.command({ kind: "block", tag: "blockquote" });
    expect(editor.markdown()).toBe("> Title");
    editor.command({ kind: "block", tag: "blockquote" });
    expect(editor.markdown()).toBe("Title");
  });
});

describe("safe link handling", () => {
  it.each(["javascript:alert(1)", "data:text/html,hello", "vbscript:x", "java\nscript:alert(1)", "", "https://a.test/a b"])("rejects %j", (href) => {
    expect(safeHref(href)).toBeNull();
    const editor = editing("link"); editor.select("link");
    expect(editor.command({ kind: "link" }, href)).toBe(false);
    expect(editor.markdown()).toBe("link");
  });
  it.each(["https://github.com", "http://localhost:5173", "mailto:a@example.com", "/docs", "#section"])("accepts %j", (href) => {
    expect(safeHref(href)).toBe(href);
  });
  it("never parses raw HTML into executable document nodes", () => {
    const doc = parseMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert%281%29)');
    expect(doc.textContent).toContain("<script>");
    doc.descendants((node) => expect(node.marks.some((mark) => mark.type.name === "link")).toBe(false));
  });
});
