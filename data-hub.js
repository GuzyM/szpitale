"use strict";

(function initializeHospitalDataHub(global) {
  const DEFAULT_MANIFEST_PATH = "./data-hub/manifest.json";

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function recordSearchText(record) {
    return normalize([
      record.id,
      record.subject,
      record.referenceNumber,
      record.category,
      record.status,
      record.hospital?.name,
      record.hospital?.krs,
      record.hospital?.regon,
      record.contractor?.name,
      ...(record.cpv || [])
    ].join(" "));
  }

  class DataHubClient {
    constructor(options = {}) {
      this.manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH;
      this.fetcher = options.fetcher || ((...args) => global.fetch(...args));
      this.cache = new Map();
      this.manifestPromise = null;
    }

    async fetchJson(path, options = {}) {
      const cacheKey = String(path);
      if (!options.fresh && this.cache.has(cacheKey)) return this.cache.get(cacheKey);
      const separator = cacheKey.includes("?") ? "&" : "?";
      const requestPath = options.fresh ? `${cacheKey}${separator}v=${Date.now()}` : cacheKey;
      const response = await this.fetcher(requestPath, {
        cache: options.fresh ? "no-store" : "default"
      });
      if (!response?.ok) throw new Error(`Data Hub: HTTP ${response?.status || "error"} dla ${cacheKey}`);
      const payload = await response.json();
      if (!options.fresh) this.cache.set(cacheKey, payload);
      return payload;
    }

    async manifest(options = {}) {
      if (options.fresh) {
        this.manifestPromise = null;
        this.cache.delete(this.manifestPath);
      }
      if (!this.manifestPromise) {
        this.manifestPromise = this.fetchJson(this.manifestPath, options).then((payload) => {
          if (!payload?.datasets || !payload.schemaVersion) {
            throw new Error("Data Hub: nieprawidłowy manifest");
          }
          return payload;
        });
      }
      return this.manifestPromise;
    }

    async descriptor(datasetName, options = {}) {
      const manifest = await this.manifest(options);
      const descriptor = manifest.datasets?.[datasetName];
      if (!descriptor) throw new Error(`Data Hub: nieznany zbiór ${datasetName}`);
      return descriptor;
    }

    async loadDataset(datasetName, options = {}) {
      const descriptor = await this.descriptor(datasetName, options);
      if (descriptor.adapter === "single-json") {
        return this.fetchJson(descriptor.path, options);
      }
      if (descriptor.adapter !== "sharded-json") {
        throw new Error(`Data Hub: zbiór ${datasetName} nie używa adaptera JSON`);
      }
      const index = await this.fetchJson(descriptor.indexPath, options);
      const selectedPartitionIds = new Set(options.partitionIds || []);
      const partitions = (index.partitions || []).filter((partition) => (
        selectedPartitionIds.size === 0 || selectedPartitionIds.has(partition.id)
      ));
      const payloads = await Promise.all(
        partitions.map((partition) => this.fetchJson(partition.path, options))
      );
      return {
        meta: {
          dataset: datasetName,
          schemaVersion: descriptor.schemaVersion,
          generatedAt: index.generatedAt,
          recordCount: index.recordCount,
          loadedPartitions: partitions.map((partition) => partition.id)
        },
        items: payloads.flatMap((payload) => payload.records || [])
      };
    }

    async search(datasetName, query, options = {}) {
      const payload = await this.loadDataset(datasetName, options);
      const words = normalize(query).split(" ").filter(Boolean);
      const limit = Math.max(1, Number(options.limit) || 50);
      const items = (payload.items || [])
        .filter((record) => {
          const haystack = recordSearchText(record);
          return words.every((word) => (
            haystack.includes(word)
            || (word.length >= 6 && haystack.includes(word.slice(0, -1)))
          ));
        })
        .sort((left, right) => {
          const leftDate = left.dates?.published || left.dates?.updated || "";
          const rightDate = right.dates?.published || right.dates?.updated || "";
          return rightDate.localeCompare(leftDate) || left.subject.localeCompare(right.subject, "pl");
        })
        .slice(0, limit);
      return { ...payload, items };
    }

    clear() {
      this.cache.clear();
      this.manifestPromise = null;
    }
  }

  global.HospitalDataHubClient = DataHubClient;
  global.HospitalDataHub = new DataHubClient();
})(window);
