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
  assert.match(css, /\.verification-chain/);
  assert.match(css, /\.stamp/);
  assert.match(css, /\.dumbbell-track/);
});

test("published ASI records respect the disclosure rule", async () => {
  const raw = await readFile(new URL("../public/data/observatory.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);

  assert.ok(data.asi_records.length > 500);
  for (const record of data.asi_records) {
    assert.ok(record.sample_factories >= 10, `cell below 10 factories: ${JSON.stringify(record)}`);
    assert.notEqual(record.stability, "suppress", `suppressed cell leaked: ${JSON.stringify(record)}`);
  }
  const states = new Set(data.asi_records.map((record) => record.state));
  assert.ok(!states.has("28") && !states.has("36"), "AP and Telangana must be published as one combined series");
});

test("scored verdicts stay consistent with the underlying companion data", async () => {
  const raw = await readFile(new URL("../public/data/observatory.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);

  assert.deepEqual(data.metadata.verdict_counts, {
    not_scored: 27,
    not_met: 3,
    below_target: 1,
    below_target_so_far: 1,
    not_due: 9,
  });

  const byLabel = Object.fromEntries(data.gsva.map((row) => [row.year_label, row]));
  const cagr = (a, b, n) => ((b / a) ** (1 / n) - 1) * 100;
  const nominal2021 = cagr(byLabel["2020-21"].current_rupees_crore, byLabel["2023-24"].current_rupees_crore, 3);
  const real2021 = cagr(byLabel["2020-21"].constant_rupees_crore, byLabel["2023-24"].constant_rupees_crore, 3);

  const targets = data.policies.flatMap((policy) => policy.targets);
  const growth2021 = targets.find((target) => target.id === "industrial-2021-growth");
  assert.ok(growth2021.assessment.includes(`${nominal2021.toFixed(1)}% nominal`), growth2021.assessment);
  assert.ok(growth2021.assessment.includes(`${real2021.toFixed(1)}% real`), growth2021.assessment);

  const share2007 = targets.find((target) => target.id === "industrial-2007-share");
  assert.equal(share2007.verdict, "not_met");
  const gsdpLatest = data.gsdp_archived.values.at(-1);
  assert.ok(share2007.assessment.includes(`${gsdpLatest.manufacturing_share_pct.toFixed(2)}%`), share2007.assessment);

  const trajectories = data.policies.filter((policy) => policy.trajectory);
  assert.ok(trajectories.length >= 10);
  for (const policy of trajectories) {
    assert.ok(Number.isFinite(policy.trajectory.tn_pre_cagr));
    assert.ok(Number.isFinite(policy.trajectory.tn_post_cagr));
  }
});
