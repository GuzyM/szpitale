"use strict";

const CATALOG = window.JGP_CATALOG || { meta: {}, groups: [] };
const GROUPS = CATALOG.groups;

const STORAGE_KEY = "jgp-calculator-v01";
const MODE_LABELS = {
  ordinary: "Hospitalizacja",
  planned: "Hospitalizacja planowa",
  oneDayTreatment: "Leczenie jednego dnia",
  sameDay: "Przyjęcie i wypis tego samego dnia",
  oneDayHosp: "Hospitalizacja 1-dniowa",
  twoDayHosp: "Hospitalizacja 2-dniowa"
};

const elements = {
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  suggestions: document.querySelector("#suggestions"),
  resultCard: document.querySelector("#result-card"),
  emptyState: document.querySelector("#empty-state"),
  groupCode: document.querySelector("#group-code"),
  groupName: document.querySelector("#group-name"),
  groupProductCode: document.querySelector("#group-product-code"),
  groupSection: document.querySelector("#group-section"),
  mode: document.querySelector("#hospitalization-mode"),
  pointPrice: document.querySelector("#point-price"),
  pointsValue: document.querySelector("#points-value"),
  baseValue: document.querySelector("#base-value"),
  combinedFactor: document.querySelector("#combined-factor"),
  totalValue: document.querySelector("#total-value"),
  totalEquation: document.querySelector("#total-equation"),
  factorFormula: document.querySelector("#factor-formula"),
  financedDays: document.querySelector("#financed-days"),
  extraDayPoints: document.querySelector("#extra-day-points"),
  bridge: document.querySelector("#factor-bridge"),
  anesthesia: document.querySelector("#factor-anesthesia"),
  neonate: document.querySelector("#factor-neonate"),
  customEnabled: document.querySelector("#factor-custom-enabled"),
  custom: document.querySelector("#factor-custom"),
  clearCoefficients: document.querySelector("#clear-coefficients"),
  installButton: document.querySelector("#install-help-button"),
  installDialog: document.querySelector("#install-dialog"),
  connectionBadge: document.querySelector("#connection-badge"),
  catalogLabel: document.querySelector("#catalog-label"),
  sourceOrder: document.querySelector("#source-order"),
  sourceCatalog: document.querySelector("#source-catalog"),
  sourceCount: document.querySelector("#source-count")
};

const factorInputs = [elements.bridge, elements.anesthesia, elements.neonate];
const numberFormatter = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2
});

let state = loadState();
let selectedGroup = GROUPS.find((group) => group.code === state.groupCode)
  || GROUPS.find((group) => group.code === "N01")
  || GROUPS[0];

function defaultState() {
  return {
    groupCode: "N01",
    modeByGroup: {},
    price: 1.96,
    customFactor: 1.27,
    factorsByGroup: {}
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultState(), ...saved };
  } catch {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Aplikacja pozostaje funkcjonalna również przy wyłączonym localStorage.
  }
}

function normalize(value) {
  return String(value || "").trim().toLocaleUpperCase("pl-PL");
}

function findMatches(value) {
  const query = normalize(value);
  if (!query) return GROUPS.slice(0, 8);
  return GROUPS.filter((group) => {
    return normalize(group.code).includes(query)
      || normalize(group.name).includes(query)
      || normalize(group.productCode).includes(query);
  });
}

function activeFactorState() {
  return state.factorsByGroup[selectedGroup.code] || {
    bridge: false,
    anesthesia: false,
    neonate: false,
    custom: false
  };
}

function setActiveFactorState(next) {
  state.factorsByGroup[selectedGroup.code] = next;
  saveState();
}

function renderSuggestions(matches) {
  elements.suggestions.replaceChildren();
  matches.slice(0, 8).forEach((group) => {
    const button = document.createElement("button");
    const code = document.createElement("strong");
    const name = document.createElement("span");
    button.type = "button";
    button.className = "suggestion";
    code.textContent = group.code;
    name.textContent = group.name;
    button.append(code, name);
    button.addEventListener("click", () => {
      elements.searchInput.value = group.code;
      elements.suggestions.replaceChildren();
      selectGroup(group);
    });
    elements.suggestions.appendChild(button);
  });
}

function renderModes(group) {
  elements.mode.replaceChildren();
  Object.keys(MODE_LABELS).forEach((modeKey) => {
    if (group[modeKey] == null) return;
    const option = document.createElement("option");
    option.value = modeKey;
    option.textContent = `${MODE_LABELS[modeKey]} · ${numberFormatter.format(group[modeKey])} pkt`;
    elements.mode.appendChild(option);
  });

  const savedMode = state.modeByGroup[group.code];
  elements.mode.value = group[savedMode] != null ? savedMode : "ordinary";
}

function setRuleAvailability() {
  const rules = [
    { input: elements.bridge, allowed: selectedGroup.code === "N01" },
    { input: elements.anesthesia, allowed: selectedGroup.code === "N01" },
    { input: elements.neonate, allowed: selectedGroup.code === "N01" }
  ];

  rules.forEach(({ input, allowed }) => {
    input.disabled = !allowed;
    const label = input.closest(".coefficient-option");
    label.classList.toggle("is-disabled", !allowed);
    if (!allowed) input.checked = false;
  });
}

function restoreFactorControls() {
  const factors = activeFactorState();
  elements.bridge.checked = Boolean(factors.bridge);
  elements.anesthesia.checked = Boolean(factors.anesthesia);
  elements.neonate.checked = Boolean(factors.neonate);
  elements.customEnabled.checked = Boolean(factors.custom);
  elements.custom.value = state.customFactor;
  elements.custom.disabled = !elements.customEnabled.checked;
  setRuleAvailability();
}

function selectGroup(group) {
  selectedGroup = group;
  state.groupCode = group.code;
  saveState();

  elements.resultCard.hidden = false;
  elements.emptyState.hidden = true;
  elements.groupCode.textContent = group.code;
  elements.groupName.textContent = group.name;
  elements.groupProductCode.textContent = group.productCode
    ? `Kod produktu: ${group.productCode}`
    : "Brak kodu produktu w katalogu";
  elements.groupSection.textContent = group.section || "Dział nieokreślony";
  elements.financedDays.textContent = group.financedDays == null
    ? "—"
    : `${numberFormatter.format(group.financedDays)} dni`;
  elements.extraDayPoints.textContent = group.extraDay == null
    ? "—"
    : `${numberFormatter.format(group.extraDay)} pkt`;

  renderModes(group);
  restoreFactorControls();
  updateCalculation();
}

function currentPoints() {
  return Number(selectedGroup[elements.mode.value] ?? selectedGroup.ordinary ?? 0);
}

function selectedFactors() {
  const factors = factorInputs
    .filter((input) => input.checked && !input.disabled)
    .map((input) => Number(input.dataset.factor));

  if (elements.customEnabled.checked) {
    const customValue = Number(elements.custom.value);
    if (Number.isFinite(customValue) && customValue > 0) factors.push(customValue);
  }

  return factors;
}

function combineFactors(factors) {
  if (factors.length === 0) return 1;
  return factors.reduce((sum, factor) => sum + factor, 0) - (factors.length - 1);
}

function updateCalculation() {
  const points = currentPoints();
  const price = Math.max(0, Number(elements.pointPrice.value) || 0);
  const factors = selectedFactors();
  const combined = combineFactors(factors);
  const base = points * price;
  const total = base * combined;

  elements.pointsValue.textContent = numberFormatter.format(points);
  elements.baseValue.textContent = moneyFormatter.format(base);
  elements.combinedFactor.textContent = decimalFormatter.format(combined);
  elements.totalValue.textContent = moneyFormatter.format(total);
  elements.totalEquation.textContent = `${numberFormatter.format(points)} pkt × ${decimalFormatter.format(price)} zł × ${decimalFormatter.format(combined)}`;
  elements.factorFormula.textContent = factors.length
    ? `Wybrane: ${factors.map((factor) => decimalFormatter.format(factor)).join(" + ")} → K = ${decimalFormatter.format(combined)}`
    : "Brak wybranego współczynnika.";

  state.price = price;
  state.customFactor = Number(elements.custom.value) || 1.27;
  state.modeByGroup[selectedGroup.code] = elements.mode.value;
  setActiveFactorState({
    bridge: elements.bridge.checked,
    anesthesia: elements.anesthesia.checked,
    neonate: elements.neonate.checked,
    custom: elements.customEnabled.checked
  });
}

function runSearch() {
  const matches = findMatches(elements.searchInput.value);
  const exact = matches.find((group) => normalize(group.code) === normalize(elements.searchInput.value));
  renderSuggestions(matches);

  if (exact || matches.length === 1) {
    selectGroup(exact || matches[0]);
    return;
  }

  if (matches.length === 0) {
    elements.resultCard.hidden = true;
    elements.emptyState.hidden = false;
  }
}

function clearCoefficients() {
  factorInputs.forEach((input) => { input.checked = false; });
  elements.customEnabled.checked = false;
  elements.custom.disabled = true;
  updateCalculation();
}

function updateConnectionBadge() {
  const isOnline = navigator.onLine;
  elements.connectionBadge.textContent = isOnline ? "Online" : "Offline";
  elements.connectionBadge.classList.toggle("offline", !isOnline);
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

elements.searchInput.addEventListener("input", () => {
  renderSuggestions(findMatches(elements.searchInput.value));
});

elements.mode.addEventListener("change", updateCalculation);
elements.pointPrice.addEventListener("input", updateCalculation);
factorInputs.forEach((input) => input.addEventListener("change", updateCalculation));

elements.customEnabled.addEventListener("change", () => {
  elements.custom.disabled = !elements.customEnabled.checked;
  if (elements.customEnabled.checked) elements.custom.focus();
  updateCalculation();
});

elements.custom.addEventListener("input", updateCalculation);
elements.clearCoefficients.addEventListener("click", clearCoefficients);
elements.installButton.addEventListener("click", () => elements.installDialog.showModal());
window.addEventListener("online", updateConnectionBadge);
window.addEventListener("offline", updateConnectionBadge);

elements.pointPrice.value = state.price;
elements.catalogLabel.textContent = `Załącznik 1a · ${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup`;
elements.sourceOrder.textContent = CATALOG.meta.orderNumber || "46/2026/DSOZ";
elements.sourceCatalog.textContent = CATALOG.meta.catalog || "Załącznik 1a – katalog grup";
elements.sourceCount.textContent = `${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup JGP`;

if (selectedGroup) {
  elements.searchInput.value = selectedGroup.code;
  selectGroup(selectedGroup);
} else {
  elements.resultCard.hidden = true;
  elements.emptyState.hidden = false;
}
updateConnectionBadge();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Brak service workera nie blokuje działania kalkulatora online.
    });
  });
}
