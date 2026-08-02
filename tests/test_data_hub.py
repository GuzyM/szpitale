import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "validate_data_hub",
    ROOT / "scripts" / "validate_data_hub.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DataHubValidationTests(unittest.TestCase):
    def test_published_data_hub_is_valid(self):
        datasets, records, partitions = MODULE.validate()
        self.assertEqual(datasets, 9)
        self.assertEqual(records, 3)
        self.assertEqual(partitions, 2)

    def test_raw_document_fields_are_forbidden(self):
        keys = set(
            MODULE.walk_keys(
                {
                    "source": {"url": "https://example.test"},
                    "rawDocument": "nie powinno trafić do repozytorium",
                }
            )
        )
        self.assertTrue(keys.intersection(MODULE.FORBIDDEN_CONTENT_KEYS))

    def test_non_clinical_procurement_is_rejected(self):
        shard = json.loads(
            (ROOT / "data-hub/datasets/procurements/shards/2022.json").read_text(
                encoding="utf-8"
            )
        )
        record = shard["records"][0]
        record["hospital"]["kind"] = "general"
        with self.assertRaisesRegex(ValueError, "wyłącznie szpitale kliniczne"):
            MODULE.validate_procurement(record, set(), "testowy rekord")


if __name__ == "__main__":
    unittest.main()
