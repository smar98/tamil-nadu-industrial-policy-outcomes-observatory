import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the policy observatory", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Tamil Nadu Industrial Policy Outcomes Observatory<\/title>/i);
  assert.match(html, /Loading the policy evidence ledger/i);
  assert.doesNotMatch(html, /Codex is working|Your site is taking shape|react-loading-skeleton/i);
});

test("published data reconciles across the complete policy ledger", async () => {
  const raw = await readFile(new URL("../public/data/observatory.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);

  assert.equal(data.metadata.policy_count, 33);
  assert.equal(data.policies.length, 33);
  assert.equal(data.metadata.target_count, 41);
  assert.equal(
    Object.values(data.metadata.evidence_counts).reduce((sum, count) => sum + count, 0),
    data.metadata.target_count,
  );
  assert.equal(new Set(data.policies.map((policy) => policy.id)).size, 33);
  assert.ok(data.policies.every((policy) => policy.source_url?.startsWith("https://")));
  assert.ok(data.policies.every((policy) => Array.isArray(policy.targets)));
});

test("ASI and companion evidence carry their published validation metadata", async () => {
  const raw = await readFile(new URL("../public/data/observatory.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);

  assert.equal(data.metadata.asi_benchmark_passed, true);
  assert.equal(data.benchmark_validation.passed, true);
  assert.ok(data.benchmark_validation.records.length >= 19);
  assert.ok(data.metadata.asi_benchmark_max_error < 0.05);
  assert.equal(data.metadata.asi_coverage, "2008-09 to 2023-24");
  assert.equal(data.gsva.length, 13);
  assert.equal(data.solar.verdict, "not_met");
  assert.match(data.metadata.causal_note, /does not claim/i);
  assert.match(data.metadata.price_note, /current rupees/i);
});

test("the interface exposes a readable verification chain", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /One policy promise\. Four checks\./);
  assert.match(page, /Outcome evidence/);
  assert.match(page, /Decision rule/);
  assert.match(page, /Why no verdict/);
  assert.match(page, /Not publicly verifiable/);
  assert.match(page, /Not automatically used to score/);
  assert.match(css, /\.policy-chronology/);
  assert.match(css, /\.verification-chain/);
  assert.doesNotMatch(css, /\.policy-timeline\s*\{/);
});
