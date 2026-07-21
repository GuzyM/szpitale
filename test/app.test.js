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
    .replace(/\s*<script src="data\/jgp-characteristics-[^"]+\.js" defer><\/script>/g, "")
    .replace('<script src="app.js" defer></script>', "");
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
  const legislation = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mz-legislation.json"), "utf8"));
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
  dom.window.eval(fs.readFileSync(path.join(ROOT, "data", "nfz-coefficients.js"), "utf8"));
  dom.window.fetch = async () => ({
    ok: true,
    json: async () => legislation
  });
  dom.window.eval(script);
  return dom;
}

function input(window, element) {
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function change(window, element) {
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function openGruper(dom) {
  dom.window.document.querySelector("#open-gruper").click();
}

function selectSearchMode(dom, mode) {
  dom.window.document.querySelector(`[data-search-mode="${mode}"]`).click();
}

function search(dom, value, mode = "group") {
  const { document } = dom.window;
  selectSearchMode(dom, mode);
  const searchInput = document.querySelector("#search-input");
  searchInput.value = value;
  document.querySelector("#search-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
}

function suggestedCodes(document) {
  return Array.from(document.querySelectorAll("#suggestions .suggestion strong"))
    .map((element) => element.textContent);
}

test("HospitalAPP opens on a separate modern module home screen", () => {
  const dom = createApp();
  const { document } = dom.window;

  assert.equal(document.querySelector("#home-screen").hidden, false);
  assert.equal(document.querySelector("#gruper-screen").hidden, true);
  assert.match(document.querySelector("#home-title").textContent, /analizy szpitala/i);
  assert.equal(document.querySelector("#open-gruper").disabled, false);
  assert.equal(document.querySelectorAll(".module-card:disabled").length, 3);
  assert.match(document.querySelector(".dashboard-grid").textContent, /Kalkulator wynagrodzeń/);
  assert.equal(document.querySelector("#open-legislation").disabled, false);
});

test("entering Gruper first asks how the user wants to search", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);

  assert.equal(document.querySelector("#home-screen").hidden, true);
  assert.equal(document.querySelector("#gruper-screen").hidden, false);
  assert.equal(document.querySelector("#result-card").hidden, true);
  assert.equal(document.querySelectorAll("[data-search-mode]").length, 3);
  assert.equal(document.querySelector('[data-search-mode="group"]').getAttribute("aria-checked"), "true");
});

test("N01 calculation uses the verified contract price by default", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  assert.equal(document.querySelector("#group-code").textContent, "N01");
  assert.match(document.querySelector("#points-value").textContent, /1[\s\u00a0]?994/);
  assert.match(document.querySelector("#base-value").textContent, /3[\s\u00a0]?908,24/);
  assert.equal(document.querySelector("#combined-factor").textContent, "1,00");
  assert.equal(document.querySelector("#price-source-contract").checked, true);
  assert.equal(document.querySelector("#point-price").readOnly, true);
});

test("N01 shows an anonymized profile, scope, unit product and API price", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  assert.equal(document.querySelector("#provider-name").textContent, "Anonimowy profil referencyjny");
  assert.equal(document.querySelector("#provider-code").textContent, "dane zanonimizowane");
  assert.equal(document.querySelector("#contract-status").textContent, "Potwierdzone w API");
  assert.equal(document.querySelector("#contract-scope-code").textContent, "03.4450.260.02");
  assert.equal(document.querySelector("#contract-unit-code").textContent, "5.51.01.0013001");
  assert.equal(document.querySelector("#contract-agreement-code").textContent, "dane zanonimizowane");
  assert.match(document.querySelector("#contract-point-price").textContent, /1,96/);
  assert.match(document.querySelector("#contract-addition-list").textContent, /5\.53\.01\.0001510/);
  assert.match(document.querySelector("#contract-addition-list").textContent, /nie jest automatycznie dodany/i);
});

test("the clear price source control switches from contract to custom price", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  const customChoice = document.querySelector("#price-source-custom");
  customChoice.checked = true;
  change(dom.window, customChoice);
  const price = document.querySelector("#point-price");
  price.value = "2.50";
  input(dom.window, price);

  assert.equal(price.readOnly, false);
  assert.equal(document.querySelector("#point-price-source").textContent, "wartość użytkownika");
  assert.match(document.querySelector("#base-value").textContent, /4[\s\u00a0]?985,00/);
});

test("custom provider mode is clearly local and disables contract prices", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  const provider = document.querySelector("#provider-profile");
  provider.value = "custom";
  change(dom.window, provider);
  const name = document.querySelector("#custom-provider-name");
  name.value = "Mój szpital";
  input(dom.window, name);

  assert.equal(document.querySelector("#custom-provider-fields").hidden, false);
  assert.equal(document.querySelector("#provider-status").textContent, "Profil własny");
  assert.equal(document.querySelector("#provider-name").textContent, "Mój szpital");
  assert.equal(document.querySelector("#contract-status").textContent, "Brak w profilu");
  assert.equal(document.querySelector("#price-source-contract").disabled, true);
  assert.equal(document.querySelector("#price-source-custom").checked, true);
  assert.match(document.querySelector(".provider-lookup-link").href, /Branch=06/);
});

test("search modes separate groups, ICD-10 diagnoses and ICD-9 procedures", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);

  selectSearchMode(dom, "group");
  const searchInput = document.querySelector("#search-input");
  searchInput.value = "O80.0";
  input(dom.window, searchInput);
  assert.deepEqual(suggestedCodes(document), []);

  selectSearchMode(dom, "diagnosis");
  searchInput.value = "O80.0";
  input(dom.window, searchInput);
  assert.equal(suggestedCodes(document).includes("N01"), true);

  selectSearchMode(dom, "procedure");
  searchInput.value = "89.393";
  input(dom.window, searchInput);
  assert.equal(suggestedCodes(document).includes("N01"), true);
});

test("search by contract scope returns all matching obstetric groups", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  selectSearchMode(dom, "group");
  const searchInput = document.querySelector("#search-input");
  searchInput.value = "03.4450.260.02";
  input(dom.window, searchInput);

  assert.deepEqual(suggestedCodes(document), ["N01", "N02", "N03", "N09", "N11", "N13", "N20"]);
});

test("multiple coefficients follow NFZ sum and multiplication modes", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  document.querySelector("#add-coefficient").click();
  document.querySelector("#add-coefficient").click();
  document.querySelector("#add-coefficient").click();
  const valueInputs = Array.from(document.querySelectorAll('[data-coefficient-field="value"]'));
  valueInputs[0].value = "1.20";
  input(dom.window, valueInputs[0]);
  valueInputs[1].value = "1.10";
  input(dom.window, valueInputs[1]);
  valueInputs[2].value = "1.05";
  input(dom.window, valueInputs[2]);
  const combinations = Array.from(document.querySelectorAll('[data-coefficient-field="combination"]'));
  combinations[2].value = "multiply";
  change(dom.window, combinations[2]);

  assert.equal(document.querySelector("#coefficient-count").textContent, "3");
  assert.equal(document.querySelector("#combined-factor").textContent, "1,37");
  assert.match(document.querySelector("#factor-formula").textContent, /sumowanie NFZ/i);
  assert.match(document.querySelector("#factor-formula").textContent, /mnożenie/i);
  assert.match(document.querySelector("#total-value").textContent, /5[\s\u00a0]?334,75/);
});

test("N01 suggests only matching public rules and adds a selected sourced variant", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  assert.equal(document.querySelector("#coefficient-enabled").checked, false);
  assert.equal(document.querySelector("#coefficient-tools").hidden, true);
  const toggle = document.querySelector("#coefficient-enabled");
  toggle.checked = true;
  change(dom.window, toggle);

  assert.equal(document.querySelector("#coefficient-tools").hidden, false);
  assert.equal(document.querySelectorAll("#coefficient-suggestion-list .registry-rule-card").length, 2);
  assert.match(document.querySelector("#coefficient-suggestion-list").textContent, /znieczuleni/i);
  assert.match(document.querySelector("#coefficient-suggestion-list").textContent, /N01 i opieki nad noworodkiem N20/);

  const variant = document.querySelector('[data-rule-variant="obstetric-anesthesia-share"]');
  variant.value = "above-35";
  document.querySelector('[data-add-rule="obstetric-anesthesia-share"]').click();

  assert.equal(document.querySelector("#coefficient-count").textContent, "1");
  assert.equal(document.querySelector("#combined-factor").textContent, "1,21");
  assert.match(document.querySelector(".coefficient-item-source").href, /nfz\.gov\.pl/);
});

test("a group without mapped public rules does not inherit obstetric suggestions", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "A01");
  const toggle = document.querySelector("#coefficient-enabled");
  toggle.checked = true;
  change(dom.window, toggle);

  assert.equal(document.querySelectorAll("#coefficient-suggestion-list .registry-rule-card").length, 0);
  assert.equal(document.querySelector("#coefficient-suggestion-empty").hidden, false);
  assert.doesNotMatch(document.querySelector("#coefficient-suggestions-title").parentElement.parentElement.textContent, /N20/);
});

test("Legislacja MZ opens as a separate module and refreshes official links", async () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-legislation").click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(document.querySelector("#home-screen").hidden, true);
  assert.equal(document.querySelector("#gruper-screen").hidden, true);
  assert.equal(document.querySelector("#legislation-screen").hidden, false);
  assert.equal(document.querySelectorAll("#legislation-list .legislation-item").length, 3);
  assert.match(document.querySelector("#legislation-list").textContent, /Rządowym Procesie Legislacyjnym/);
  assert.equal(
    Array.from(document.querySelectorAll("#legislation-list a")).every((link) => (
      link.hostname === "legislacja.gov.pl" || link.hostname === "www.gov.pl"
    )),
    true
  );
});

test("coefficients can be removed and remain isolated to their JGP group", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");
  document.querySelector("#add-coefficient").click();
  const factor = document.querySelector('[data-coefficient-field="value"]');
  factor.value = "1.27";
  input(dom.window, factor);

  search(dom, "A01");
  assert.equal(document.querySelector("#coefficient-count").textContent, "0");
  assert.equal(document.querySelector("#combined-factor").textContent, "1,00");

  search(dom, "N01");
  assert.equal(document.querySelector("#coefficient-count").textContent, "1");
  document.querySelector("[data-remove-coefficient]").click();
  assert.equal(document.querySelector("#coefficient-count").textContent, "0");
  assert.equal(document.querySelector("#coefficient-empty").hidden, false);
});

test("N20 never receives N01 additional obstetric products automatically", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N20");

  assert.equal(document.querySelector("#group-code").textContent, "N20");
  assert.equal(document.querySelector("#contract-additions").hidden, true);
  assert.equal(document.querySelector("#contract-addition-list").textContent, "");
  assert.equal(document.querySelector("#coefficient-count").textContent, "0");
});

test("N01 grouping is shown as two readable paths with labelled lists", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  assert.equal(document.querySelectorAll("#grouping-rules .grouping-rule-card").length, 2);
  assert.match(document.querySelector("#grouping-summary").textContent, /2 ścieżki/);
  assert.equal(document.querySelectorAll("#grouping-rules .rule-connector").length, 0);
  assert.equal(document.querySelectorAll("#grouping-rules .rule-chip").length > 0, true);
  assert.equal(document.querySelectorAll("#direct-code-lists .system-icd-10").length, 1);
});

test("technical list markers do not become fake grouping paths", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "B18G");

  assert.equal(document.querySelectorAll("#grouping-rules .grouping-rule-card").length, 2);
  assert.equal(
    Array.from(document.querySelectorAll("#grouping-rules .rule-card-copy p"))
      .some((element) => element.textContent.trim() === "B18R"),
    false
  );
});

test("large ICD lists remain lazy and render only after opening", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");
  const list = document.querySelector("#direct-code-lists .code-list");

  assert.equal(list.querySelectorAll("li").length, 0);
  list.open = true;
  list.dispatchEvent(new dom.window.Event("toggle"));
  assert.equal(list.querySelectorAll("li").length, 16);
});

test("a group outside the selected contract uses a custom price without losing catalog data", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "A01");

  assert.equal(document.querySelector("#group-code").textContent, "A01");
  assert.equal(document.querySelector("#contract-status").textContent, "Brak w profilu");
  assert.equal(document.querySelector("#contract-verified-content").hidden, true);
  assert.equal(document.querySelector("#price-source-contract").disabled, true);
  assert.equal(document.querySelector("#price-source-custom").checked, true);
  assert.match(document.querySelector("#points-value").textContent, /13[\s\u00a0]?586/);
  assert.equal(document.querySelector("#financed-days").textContent, "25 dni");
  assert.equal(document.querySelector("#extra-day-points").textContent, "641 pkt");
});

test("official catalog and characteristics remain complete", () => {
  const dom = createApp();
  const catalog = dom.window.JGP_CATALOG;
  const characteristics = dom.window.JGP_CHARACTERISTICS;

  assert.equal(catalog.meta.orderNumber, "46/2026/DSOZ");
  assert.equal(catalog.groups.length, 702);
  assert.equal(catalog.groups[0].code, "A01");
  assert.equal(catalog.groups.at(-1).code, "Z01");
  assert.equal(catalog.groups.find((group) => group.code === "N01").ordinary, 1994);
  assert.equal(characteristics.meta.groupCount, 702);
  assert.equal(characteristics.meta.listCount, 144);
  assert.equal(characteristics.meta.codeEntryCount, 35060);
});

test("the public profile contains no hospital or agreement identifiers", () => {
  const contract = fs.readFileSync(path.join(ROOT, "data", "nfz-contract.js"), "utf8");
  assert.match(contract, /providerName/);
  assert.equal(contract.includes("SZPITAL UNIWERSYTECKI"), false);
  assert.equal(contract.includes("061/100014"), false);
  assert.equal(/\bNIP\b/i.test(contract), false);
  assert.equal(/\bREGON\b/i.test(contract), false);
  assert.equal(/providerAddress/i.test(contract), false);
});

test("current NFZ coefficient guidance is linked in the application", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /komunikat-dla-swiadczeniodawcow-i-tworcow-oprogramowania%2C8872/);
  assert.match(html, /ΣW − \(n−1\)/);
  assert.match(html, /standardy-zywienia-w-szpitalach/);
});

test("manifest and offline shell reference all core files", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait-primary");
  for (const icon of manifest.icons) {
    assert.equal(fs.existsSync(path.join(ROOT, icon.src)), true, icon.src);
  }

  const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  for (const file of [
    "index.html", "app.css", "data/jgp-data-meta.js", "data/jgp-data-04.js",
    "data/jgp-characteristics-meta.js", "data/jgp-characteristics-14.js",
    "data/nfz-contract.js", "app.js", "manifest.webmanifest"
  ]) {
    assert.match(worker, new RegExp(file.replace(".", "\\.")));
  }
});
