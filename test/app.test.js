"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");

function createApp(legislationOverride = null) {
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
  const legislation = legislationOverride
    || JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mz-legislation.json"), "utf8"));
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
  dom.window.eval(fs.readFileSync(path.join(ROOT, "data", "cost-accounting-regulation.js"), "utf8"));
  dom.window.eval(fs.readFileSync(path.join(ROOT, "data", "cost-accounting.js"), "utf8"));
  dom.window.eval(fs.readFileSync(path.join(ROOT, "data", "key-change.js"), "utf8"));
  dom.window.fetch = async (request) => {
    const url = String(request).split("?")[0];
    let payload;
    if (url.endsWith("data-hub/manifest.json")) {
      payload = JSON.parse(fs.readFileSync(path.join(ROOT, "data-hub", "manifest.json"), "utf8"));
    } else if (url.endsWith("data-hub/datasets/procurements/index.json")) {
      payload = JSON.parse(fs.readFileSync(
        path.join(ROOT, "data-hub", "datasets", "procurements", "index.json"),
        "utf8"
      ));
    } else if (url.includes("data-hub/datasets/procurements/shards/")) {
      const filename = path.basename(url);
      payload = JSON.parse(fs.readFileSync(
        path.join(ROOT, "data-hub", "datasets", "procurements", "shards", filename),
        "utf8"
      ));
    } else if (url.endsWith("data/mz-legislation.json")) {
      payload = legislation;
    } else {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => payload };
  };
  dom.window.eval(fs.readFileSync(path.join(ROOT, "data-hub.js"), "utf8"));
  dom.window.eval(script);
  return dom;
}

function legislationFixture() {
  return {
    meta: {
      checkedAt: "2026-07-23T04:17:00+00:00",
      projectCount: 2,
      newSincePreviousCheck: 1
    },
    items: [
      {
        id: "rcl-1001",
        type: "Projekt rozporządzenia Ministra Zdrowia",
        title: "Projekt rozporządzenia w sprawie pilotażu",
        publicationDate: "2026-07-23",
        dateLabel: "Publikacja",
        shortStatus: "Nowy projekt",
        isNew: true,
        summaryStatus: "ready",
        summary: "Zdanie pierwsze. Zdanie drugie. Zdanie trzecie. Zdanie czwarte. Zdanie piąte.",
        source: "Rządowy Proces Legislacyjny",
        url: "https://legislacja.gov.pl/projekt/1001"
      },
      {
        id: "rcl-1000",
        type: "Projekt ustawy",
        title: "Projekt ustawy o jakości",
        publicationDate: "2026-07-22",
        dateLabel: "Publikacja",
        shortStatus: "W toku",
        isNew: false,
        summaryStatus: "pending",
        summary: null,
        source: "Rządowy Proces Legislacyjny",
        url: "https://legislacja.gov.pl/projekt/1000"
      }
    ]
  };
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
  assert.match(document.querySelector("#home-title").textContent, /Sprawdź JGP/i);
  assert.equal(document.querySelector("#open-gruper").disabled, false);
  assert.equal(document.querySelectorAll(".module-card:disabled").length, 1);
  assert.equal(document.querySelector("#open-payroll").disabled, false);
  assert.equal(document.querySelector("#open-cost-accounting").disabled, false);
  assert.equal(document.querySelector("#open-key-change").disabled, false);
  assert.equal(document.querySelector("#open-nfz-services").hidden, true);
  assert.match(document.querySelector(".dashboard-grid").textContent, /Skutki wzrostu płac/);
  assert.match(document.querySelector(".dashboard-grid").textContent, /Rachunek kosztów/);
  assert.equal(document.querySelector("#open-legislation").disabled, false);
  assert.equal(document.querySelector("#open-procurements").hidden, true);
  assert.doesNotMatch(document.querySelector(".dashboard-grid").textContent, /Pilot 1\.0|Zalążek 0\.9/);
  assert.match(document.querySelector("#open-key-change").textContent, /Kluczowa zmiana/i);
});

test("Data Hub procurement pilot searches processed records without storing documents", async () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-procurements").click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(document.querySelector("#procurements-screen").hidden, false);
  assert.equal(document.querySelectorAll("#procurements-results .procurement-card").length, 3);
  assert.match(document.querySelector("#procurements-results").textContent, /Szpital Uniwersytecki w Krakowie/i);
  assert.match(document.querySelector("#procurements-results").textContent, /Szpital Kliniczny/i);
  assert.match(document.querySelector("#procurements-results").textContent, /Projekt umowy/i);
  assert.match(document.querySelector("#procurements-results").textContent, /Nie wyodrębniono/i);

  const searchInput = document.querySelector("#procurements-search");
  searchInput.value = "Poznaniu materiały";
  document.querySelector("#procurements-search-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(document.querySelectorAll("#procurements-results .procurement-card").length, 1);
  assert.match(document.querySelector("#procurements-results").textContent, /DZP\/APT\/39\/2025/i);
  assert.equal(
    Array.from(document.querySelectorAll(".procurement-card a"))
      .every((link) => link.hostname === "platformazakupowa.pl"),
    true
  );
});

test("gold key-change module explains UD439 in nine management tiles", () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-key-change").click();

  assert.equal(document.querySelector("#key-change-screen").hidden, false);
  assert.equal(document.querySelectorAll("#key-change-tiles .key-change-tile").length, 9);
  assert.match(document.querySelector("#key-change-screen").textContent, /To jeszcze nie jest prawo/i);
  assert.match(document.querySelector("#key-change-screen").textContent, /Wynagrodzenia/i);
  assert.match(document.querySelector("#key-change-screen").textContent, /Etaty i czas pracy/i);
  assert.match(document.querySelector("#key-change-screen").textContent, /Kogo obejmuje/i);
  assert.match(document.querySelector("#key-hourly-limit").textContent, /240,30/);
  assert.match(document.querySelector("#key-monthly-limit").textContent, /38[\s\u00a0]?448,00/);
  assert.match(document.querySelector("#key-total-limit").textContent, /76[\s\u00a0]?896,00/);
  assert.equal(document.querySelectorAll("#key-change-actions li").length, 6);
  assert.equal(document.querySelector("#key-change-project").hostname, "legislacja.gov.pl");
});

test("unfinished modules are clearly marked as test versions with full versions coming soon", () => {
  const dom = createApp();
  const { document } = dom.window;

  assert.match(document.querySelector("#open-procurements").textContent, /Wersja testowa/i);
  assert.match(document.querySelector("#open-nfz-services").textContent, /Wersja testowa/i);
  assert.match(document.querySelector(".module-card:disabled").textContent, /Pełna wersja wkrótce/i);

  document.querySelector("#open-nfz-services").click();
  assert.equal(document.querySelector("#nfz-services-screen").hidden, false);
  assert.equal(document.querySelectorAll(".nfz-service-card.is-ready").length, 1);
  assert.equal(document.querySelectorAll(".nfz-service-card:not(.is-ready)").length, 5);
  assert.match(document.querySelector("#nfz-services-screen").textContent, /pełni działa wyłącznie katalog JGP/i);
});

test("private notes save the current module context only on the device", () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-key-change").click();
  document.querySelector("#notes-button").click();
  const note = document.querySelector("#notes-input");
  note.value = "Sprawdzić umowy lekarzy kontraktowych.";
  document.querySelector("#notes-save").click();

  const saved = JSON.parse(dom.window.localStorage.getItem("hospitalapp-local-notes-v1"));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].context, "Kluczowa zmiana · UD439");
  assert.equal(saved[0].text, "Sprawdzić umowy lekarzy kontraktowych.");
  assert.match(document.querySelector("#notes-list").textContent, /Sprawdzić umowy/i);
  assert.equal(document.querySelector("#notes-count").textContent, "1");
});

test("Rachunek kosztów searches the regulation and exposes 20 practical questions", () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-cost-accounting").click();

  assert.equal(document.querySelector("#cost-accounting-screen").hidden, false);
  assert.equal(document.querySelectorAll("#knowledge-results .knowledge-result.is-faq").length, 20);
  assert.equal(document.querySelectorAll("#knowledge-results .knowledge-result.is-regulation").length, 21);
  assert.equal(dom.window.HOSPITALAPP_SRK_FULLTEXT.sections.length, 19);
  assert.equal(document.querySelectorAll("#knowledge-resources a").length, 5);

  const searchInput = document.querySelector("#knowledge-search");
  searchInput.value = "blok operacyjny";
  input(dom.window, searchInput);
  assert.match(document.querySelector("#knowledge-results").textContent, /Centralnego Bloku Operacyjnego/i);
  assert.equal(
    Array.from(document.querySelectorAll("#knowledge-results .knowledge-result"))
      .every((item) => /blok|sala/i.test(item.textContent)),
    true
  );

  searchInput.value = "";
  input(dom.window, searchInput);
  document.querySelector('[data-knowledge-filter="faq"]').click();
  assert.equal(document.querySelectorAll("#knowledge-results .knowledge-result").length, 20);

  document.querySelector('[data-knowledge-filter="regulation"]').click();
  searchInput.value = "cyberprzestępstw";
  input(dom.window, searchInput);
  assert.equal(document.querySelectorAll("#knowledge-results .knowledge-result").length, 1);
  assert.match(document.querySelector(".knowledge-official-match").textContent, /cyberprzestępstw/i);
});

test("payroll impact calculator uses all 10 statutory groups and official 2026 bases", () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-payroll").click();

  assert.equal(document.querySelector("#payroll-screen").hidden, false);
  assert.equal(document.querySelectorAll("#payroll-group-list .payroll-group-row").length, 10);
  assert.equal(document.querySelector("#payroll-previous-base").value, "8181.72");
  assert.equal(document.querySelector("#payroll-current-base").value, "8903.56");

  const groupOne = document.querySelector('[data-payroll-headcount="1"]');
  groupOne.value = "1";
  input(dom.window, groupOne);
  assert.match(document.querySelector('[data-payroll-delta="1"]').textContent, /1[\s\u00a0]?046,67/);
  assert.match(document.querySelector("#payroll-monthly-result").textContent, /1[\s\u00a0]?261,03/);
  assert.match(document.querySelector("#payroll-halfyear-result").textContent, /7[\s\u00a0]?566,15/);
  assert.match(document.querySelector("#payroll-year-result").textContent, /15[\s\u00a0]?132,31/);
});

test("payroll oncost toggle changes the result and has a clear checked state", () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-payroll").click();
  const groupOne = document.querySelector('[data-payroll-headcount="1"]');
  groupOne.value = "1";
  input(dom.window, groupOne);
  const withOncost = document.querySelector("#payroll-monthly-result").textContent;
  const toggle = document.querySelector("#payroll-include-oncost");
  assert.equal(toggle.checked, true);

  toggle.checked = false;
  change(dom.window, toggle);
  assert.notEqual(document.querySelector("#payroll-monthly-result").textContent, withOncost);
  assert.match(document.querySelector("#payroll-monthly-result").textContent, /1[\s\u00a0]?046,67/);
  assert.match(document.querySelector("#payroll-result-mode").textContent, /zasadnicze/i);
});

test("each payroll group can reveal its full statutory composition", () => {
  const dom = createApp();
  const { document } = dom.window;
  document.querySelector("#open-payroll").click();
  const toggle = document.querySelector('[data-payroll-group-toggle="2"]');
  const description = document.querySelector("#payroll-group-description-2");
  assert.equal(description.hidden, true);

  toggle.click();
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(description.hidden, false);
  assert.match(description.textContent, /Farmaceuta, fizjoterapeuta, diagnosta laboratoryjny/i);
  assert.match(description.textContent, /pielęgniarka lub położna/i);
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

test("N01 calculation uses the current catalog and a local price by default", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  assert.equal(document.querySelector("#group-code").textContent, "N01");
  assert.match(document.querySelector("#points-value").textContent, /4[\s\u00a0]?352/);
  assert.match(document.querySelector("#base-value").textContent, /8[\s\u00a0]?529,92/);
  assert.equal(document.querySelector("#combined-factor").textContent, "1,00");
  assert.equal(document.querySelector("#price-source-custom").checked, true);
  assert.equal(document.querySelector("#point-price").readOnly, false);
});

test("contract and provider surfaces are removed from the tester interface", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");

  assert.equal(document.querySelector(".provider-section").hidden, true);
  assert.equal(document.querySelector("#contract-panel").hidden, true);
  assert.equal(document.querySelector(".price-source-fieldset").hidden, true);
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
  assert.match(document.querySelector("#base-value").textContent, /10[\s\u00a0]?880,00/);
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

test("groups removed by order 74 no longer appear in the catalog", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N09");
  assert.equal(document.querySelector("#result-card").hidden, true);
  search(dom, "AU35C");
  assert.equal(document.querySelector("#group-code").textContent, "AU35C");
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
  assert.match(document.querySelector("#total-value").textContent, /11[\s\u00a0]?643,34/);
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

test("Legislacja MZ opens as a persistent project register with full metadata", async () => {
  const dom = createApp(legislationFixture());
  const { document } = dom.window;
  document.querySelector("#open-legislation").click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(document.querySelector("#home-screen").hidden, true);
  assert.equal(document.querySelector("#gruper-screen").hidden, true);
  assert.equal(document.querySelector("#legislation-screen").hidden, false);
  assert.equal(document.querySelectorAll("#legislation-list .legislation-item").length, 2);
  assert.equal(document.querySelector("#legislation-total-count").textContent, "2");
  assert.equal(document.querySelector("#legislation-new-count").textContent, "1");
  assert.match(document.querySelector("#legislation-list").textContent, /NOWE/);
  assert.match(document.querySelector("#legislation-list").textContent, /Podsumowanie · gotowe 5 zdań/);
  assert.match(document.querySelector("#legislation-list").textContent, /Podsumowanie w przygotowaniu/);
  assert.equal(
    Array.from(document.querySelectorAll("#legislation-list .legislation-source-button"))
      .every((link) => link.hostname === "legislacja.gov.pl"),
    true
  );
});

test("legislation filters show only new projects or projects with a ready summary", async () => {
  const dom = createApp(legislationFixture());
  const { document } = dom.window;
  document.querySelector("#open-legislation").click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  const onlySummary = document.querySelector("#legislation-filter-summary");
  onlySummary.checked = true;
  change(dom.window, onlySummary);
  assert.equal(document.querySelectorAll("#legislation-list .legislation-item").length, 1);
  assert.match(document.querySelector("#legislation-count").textContent, /1 z 2/);

  onlySummary.checked = false;
  change(dom.window, onlySummary);
  const onlyNew = document.querySelector("#legislation-filter-new");
  onlyNew.checked = true;
  change(dom.window, onlyNew);
  assert.equal(document.querySelectorAll("#legislation-list .legislation-item").length, 1);
  assert.match(document.querySelector("#legislation-list").textContent, /Nowy projekt/);
});

test("legislation user labels are private and saved on the device", async () => {
  const dom = createApp(legislationFixture());
  const { document } = dom.window;
  document.querySelector("#open-legislation").click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  const important = document.querySelector('[data-legislation-id="rcl-1001"][data-legislation-action="important"]');
  important.click();
  assert.equal(
    document.querySelector(".legislation-item.is-important") !== null,
    true
  );
  const saved = JSON.parse(dom.window.localStorage.getItem("hospitalapp-mz-legislation-preferences-v1"));
  assert.equal(saved["rcl-1001"].important, true);
});

test("stale legislation is never presented as current", () => {
  const fixture = legislationFixture();
  fixture.meta.checkedAt = "2026-01-01T00:00:00+00:00";
  const dom = createApp(fixture);
  const { document } = dom.window;

  assert.equal(document.querySelector("#legislation-status").textContent, "Dane opóźnione");
  assert.match(document.querySelector("#legislation-freshness-note").textContent, /ponad 36 godzin/i);
  assert.equal(document.querySelector(".legislation-status-card").classList.contains("is-stale"), true);
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

test("clicking a grouping chip opens and highlights the referenced ICD list", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "N01");
  const chip = document.querySelector("#grouping-rules [data-open-list-code]");
  assert.ok(chip);
  const code = chip.dataset.openListCode;
  const type = chip.dataset.openListType;
  const target = Array.from(document.querySelectorAll(`.code-list[data-list-code="${code}"]`))
    .find((item) => item.dataset.listType === type)
    || document.querySelector(`.code-list[data-list-code="${code}"]`);
  assert.ok(target);

  chip.click();
  assert.equal(target.open, true);
  assert.equal(target.classList.contains("is-highlighted"), true);
  assert.equal(target.querySelectorAll("li").length > 0, true);
});

test("the new 1ae catalog exposes the under-12-hour mode", () => {
  const dom = createApp();
  const { document } = dom.window;
  openGruper(dom);
  search(dom, "AU35C");
  assert.match(document.querySelector("#hospitalization-mode").textContent, /do 12 godzin/i);
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
  assert.equal(list.querySelectorAll("li").length > 0, true);
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

  assert.equal(catalog.meta.orderNumber, "74/2026/DSOZ");
  assert.equal(catalog.groups.length, 748);
  assert.equal(catalog.groups[0].code, "A01");
  assert.equal(catalog.groups.some((group) => group.code === "AU35C"), true);
  assert.equal(catalog.groups.some((group) => group.code === "N09"), false);
  assert.equal(catalog.groups.find((group) => group.code === "N01").ordinary, 4352);
  assert.equal(characteristics.meta.groupCount, 748);
  assert.equal(characteristics.meta.listCount, 140);
  assert.equal(characteristics.meta.codeEntryCount, 39306);
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
    "data/key-change.js", "data-hub.js", "data-hub/manifest.json", "app.js", "manifest.webmanifest"
  ]) {
    assert.match(worker, new RegExp(file.replace(".", "\\.")));
  }
  assert.match(worker, /hospitalapp-v1\.2\.0/);
});
