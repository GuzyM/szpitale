"use strict";

const CATALOG = window.JGP_CATALOG || { meta: {}, groups: [] };
const CHARACTERISTICS = window.JGP_CHARACTERISTICS || { meta: {}, blocks: {} };
const CONTRACT_DATA = window.NFZ_CONTRACT || { meta: {}, scopes: [] };
const GROUPS = CATALOG.groups;
const BLOCKS = CHARACTERISTICS.blocks;
const CONTRACT_SCOPES = CONTRACT_DATA.scopes || [];
const GROUP_BY_CODE = new Map(GROUPS.map((group) => [group.code, group]));

const STORAGE_KEY = "hospitalapp-jgp-v04";
const LEGACY_STORAGE_KEY = "jgp-calculator-v03";
const MODE_LABELS = {
  ordinary: "Hospitalizacja",
  planned: "Hospitalizacja planowa",
  oneDayTreatment: "Leczenie jednego dnia",
  sameDay: "Przyjęcie i wypis tego samego dnia",
  oneDayHosp: "Hospitalizacja 1-dniowa",
  twoDayHosp: "Hospitalizacja 2-dniowa"
};
const REFERENCE_ROLE_LABELS = {
  procedure: "Lista procedur",
  diagnosis: "Lista rozpoznań",
  additional: "Lista dodatkowa",
  general: "Lista ogólna",
  reference: "Lista przywołana"
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
  contractPanel: document.querySelector("#contract-panel"),
  contractStatus: document.querySelector("#contract-status"),
  contractVerifiedContent: document.querySelector("#contract-verified-content"),
  contractEmpty: document.querySelector("#contract-empty"),
  contractScopeCode: document.querySelector("#contract-scope-code"),
  contractScopeName: document.querySelector("#contract-scope-name"),
  contractPointPrice: document.querySelector("#contract-point-price"),
  contractUnitCode: document.querySelector("#contract-unit-code"),
  contractUnitName: document.querySelector("#contract-unit-name"),
  contractAgreementCode: document.querySelector("#contract-agreement-code"),
  contractValidity: document.querySelector("#contract-validity"),
  contractAdditions: document.querySelector("#contract-additions"),
  contractAdditionList: document.querySelector("#contract-addition-list"),
  contractSource: document.querySelector("#contract-source"),
  useContractPrice: document.querySelector("#use-contract-price"),
  mode: document.querySelector("#hospitalization-mode"),
  pointPrice: document.querySelector("#point-price"),
  pointPriceSource: document.querySelector("#point-price-source"),
  pointsValue: document.querySelector("#points-value"),
  baseValue: document.querySelector("#base-value"),
  combinedFactor: document.querySelector("#combined-factor"),
  totalValue: document.querySelector("#total-value"),
  totalEquation: document.querySelector("#total-equation"),
  factorFormula: document.querySelector("#factor-formula"),
  financedDays: document.querySelector("#financed-days"),
  extraDayPoints: document.querySelector("#extra-day-points"),
  coefficientEnabled: document.querySelector("#coefficient-enabled"),
  coefficientControls: document.querySelector("#coefficient-controls"),
  coefficientSelect: document.querySelector("#coefficient-select"),
  customFactor: document.querySelector("#factor-custom"),
  groupingSummary: document.querySelector("#grouping-summary"),
  groupingRules: document.querySelector("#grouping-rules"),
  directCodeLists: document.querySelector("#direct-code-lists"),
  referencedCodeLists: document.querySelector("#referenced-code-lists"),
  scopeSummary: document.querySelector("#scope-summary"),
  scopeList: document.querySelector("#scope-list"),
  catalogNote: document.querySelector("#catalog-note"),
  installButton: document.querySelector("#install-help-button"),
  installDialog: document.querySelector("#install-dialog"),
  connectionBadge: document.querySelector("#connection-badge"),
  catalogLabel: document.querySelector("#catalog-label"),
  sourceOrder: document.querySelector("#source-order"),
  sourceCatalog: document.querySelector("#source-catalog"),
  sourceCount: document.querySelector("#source-count"),
  sourceCharacteristics: document.querySelector("#source-characteristics"),
  sourceApiLabel: document.querySelector("#source-api-label"),
  sourceApiDate: document.querySelector("#source-api-date")
};

const numberFormatter = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2
});
const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const BLOCK_TO_GROUPS = buildBlockToGroupMap();
let state = loadState();
let selectedGroup = GROUP_BY_CODE.get(state.groupCode)
  || GROUP_BY_CODE.get("N01")
  || GROUPS[0];

function defaultState() {
  return {
    groupCode: "N01",
    modeByGroup: {},
    price: 1.96,
    customFactorByGroup: {},
    coefficientEnabledByGroup: {}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const merged = { ...defaultState(), ...saved };
    merged.customFactorByGroup = { ...(saved.customFactorByGroup || {}) };
    if (saved.customFactor && saved.groupCode && merged.customFactorByGroup[saved.groupCode] == null) {
      merged.customFactorByGroup[saved.groupCode] = saved.customFactor;
    }
    return merged;
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
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function contractMatchesForGroup(group) {
  const matches = [];
  CONTRACT_SCOPES.forEach((scope) => {
    const unitProduct = (scope.unitProducts || []).find((product) => (
      product.groupCode === group.code || product.productCode === group.productCode
    ));
    if (unitProduct) matches.push({ scope, unitProduct });
  });
  return matches;
}

function primaryContractMatch(group = selectedGroup) {
  return contractMatchesForGroup(group)[0] || null;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
}

function addBlockGroup(mapping, blockCode, groupCode) {
  if (!mapping.has(blockCode)) mapping.set(blockCode, new Set());
  mapping.get(blockCode).add(groupCode);
}

function buildBlockToGroupMap() {
  const mapping = new Map();
  GROUPS.forEach((group) => {
    addBlockGroup(mapping, group.code, group.code);
    const block = BLOCKS[group.code];
    (block?.references || []).forEach((reference) => {
      addBlockGroup(mapping, reference.code, group.code);
    });
  });
  return mapping;
}

function blockSearchText(block) {
  if (block.searchText) return block.searchText;
  const values = [block.title];
  block.segments.forEach((segment) => {
    if (segment.type === "text") values.push(segment.text);
    if (segment.type === "list") values.push(...segment.items);
  });
  block.searchText = normalize(values.join(" "));
  return block.searchText;
}

function blockMatchContext(block, query) {
  for (const segment of block.segments) {
    if (segment.type === "text" && normalize(segment.text).includes(query)) {
      return segment.text;
    }
    if (segment.type === "list") {
      const item = segment.items.find((entry) => normalize(entry).includes(query));
      if (item) return item;
    }
  }
  return block.title;
}

function directGroupMatch(group, query) {
  const contractMatches = contractMatchesForGroup(group);
  const contractText = contractMatches.flatMap(({ scope, unitProduct }) => [
    scope.productCode,
    scope.productName,
    unitProduct.productCode,
    unitProduct.productName,
    CONTRACT_DATA.meta.agreementCode
  ]).join(" ");
  return normalize(group.code).includes(query)
    || normalize(group.name).includes(query)
    || normalize(group.productCode).includes(query)
    || normalize(contractText).includes(query);
}

function findMatches(value) {
  const query = normalize(value);
  if (!query) return GROUPS.slice(0, 8).map((group) => ({ group, context: "Grupa JGP" }));

  const matches = [];
  const included = new Set();
  GROUPS.forEach((group) => {
    if (!directGroupMatch(group, query)) return;
    included.add(group.code);
    const inContract = contractMatchesForGroup(group).some(({ scope }) => (
      normalize(scope.productCode).includes(query)
      || normalize(CONTRACT_DATA.meta.agreementCode).includes(query)
    ));
    matches.push({
      group,
      context: inContract ? "Zakres lub umowa w API NFZ" : "Kod, produkt lub nazwa grupy"
    });
  });

  if (query.length < 3) return matches;

  for (const [blockCode, block] of Object.entries(BLOCKS)) {
    if (!blockSearchText(block).includes(query)) continue;
    const groupCodes = BLOCK_TO_GROUPS.get(blockCode);
    if (!groupCodes) continue;
    const context = blockMatchContext(block, query);
    for (const groupCode of groupCodes) {
      if (included.has(groupCode)) continue;
      const group = GROUP_BY_CODE.get(groupCode);
      if (!group) continue;
      included.add(groupCode);
      matches.push({ group, context });
      if (matches.length >= 40) return matches;
    }
  }
  return matches;
}

function renderSuggestions(matches) {
  elements.suggestions.replaceChildren();
  matches.slice(0, 8).forEach(({ group, context }) => {
    const button = document.createElement("button");
    const code = document.createElement("strong");
    const name = document.createElement("span");
    const detail = document.createElement("small");
    button.type = "button";
    button.className = "suggestion";
    code.textContent = group.code;
    name.textContent = group.name;
    detail.textContent = context;
    button.append(code, name, detail);
    button.addEventListener("click", () => {
      elements.searchInput.value = group.code;
      elements.suggestions.replaceChildren();
      selectGroup(group);
    });
    elements.suggestions.appendChild(button);
  });
}

function renderContract(group) {
  const match = primaryContractMatch(group);
  const hasMatch = Boolean(match);
  elements.contractPanel.classList.toggle("unavailable", !hasMatch);
  elements.contractStatus.classList.toggle("unavailable", !hasMatch);
  elements.contractVerifiedContent.hidden = !hasMatch;
  elements.contractEmpty.hidden = hasMatch;
  elements.contractStatus.textContent = hasMatch ? "Potwierdzone w API" : "Brak w profilu";
  elements.contractAdditionList.replaceChildren();

  if (!hasMatch) {
    elements.contractSource.textContent = `Profil: ${CONTRACT_DATA.meta.profileLabel || "brak danych"}. Źródło: API Umowy NFZ.`;
    return;
  }

  const { scope, unitProduct } = match;
  elements.contractScopeCode.textContent = scope.productCode;
  elements.contractScopeName.textContent = scope.productName;
  elements.contractPointPrice.textContent = moneyFormatter.format(scope.averagePointPrice);
  elements.contractUnitCode.textContent = unitProduct.productCode;
  elements.contractUnitName.textContent = unitProduct.productName;
  elements.contractAgreementCode.textContent = CONTRACT_DATA.meta.agreementCode || "—";
  elements.contractValidity.textContent = `${formatDate(scope.dateFrom)}–${formatDate(scope.dateTo)}`;
  elements.useContractPrice.dataset.price = String(scope.averagePointPrice);

  const additionalProducts = (scope.additionalProducts || []).filter((product) => (
    !product.applicableGroupCodes
    || product.applicableGroupCodes.includes(group.code)
  ));
  elements.contractAdditions.hidden = additionalProducts.length === 0;
  additionalProducts.forEach((product) => {
    const item = document.createElement("article");
    const code = document.createElement("strong");
    const name = document.createElement("span");
    const note = document.createElement("small");
    item.className = "contract-addition-item";
    code.textContent = `${product.productCode} · ${numberFormatter.format(product.points)} pkt`;
    name.textContent = product.productName;
    note.textContent = product.note;
    item.append(code, name, note);
    elements.contractAdditionList.appendChild(item);
  });

  elements.contractSource.textContent = `Źródło: API Umowy NFZ · aktualizacja umowy ${formatDate(CONTRACT_DATA.meta.agreementUpdatedAt)}.`;
}

function updatePointPriceSource() {
  const match = primaryContractMatch();
  const enteredPrice = Number(elements.pointPrice.value);
  const isContractPrice = match
    && Math.abs(enteredPrice - Number(match.scope.averagePointPrice)) < 0.0001;
  elements.pointPriceSource.textContent = isContractPrice
    ? "zgodna z API NFZ"
    : "wartość użytkownika";
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

function restoreCoefficientControls() {
  const enabled = Boolean(state.coefficientEnabledByGroup[selectedGroup.code]);
  elements.coefficientEnabled.checked = enabled;
  elements.coefficientControls.hidden = !enabled;
  elements.customFactor.value = Number(state.customFactorByGroup[selectedGroup.code]) || 1;
}

function splitMedicalCode(item) {
  const match = String(item).match(/^(\S+)\s+(.+)$/);
  return match ? { code: match[1], name: match[2] } : { code: "—", name: item };
}

function createCodeList(segment, heading) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  const count = document.createElement("span");
  const list = document.createElement("ul");
  details.className = "code-list";
  title.textContent = heading;
  count.textContent = `${numberFormatter.format(segment.items.length)} poz.`;
  list.className = "code-items";
  summary.append(title, count);
  details.append(summary, list);

  details.addEventListener("toggle", () => {
    if (!details.open || details.dataset.rendered === "true") return;
    const fragment = document.createDocumentFragment();
    segment.items.forEach((item) => {
      const parsed = splitMedicalCode(item);
      const row = document.createElement("li");
      const code = document.createElement("span");
      const name = document.createElement("span");
      code.className = "medical-code";
      code.textContent = parsed.code;
      name.textContent = parsed.name;
      row.append(code, name);
      fragment.appendChild(row);
    });
    list.appendChild(fragment);
    details.dataset.rendered = "true";
  });
  return details;
}

function relevantLists(block, role) {
  const lists = block.segments.filter((segment) => segment.type === "list");
  if (role === "procedure") return lists.filter((segment) => segment.system === "ICD-9");
  if (role === "diagnosis" || role === "general") {
    return lists.filter((segment) => segment.system === "ICD-10");
  }
  return lists;
}

function renderGrouping(group) {
  const block = BLOCKS[group.code];
  elements.groupingRules.replaceChildren();
  elements.directCodeLists.replaceChildren();
  elements.referencedCodeLists.replaceChildren();

  if (!block) {
    elements.groupingSummary.textContent = "Brak charakterystyki w danych źródłowych";
    return;
  }

  const directLists = block.segments.filter((segment) => segment.type === "list");
  block.segments.filter((segment) => segment.type === "text").forEach((segment) => {
    const paragraph = document.createElement("p");
    const isConnector = normalize(segment.text) === "LUB";
    paragraph.className = isConnector ? "rule-connector" : "grouping-rule";
    paragraph.textContent = segment.text;
    elements.groupingRules.appendChild(paragraph);
  });

  const labelCounts = {};
  directLists.forEach((segment) => {
    labelCounts[segment.label] = (labelCounts[segment.label] || 0) + 1;
    const suffix = labelCounts[segment.label] > 1 ? ` · lista ${labelCounts[segment.label]}` : "";
    elements.directCodeLists.appendChild(
      createCodeList(segment, `${segment.label}${suffix} · bezpośrednio w ${group.code}`)
    );
  });

  let referencedItemCount = 0;
  (block.references || []).forEach((reference) => {
    const referenced = BLOCKS[reference.code];
    if (!referenced) return;
    const lists = relevantLists(referenced, reference.role);
    if (!lists.length) return;

    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const stack = document.createElement("div");
    section.className = "reference-block";
    heading.className = "reference-block-title";
    stack.className = "code-list-stack";
    heading.textContent = `${REFERENCE_ROLE_LABELS[reference.role] || REFERENCE_ROLE_LABELS.reference} ${reference.code}`;
    lists.forEach((segment, index) => {
      referencedItemCount += segment.items.length;
      const suffix = lists.length > 1 ? ` · część ${index + 1}` : "";
      stack.appendChild(
        createCodeList(segment, `${segment.label}${suffix} · ${referenced.title}`)
      );
    });
    section.append(heading, stack);
    elements.referencedCodeLists.appendChild(section);
  });

  const directItemCount = directLists.reduce((sum, segment) => sum + segment.items.length, 0);
  const ruleCount = block.segments.filter(
    (segment) => segment.type === "text" && normalize(segment.text) !== "LUB"
  ).length;
  elements.groupingSummary.textContent = `${numberFormatter.format(ruleCount)} war. · ${numberFormatter.format(directItemCount + referencedItemCount)} pozycji ICD`;
}

function scopeQualifierText(qualifier) {
  if (qualifier === 1) return "Możliwość realizacji w pierwszym zakresie wskazanym w tej pozycji katalogu.";
  if (qualifier === 2) return "Możliwość realizacji w drugim zakresie wskazanym w tej pozycji katalogu.";
  return "Możliwość realizacji we wszystkich zakresach wskazanych w tej pozycji katalogu.";
}

function scopeDisplayLabel(scope) {
  if (scope.qualifier === 3) return scope.label;
  const parts = scope.label.split("/").map((part) => part.trim()).filter(Boolean);
  return parts[scope.qualifier - 1] || scope.label;
}

function renderScopes(group) {
  const scopes = group.scopeFamilies || [];
  elements.scopeList.replaceChildren();
  scopes.forEach((scope) => {
    const item = document.createElement("article");
    const title = document.createElement("strong");
    const note = document.createElement("small");
    item.className = "scope-item";
    title.textContent = scopeDisplayLabel(scope);
    note.textContent = scopeQualifierText(scope.qualifier);
    item.append(title, note);
    elements.scopeList.appendChild(item);
  });

  elements.scopeSummary.textContent = scopes.length === 1
    ? "1 pozycja zakresowa w katalogu 1a"
    : `${numberFormatter.format(scopes.length)} pozycje zakresowe w katalogu 1a`;
  elements.catalogNote.hidden = !group.catalogNote;
  elements.catalogNote.textContent = group.catalogNote || "";
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

  renderContract(group);
  renderModes(group);
  restoreCoefficientControls();
  renderGrouping(group);
  renderScopes(group);
  updateCalculation();
}

function currentPoints() {
  return Number(selectedGroup[elements.mode.value] ?? selectedGroup.ordinary ?? 0);
}

function currentFactor() {
  if (!elements.coefficientEnabled.checked) return 1;
  const customValue = Number(elements.customFactor.value);
  return Number.isFinite(customValue) && customValue > 0 ? customValue : 1;
}

function updateCalculation() {
  const points = currentPoints();
  const price = Math.max(0, Number(elements.pointPrice.value) || 0);
  const factor = currentFactor();
  const base = points * price;
  const total = base * factor;

  elements.pointsValue.textContent = numberFormatter.format(points);
  elements.baseValue.textContent = moneyFormatter.format(base);
  elements.combinedFactor.textContent = decimalFormatter.format(factor);
  elements.totalValue.textContent = moneyFormatter.format(total);
  elements.totalEquation.textContent = `${numberFormatter.format(points)} pkt × ${decimalFormatter.format(price)} zł × ${decimalFormatter.format(factor)}`;
  elements.factorFormula.textContent = elements.coefficientEnabled.checked
    ? `Zastosowano ręcznie wpisany współczynnik ${decimalFormatter.format(factor)}. To ustawienie użytkownika, nie wartość pobrana z API NFZ.`
    : "Współczynnik nie jest stosowany.";
  updatePointPriceSource();

  state.price = price;
  state.customFactorByGroup[selectedGroup.code] = Number(elements.customFactor.value) || 1;
  state.modeByGroup[selectedGroup.code] = elements.mode.value;
  state.coefficientEnabledByGroup[selectedGroup.code] = elements.coefficientEnabled.checked;
  saveState();
}

function runSearch() {
  const matches = findMatches(elements.searchInput.value);
  const query = normalize(elements.searchInput.value);
  const exact = matches.find(({ group }) => normalize(group.code) === query)
    || matches.find(({ group }) => normalize(group.productCode) === query);
  renderSuggestions(matches);

  if (exact || matches.length === 1) {
    selectGroup((exact || matches[0]).group);
    return;
  }

  if (matches.length === 0) {
    elements.resultCard.hidden = true;
    elements.emptyState.hidden = false;
  }
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
elements.useContractPrice.addEventListener("click", () => {
  const price = Number(elements.useContractPrice.dataset.price);
  if (!Number.isFinite(price)) return;
  elements.pointPrice.value = price.toFixed(2);
  updateCalculation();
});
elements.customFactor.addEventListener("input", updateCalculation);
elements.coefficientSelect.addEventListener("change", updateCalculation);
elements.coefficientEnabled.addEventListener("change", () => {
  elements.coefficientControls.hidden = !elements.coefficientEnabled.checked;
  if (elements.coefficientEnabled.checked) elements.customFactor.focus();
  updateCalculation();
});
elements.installButton.addEventListener("click", () => elements.installDialog.showModal());
window.addEventListener("online", updateConnectionBadge);
window.addEventListener("offline", updateConnectionBadge);

elements.pointPrice.value = state.price;
elements.catalogLabel.textContent = `Załączniki 1a i 9 · ${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup`;
elements.sourceOrder.textContent = CATALOG.meta.orderNumber || "46/2026/DSOZ";
elements.sourceCatalog.textContent = CATALOG.meta.catalog || "Załącznik 1a – katalog grup";
elements.sourceCount.textContent = `${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup JGP`;
elements.sourceCharacteristics.textContent = `Załącznik 9 – charakterystyka JGP · ${numberFormatter.format(CHARACTERISTICS.meta.codeEntryCount || 0)} pozycji ICD.`;
elements.sourceApiLabel.textContent = `${CONTRACT_DATA.meta.source || "API Umowy NFZ"} v${CONTRACT_DATA.meta.apiVersion || "—"}`;
elements.sourceApiDate.textContent = formatDate(CONTRACT_DATA.meta.syncedAt);

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
      // Brak service workera nie blokuje działania katalogu online.
    });
  });
}
