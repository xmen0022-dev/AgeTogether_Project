// Renders real builders from script.js with hostile input.
// The property under test is that no user-supplied "<" survives as a tag.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");

function extract(name, ...deps) {
  const escape = source.indexOf("function escapeHtml(");
  const escapeEnd = source.indexOf("\n}", escape) + 2;
  const complete = source.indexOf("function letterLooksComplete(");
  const completeEnd = complete >= 0 ? source.indexOf("\n}", complete) + 2 : complete;
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\nfunction ", start + 1);
  const helper = name === "letterPreviewMarkup" && complete >= 0 ? `\n${source.slice(complete, completeEnd)}` : "";
  return new Function(
    ...deps,
    `${source.slice(escape, escapeEnd)}${helper}\n${source.slice(start, end)}\nreturn ${name};`,
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

test("letter preview text cannot inject markup", () => {
  const state = { profile: { preferredName: "Me", fullName: "Me" } };
  for (const payload of PAYLOADS) {
    const letterDraft = {
      recipientName: payload,
      body: payload,
      paper: "cream",
      textColor: "ink",
      font: "serif",
    };
    const letterPreviewMarkup = extract("letterPreviewMarkup", "letterDraft", "state")(letterDraft, state);
    assertInert(letterPreviewMarkup(), payload);
  }
});

test("profile values cannot break out of the value attribute", () => {
  const profileField = extract("profileField")();
  const html = profileField("phone", "Phone", `" onfocus="alert(1)`);
  assert.ok(!html.includes(`value="" onfocus="`), "the value attribute was broken out of");
  assert.ok(html.includes("&quot;"), "the quote was not escaped");
});

test("ordinary text and emoji still render normally", () => {
  const letterDraft = {
    recipientName: "Sophie",
    body: "Drink water today 💧",
    paper: "cream",
    textColor: "ink",
    font: "serif",
  };
  const state = { profile: { preferredName: "Me", fullName: "Me" } };
  const letterPreviewMarkup = extract("letterPreviewMarkup", "letterDraft", "state")(letterDraft, state);
  const html = letterPreviewMarkup();
  assert.match(html, /Drink water today 💧/);
  assert.doesNotMatch(html, /Dear Sophie/);
  assert.ok(!html.includes("&amp;#x"), "an emoji was double-encoded");
});
