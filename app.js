"use strict";

const CATALOG = window.JGP_CATALOG || { meta: {}, groups: [] };
const CHARACTERISTICS = window.JGP_CHARACTERISTICS || { meta: {}, blocks: {} };
const CONTRACT_DATA = window.NFZ_CONTRACT || { meta: {}, scopes: [] };
const COEFFICIENT_REGISTRY = window.HOSPITALAPP_COEFFICIENTS || { meta: {}, rules: [] };
const SRK_FULLTEXT = window.HOSPITALAPP_SRK_FULLTEXT || { meta: {}, sections: [] };
const COST_ACCOUNTING = window.HOSPITALAPP_COST_ACCOUNTING || {
  meta: {},
  regulationEntries: [],
  faq: [],
  resources: []
};
const PAYROLL_DATA = window.HOSPITALAPP_PAYROLL || { meta: {}, groups: [] };
const KEY_CHANGE = window.HOSPITALAPP_KEY_CHANGE || { meta: {}, tiles: [], actions: [] };
const DATA_HUB = window.HospitalDataHub || null;
const SRK_FULLTEXT_BY_ID = new Map((SRK_FULLTEXT.sections || []).map((section) => [section.id, section]));
const GROUPS = CATALOG.groups || [];
const BLOCKS = CHARACTERISTICS.blocks || {};
const GROUP_BY_CODE = new Map(GROUPS.map((group) => [group.code, group]));

const STORAGE_KEY = "hospitalapp-jgp-v06";
const PREVIOUS_STORAGE_KEYS = ["hospitalapp-jgp-v05", "hospitalapp-jgp-v04", "jgp-calculator-v03"];
const LEGISLATION_CHECK_KEY = "hospitalapp-mz-legislation-last-check";
const LEGISLATION_PREFERENCES_KEY = "hospitalapp-mz-legislation-preferences-v1";
const PAYROLL_STORAGE_KEY = "hospitalapp-payroll-impact-v09";
const NOTES_STORAGE_KEY = "hospitalapp-local-notes-v1";
const LEGISLATION_REFRESH_INTERVAL = 24 * 60 * 60 * 1000;
const LEGISLATION_STALE_INTERVAL = 36 * 60 * 60 * 1000;
const LEGISLATION_DATA_URL = "./data/mz-legislation.json";
const MODE_LABELS = {
  ordinary: "Hospitalizacja",
  planned: "Hospitalizacja planowa",
  oneDayTreatment: "Leczenie jednego dnia",
  under12h: "Pobyt dzienny do 12 godzin",
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
let legislationData = {
  meta: {
    checkedAt: "2026-07-21T00:00:00+02:00",
    sourceLabel: "Rządowy Proces Legislacyjny · Ministerstwo Zdrowia"
  },
  items: []
};
let legislationPreferences = loadLegislationPreferences();
let legislationLoadError = false;
let knowledgeFilter = "all";
let payrollState = loadPayrollState();
let localNotes = loadLocalNotes();
let currentScreen = "home";
let toastTimer = null;
let procurementsData = {
  meta: {
    generatedAt: null,
    recordCount: 0
  },
  items: []
};
let procurementsLoaded = false;

const elements = {
  homeScreen: document.querySelector("#home-screen"),
  gruperScreen: document.querySelector("#gruper-screen"),
  keyChangeScreen: document.querySelector("#key-change-screen"),
  nfzServicesScreen: document.querySelector("#nfz-services-screen"),
  legislationScreen: document.querySelector("#legislation-screen"),
  costAccountingScreen: document.querySelector("#cost-accounting-screen"),
  payrollScreen: document.querySelector("#payroll-screen"),
  procurementsScreen: document.querySelector("#procurements-screen"),
  openGruper: document.querySelector("#open-gruper"),
  openKeyChange: document.querySelector("#open-key-change"),
  openNfzServices: document.querySelector("#open-nfz-services"),
  openJgpFromServices: document.querySelector("#open-jgp-from-services"),
  openLegislation: document.querySelector("#open-legislation"),
  openCostAccounting: document.querySelector("#open-cost-accounting"),
  openPayroll: document.querySelector("#open-payroll"),
  openProcurements: document.querySelector("#open-procurements"),
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
  coefficientEnabled: document.querySelector("#coefficient-enabled"),
  coefficientTools: document.querySelector("#coefficient-tools"),
  coefficientList: document.querySelector("#coefficient-list"),
  coefficientEmpty: document.querySelector("#coefficient-empty"),
  addCoefficient: document.querySelector("#add-coefficient"),
  coefficientSuggestionCount: document.querySelector("#coefficient-suggestion-count"),
  coefficientSuggestionList: document.querySelector("#coefficient-suggestion-list"),
  coefficientSuggestionEmpty: document.querySelector("#coefficient-suggestion-empty"),
  coefficientRegistryNote: document.querySelector("#coefficient-registry-note"),
  coefficientRegistryList: document.querySelector("#coefficient-registry-list"),
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
  sourceApiDate: document.querySelector("#source-api-date"),
  keyMinimumWage: document.querySelector("#key-minimum-wage"),
  keyHourlyLimit: document.querySelector("#key-hourly-limit"),
  keyMonthlyLimit: document.querySelector("#key-monthly-limit"),
  keyTotalLimit: document.querySelector("#key-total-limit"),
  keyChangeTiles: document.querySelector("#key-change-tiles"),
  keyChangeActions: document.querySelector("#key-change-actions"),
  keyChangeSource: document.querySelector("#key-change-source"),
  keyChangeProject: document.querySelector("#key-change-project"),
  legislationStatus: document.querySelector("#legislation-status"),
  legislationStatusCard: document.querySelector(".legislation-status-card"),
  legislationFreshnessNote: document.querySelector("#legislation-freshness-note"),
  legislationUpdatedLabel: document.querySelector("#legislation-updated-label"),
  refreshLegislation: document.querySelector("#refresh-legislation"),
  legislationSearch: document.querySelector("#legislation-search"),
  legislationFilterNew: document.querySelector("#legislation-filter-new"),
  legislationFilterSummary: document.querySelector("#legislation-filter-summary"),
  legislationList: document.querySelector("#legislation-list"),
  legislationCount: document.querySelector("#legislation-count"),
  legislationTotalCount: document.querySelector("#legislation-total-count"),
  legislationNewCount: document.querySelector("#legislation-new-count"),
  legislationEmpty: document.querySelector("#legislation-empty"),
  knowledgeSearch: document.querySelector("#knowledge-search"),
  knowledgeFilters: document.querySelector("#knowledge-filters"),
  knowledgeResults: document.querySelector("#knowledge-results"),
  knowledgeCount: document.querySelector("#knowledge-count"),
  knowledgeEmpty: document.querySelector("#knowledge-empty"),
  knowledgeResources: document.querySelector("#knowledge-resources"),
  payrollPreviousBase: document.querySelector("#payroll-previous-base"),
  payrollCurrentBase: document.querySelector("#payroll-current-base"),
  payrollOncost: document.querySelector("#payroll-oncost"),
  payrollIncludeOncost: document.querySelector("#payroll-include-oncost"),
  payrollGroupList: document.querySelector("#payroll-group-list"),
  payrollFteTotal: document.querySelector("#payroll-fte-total"),
  payrollReset: document.querySelector("#payroll-reset"),
  payrollResultMode: document.querySelector("#payroll-result-mode"),
  payrollResultFte: document.querySelector("#payroll-result-fte"),
  payrollMonthlyResult: document.querySelector("#payroll-monthly-result"),
  payrollHalfyearResult: document.querySelector("#payroll-halfyear-result"),
  payrollYearResult: document.querySelector("#payroll-year-result"),
  payrollResultDetails: document.querySelector("#payroll-result-details"),
  procurementsStatus: document.querySelector("#procurements-status"),
  procurementsSearchForm: document.querySelector("#procurements-search-form"),
  procurementsSearch: document.querySelector("#procurements-search"),
  procurementsCount: document.querySelector("#procurements-count"),
  procurementsUpdated: document.querySelector("#procurements-updated"),
  procurementsResults: document.querySelector("#procurements-results"),
  procurementsEmpty: document.querySelector("#procurements-empty"),
  notesButton: document.querySelector("#notes-button"),
  notesCount: document.querySelector("#notes-count"),
  notesDialog: document.querySelector("#notes-dialog"),
  notesClose: document.querySelector("#notes-close"),
  notesContext: document.querySelector("#notes-context"),
  notesInput: document.querySelector("#notes-input"),
  notesSave: document.querySelector("#notes-save"),
  notesSavedCount: document.querySelector("#notes-saved-count"),
  notesList: document.querySelector("#notes-list"),
  notesEmpty: document.querySelector("#notes-empty"),
  appToast: document.querySelector("#app-toast")
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
    priceSource: "custom",
    customPrice: 1.96,
    coefficientEnabledByGroup: {},
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
    merged.coefficientEnabledByGroup = { ...(saved.coefficientEnabledByGroup || {}) };
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
      merged.coefficientEnabledByGroup[groupCode] = true;
    });
    Object.entries(merged.coefficientsByGroup).forEach(([groupCode, items]) => {
      if (Array.isArray(items) && items.length && merged.coefficientEnabledByGroup[groupCode] == null) {
        merged.coefficientEnabledByGroup[groupCode] = true;
      }
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

function loadLegislationPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEGISLATION_PREFERENCES_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveLegislationPreferences() {
  try {
    localStorage.setItem(LEGISLATION_PREFERENCES_KEY, JSON.stringify(legislationPreferences));
  } catch {
    // Prywatne oznaczenia są opcjonalne i nie blokują monitora legislacji.
  }
}

function defaultPayrollState() {
  return {
    previousBase: Number(PAYROLL_DATA.meta?.previousBase) || 0,
    currentBase: Number(PAYROLL_DATA.meta?.currentBase) || 0,
    oncost: Number(PAYROLL_DATA.meta?.defaultEmployerOncost) || 0,
    includeOncost: true,
    headcounts: {}
  };
}

function loadPayrollState() {
  try {
    const saved = JSON.parse(localStorage.getItem(PAYROLL_STORAGE_KEY) || "{}");
    const defaults = defaultPayrollState();
    return {
      ...defaults,
      ...saved,
      previousBase: Number(saved.previousBase ?? defaults.previousBase) || 0,
      currentBase: Number(saved.currentBase ?? defaults.currentBase) || 0,
      oncost: Number(saved.oncost ?? defaults.oncost) || 0,
      includeOncost: saved.includeOncost == null ? defaults.includeOncost : Boolean(saved.includeOncost),
      headcounts: { ...(saved.headcounts || {}) }
    };
  } catch {
    return defaultPayrollState();
  }
}

function savePayrollState() {
  try {
    localStorage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(payrollState));
  } catch {
    // Kalkulator działa także bez możliwości zapisu ustawień.
  }
}

function loadLocalNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter((item) => item && item.id && item.text && item.context).slice(0, 200)
      : [];
  } catch {
    return [];
  }
}

function saveLocalNotes() {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(localNotes));
  } catch {
    // Notatnik jest dodatkiem i nie może blokować pozostałych modułów.
  }
}

function noteContextLabel() {
  if (currentScreen === "gruper") {
    return selectedGroup ? `Gruper JGP · ${selectedGroup.code}` : "Gruper JGP";
  }
  return {
    home: "Ekran główny",
    "key-change": "Kluczowa zmiana · UD439",
    "nfz-services": "Świadczenia NFZ",
    legislation: "Legislacja MZ",
    "cost-accounting": "Rachunek kosztów",
    payroll: "Skutki wzrostu płac",
    procurements: "Przetargi"
  }[currentScreen] || "HospitalAPP";
}

function showToast(message) {
  if (!elements.appToast) return;
  window.clearTimeout(toastTimer);
  elements.appToast.textContent = message;
  elements.appToast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.appToast.hidden = true;
  }, 2400);
}

function renderLocalNotes() {
  if (!elements.notesList) return;
  elements.notesList.replaceChildren();
  elements.notesCount.textContent = String(localNotes.length);
  elements.notesCount.hidden = localNotes.length === 0;
  elements.notesSavedCount.textContent = `${localNotes.length} ${localNotes.length === 1 ? "uwaga" : "uwag"}`;
  elements.notesEmpty.hidden = localNotes.length > 0;
  localNotes.forEach((note) => {
    const item = document.createElement("article");
    const copy = document.createElement("div");
    const context = document.createElement("strong");
    const text = document.createElement("p");
    const date = document.createElement("time");
    const remove = document.createElement("button");
    item.className = "note-item";
    item.dataset.noteId = note.id;
    copy.className = "note-item-copy";
    context.textContent = note.context;
    text.textContent = note.text;
    date.dateTime = note.createdAt;
    date.textContent = formatLegislationDate(note.createdAt);
    remove.type = "button";
    remove.className = "note-delete";
    remove.dataset.deleteNote = note.id;
    remove.setAttribute("aria-label", `Usuń uwagę: ${note.text.slice(0, 50)}`);
    remove.textContent = "×";
    copy.append(context, text, date);
    item.append(copy, remove);
    elements.notesList.appendChild(item);
  });
}

function openNotes() {
  elements.notesContext.textContent = noteContextLabel();
  elements.notesInput.value = "";
  renderLocalNotes();
  if (typeof elements.notesDialog.showModal === "function") elements.notesDialog.showModal();
  else elements.notesDialog.setAttribute("open", "");
  elements.notesInput.focus();
}

function closeNotes() {
  if (typeof elements.notesDialog.close === "function") elements.notesDialog.close();
  else elements.notesDialog.removeAttribute("open");
}

function addLocalNote() {
  const text = elements.notesInput.value.trim();
  if (!text) {
    elements.notesInput.focus();
    return;
  }
  localNotes.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    context: noteContextLabel(),
    text,
    createdAt: new Date().toISOString()
  });
  localNotes = localNotes.slice(0, 200);
  saveLocalNotes();
  elements.notesInput.value = "";
  renderLocalNotes();
  showToast("Uwaga zapisana tylko na tym urządzeniu.");
}

function deleteLocalNote(noteId) {
  localNotes = localNotes.filter((note) => note.id !== noteId);
  saveLocalNotes();
  renderLocalNotes();
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
  const isGruper = screen === "gruper";
  const isKeyChange = screen === "key-change";
  const isNfzServices = screen === "nfz-services";
  const isLegislation = screen === "legislation";
  const isCostAccounting = screen === "cost-accounting";
  const isPayroll = screen === "payroll";
  const isProcurements = screen === "procurements";
  elements.homeScreen.hidden = !isHome;
  elements.gruperScreen.hidden = !isGruper;
  elements.keyChangeScreen.hidden = !isKeyChange;
  elements.nfzServicesScreen.hidden = !isNfzServices;
  elements.legislationScreen.hidden = !isLegislation;
  elements.costAccountingScreen.hidden = !isCostAccounting;
  elements.payrollScreen.hidden = !isPayroll;
  elements.procurementsScreen.hidden = !isProcurements;
  elements.backButton.hidden = isHome;
  elements.brandMark.hidden = !isHome;
  currentScreen = screen;
  const screenMeta = isHome
    ? ["Centrum analityki szpitalnej", "HospitalAPP", "HospitalAPP"]
    : isGruper
      ? ["HospitalAPP · moduł JGP", "Gruper i wycena JGP", "HospitalAPP · Gruper JGP"]
      : isKeyChange
        ? ["HospitalAPP · projekt UD439", "Kluczowa zmiana", "HospitalAPP · Kluczowa zmiana"]
        : isNfzServices
          ? ["HospitalAPP · katalog NFZ", "Świadczenia NFZ", "HospitalAPP · Świadczenia NFZ"]
      : isLegislation
        ? ["HospitalAPP · źródła publiczne", "Legislacja MZ", "HospitalAPP · Legislacja MZ"]
        : isCostAccounting
          ? ["HospitalAPP · baza wiedzy", "Rachunek kosztów", "HospitalAPP · Rachunek kosztów"]
          : isPayroll
            ? ["HospitalAPP · kalkulator", "Skutki wzrostu płac", "HospitalAPP · Skutki wzrostu płac"]
            : ["HospitalAPP · dane publiczne", "Przetargi", "HospitalAPP · Przetargi"];
  [elements.topbarEyebrow.textContent, elements.topbarTitle.textContent, document.title] = screenMeta;
  if (isGruper && !options.keepResult) {
    elements.resultCard.hidden = true;
    elements.emptyState.hidden = true;
    elements.suggestions.replaceChildren();
    elements.searchInput.value = "";
  }
  if (isCostAccounting) renderCostKnowledge();
  if (isPayroll) updatePayrollCalculation();
  if (isKeyChange) updateKeyChangeFigures();
  if (isProcurements && procurementsLoaded) renderProcurements();
  elements.notesContext.textContent = noteContextLabel();
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

function createCodeList(segment, heading, options = {}) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  const count = document.createElement("span");
  const list = document.createElement("ul");
  details.className = `code-list system-${String(segment.system || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  details.dataset.listCode = options.code || "";
  details.dataset.listType = options.role
    || (segment.system === "ICD-9" ? "procedure" : segment.system === "ICD-10" ? "diagnosis" : "additional");
  summary.tabIndex = -1;
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
      code: match[2],
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
      const chip = document.createElement(chipData.code ? "button" : "span");
      chip.className = `rule-chip ${chipData.type}`;
      chip.textContent = chipData.label;
      if (chipData.code) {
        chip.type = "button";
        chip.dataset.openListCode = chipData.code;
        chip.dataset.openListType = chipData.type;
        chip.setAttribute("aria-label", `Otwórz i podświetl ${chipData.label}`);
      }
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
      createCodeList(segment, `${segment.label}${suffix} · bezpośrednio w ${group.code}`, {
        code: group.code
      })
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
    section.dataset.referenceCode = reference.code;
    heading.className = "reference-block-title";
    stack.className = "code-list-stack";
    heading.textContent = `${REFERENCE_ROLE_LABELS[reference.role] || REFERENCE_ROLE_LABELS.reference} · ${reference.code}`;
    lists.forEach((segment, index) => {
      referencedItemCount += segment.items.length;
      const suffix = lists.length > 1 ? ` · część ${index + 1}` : "";
      stack.appendChild(
        createCodeList(segment, `${segment.label}${suffix} · ${referenced.title}`, {
          code: reference.code,
          role: reference.role
        })
      );
    });
    section.append(heading, stack);
    elements.referencedCodeLists.appendChild(section);
  });

  const directItemCount = directLists.reduce((sum, segment) => sum + segment.items.length, 0);
  elements.groupingSummary.textContent = `${numberFormatter.format(paths.length)} ${paths.length === 1 ? "ścieżka" : "ścieżki"} · ${numberFormatter.format(directItemCount + referencedItemCount)} pozycji ICD`;
}

function openAndHighlightGroupingList(code, type) {
  const candidates = Array.from(document.querySelectorAll(".code-list[data-list-code]"))
    .filter((list) => list.dataset.listCode === code);
  const target = candidates.find((list) => list.dataset.listType === type) || candidates[0];
  if (!target) {
    showToast(`Nie znaleziono listy ${code} w tej charakterystyce.`);
    return;
  }
  target.open = true;
  target.dispatchEvent(new Event("toggle"));
  target.classList.remove("is-highlighted");
  void target.offsetWidth;
  target.classList.add("is-highlighted");
  const summary = target.querySelector("summary");
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (typeof summary?.focus === "function") summary.focus({ preventScroll: true });
  window.setTimeout(() => target.classList.remove("is-highlighted"), 1900);
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

function coefficientsEnabled() {
  return Boolean(selectedGroup && state.coefficientEnabledByGroup[selectedGroup.code]);
}

function ruleMatchesGroup(rule, group = selectedGroup) {
  if (!group || rule.catalogOnly) return false;
  if ((rule.excludedGroupCodes || []).includes(group.code)) return false;
  if ((rule.groupCodes || []).includes(group.code)) return true;
  return (rule.groupPrefixes || []).some((prefix) => group.code.startsWith(prefix));
}

function matchingCoefficientRules(group = selectedGroup) {
  return (COEFFICIENT_REGISTRY.rules || []).filter((rule) => ruleMatchesGroup(rule, group));
}

function ruleValueLabel(rule) {
  if (Array.isArray(rule.variants) && rule.variants.length) {
    return rule.variants.map((variant) => preciseFactorFormatter.format(variant.value)).join(" / ");
  }
  if (Number.isFinite(Number(rule.value))) return preciseFactorFormatter.format(rule.value);
  return "wartość zmienna";
}

function createSourceLink(rule, className = "coefficient-source-link") {
  const link = document.createElement("a");
  link.className = className;
  link.href = rule.sourceUrl;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Otwórz źródło ↗";
  link.setAttribute("aria-label", `${rule.sourceTitle || "Otwórz źródło"} (otwiera w nowej karcie)`);
  return link;
}

function selectedVariantForRule(rule, container = elements.coefficientSuggestionList) {
  if (!Array.isArray(rule.variants) || !rule.variants.length) {
    return { id: "fixed", label: "", value: Number(rule.value) };
  }
  const select = container.querySelector(`[data-rule-variant="${rule.id}"]`);
  return rule.variants.find((variant) => variant.id === select?.value) || rule.variants[0];
}

function addCoefficientFromRule(rule) {
  if (!selectedGroup || rule.selectable === false) return;
  const variant = selectedVariantForRule(rule);
  if (!Number.isFinite(Number(variant.value))) return;
  const name = variant.label ? `${rule.shortTitle || rule.title} · ${variant.label}` : (rule.shortTitle || rule.title);
  const existingItems = coefficientItems();
  const nextItem = {
    id: `registry-${rule.id}-${Date.now()}`,
    name,
    value: Number(variant.value),
    combination: rule.combination === "multiply" ? "multiply" : "sum",
    source: "nfz",
    registryId: rule.id,
    registryVariantId: variant.id,
    exclusiveGroup: rule.exclusiveGroup || rule.id,
    sourceUrl: rule.sourceUrl,
    sourceTitle: rule.sourceTitle,
    statusLabel: rule.statusLabel
  };
  const filtered = existingItems.filter((item) => (
    item.registryId !== rule.id
    && (!nextItem.exclusiveGroup || item.exclusiveGroup !== nextItem.exclusiveGroup)
  ));
  state.coefficientsByGroup[selectedGroup.code] = [...filtered, nextItem];
  state.coefficientEnabledByGroup[selectedGroup.code] = true;
  saveState();
  renderCoefficients();
  updateCalculation();
}

function createRegistryRuleCard(rule, options = {}) {
  const card = document.createElement("article");
  const top = document.createElement("div");
  const titleWrap = document.createElement("div");
  const title = document.createElement("strong");
  const value = document.createElement("span");
  const status = document.createElement("small");
  const condition = document.createElement("p");
  const footer = document.createElement("div");
  card.className = `registry-rule-card status-${rule.status || "unknown"}`;
  top.className = "registry-rule-top";
  titleWrap.className = "registry-rule-title";
  value.className = "registry-rule-value";
  status.className = "registry-rule-status";
  condition.className = "registry-rule-condition";
  footer.className = "registry-rule-footer";
  title.textContent = rule.title;
  value.textContent = `× ${ruleValueLabel(rule)}`;
  status.textContent = rule.statusLabel || rule.institution || "Reguła publiczna";
  condition.textContent = rule.condition;
  titleWrap.append(title, status);
  top.append(titleWrap, value);
  footer.appendChild(createSourceLink(rule));

  if (options.selectable && rule.selectable !== false) {
    if (Array.isArray(rule.variants) && rule.variants.length) {
      const select = document.createElement("select");
      select.className = "registry-variant-select";
      select.dataset.ruleVariant = rule.id;
      select.setAttribute("aria-label", `Wariant: ${rule.title}`);
      rule.variants.forEach((variant) => {
        const option = document.createElement("option");
        option.value = variant.id;
        option.textContent = `${variant.label} · ×${preciseFactorFormatter.format(variant.value)}`;
        select.appendChild(option);
      });
      card.append(top, condition, select, footer);
    } else {
      card.append(top, condition, footer);
    }
    const button = document.createElement("button");
    const alreadyAdded = coefficientItems().some((item) => item.registryId === rule.id);
    button.type = "button";
    button.className = "add-registry-rule";
    button.dataset.addRule = rule.id;
    button.textContent = alreadyAdded ? "Zaktualizuj w kalkulacji" : "Dodaj do kalkulacji";
    footer.appendChild(button);
  } else {
    card.append(top, condition, footer);
  }

  if (rule.note) {
    const note = document.createElement("small");
    note.className = "registry-rule-note";
    note.textContent = rule.note;
    card.appendChild(note);
  }
  return card;
}

function renderCoefficientSuggestions() {
  const rules = matchingCoefficientRules();
  elements.coefficientSuggestionList.replaceChildren();
  elements.coefficientSuggestionEmpty.hidden = rules.length > 0;
  elements.coefficientSuggestionCount.textContent = `${rules.length} ${rules.length === 1 ? "reguła" : "reguły"}`;
  rules.forEach((rule) => {
    elements.coefficientSuggestionList.appendChild(createRegistryRuleCard(rule, { selectable: true }));
  });
}

function renderCoefficientRegistry() {
  elements.coefficientRegistryList.replaceChildren();
  elements.coefficientRegistryNote.textContent = COEFFICIENT_REGISTRY.meta.disclaimer || "";
  (COEFFICIENT_REGISTRY.rules || []).forEach((rule) => {
    elements.coefficientRegistryList.appendChild(createRegistryRuleCard(rule));
  });
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
  const enabled = coefficientsEnabled();
  elements.coefficientEnabled.checked = enabled;
  elements.coefficientTools.hidden = !enabled;
  elements.coefficientList.replaceChildren();
  elements.coefficientEmpty.hidden = items.length > 0;
  elements.coefficientCount.textContent = enabled ? String(items.length) : "0";
  renderCoefficientSuggestions();

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
    if (item.sourceUrl) {
      const sourceLink = document.createElement("a");
      sourceLink.className = "coefficient-item-source";
      sourceLink.href = item.sourceUrl;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener";
      sourceLink.textContent = `${item.sourceTitle || "Źródło reguły"} ↗`;
      card.appendChild(sourceLink);
    }
    elements.coefficientList.appendChild(card);
  });
}

function factorBreakdown() {
  if (!coefficientsEnabled()) {
    return { valid: [], summed: [], multiplied: [], summedFactor: 1, multipliedFactor: 1, combined: 1 };
  }
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

function knowledgeResultCard(item) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const summaryCopy = document.createElement("span");
  const badges = document.createElement("span");
  const title = document.createElement("strong");
  const hint = document.createElement("small");
  const body = document.createElement("div");
  const text = document.createElement("p");
  const source = document.createElement("a");
  const isFaq = item.kind === "faq";
  details.className = `knowledge-result ${isFaq ? "is-faq" : "is-regulation"}`;
  summaryCopy.className = "knowledge-result-summary-copy";
  badges.className = "knowledge-result-badges";
  const typeBadge = document.createElement("b");
  typeBadge.textContent = isFaq ? item.category : item.reference;
  badges.appendChild(typeBadge);
  if (!isFaq) {
    const topicBadge = document.createElement("span");
    topicBadge.textContent = item.topic;
    badges.appendChild(topicBadge);
  }
  title.textContent = isFaq ? item.question : item.title;
  hint.textContent = isFaq ? item.reference : "Opracowanie treści przepisu";
  summaryCopy.append(badges, title, hint);
  summary.appendChild(summaryCopy);
  text.textContent = isFaq ? item.answer : item.text;
  source.href = isFaq
    ? "https://www.aotm.gov.pl/standard-rachunku-kosztow/wsparcie-aotmit-w-srk/faq/"
    : COST_ACCOUNTING.meta?.sourceUrl;
  source.target = "_blank";
  source.rel = "noopener";
  source.textContent = isFaq ? "Porównaj z FAQ AOTMiT ↗" : "Zobacz pełny akt prawny ↗";
  body.appendChild(text);
  if (!isFaq && item.matchExcerpt) {
    const match = document.createElement("aside");
    const matchLabel = document.createElement("strong");
    const matchText = document.createElement("p");
    match.className = "knowledge-official-match";
    matchLabel.textContent = "Trafienie w pełnej treści aktu";
    matchText.textContent = item.matchExcerpt;
    match.append(matchLabel, matchText);
    body.appendChild(match);
  }
  body.appendChild(source);
  details.append(summary, body);
  return details;
}

function renderKnowledgeResources() {
  elements.knowledgeResources.replaceChildren();
  (COST_ACCOUNTING.resources || []).forEach((resource) => {
    const link = document.createElement("a");
    const type = document.createElement("span");
    const title = document.createElement("strong");
    const description = document.createElement("small");
    link.href = resource.url;
    link.target = "_blank";
    link.rel = "noopener";
    type.textContent = resource.type;
    title.textContent = resource.title;
    description.textContent = `${resource.description} ↗`;
    link.append(type, title, description);
    elements.knowledgeResources.appendChild(link);
  });
}

function regulationSourceText(reference) {
  const paragraph = String(reference || "").match(/^§\s*(\d+)/);
  if (paragraph) return SRK_FULLTEXT_BY_ID.get(`paragraph-${paragraph[1]}`)?.text || "";
  const annex = String(reference || "").match(/^Załącznik nr\s*(\d+)/i);
  if (annex) return SRK_FULLTEXT_BY_ID.get(`annex-${annex[1]}`)?.text || "";
  return "";
}

function regulationMatchExcerpt(text, query) {
  if (!text || !query) return "";
  const position = normalize(text).indexOf(query);
  if (position < 0) return "";
  const radius = 190;
  const start = Math.max(0, position - radius);
  const end = Math.min(text.length, position + query.length + radius);
  const excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "… " : ""}${excerpt}${end < text.length ? " …" : ""}`;
}

function renderCostKnowledge() {
  const query = normalize(elements.knowledgeSearch.value);
  const regulationEntries = (COST_ACCOUNTING.regulationEntries || []).map((item) => ({
    ...item,
    kind: "regulation",
    sourceText: regulationSourceText(item.reference)
  }));
  const faqEntries = (COST_ACCOUNTING.faq || []).map((item) => ({ ...item, kind: "faq" }));
  const items = [...regulationEntries, ...faqEntries]
    .filter((item) => {
      if (knowledgeFilter !== "all" && item.kind !== knowledgeFilter) return false;
      return normalize([
        item.reference,
        item.title,
        item.topic,
        item.text,
        item.category,
        item.question,
        item.answer,
        item.keywords,
        item.sourceText
      ].join(" ")).includes(query);
    })
    .map((item) => ({
      ...item,
      matchExcerpt: item.kind === "regulation"
        ? regulationMatchExcerpt(item.sourceText, query)
        : ""
    }));
  elements.knowledgeResults.replaceChildren();
  items.forEach((item) => elements.knowledgeResults.appendChild(knowledgeResultCard(item)));
  elements.knowledgeCount.textContent = `${items.length} wyników`;
  elements.knowledgeEmpty.hidden = items.length > 0;
}

function setKnowledgeFilter(filter) {
  if (!["all", "regulation", "faq"].includes(filter)) return;
  knowledgeFilter = filter;
  elements.knowledgeFilters.querySelectorAll("[data-knowledge-filter]").forEach((button) => {
    const active = button.dataset.knowledgeFilter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderCostKnowledge();
}

function renderKeyChange() {
  elements.keyChangeTiles.replaceChildren();
  (KEY_CHANGE.tiles || []).forEach((tile) => {
    const card = document.createElement("article");
    const icon = document.createElement("span");
    const copy = document.createElement("div");
    const eyebrow = document.createElement("span");
    const title = document.createElement("h3");
    const list = document.createElement("ul");
    card.className = "key-change-tile";
    card.dataset.keyChangeTile = tile.id;
    icon.className = "key-change-tile-icon";
    icon.textContent = tile.icon;
    copy.className = "key-change-tile-copy";
    eyebrow.textContent = tile.eyebrow;
    title.textContent = tile.title;
    (tile.points || []).forEach((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      list.appendChild(item);
    });
    copy.append(eyebrow, title, list);
    card.append(icon, copy);
    elements.keyChangeTiles.appendChild(card);
  });

  elements.keyChangeActions.replaceChildren();
  (KEY_CHANGE.actions || []).forEach((action) => {
    const item = document.createElement("li");
    item.textContent = action;
    elements.keyChangeActions.appendChild(item);
  });

  const minimumWage = Number(KEY_CHANGE.meta?.minimumWage2026) || 4806;
  elements.keyMinimumWage.value = String(minimumWage);
  if (KEY_CHANGE.meta?.sourceUrl) elements.keyChangeSource.href = KEY_CHANGE.meta.sourceUrl;
  if (KEY_CHANGE.meta?.projectUrl) elements.keyChangeProject.href = KEY_CHANGE.meta.projectUrl;
  updateKeyChangeFigures();
}

function updateKeyChangeFigures() {
  const minimumWage = Math.max(0, Number(elements.keyMinimumWage?.value) || 0);
  elements.keyHourlyLimit.textContent = moneyFormatter.format(minimumWage / 20);
  elements.keyMonthlyLimit.textContent = moneyFormatter.format(minimumWage * 8);
  elements.keyTotalLimit.textContent = moneyFormatter.format(minimumWage * 16);
}

function payrollFteLabel(value) {
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value)} etatów`;
}

function renderPayrollGroups() {
  elements.payrollGroupList.replaceChildren();
  (PAYROLL_DATA.groups || []).forEach((group) => {
    const row = document.createElement("article");
    const identity = document.createElement("div");
    const groupNumber = document.createElement("span");
    const identityCopy = document.createElement("span");
    const toggle = document.createElement("button");
    const name = document.createElement("strong");
    const coefficient = document.createElement("small");
    const description = document.createElement("p");
    const rates = document.createElement("div");
    const rateValues = document.createElement("strong");
    const delta = document.createElement("small");
    const headcountLabel = document.createElement("label");
    const headcountText = document.createElement("span");
    const headcount = document.createElement("input");
    row.className = "payroll-group-row";
    row.dataset.payrollGroupRow = group.id;
    identity.className = "payroll-group-identity";
    groupNumber.textContent = group.id;
    identityCopy.className = "payroll-group-copy";
    toggle.type = "button";
    toggle.className = "payroll-group-toggle";
    toggle.dataset.payrollGroupToggle = group.id;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", `payroll-group-description-${group.id}`);
    name.textContent = group.shortName;
    coefficient.textContent = `Współczynnik ${decimalFormatter.format(group.coefficient)} · rozwiń skład grupy`;
    toggle.append(name, coefficient);
    identityCopy.appendChild(toggle);
    identity.append(groupNumber, identityCopy);
    rates.className = "payroll-group-rates";
    rateValues.dataset.payrollRates = group.id;
    delta.dataset.payrollDelta = group.id;
    rates.append(rateValues, delta);
    headcountLabel.className = "payroll-headcount-field";
    headcountText.className = "sr-only";
    headcountText.textContent = `Liczba etatów w grupie ${group.id}`;
    headcount.type = "number";
    headcount.min = "0";
    headcount.step = "0.01";
    headcount.inputMode = "decimal";
    headcount.value = Number(payrollState.headcounts[group.id]) || "";
    headcount.dataset.payrollHeadcount = group.id;
    headcount.placeholder = "0";
    headcountLabel.append(headcountText, headcount);
    description.id = `payroll-group-description-${group.id}`;
    description.className = "payroll-group-description";
    description.textContent = `Do grupy wchodzą: ${group.name}.`;
    description.hidden = true;
    row.append(identity, rates, headcountLabel, description);
    elements.payrollGroupList.appendChild(row);
  });
}

function syncPayrollControls() {
  elements.payrollPreviousBase.value = payrollState.previousBase;
  elements.payrollCurrentBase.value = payrollState.currentBase;
  elements.payrollOncost.value = payrollState.oncost;
  elements.payrollIncludeOncost.checked = payrollState.includeOncost;
}

function updatePayrollCalculation() {
  payrollState.previousBase = Math.max(0, Number(elements.payrollPreviousBase.value) || 0);
  payrollState.currentBase = Math.max(0, Number(elements.payrollCurrentBase.value) || 0);
  payrollState.oncost = Math.max(0, Number(elements.payrollOncost.value) || 0);
  payrollState.includeOncost = elements.payrollIncludeOncost.checked;
  let baseMonthly = 0;
  let totalFte = 0;
  (PAYROLL_DATA.groups || []).forEach((group) => {
    const input = elements.payrollGroupList.querySelector(`[data-payroll-headcount="${group.id}"]`);
    const headcount = Math.max(0, Number(input?.value) || 0);
    payrollState.headcounts[group.id] = headcount;
    totalFte += headcount;
    const previousMinimum = payrollState.previousBase * group.coefficient;
    const currentMinimum = payrollState.currentBase * group.coefficient;
    const changePerFte = Math.max(0, currentMinimum - previousMinimum);
    baseMonthly += headcount * changePerFte;
    const rates = elements.payrollGroupList.querySelector(`[data-payroll-rates="${group.id}"]`);
    const delta = elements.payrollGroupList.querySelector(`[data-payroll-delta="${group.id}"]`);
    if (rates) rates.textContent = `${moneyFormatter.format(previousMinimum)} → ${moneyFormatter.format(currentMinimum)}`;
    if (delta) delta.textContent = `+${moneyFormatter.format(changePerFte)} / etat`;
  });
  const employerMonthly = baseMonthly * (1 + payrollState.oncost / 100);
  const selectedMonthly = payrollState.includeOncost ? employerMonthly : baseMonthly;
  const oncostValue = Math.max(0, employerMonthly - baseMonthly);
  elements.payrollFteTotal.textContent = payrollFteLabel(totalFte);
  elements.payrollResultFte.textContent = payrollFteLabel(totalFte);
  elements.payrollResultMode.textContent = payrollState.includeOncost
    ? "Koszt z narzutami pracodawcy"
    : "Wynagrodzenia zasadnicze";
  elements.payrollMonthlyResult.textContent = moneyFormatter.format(selectedMonthly);
  elements.payrollHalfyearResult.textContent = moneyFormatter.format(selectedMonthly * 6);
  elements.payrollYearResult.textContent = moneyFormatter.format(selectedMonthly * 12);
  elements.payrollResultDetails.textContent = payrollState.includeOncost
    ? `Wzrost wynagrodzeń zasadniczych: ${moneyFormatter.format(baseMonthly)} miesięcznie · narzuty: ${moneyFormatter.format(oncostValue)} miesięcznie.`
    : `Wynik nie zawiera narzutów pracodawcy. Po ich włączeniu: ${moneyFormatter.format(employerMonthly)} miesięcznie.`;
  savePayrollState();
}

function resetPayrollCalculator() {
  payrollState = defaultPayrollState();
  syncPayrollControls();
  renderPayrollGroups();
  updatePayrollCalculation();
}

function procurementDocumentLabel(type) {
  return {
    swz: "SWZ",
    "draft-contract": "Projekt umowy",
    "questions-and-answers": "Pytania i odpowiedzi",
    award: "Wynik",
    source: "Źródło"
  }[type] || "Dokument";
}

function procurementValueLabel(item) {
  const value = item.value || {};
  if (value.status === "verified" && Number.isFinite(Number(value.amount))) {
    return moneyFormatter.format(Number(value.amount));
  }
  return "Nie wyodrębniono";
}

function isClinicalProcurement(item) {
  return item?.hospital?.kind === "clinical";
}

function procurementCard(item) {
  const card = document.createElement("article");
  const meta = document.createElement("div");
  const category = document.createElement("span");
  const status = document.createElement("span");
  const title = document.createElement("h3");
  const hospital = document.createElement("p");
  const facts = document.createElement("dl");
  const summary = document.createElement("section");
  const summaryLabel = document.createElement("strong");
  const summaryText = document.createElement("p");
  const documents = document.createElement("div");
  const source = document.createElement("a");
  const publishedDate = item.dates?.published || item.dates?.updated;
  card.className = "procurement-card";
  meta.className = "procurement-card-meta";
  category.textContent = item.category || "Zamówienie publiczne";
  status.textContent = item.status || "Status nieodczytany";
  meta.append(category, status);
  title.textContent = item.subject;
  hospital.className = "procurement-hospital";
  hospital.textContent = [
    item.hospital?.name || "Podmiot leczniczy",
    item.referenceNumber ? `nr ${item.referenceNumber}` : null
  ].filter(Boolean).join(" · ");
  facts.className = "procurement-facts";
  [
    ["Data", publishedDate ? formatDate(publishedDate) : "Brak w rekordzie"],
    ["Wartość", procurementValueLabel(item)],
    ["Wykonawca", item.contractor?.status === "verified" ? item.contractor.name : "Nie wyodrębniono"]
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    facts.appendChild(row);
  });
  summary.className = `procurement-summary ${item.aiSummary?.status === "ready" ? "is-ready" : "is-pending"}`;
  summaryLabel.textContent = item.aiSummary?.status === "ready"
    ? "Streszczenie AI"
    : "Streszczenie AI w przygotowaniu";
  summaryText.textContent = item.aiSummary?.status === "ready" && item.aiSummary.text
    ? item.aiSummary.text
    : "W wersji testowej pokazujemy wyłącznie metadane i linki. Streszczenie pojawi się dopiero po analizie wskazanych dokumentów.";
  summary.append(summaryLabel, summaryText);
  documents.className = "procurement-documents";
  (item.documents || [])
    .filter((documentItem) => documentItem.type !== "source")
    .forEach((documentItem) => {
      const link = document.createElement("a");
      link.href = documentItem.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = documentItem.title;
      link.textContent = `${procurementDocumentLabel(documentItem.type)} ↗`;
      documents.appendChild(link);
    });
  source.className = "procurement-source";
  source.href = item.source?.url;
  source.target = "_blank";
  source.rel = "noopener";
  source.textContent = "Zobacz oficjalną kartę postępowania ↗";
  documents.appendChild(source);
  card.append(meta, title, hospital, facts, summary, documents);
  return card;
}

function renderProcurements() {
  const items = (procurementsData.items || []).filter(isClinicalProcurement);
  elements.procurementsResults.replaceChildren();
  items.forEach((item) => elements.procurementsResults.appendChild(procurementCard(item)));
  elements.procurementsCount.textContent = String(items.length);
  elements.procurementsEmpty.hidden = items.length > 0;
  elements.procurementsUpdated.textContent = `Ostatnia aktualizacja: ${formatLegislationDate(
    procurementsData.meta?.generatedAt
  )}`;
}

async function searchProcurements(options = {}) {
  const query = elements.procurementsSearch.value.trim();
  elements.procurementsStatus.textContent = "Szukam";
  elements.procurementsSearchForm.querySelector("button").disabled = true;
  try {
    if (!DATA_HUB) throw new Error("Brak klienta Data Hub");
    procurementsData = await DATA_HUB.search("procurements", query, {
      limit: 50,
      fresh: Boolean(options.fresh)
    });
    procurementsData.items = (procurementsData.items || []).filter(isClinicalProcurement);
    procurementsLoaded = true;
    elements.procurementsStatus.textContent = navigator.onLine ? "Aktualne" : "Offline";
    renderProcurements();
    return true;
  } catch {
    elements.procurementsStatus.textContent = navigator.onLine ? "Brak danych" : "Offline";
    procurementsData = {
      meta: { generatedAt: null, recordCount: 0 },
      items: []
    };
    procurementsLoaded = true;
    renderProcurements();
    return false;
  } finally {
    elements.procurementsSearchForm.querySelector("button").disabled = false;
  }
}

function formatLegislationDate(value) {
  if (!value) return "Bez daty na liście";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: String(value).includes("T") ? "2-digit" : undefined,
    minute: String(value).includes("T") ? "2-digit" : undefined
  }).format(date);
}

function legislationDataAge() {
  const checkedAt = Date.parse(legislationData.meta?.checkedAt || "");
  return Number.isFinite(checkedAt) ? Math.max(0, Date.now() - checkedAt) : Number.POSITIVE_INFINITY;
}

function updateLegislationFreshness() {
  const stale = legislationDataAge() > LEGISLATION_STALE_INTERVAL;
  const offline = navigator.onLine === false;
  elements.legislationStatusCard.classList.toggle("is-stale", stale || legislationLoadError);
  elements.legislationStatus.classList.toggle("is-stale", stale || legislationLoadError);
  if (offline) {
    elements.legislationStatus.textContent = "Offline";
    elements.legislationFreshnessNote.textContent = "Brak połączenia. Pokazuję ostatni zapisany rejestr i jego datę aktualizacji.";
  } else if (legislationLoadError) {
    elements.legislationStatus.textContent = "Brak aktualizacji";
    elements.legislationFreshnessNote.textContent = "Nie udało się pobrać nowego rejestru. Pokazuję ostatnie dostępne dane i wyraźnie oznaczam ich datę.";
  } else if (stale) {
    elements.legislationStatus.textContent = "Dane opóźnione";
    elements.legislationFreshnessNote.textContent = "Dane mają ponad 36 godzin. Automat sprawdza RCL dwa razy dziennie; do czasu skutecznej aktualizacji sprawdź także oficjalne źródło.";
  } else {
    elements.legislationStatus.textContent = "Aktualne";
    elements.legislationFreshnessNote.textContent = "GitHub sprawdza Rządowy Proces Legislacyjny dwa razy dziennie. Przycisk pobiera najnowszy zapisany rejestr.";
  }
}

function isLegislationProject(item) {
  if (!item || !item.id) return false;
  if (/^rcl-\d+$/.test(item.id)) return true;
  return item.id !== "rcl-mz-projects" && normalize(item.type).includes("PROJEKT");
}

function hasReadyLegislationSummary(item) {
  return item?.summaryStatus === "ready" && Boolean(String(item.summary || "").trim());
}

function legislationPreference(itemId) {
  return {
    important: false,
    read: false,
    notRelevant: false,
    ...(legislationPreferences[itemId] || {})
  };
}

function setLegislationPreference(itemId, key) {
  const next = legislationPreference(itemId);
  next[key] = !next[key];
  legislationPreferences[itemId] = next;
  saveLegislationPreferences();
  renderLegislation();
}

function legislationActionButton(itemId, key, label, active) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "legislation-user-action";
  button.dataset.legislationId = itemId;
  button.dataset.legislationAction = key;
  button.setAttribute("aria-pressed", String(active));
  button.textContent = label;
  return button;
}

function renderLegislation() {
  const query = normalize(elements.legislationSearch.value);
  const allItems = (Array.isArray(legislationData.items) ? legislationData.items : [])
    .filter(isLegislationProject);
  const onlyNew = Boolean(elements.legislationFilterNew?.checked);
  const onlyWithSummary = Boolean(elements.legislationFilterSummary?.checked);
  const items = allItems.filter((item) => {
    if (onlyNew && !item.isNew) return false;
    if (onlyWithSummary && !hasReadyLegislationSummary(item)) return false;
    return normalize([
      item.type,
      item.title,
      item.summary,
      item.shortStatus,
      item.source
    ].join(" ")).includes(query);
  });
  elements.legislationList.replaceChildren();
  elements.legislationCount.textContent = items.length === allItems.length
    ? String(items.length)
    : `${items.length} z ${allItems.length}`;
  elements.legislationEmpty.hidden = items.length > 0;
  elements.legislationUpdatedLabel.textContent = formatLegislationDate(legislationData.meta?.checkedAt);
  elements.legislationTotalCount.textContent = String(
    Number(legislationData.meta?.projectCount) || allItems.length
  );
  elements.legislationNewCount.textContent = String(
    Number(legislationData.meta?.newSincePreviousCheck) || 0
  );
  updateLegislationFreshness();

  items.forEach((item) => {
    const card = document.createElement("article");
    const meta = document.createElement("div");
    const metaLeading = document.createElement("div");
    const type = document.createElement("span");
    const date = document.createElement("time");
    const title = document.createElement("h3");
    const statusRow = document.createElement("div");
    const shortStatus = document.createElement("span");
    const summaryBox = document.createElement("section");
    const summaryLabel = document.createElement("strong");
    const summary = document.createElement("p");
    const footer = document.createElement("div");
    const source = document.createElement("a");
    const actions = document.createElement("div");
    const preferences = legislationPreference(item.id);
    const summaryReady = hasReadyLegislationSummary(item);
    const primaryDate = item.dateLabel === "Aktualizacja" && item.updatedAt
      ? item.updatedAt
      : item.publicationDate || item.date || item.firstSeenAt;
    card.className = "legislation-item";
    card.classList.toggle("is-new", Boolean(item.isNew));
    card.classList.toggle("is-read", preferences.read);
    card.classList.toggle("is-not-relevant", preferences.notRelevant);
    card.classList.toggle("is-important", preferences.important);
    meta.className = "legislation-item-meta";
    metaLeading.className = "legislation-item-meta-leading";
    type.textContent = item.type || "Projekt aktu prawnego";
    metaLeading.appendChild(type);
    if (item.isNew) {
      const newBadge = document.createElement("b");
      newBadge.className = "legislation-new-badge";
      newBadge.textContent = "NOWE";
      metaLeading.appendChild(newBadge);
    }
    date.textContent = `${item.dateLabel || "Publikacja"}: ${formatLegislationDate(primaryDate)}`;
    if (primaryDate) date.dateTime = primaryDate;
    title.textContent = item.title;
    statusRow.className = "legislation-status-row";
    shortStatus.className = "legislation-short-status";
    shortStatus.textContent = item.shortStatus || (item.isNew ? "Nowy projekt" : "W toku");
    statusRow.appendChild(shortStatus);
    summaryBox.className = `legislation-summary ${summaryReady ? "is-ready" : "is-pending"}`;
    summaryLabel.textContent = summaryReady ? "Podsumowanie · gotowe 5 zdań" : "Podsumowanie w przygotowaniu";
    summary.textContent = summaryReady
      ? item.summary
      : "Streszczenie nie zostało jeszcze przygotowane. Pełna i wiążąca treść jest dostępna w oficjalnym źródle.";
    summaryBox.append(summaryLabel, summary);
    footer.className = "legislation-item-footer";
    source.className = "legislation-source-button";
    source.href = item.url;
    source.target = "_blank";
    source.rel = "noopener";
    source.textContent = "Zobacz źródło ↗";
    actions.className = "legislation-user-actions";
    actions.append(
      legislationActionButton(item.id, "important", "Ważne", preferences.important),
      legislationActionButton(item.id, "read", "Przeczytane", preferences.read),
      legislationActionButton(item.id, "notRelevant", "Nie dotyczy mojego szpitala", preferences.notRelevant)
    );
    footer.append(source, actions);
    meta.append(metaLeading, date);
    card.append(meta, title, statusRow, summaryBox, footer);
    elements.legislationList.appendChild(card);
  });
}

async function refreshLegislation(options = {}) {
  if (typeof window.fetch !== "function") {
    renderLegislation();
    return false;
  }
  elements.refreshLegislation.disabled = true;
  elements.legislationStatus.textContent = "Sprawdzam";
  try {
    let nextData;
    if (DATA_HUB) {
      nextData = await DATA_HUB.loadDataset("legislation", { fresh: true });
    } else {
      const separator = LEGISLATION_DATA_URL.includes("?") ? "&" : "?";
      const response = await window.fetch(`${LEGISLATION_DATA_URL}${separator}v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      nextData = await response.json();
    }
    if (!nextData || !Array.isArray(nextData.items)) throw new Error("Nieprawidłowy format danych");
    legislationData = nextData;
    try {
      localStorage.setItem(LEGISLATION_CHECK_KEY, String(Date.now()));
    } catch {
      // Brak pamięci lokalnej nie blokuje odświeżenia danych.
    }
    legislationLoadError = false;
    renderLegislation();
    return true;
  } catch {
    legislationLoadError = true;
    renderLegislation();
    if (options.userInitiated) showToast("Nie udało się pobrać nowej listy. Pokazuję ostatni zapis.");
    return false;
  } finally {
    elements.refreshLegislation.disabled = false;
  }
}

function maybeRefreshLegislation() {
  let lastCheck = 0;
  try {
    lastCheck = Number(localStorage.getItem(LEGISLATION_CHECK_KEY)) || 0;
  } catch {
    lastCheck = 0;
  }
  if (Date.now() - lastCheck >= LEGISLATION_REFRESH_INTERVAL) {
    refreshLegislation();
  } else {
    renderLegislation();
  }
}

elements.openGruper.addEventListener("click", () => {
  showScreen("gruper");
  setSearchMode(state.searchMode);
});
elements.openKeyChange.addEventListener("click", () => showScreen("key-change"));
elements.openNfzServices.addEventListener("click", () => showScreen("nfz-services"));
elements.openJgpFromServices.addEventListener("click", () => {
  showScreen("gruper");
  setSearchMode(state.searchMode);
});
elements.openLegislation.addEventListener("click", () => {
  showScreen("legislation");
  maybeRefreshLegislation();
});
elements.openCostAccounting.addEventListener("click", () => showScreen("cost-accounting"));
elements.openPayroll.addEventListener("click", () => showScreen("payroll"));
elements.openProcurements.addEventListener("click", () => {
  showScreen("procurements");
  searchProcurements();
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
elements.coefficientEnabled.addEventListener("change", () => {
  if (!selectedGroup) return;
  state.coefficientEnabledByGroup[selectedGroup.code] = elements.coefficientEnabled.checked;
  saveState();
  renderCoefficients();
  updateCalculation();
});
elements.addCoefficient.addEventListener("click", () => {
  if (!selectedGroup) return;
  const items = coefficientItems();
  const item = newCoefficient();
  state.coefficientsByGroup[selectedGroup.code] = [...items, item];
  state.coefficientEnabledByGroup[selectedGroup.code] = true;
  saveState();
  renderCoefficients();
  updateCalculation();
  const card = elements.coefficientList.querySelector(`[data-coefficient-id="${item.id}"]`);
  card?.querySelector("input")?.focus();
});
elements.coefficientSuggestionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-rule]");
  if (!button) return;
  const rule = (COEFFICIENT_REGISTRY.rules || []).find((candidate) => candidate.id === button.dataset.addRule);
  if (rule) addCoefficientFromRule(rule);
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
elements.refreshLegislation.addEventListener("click", () => refreshLegislation({ userInitiated: true }));
elements.legislationSearch.addEventListener("input", renderLegislation);
elements.legislationFilterNew.addEventListener("change", renderLegislation);
elements.legislationFilterSummary.addEventListener("change", renderLegislation);
elements.legislationList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-legislation-action]");
  if (!button || !elements.legislationList.contains(button)) return;
  setLegislationPreference(button.dataset.legislationId, button.dataset.legislationAction);
});
elements.knowledgeSearch.addEventListener("input", renderCostKnowledge);
elements.knowledgeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-knowledge-filter]");
  if (button) setKnowledgeFilter(button.dataset.knowledgeFilter);
});
elements.keyMinimumWage.addEventListener("input", updateKeyChangeFigures);
[
  elements.payrollPreviousBase,
  elements.payrollCurrentBase,
  elements.payrollOncost
].forEach((input) => input.addEventListener("input", updatePayrollCalculation));
elements.payrollIncludeOncost.addEventListener("change", updatePayrollCalculation);
elements.payrollGroupList.addEventListener("input", (event) => {
  if (event.target.matches("[data-payroll-headcount]")) updatePayrollCalculation();
});
elements.payrollGroupList.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-payroll-group-toggle]");
  if (!toggle) return;
  const description = document.querySelector(`#${toggle.getAttribute("aria-controls")}`);
  if (!description) return;
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  description.hidden = expanded;
  const hint = toggle.querySelector("small");
  if (hint) {
    const group = (PAYROLL_DATA.groups || []).find((item) => item.id === toggle.dataset.payrollGroupToggle);
    hint.textContent = `Współczynnik ${decimalFormatter.format(group?.coefficient || 0)} · ${expanded ? "rozwiń skład grupy" : "zwiń skład grupy"}`;
  }
});
elements.payrollReset.addEventListener("click", resetPayrollCalculator);
elements.groupingRules.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-open-list-code]");
  if (!chip) return;
  openAndHighlightGroupingList(chip.dataset.openListCode, chip.dataset.openListType);
});
elements.procurementsSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchProcurements();
});
elements.notesButton.addEventListener("click", openNotes);
elements.notesClose.addEventListener("click", closeNotes);
elements.notesSave.addEventListener("click", addLocalNote);
elements.notesInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    addLocalNote();
  }
});
elements.notesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-note]");
  if (button) deleteLocalNote(button.dataset.deleteNote);
});
elements.notesDialog.addEventListener("click", (event) => {
  if (event.target === elements.notesDialog) closeNotes();
});
window.addEventListener("online", () => {
  updateConnectionBadge();
  updateLegislationFreshness();
});
window.addEventListener("offline", () => {
  updateConnectionBadge();
  updateLegislationFreshness();
});

elements.catalogLabel.textContent = `Załączniki 1a i 9 · ${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup`;
elements.homeDataLabel.textContent = `${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup JGP · ${numberFormatter.format(CHARACTERISTICS.meta.codeEntryCount || 0)} kodów ICD`;
elements.sourceOrder.textContent = CATALOG.meta.orderNumber || "46/2026/DSOZ";
elements.sourceCatalog.textContent = CATALOG.meta.catalog || "Załącznik 1a – katalog grup";
elements.sourceCount.textContent = `${numberFormatter.format(CATALOG.meta.groupCount || GROUPS.length)} grup JGP`;
elements.sourceCharacteristics.textContent = `Załącznik 9 – charakterystyka JGP · ${numberFormatter.format(CHARACTERISTICS.meta.codeEntryCount || 0)} pozycji ICD.`;
elements.sourceApiLabel.textContent = `${CONTRACT_DATA.meta.source || "API Umowy NFZ"} v${CONTRACT_DATA.meta.apiVersion || "—"}`;
elements.sourceApiDate.textContent = formatDate(CONTRACT_DATA.meta.syncedAt);

renderProviderSelector();
renderCoefficientRegistry();
renderLegislation();
renderKeyChange();
renderKnowledgeResources();
renderCostKnowledge();
syncPayrollControls();
renderPayrollGroups();
updatePayrollCalculation();
renderLocalNotes();
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
