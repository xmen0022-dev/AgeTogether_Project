// Renders the real card builders from script.js with hostile input.
// Notes and member details are typed by the user and the cards are written with
// innerHTML, so escaping here is what stops that text becoming markup.
//
// The property under test is that no user-supplied "<" survives as a tag.
// Escaping leaves harmless words like `onerror=` in the text, which is fine:
// without an unescaped "<" the browser never parses them as an attribute.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");

/** Pull one top-level function out of script.js so the shipped code is tested. */
function extract(name, ...deps) {
  const escape = source.indexOf("function escapeHtml(");
  const escapeEnd = source.indexOf("\n}", escape) + 2;
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\nfunction ", start + 1);
  return new Function(
    ...deps,
    `${source.slice(escape, escapeEnd)}\n${source.slice(start, end)}\nreturn ${name};`,
  );
}

const PAYLOADS = [
  `<img src=x onerror="alert(1)">`,
  `<script>alert(1)</script>`,
  `'><svg onload=alert(1)>`,
];

function assertInert(html, payload) {
  for (const tag of ["<img", "<script", "<svg"]) {
    assert.ok(!html.includes(tag), `raw ${tag} survived for payload: ${payload}`);
  }
  assert.ok(html.includes("&lt;"), `the payload's "<" was not escaped: ${payload}`);
}

const member = { id: 1, name: "Daniel", initial: "D", rel: "Son", color: "peach", contact: "d@e.com" };
const note = { id: 1, memberId: 1, text: "hello", date: "Today", done: false };

test("family note text cannot inject markup", () => {
  const familyNoteCard = extract("familyNoteCard", "getFamilyMember")(() => member);
  for (const payload of PAYLOADS) {
    assertInert(familyNoteCard({ ...note, text: payload }), payload);
  }
});

test("a hostile family member name or relationship cannot inject markup", () => {
  const build = extract("familyNoteCard", "getFamilyMember");
  for (const payload of PAYLOADS) {
    const card = build(() => ({ ...member, name: payload, rel: payload }));
    assertInert(card(note), payload);
  }
});

test("friend note text cannot inject markup", () => {
  const friendNoteCard = extract("friendNoteCard")();
  const friend = { id: 1, name: "Margaret", initial: "M", color: "peach" };
  for (const payload of PAYLOADS) {
    assertInert(friendNoteCard({ id: 1, author: "friend", color: "peach", text: payload, date: "Today" }, friend), payload);
  }
});

test("profile values cannot break out of the value attribute", () => {
  const profileField = extract("profileField")();
  const html = profileField("phone", "Phone", `" onfocus="alert(1)`);
  assert.ok(!html.includes(`value="" onfocus="`), "the value attribute was broken out of");
  assert.ok(html.includes("&quot;"), "the quote was not escaped");
});

test("ordinary text and emoji still render normally", () => {
  const familyNoteCard = extract("familyNoteCard", "getFamilyMember")(() => member);
  const html = familyNoteCard({ ...note, text: "Drink water today 💧" });
  assert.match(html, /Drink water today 💧/);
  assert.match(html, /Daniel/);
  assert.ok(!html.includes("&amp;#x"), "an emoji was double-encoded");
});
