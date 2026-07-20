"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");

function createApp() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
    .replace(/\s*<script src="data\/jgp-data-[^"]+\.js" defer><\/script>/g, "")
    .replace(/\s*<script src="data\/jgp-characteristics-[^"]+\.js" defer><\/script>/g, "").replace(
    '<script src="app.js" defer></script>',
    ""
  );
  const catalogFiles = fs.readdirSync(path.join(ROOT, "data"))
    .filter((name) => /^jgp-data-(?:meta|\d{2})\.js$/.test(name))
    .sort((a, b) => {
      if (a.includes("meta")) return -1;
      if (b.includes("meta")) return 1;
      return a.localeCompare(b);
    });
  const characteristicFiles = fs.readdirSync(path.join(ROOT, "data"))
    .filter((name) => /^jgp-characteristics-(?:meta|\d{2})\.js$/.test(name))
    .sort((a, b) => {
      if (a.includes("meta")) return -1;
      if (b.includes("meta")) return 1;
      return a.localeCompare(b);
    });
  const script = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://example.test/"
  });
  catalogFiles.forEach((name) => {
    dom.window.eval(fs.readFileSync(path.join(ROOT, "data", name), "utf8"));
  });
  characteristicFiles.forEach((name) => {
    dom.window.eval(fs.readFileSync(path.join(ROOT, "data", name), "utf8"));
  });
  dom.window.eval(fs.readFileSync(path.join(ROOT, "data", "nfz-contract.js"), "utf8"));
  dom.window.eval(script);
  return dom;
}

function change(window, element) {
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

test("N01 starts with the verified base calculation", () => {
  const dom = createApp();
  const document = dom.window.document;

  assert.equal(document.querySelector("#group-code").textContent, "N01");
  assert.match(document.querySelector("#points-value").textContent, /1[\s\u00a0]?994/);
  assert.match(document.querySelector("#base-value").textContent, /3[\s\u00a0]?908,24/);
  assert.equal(document.querySelector("#combined-factor").textContent, "1,00");
});

test("N01 shows the verified scope and price from API NFZ", () => {
  const dom = createApp();
  const { document } = dom.window;

  assert.equal(document.querySelector("#contract-status").textContent, "Potwierdzone w API");
  assert.equal(document.querySelector("#contract-scope-code").textContent, "03.4450.260.02");
  assert.equal(document.querySelector("#contract-unit-code").textContent, "5.51.01.0013001");
  assert.match(document.querySelector("#contract-point-price").textContent, /1,96/);
  assert.equal(document.querySelector("#point-price-source").textContent, "zgodna z API NFZ");
  assert.match(document.querySelector("#contract-addition-list").textContent, /5\.53\.01\.0001510/);
  assert.match(document.querySelector("#contract-addition-list").textContent, /600 pkt/);
});

test("production version contains no predefined obstetric coefficients", () => {
  const dom = createApp();
  const { document } = dom.window;

  assert.equal(document.querySelector("#factor-bridge"), null);
  assert.equal(document.querySelector("#factor-anesthesia"), null);
  assert.equal(document.querySelector("#factor-neonate"), null);
  assert.equal(document.querySelector("#coefficient-select").options.length, 1);
  assert.equal(document.querySelector("#coefficient-select").value, "custom");
});

test("manual coefficient is available only after enabling the switch", () => {
  const dom = createApp();
  const { document } = dom.window;
  const enabled = document.querySelector("#coefficient-enabled");
  const custom = document.querySelector("#factor-custom");

  assert.equal(document.querySelector("#coefficient-controls").hidden, true);
  custom.value = "1.27";
  enabled.checked = true;
  change(dom.window, enabled);

  assert.equal(document.querySelector("#coefficient-controls").hidden, false);
  assert.equal(document.querySelector("#combined-factor").textContent, "1,27");
  assert.match(document.querySelector("#total-value").textContent, /4[\s\u00a0]?963,46/);
});

test("search switches from N01 to N20", () => {
  const dom = createApp();
  const { document } = dom.window;
  const search = document.querySelector("#search-input");

  search.value = "N20";
  document.querySelector("#search-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );

  assert.equal(document.querySelector("#group-code").textContent, "N20");
  assert.match(document.querySelector("#points-value").textContent, /1[\s\u00a0]?958/);
  assert.equal(document.body.textContent.includes("Pomostowy"), false);
  assert.equal(document.body.textContent.includes("Znieczulenie do porodu"), false);
  assert.equal(document.querySelector("#contract-additions").hidden, true);
  assert.equal(document.querySelector("#contract-addition-list").textContent, "");
});

test("a manual coefficient is isolated to the selected JGP group", () => {
  const dom = createApp();
  const { document } = dom.window;
  const enabled = document.querySelector("#coefficient-enabled");
  const custom = document.querySelector("#factor-custom");
  const search = document.querySelector("#search-input");

  custom.value = "1.27";
  enabled.checked = true;
  change(dom.window, enabled);

  search.value = "A01";
  document.querySelector("#search-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );

  assert.equal(enabled.checked, false);
  assert.equal(document.querySelector("#coefficient-controls").hidden, true);
  assert.equal(document.querySelector("#combined-factor").textContent, "1,00");
});

test("search by contract scope returns all matching obstetric groups", () => {
  const dom = createApp();
  const { document } = dom.window;
  const search = document.querySelector("#search-input");

  search.value = "03.4450.260.02";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  const suggestedCodes = Array.from(
    document.querySelectorAll("#suggestions .suggestion strong")
  ).map((element) => element.textContent);

  assert.deepEqual(suggestedCodes, ["N01", "N02", "N03", "N09", "N11", "N13", "N20"]);
});

test("a group outside the current contract profile is clearly marked", () => {
  const dom = createApp();
  const { document } = dom.window;
  const search = document.querySelector("#search-input");

  search.value = "A01";
  document.querySelector("#search-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );

  assert.equal(document.querySelector("#contract-status").textContent, "Brak w profilu");
  assert.equal(document.querySelector("#contract-verified-content").hidden, true);
  assert.equal(document.querySelector("#contract-empty").hidden, false);
});

test("official catalog contains 702 JGP groups from attachment 1a", () => {
  const dom = createApp();
  const catalog = dom.window.JGP_CATALOG;

  assert.equal(catalog.meta.orderNumber, "46/2026/DSOZ");
  assert.equal(catalog.groups.length, 702);
  assert.equal(catalog.groups[0].code, "A01");
  assert.equal(catalog.groups.at(-1).code, "Z01");
  assert.equal(catalog.groups.find((group) => group.code === "N01").ordinary, 1994);
  assert.deepEqual(
    JSON.parse(JSON.stringify(catalog.groups.find((group) => group.code === "N01").scopeFamilies)),
    [{
      label: "położnictwo i ginekologia/poł. i gin.-drugi p.ref./poł. i gin.-trzeci p.ref.",
      qualifier: 3
    }]
  );
});

test("characteristics cover all groups and resolve N01 source lists", () => {
  const dom = createApp();
  const characteristics = dom.window.JGP_CHARACTERISTICS;
  const n01 = characteristics.blocks.N01;

  assert.equal(characteristics.meta.groupCount, 702);
  assert.equal(characteristics.meta.listCount, 144);
  assert.equal(characteristics.meta.codeEntryCount, 35060);
  assert.deepEqual(JSON.parse(JSON.stringify(n01.references)), [
    { code: "N03", role: "procedure" },
    { code: "N1", role: "additional" },
    { code: "N9", role: "additional" }
  ]);
  assert.match(n01.segments[0].text, /procedury z listy procedur N03/);
});

test("search by ICD-9 procedure finds groups that reference its list", () => {
  const dom = createApp();
  const { document } = dom.window;
  const search = document.querySelector("#search-input");

  search.value = "89.393";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  const suggestedCodes = Array.from(
    document.querySelectorAll("#suggestions .suggestion strong")
  ).map((element) => element.textContent);

  assert.equal(suggestedCodes.includes("N01"), true);
});

test("large ICD lists are rendered lazily after opening", () => {
  const dom = createApp();
  const { document } = dom.window;
  const list = document.querySelector("#direct-code-lists .code-list");

  assert.equal(list.querySelectorAll("li").length, 0);
  list.open = true;
  list.dispatchEvent(new dom.window.Event("toggle"));
  assert.equal(list.querySelectorAll("li").length, 16);
});

test("A01 shows extended catalog fields without treating blank cells as points", () => {
  const dom = createApp();
  const { document } = dom.window;
  const search = document.querySelector("#search-input");

  search.value = "A01";
  document.querySelector("#search-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );

  assert.equal(document.querySelector("#group-code").textContent, "A01");
  assert.match(document.querySelector("#points-value").textContent, /13[\s\u00a0]?586/);
  assert.equal(document.querySelector("#financed-days").textContent, "25 dni");
  assert.equal(document.querySelector("#extra-day-points").textContent, "641 pkt");
  assert.equal(document.querySelector("#hospitalization-mode").options.length, 1);
});

test("manifest and offline shell reference existing files", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 1);

  for (const icon of manifest.icons) {
    assert.equal(fs.existsSync(path.join(ROOT, icon.src)), true, icon.src);
  }

  const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  for (const file of ["index.html", "app.css", "data/jgp-data-meta.js", "data/jgp-data-04.js", "data/jgp-characteristics-meta.js", "data/jgp-characteristics-14.js", "data/nfz-contract.js", "app.js", "manifest.webmanifest"]) {
    assert.match(worker, new RegExp(file.replace(".", "\\.")));
  }
});

test("the public build does not display a hospital name", () => {
  const files = ["index.html", "app.js", "data/nfz-contract.js"];
  files.forEach((name) => {
    const content = fs.readFileSync(path.join(ROOT, name), "utf8").toLocaleUpperCase("pl-PL");
    assert.equal(content.includes("SZPITAL UNIWERSYTECKI"), false, name);
  });
});
