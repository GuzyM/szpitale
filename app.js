"use strict";

const CATALOG = window.JGP_CATALOG || { meta: {}, groups: [] };
const CHARACTERISTICS = window.JGP_CHARACTERISTICS || { meta: {}, blocks: {} };
const CONTRACT_DATA = window.NFZ_CONTRACT || { meta: {}, scopes: [] };
const GROUPS = CATALOG.groups || [];
const BLOCKS = CHARACTERISTICS.blocks || {};
const GROUP_BY_CODE = new Map(GROUPS.map((group) => [group.code, group]));

const STORAGE_KEY = "hospitalapp-jgp-v05";
const PREVIOUS_STORAGE_KEYS = ["hospitalapp-jgp-v04", "jgp-calculator-v03"];
const MODE_LABELS = {
  ordinary: "Hospitalizacja",
  planned: "Hospitalizacja planowa",
  oneDayTreatment: "Leczenie jednego dnia",
  sameDay: "Przyjęcie i wypis tego samego dnia",
  oneDayHosp: "Hospitalizacja 1-dniowa",
  twoDayHosp: "Hospitalizacja 2-dniowa"
};
const REFERENCE_ROLE_LABELS = {
  procedure: "Wymagane listy procedur",
  diagnosis: "Wymagane listy rozpoznań",
  additional: "Wymagane listy dodatkowe",
  general: "Wymagane listy ogólne",
  reference: "Listy przywołane"
};
const SEARCH_MODES = {
  group: {
    label: "Wyszukiwanie po grupie JGP",
    help: "Wpisz kod grupy, kod produktu albo fragment nazwy.",
    placeholder: "Np. N01 lub poród"
  },
  diagnosis: {
    label: "Wyszukiwanie po rozpoznaniu ICD-10",
    help: "Wpisz kod ICD-10 albo fragment nazwy rozpoznania.",
    placeholder: "Np. O80.0 lub poród samoistny"
  },
  procedure: {
    label: "Wyszukiwanie po procedurze ICD-9",
    help: "Wpisz kod ICD-9 albo fragment nazwy wykonanej procedury.",
    placeholder: "Np. 72.1 lub cięcie cesarskie"
  }
};
const COEFFICIENT_SOURCE_LABELS = {
  contract: "Umowa lub aneks MOW NFZ",
  nfz: "Zarządzenie NFZ / SP_ROZ",
  aotmit: "Taryfa lub obwieszczenie AOTMiT",
  ministry: "Rozporządzenie / komunikat MZ",
  custom: "Własne założenie"
};

function normalizedProfiles() {
  if (Array.isArray(CONTRACT_DATA.profiles) && CONTRACT_DATA.profiles.length) {
    return CONTRACT_DATA.profiles.map((profile, index) => ({
      id: profile.id || `profile-${index + 1}`,
      meta: { ...CONTRACT_DATA.meta, ...(profile.meta || {}) },
      scopes: profile.scopes || []
    }));
  }
  if (!(CONTRACT_DATA.scopes || []).length) return [];
  return [{
    id: CONTRACT_DATA.meta.providerCode || "verified-profile",
    meta: CONTRACT_DATA.meta || {},
    scopes: CONTRACT_DATA.scopes || []
  }];
}

const VERIFIED_PROFILES = normalizedProfiles();
const BLOCK_TO_GROUPS = buildBlockToGroupMap();
let coefficientSequence = 0;
let state = loadState();
let selectedGroup = state.groupCode ? GROUP_BY_CODE.get(state.groupCode) || null : null;

const elements = {
  homeScreen: document.querySelector("#home-screen"),
  gruperScreen: document.querySelector("#gruper-screen"),
  openGruper: document.querySelector("#open-gruper"),
  resumeGroup: document.querySelector("#resume-group"),
  resumeGroupLabel: document.querySelector("#resume-group-label"),
  backButton: document.querySelector("#back-button"),
  brandMark: document.querySelector("#brand-mark"),
  topbarEyebrow: document.querySelector("#topbar-eyebrow"),
  topbarTitle: document.querySelector("#topbar-title"),
  homeDataLabel: document.querySelector("#home-data-label"),
  providerProfile: document.querySelector("#provider-profile"),
  providerStatus: document.querySelector("#provider-status"),
  customProviderFields: document.querySelector("#custom-provider-fields"),
  customProviderName: document.querySelector("#custom-provider-name"),
  customProviderCode: document.querySelector("#custom-provider-code"),
  providerName: document.querySelector("#provider-name"),
  providerCode: document.querySelector("#provider-code"),
  providerHelp: document.querySelector("#provider-help"),
  searchModeGrid: document.querySelector("#search-mode-grid"),
  searchStepLabel: document.querySelector("#search-step-label"),
  searchHelp: document.querySelector("#search-help"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  suggestions: document.querySelector("#suggestions"),
  resultCard: document.querySelector("#result-card"),
  emptyState: document.querySelector("#empty-state"),
  emptyStateCopy: document.querySelector("#empty-state-copy"),
  groupCode: document.querySelector("#group-code"),
  groupName: document.querySelector("#group-name"),
  groupProductCode: document.querySelector("#group-product-code"),
  groupSection: document.querySelector("#group-section"),
  contractPanel: document.querySelector("#contract-panel"),
  contractStatus: document.querySelector("#contract-status"),
  contractProviderName: document.querySelector("#contract-provider-name"),
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
  mode: document.querySelector("#hospitalization-mode"),
  priceSourceContract: document.querySelector("#price-source-contract"),
  priceSourceCustom: document.querySelector("#price-source-custom"),
  contractPriceChoice: document.querySelector("#contract-price-choice"),
  contractPriceChoiceLabel: document.querySelector("#contract-price-choice-label"),
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
  coefficientCount: document.querySelector("#coefficient-count"),
  coefficientList: document.querySelector("#coefficient-list"),
  coefficientEmpty: document.querySelector("#coefficient-empty"),
  addCoefficient: document.querySelector("#add-coefficient"),
  groupingSummary: document.querySelector("#grouping-summary"),
  groupingRules: document.querySelector("#grouping-rules"),
  directListsHeading: document.querySelector("#direct-lists-heading"),
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
const preciseFactorFormatter = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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

function defaultState() {
  return {
    groupCode: null,
    searchMode: "group",
    providerId: VERIFIED_PROFILES[0]?.id || "custom",
    customProviderName: "",
    customProviderCode: "",
    modeByGroup: {},
    priceSource: "contract",
    customPrice: 1.96,
    coefficientsByGroup: {}
  };
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of PREVIOUS_STORAGE_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    const saved = raw ? JSON.parse(raw) : {};
    const merged = { ...defaultState(), ...saved };
    merged.modeByGroup = { ...(saved.modeByGroup || {}) };
    merged.coefficientsByGroup = { ...(saved.coefficientsByGroup || {}) };
    merged.customPrice = Number(saved.customPrice ?? saved.price ?? 1.96) || 1.96;
    if (!SEARCH_MODES[merged.searchMode]) merged.searchMode = "group";
    if (saved.providerMode === "custom") merged.providerId = "custom";

    const legacyFactors = saved.customFactorByGroup || {};
    const legacyEnabled = saved.coefficientEnabledByGroup || {};
    Object.keys(legacyEnabled).forEach((groupCode) => {
      if (!legacyEnabled[groupCode] || merged.coefficientsByGroup[groupCode]?.length) return;
      const value = Number(legacyFactors[groupCode]) || 1;
      merged.coefficientsByGroup[groupCode] = [{
        id: `legacy-${groupCode}`,
        name: "Współczynnik przeniesiony z poprzedniej wersji",
        value,
        combination: "sum",
        source: "custom"
      }];
    });
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

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
}

function activeProfile() {
  return VERIFIED_PROFILES.find((profile) => profile.id === state.providerId) || null;
}

function providerDisplayName(profile = activeProfile()) {
  if (!profile) return state.customProviderName.trim() || "Własna placówka";
  return profile.meta.providerDisplayName
    || profile.meta.providerName
    || profile.meta.profileLabel
    || "Profil świadczeniodawcy";
}

function providerOfficialName(profile = activeProfile()) {
  if (!profile) return state.customProviderName.trim() || "Własna placówka";
  return profile.meta.providerName || providerDisplayName(profile);
}

function providerCode(profile = activeProfile()) {
  if (!profile) return state.customProviderCode.trim() || "kod nieuzupełniony";
  return profile.meta.providerCode || profile.meta.providerId || "—";
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

function contractMatchesForGroup(group) {
  const profile = activeProfile();
  if (!profile || !group) return [];
  const matches = [];
  (profile.scopes || []).forEach((scope) => {
    const unitProduct = (scope.unitProducts || []).find((product) => (
      product.groupCode === group.code || product.productCode === group.productCode
    ));
    if (unitProduct) matches.push({ scope, unitProduct, profile });
  });
  return matches;
}

function primaryContractMatch(group = selectedGroup) {
  return contractMatchesForGroup(group)[0] || null;
}

function systemForSearchMode(mode) {
  if (mode === "diagnosis") return "ICD-10";
  if (mode === "procedure") return "ICD-9";
  return null;
}

function blockSystemSearchText(block, system) {
  block._hospitalSearch = block._hospitalSearch || {};
  if (block._hospitalSearch[system]) return block._hospitalSearch[system];
  const values = [];
  block.segments.forEach((segment) => {
    if (segment.type === "list" && segment.system === system) values.push(...segment.items);
  });
  block._hospitalSearch[system] = normalize(values.join(" "));
  return block._hospitalSearch[system];
}

function blockSystemMatchContext(block, query, system) {
  for (const segment of block.segments) {
    if (segment.type !== "list" || segment.system !== system) continue;
    const item = segment.items.find((entry) => normalize(entry).includes(query));
    if (item) return item;
  }
  return block.title;
}

function directGroupMatch(group, query) {
  const profile = activeProfile();
  const contractMatches = contractMatchesForGroup(group);
  const contractText = contractMatches.flatMap(({ scope, unitProduct }) => [
    scope.productCode,
    scope.productName,
    unitProduct.productCode,
    unitProduct.productName,
    profile?.meta.agreementCode
  ]).join(" ");
  return normalize(group.code).includes(query)
    || normalize(group.name).includes(query)
    || normalize(group.productCode).includes(query)
    || normalize(contractText).includes(query);
}

function findMatches(value, mode = state.searchMode) {
  const query = normalize(value);
  if (!query) return [];
  const matches = [];
  const included = new Set();

  if (mode === "group") {
    GROUPS.forEach((group) => {
      if (!directGroupMatch(group, query)) return;
      included.add(group.code);
      const profile = activeProfile();
      const inContract = contractMatchesForGroup(group).some(({ scope }) => (
        normalize(scope.productCode).includes(query)
        || normalize(profile?.meta.agreementCode).includes(query)
      ));
      matches.push({
        group,
        context: inContract ? "Zakres lub produkt w wybranej umowie" : "Kod, produkt lub nazwa grupy"
      });
    });
    return matches.slice(0, 40);
  }

  if (query.length < 2) return [];
  const system = systemForSearchMode(mode);
  for (const [blockCode, block] of Object.entries(BLOCKS)) {
    if (!blockSystemSearchText(block, system).includes(query)) continue;
    const groupCodes = BLOCK_TO_GROUPS.get(blockCode);
    if (!groupCodes) continue;
    const context = blockSystemMatchContext(block, query, system);
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
  matches.slice(0, 10).forEach(({ group, context }) => {
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
      if (state.searchMode === "group") elements.searchInput.value = group.code;
      elements.suggestions.replaceChildren();
      selectGroup(group);
    });
    elements.suggestions.appendChild(button);
  });
}

function renderProviderSelector() {
  elements.providerProfile.replaceChildren();
  VERIFIED_PROFILES.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${providerDisplayName(profile)} · ${providerCode(profile)}`;
    elements.providerProfile.appendChild(option);
  });
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Inna placówka · ustawienia własne";
  elements.providerProfile.appendChild(customOption);

  const hasSavedProfile = state.providerId === "custom"
    || VERIFIED_PROFILES.some((profile) => profile.id === state.providerId);
  if (!hasSavedProfile) state.providerId = VERIFIED_PROFILES[0]?.id || "custom";
  elements.providerProfile.value = state.providerId;
  elements.customProviderName.value = state.customProviderName;
  elements.customProviderCode.value = state.customProviderCode;
  renderProviderSummary();
}

function renderProviderSummary() {
  const profile = activeProfile();
  const isCustom = !profile;
  elements.customProviderFields.hidden = !isCustom;
  elements.providerStatus.textContent = isCustom ? "Profil własny" : "API NFZ";
  elements.providerStatus.classList.toggle("unavailable", isCustom);
  elements.providerName.textContent = providerOfficialName(profile);
  elements.providerCode.textContent = providerCode(profile);
  elements.providerHelp.textContent = isCustom
    ? "Nazwa, kod i cena są ustawieniami lokalnymi. Dane tej placówki nie zostały jeszcze pobrane z API NFZ."
    : "Ten profil jest publicznym wycinkiem umowy. Zmiana placówki zmienia dostępne zakresy i ceny.";
}

function showScreen(screen, options = {}) {
  const isHome = screen === "home";
  elements.homeScreen.hidden = !isHome;
  elements.gruperScreen.hidden = isHome;
  elements.backButton.hidden = isHome;
  elements.brandMark.hidden = !isHome;
  elements.topbarEyebrow.textContent = isHome ? "Centrum analityki szpitalnej" : "HospitalAPP · moduł JGP";
  elements.topbarTitle.textContent = isHome ? "HospitalAPP" : "Gruper i wycena JGP";
  document.title = isHome ? "HospitalAPP" : "HospitalAPP · Gruper JGP";
  if (!isHome && !options.keepResult) {
    elements.resultCard.hidden = true;
    elements.emptyState.hidden = true;
    elements.suggestions.replaceChildren();
    elements.searchInput.value = "";
  }
  updateResumeCard();
}

function setSearchMode(mode, options = {}) {
  if (!SEARCH_MODES[mode]) return;
  state.searchMode = mode;
  saveState();
  const config = SEARCH_MODES[mode];
  elements.searchStepLabel.textContent = config.label;
  elements.searchHelp.textContent = config.help;
  elements.searchInput.placeholder = config.placeholder;
  elements.searchInput.value = "";
  elements.suggestions.replaceChildren();
  elements.emptyState.hidden = true;
  elements.searchModeGrid.querySelectorAll("[data-search-mode]").forEach((button) => {
    const active = button.dataset.searchMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  if (options.focus) elements.searchInput.focus();
}

function renderContract(group) {
  const match = primaryContractMatch(group);
  const profile = activeProfile();
  const hasMatch = Boolean(match);
  elements.contractPanel.classList.toggle("unavailable", !hasMatch);
  elements.contractStatus.classList.toggle("unavailable", !hasMatch);
  elements.contractVerifiedContent.hidden = !hasMatch;
  elements.contractEmpty.hidden = hasMatch;
  elements.contractStatus.textContent = hasMatch ? "Potwierdzone w API" : "Brak w profilu";
  elements.contractProviderName.textContent = providerOfficialName(profile);
  elements.contractAdditionList.replaceChildren();

  if (!hasMatch) {
    elements.contractSource.textContent = profile
      ? `Profil: ${providerDisplayName(profile)}. Źródło: API Umowy NFZ.`
      : "Profil własny: brak danych umownych z API NFZ.";
    renderPriceControls(null);
    return;
  }

  const { scope, unitProduct } = match;
  elements.contractScopeCode.textContent = scope.productCode;
  elements.contractScopeName.textContent = scope.productName;
  elements.contractPointPrice.textContent = moneyFormatter.format(scope.averagePointPrice);
  elements.contractUnitCode.textContent = unitProduct.productCode;
  elements.contractUnitName.textContent = unitProduct.productName;
  elements.contractAgreementCode.textContent = profile.meta.agreementCode || "—";
  elements.contractValidity.textContent = `${formatDate(scope.dateFrom)}–${formatDate(scope.dateTo)}`;

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
    note.textContent = `${product.note} Nie jest automatycznie dodany do kalkulacji JGP.`;
    item.append(code, name, note);
    elements.contractAdditionList.appendChild(item);
  });

  elements.contractSource.textContent = `Źródło: API Umowy NFZ · aktualizacja umowy ${formatDate(profile.meta.agreementUpdatedAt)}.`;
  renderPriceControls(match);
}

function effectivePriceSource(match = primaryContractMatch()) {
  return match && state.priceSource === "contract" ? "contract" : "custom";
}

function renderPriceControls(match = primaryContractMatch()) {
  const hasContractPrice = Boolean(match && Number.isFinite(Number(match.scope.averagePointPrice)));
  elements.priceSourceContract.disabled = !hasContractPrice;
  elements.contractPriceChoiceLabel.textContent = hasContractPrice
    ? moneyFormatter.format(match.scope.averagePointPrice)
    : "brak ceny";
  const source = effectivePriceSource(match);
  elements.priceSourceContract.checked = source === "contract";
  elements.priceSourceCustom.checked = source === "custom";
  elements.pointPrice.readOnly = source === "contract";
  elements.pointPrice.value = source === "contract"
    ? Number(match.scope.averagePointPrice).toFixed(2)
    : Number(state.customPrice || 0).toFixed(2);
  updatePointPriceSource(match);
}

function updatePointPriceSource(match = primaryContractMatch()) {
  const source = effectivePriceSource(match);
  elements.pointPriceSource.textContent = source === "contract"
    ? "z wybranej umowy · API NFZ"
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
  details.className = `code-list system-${String(segment.system || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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

function groupingRulePaths(block) {
  const paths = [];
  let current = [];
  block.segments.forEach((segment, index) => {
    if (segment.type !== "text") return;
    const normalized = normalize(segment.text);
    if (normalized === "LUB") {
      if (current.length) paths.push(current.join(" · "));
      current = [];
      return;
    }
    const nextSegment = block.segments[index + 1];
    const isListMarker = /^[A-Z][A-Z0-9]+$/.test(String(segment.text).trim())
      && nextSegment?.type === "list";
    if (!isListMarker) current.push(segment.text);
  });
  if (current.length) paths.push(current.join(" · "));
  return paths;
}

function ruleChips(text) {
  const chips = [];
  const pattern = /listy\s+(procedur|rozpoznań|dodatkowej|ogólnej)\s+([A-Z][A-Z0-9]+)/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const kind = normalize(match[1]);
    chips.push({
      label: `${match[1]} ${match[2]}`,
      type: kind.startsWith("PROCEDUR") ? "procedure" : kind.startsWith("ROZPOZN") ? "diagnosis" : "additional"
    });
  }
  const ageMatch = text.match(/wiek\s*[^;,.]+/i);
  if (ageMatch) chips.push({ label: ageMatch[0], type: "additional" });
  return chips;
}

function renderGrouping(group) {
  const block = BLOCKS[group.code];
  elements.groupingRules.replaceChildren();
  elements.directCodeLists.replaceChildren();
  elements.referencedCodeLists.replaceChildren();

  if (!block) {
    elements.groupingSummary.textContent = "Brak charakterystyki w danych źródłowych";
    elements.directListsHeading.hidden = true;
    return;
  }

  const paths = groupingRulePaths(block);
  paths.forEach((text, index) => {
    const card = document.createElement("article");
    const number = document.createElement("span");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const paragraph = document.createElement("p");
    const chips = document.createElement("div");
    card.className = "grouping-rule-card";
    number.className = "rule-number";
    copy.className = "rule-card-copy";
    chips.className = "rule-chips";
    number.textContent = String(index + 1);
    title.textContent = `Ścieżka ${index + 1}`;
    paragraph.textContent = text;
    ruleChips(text).forEach((chipData) => {
      const chip = document.createElement("span");
      chip.className = `rule-chip ${chipData.type}`;
      chip.textContent = chipData.label;
      chips.appendChild(chip);
    });
    copy.append(title, paragraph);
    if (chips.childElementCount) copy.appendChild(chips);
    card.append(number, copy);
    elements.groupingRules.appendChild(card);
  });

  const directLists = block.segments.filter((segment) => segment.type === "list");
  elements.directListsHeading.hidden = directLists.length === 0;
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
    heading.textContent = `${REFERENCE_ROLE_LABELS[reference.role] || REFERENCE_ROLE_LABELS.reference} · ${reference.code}`;
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
  elements.groupingSummary.textContent = `${numberFormatter.format(paths.length)} ${paths.length === 1 ? "ścieżka" : "ścieżki"} · ${numberFormatter.format(directItemCount + referencedItemCount)} pozycji ICD`;
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

function coefficientItems() {
  if (!selectedGroup) return [];
  const items = state.coefficientsByGroup[selectedGroup.code];
  return Array.isArray(items) ? items : [];
}

function newCoefficient() {
  coefficientSequence += 1;
  return {
    id: `factor-${Date.now()}-${coefficientSequence}`,
    name: "Współczynnik z umowy",
    value: 1,
    combination: "sum",
    source: "contract"
  };
}

function coefficientField(labelText, control) {
  const label = document.createElement("label");
  const text = document.createElement("span");
  label.className = "field";
  text.textContent = labelText;
  label.append(text, control);
  return label;
}

function renderCoefficients() {
  const items = coefficientItems();
  elements.coefficientList.replaceChildren();
  elements.coefficientEmpty.hidden = items.length > 0;
  elements.coefficientCount.textContent = String(items.length);

  items.forEach((item) => {
    const card = document.createElement("article");
    const top = document.createElement("div");
    const grid = document.createElement("div");
    const nameInput = document.createElement("input");
    const valueInput = document.createElement("input");
    const combinationSelect = document.createElement("select");
    const sourceSelect = document.createElement("select");
    const removeButton = document.createElement("button");
    card.className = "coefficient-card";
    card.dataset.coefficientId = item.id;
    top.className = "coefficient-card-top";
    grid.className = "coefficient-card-grid";

    nameInput.type = "text";
    nameInput.value = item.name || "";
    nameInput.placeholder = "Nazwa współczynnika";
    nameInput.dataset.coefficientField = "name";
    valueInput.type = "number";
    valueInput.value = String(item.value ?? 1);
    valueInput.min = "0";
    valueInput.step = "0.0001";
    valueInput.inputMode = "decimal";
    valueInput.dataset.coefficientField = "value";

    [{ value: "sum", label: "Sumowanie NFZ" }, { value: "multiply", label: "Mnożenie" }].forEach((optionData) => {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      combinationSelect.appendChild(option);
    });
    combinationSelect.value = item.combination === "multiply" ? "multiply" : "sum";
    combinationSelect.dataset.coefficientField = "combination";

    Object.entries(COEFFICIENT_SOURCE_LABELS).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sourceSelect.appendChild(option);
    });
    sourceSelect.value = COEFFICIENT_SOURCE_LABELS[item.source] ? item.source : "custom";
    sourceSelect.dataset.coefficientField = "source";

    removeButton.type = "button";
    removeButton.className = "remove-coefficient";
    removeButton.dataset.removeCoefficient = item.id;
    removeButton.setAttribute("aria-label", `Usuń współczynnik ${item.name || ""}`);
    removeButton.textContent = "×";

    top.append(coefficientField("Nazwa", nameInput), removeButton);
    grid.append(
      coefficientField("Wartość", valueInput),
      coefficientField("Sposób łączenia", combinationSelect)
    );
    card.append(top, grid, coefficientField("Źródło", sourceSelect));
    elements.coefficientList.appendChild(card);
  });
}

function factorBreakdown() {
  const valid = coefficientItems().map((item) => ({
    ...item,
    value: Number(item.value)
  })).filter((item) => Number.isFinite(item.value) && item.value > 0);
  const summed = valid.filter((item) => item.combination !== "multiply");
  const multiplied = valid.filter((item) => item.combination === "multiply");
  const summedFactor = Number((summed.length
    ? summed.reduce((sum, item) => sum + item.value, 0) - (summed.length - 1)
    : 1).toFixed(8));
  const multipliedFactor = Number(
    multiplied.reduce((product, item) => product * item.value, 1).toFixed(8)
  );
  return {
    valid,
    summed,
    multiplied,
    summedFactor,
    multipliedFactor,
    combined: Math.max(0, Number((summedFactor * multipliedFactor).toFixed(8)))
  };
}

function factorFormula(breakdown) {
  if (!breakdown.valid.length) return "Współczynnik nie jest stosowany.";
  const parts = [];
  if (breakdown.summed.length) {
    const values = breakdown.summed.map((item) => preciseFactorFormatter.format(item.value)).join(" + ");
    parts.push(breakdown.summed.length === 1
      ? `sumowany: ${values}`
      : `sumowanie NFZ: (${values}) − ${breakdown.summed.length - 1} = ${preciseFactorFormatter.format(breakdown.summedFactor)}`);
  }
  if (breakdown.multiplied.length) {
    parts.push(`mnożenie: ${breakdown.multiplied.map((item) => preciseFactorFormatter.format(item.value)).join(" × ")}`);
  }
  return `Zastosowano ${breakdown.valid.length} ${breakdown.valid.length === 1 ? "współczynnik" : "współczynniki"}: ${parts.join("; ")}. Łącznie ${preciseFactorFormatter.format(breakdown.combined)}.`;
}

function currentPoints() {
  if (!selectedGroup) return 0;
  return Number(selectedGroup[elements.mode.value] ?? selectedGroup.ordinary ?? 0);
}

function currentPrice() {
  const match = primaryContractMatch();
  if (effectivePriceSource(match) === "contract") return Number(match.scope.averagePointPrice) || 0;
  return Math.max(0, Number(elements.pointPrice.value) || 0);
}

function updateCalculation() {
  if (!selectedGroup) return;
  const points = currentPoints();
  const price = currentPrice();
  const breakdown = factorBreakdown();
  const base = points * price;
  const total = base * breakdown.combined;

  elements.pointsValue.textContent = numberFormatter.format(points);
  elements.baseValue.textContent = moneyFormatter.format(base);
  elements.combinedFactor.textContent = decimalFormatter.format(breakdown.combined);
  elements.totalValue.textContent = moneyFormatter.format(total);
  elements.totalEquation.textContent = `${numberFormatter.format(points)} pkt × ${decimalFormatter.format(price)} zł × ${preciseFactorFormatter.format(breakdown.combined)}`;
  elements.factorFormula.textContent = factorFormula(breakdown);
  updatePointPriceSource();

  if (effectivePriceSource() === "custom") state.customPrice = price;
  state.modeByGroup[selectedGroup.code] = elements.mode.value;
  saveState();
}

function updateResumeCard() {
  const group = state.groupCode ? GROUP_BY_CODE.get(state.groupCode) : null;
  elements.resumeGroup.hidden = !group;
  if (group) elements.resumeGroupLabel.textContent = `${group.code} · ${group.name}`;
}

function selectGroup(group) {
  if (!group) return;
  selectedGroup = group;
  state.groupCode = group.code;
  saveState();
  updateResumeCard();

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
  renderContract(group);
  renderCoefficients();
  renderGrouping(group);
  renderScopes(group);
  updateCalculation();
}

function runSearch() {
  const matches = findMatches(elements.searchInput.value);
  const query = normalize(elements.searchInput.value);
  renderSuggestions(matches);
  let exact = null;
  if (state.searchMode === "group") {
    exact = matches.find(({ group }) => normalize(group.code) === query)
      || matches.find(({ group }) => normalize(group.productCode) === query);
  }
  if (exact || matches.length === 1) {
    selectGroup((exact || matches[0]).group);
    return;
  }
  elements.resultCard.hidden = true;
  if (matches.length === 0) {
    elements.emptyState.hidden = false;
    elements.emptyStateCopy.textContent = SEARCH_MODES[state.searchMode].help;
  } else {
    elements.emptyState.hidden = true;
  }
}

function updateConnectionBadge() {
  const isOnline = navigator.onLine;
  elements.connectionBadge.textContent = isOnline ? "Online" : "Offline";
  elements.connectionBadge.classList.toggle("offline", !isOnline);
}

elements.openGruper.addEventListener("click", () => {
  showScreen("gruper");
  setSearchMode(state.searchMode);
});
elements.resumeGroup.addEventListener("click", () => {
  showScreen("gruper", { keepResult: true });
  setSearchMode("group");
  const group = GROUP_BY_CODE.get(state.groupCode);
  if (group) {
    elements.searchInput.value = group.code;
    selectGroup(group);
  }
});
elements.backButton.addEventListener("click", () => showScreen("home"));
elements.searchModeGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-mode]");
  if (!button) return;
  setSearchMode(button.dataset.searchMode, { focus: true });
});
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});
elements.searchInput.addEventListener("input", () => {
  const matches = findMatches(elements.searchInput.value);
  renderSuggestions(matches);
  if (!elements.searchInput.value.trim()) elements.emptyState.hidden = true;
});
elements.providerProfile.addEventListener("change", () => {
  state.providerId = elements.providerProfile.value;
  saveState();
  renderProviderSummary();
  if (selectedGroup) selectGroup(selectedGroup);
});
elements.customProviderName.addEventListener("input", () => {
  state.customProviderName = elements.customProviderName.value;
  saveState();
  renderProviderSummary();
  if (selectedGroup) elements.contractProviderName.textContent = providerOfficialName();
});
elements.customProviderCode.addEventListener("input", () => {
  state.customProviderCode = elements.customProviderCode.value;
  saveState();
  renderProviderSummary();
});
elements.mode.addEventListener("change", updateCalculation);
elements.priceSourceContract.addEventListener("change", () => {
  if (!elements.priceSourceContract.checked || elements.priceSourceContract.disabled) return;
  state.priceSource = "contract";
  renderPriceControls();
  updateCalculation();
});
elements.priceSourceCustom.addEventListener("change", () => {
  if (!elements.priceSourceCustom.checked) return;
  state.priceSource = "custom";
  renderPriceControls();
  updateCalculation();
  elements.pointPrice.focus();
});
elements.pointPrice.addEventListener("input", () => {
  if (effectivePriceSource() !== "custom") return;
  state.customPrice = Math.max(0, Number(elements.pointPrice.value) || 0);
  updateCalculation();
});
elements.addCoefficient.addEventListener("click", () => {
  if (!selectedGroup) return;
  const items = coefficientItems();
  const item = newCoefficient();
  state.coefficientsByGroup[selectedGroup.code] = [...items, item];
  saveState();
  renderCoefficients();
  updateCalculation();
  const card = elements.coefficientList.querySelector(`[data-coefficient-id="${item.id}"]`);
  card?.querySelector("input")?.focus();
});
elements.coefficientList.addEventListener("input", (event) => {
  const card = event.target.closest("[data-coefficient-id]");
  const field = event.target.dataset.coefficientField;
  if (!card || !field) return;
  const item = coefficientItems().find((candidate) => candidate.id === card.dataset.coefficientId);
  if (!item) return;
  item[field] = field === "value" ? Number(event.target.value) : event.target.value;
  saveState();
  updateCalculation();
});
elements.coefficientList.addEventListener("change", (event) => {
  const card = event.target.closest("[data-coefficient-id]");
  const field = event.target.dataset.coefficientField;
  if (!card || !field) return;
  const item = coefficientItems().find((candidate) => candidate.id === card.dataset.coefficientId);
  if (!item) return;
  item[field] = field === "value" ? Number(event.target.value) : event.target.value;
  saveState();
  updateCalculation();
});
elements.coefficientList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-coefficient]");
  if (!removeButton || !selectedGroup) return;
  state.coefficientsByGroup[selectedGroup.code] = coefficientItems().filter(
    (item) => item.id !== removeButton.dataset.removeCoefficient
  );
  saveState();
  renderCoefficients();
  updateCalculation();
});
elements.installButton.addEventListener("click", () => {
  if (typeof elements.installDialog.showModal === "function") elements.installDialog.showModal();
  else elements.installDialog.setAttribute("open", "");
});
window.addEventListener("online", updateConnectionBadge);
window.addEventListener("offline", updateConnectionBadge);

elements.catalogLabel.textContent = `Załączniki 1a i 9 · ${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup`;
elements.homeDataLabel.textContent = `${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup JGP · ${numberFormatter.format(CHARACTERISTICS.meta.codeEntryCount || 0)} kodów ICD`;
elements.sourceOrder.textContent = CATALOG.meta.orderNumber || "46/2026/DSOZ";
elements.sourceCatalog.textContent = CATALOG.meta.catalog || "Załącznik 1a – katalog grup";
elements.sourceCount.textContent = `${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup JGP`;
elements.sourceCharacteristics.textContent = `Załącznik 9 – charakterystyka JGP · ${numberFormatter.format(CHARACTERISTICS.meta.codeEntryCount || 0)} pozycji ICD.`;
elements.sourceApiLabel.textContent = `${CONTRACT_DATA.meta.source || "API Umowy NFZ"} v${CONTRACT_DATA.meta.apiVersion || "—"}`;
elements.sourceApiDate.textContent = formatDate(CONTRACT_DATA.meta.syncedAt);

renderProviderSelector();
setSearchMode(state.searchMode);
showScreen("home");
updateConnectionBadge();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Brak service workera nie blokuje działania katalogu online.
    });
  });
}
