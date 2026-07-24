import importlib.util
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "sync_mz_legislation.py"
SPEC = importlib.util.spec_from_file_location("sync_mz_legislation", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class LegislationSyncTests(unittest.TestCase):
    def test_transport_uses_official_rcl_host_without_changing_public_links(self):
        self.assertEqual(
            MODULE.transport_url("https://legislacja.gov.pl/projekt/12345"),
            "https://legislacja.rcl.gov.pl/projekt/12345",
        )
        self.assertEqual(
            MODULE.normalize_project_url("/projekt/12345"),
            "https://legislacja.gov.pl/projekt/12345",
        )

    def test_extracts_anchor_and_embedded_project_urls(self):
        html = """
        <a href="/projekt/12345">Projekt ustawy o jakości</a>
        <script>{"url": "\\/projekt\\/67890"}</script>
        """
        links = dict(MODULE.extract_project_links(html))
        self.assertEqual(
            links["https://legislacja.gov.pl/projekt/12345"],
            "Projekt ustawy o jakości",
        )
        self.assertIn("https://legislacja.gov.pl/projekt/67890", links)

    def test_history_never_drops_a_previously_detected_project(self):
        existing = [
            {
                "id": "rcl-100",
                "title": "Starszy projekt",
                "firstSeenAt": "2026-07-21T04:17:00+00:00",
                "shortStatus": "Nowy projekt",
                "url": "https://legislacja.gov.pl/projekt/100",
            }
        ]
        fetched = [
            {
                "id": "rcl-200",
                "title": "Nowy projekt",
                "firstSeenAt": "2026-07-23T04:17:00+00:00",
                "isNew": True,
                "url": "https://legislacja.gov.pl/projekt/200",
            }
        ]
        merged = MODULE.merge_history(
            existing,
            fetched,
            "2026-07-23T04:17:00+00:00",
        )
        self.assertEqual({item["id"] for item in merged}, {"rcl-100", "rcl-200"})
        historical = next(item for item in merged if item["id"] == "rcl-100")
        self.assertFalse(historical["isNew"])
        self.assertEqual(historical["shortStatus"], "Zapisany w historii")

    def test_only_an_exact_five_sentence_summary_is_ready(self):
        summary = "Pierwsze. Drugie. Trzecie. Czwarte. Piąte."
        ready, status = MODULE.ready_summary(
            {
                "summary": summary,
                "summaryStatus": "ready",
                "summaryProvider": "chatgpt",
            }
        )
        self.assertEqual(ready, summary)
        self.assertEqual(status, "ready")

        pending, pending_status = MODULE.ready_summary(
            {
                "summary": "Tylko jedno zdanie.",
                "summaryStatus": "ready",
                "summaryProvider": "chatgpt",
            }
        )
        self.assertIsNone(pending)
        self.assertEqual(pending_status, "pending")

    def test_act_type_is_inferred_from_public_title(self):
        self.assertEqual(
            MODULE.infer_act_type(
                "Projekt rozporządzenia Ministra Zdrowia w sprawie świadczeń",
                "",
            ),
            "Projekt rozporządzenia Ministra Zdrowia",
        )

    def test_first_baseline_marks_only_projects_published_today_as_new(self):
        old_html = """
        <html><title>Projekt ustawy o jakości</title>
        <body>Data publikacji: 22.07.2026</body></html>
        """
        with mock.patch.object(MODULE, "request_text", return_value=old_html):
            item = MODULE.build_project(
                "https://legislacja.gov.pl/projekt/300",
                "Projekt ustawy o jakości",
                None,
                "2026-07-23T04:17:00+00:00",
                1,
                baseline=True,
            )
        self.assertFalse(item["isNew"])
        self.assertEqual(item["shortStatus"], "Dodany do rejestru")


if __name__ == "__main__":
    unittest.main()
