"""Run: python -m unittest discover -s tests -v   (stdlib only)"""
import copy, json, pathlib, sys, unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import lookup, verify_grounding  # noqa: E402

DATA = json.loads((ROOT / "data" / "gst-rates.json").read_text())
E = DATA["entries"]


class Dataset(unittest.TestCase):
    def test_count_and_flags(self):
        self.assertEqual(len(E), 516)
        self.assertTrue(all(e["verified"] is False for e in E))  # nothing is CA-signed

    def test_every_row_cites_the_notification(self):
        for e in E:
            self.assertTrue(e["source_notification"].startswith("Notification No. 9/2025"))
            self.assertRegex(e["source_entry"], r"^Schedule I, S\.No\. \d+$")

    def test_schedule_one_is_five_percent(self):
        self.assertEqual({(e["cgst_rate"], e["gst_rate"]) for e in E}, {("2.5%", "5%")})

    def test_keys_unique(self):
        self.assertEqual(len({(e["schedule"], e["s_no"]) for e in E}), len(E))


class Grounding(unittest.TestCase):
    def test_all_rows_in_gazette(self):
        self.assertEqual(verify_grounding.check(E), [])

    def test_catches_a_changed_word(self):  # the check must be able to fail
        bad = copy.deepcopy(E)
        bad[0]["description"] = "Live donkeys"
        self.assertEqual(verify_grounding.check(bad), [bad[0]["source_entry"]])

    def test_catches_a_wrong_hsn(self):
        bad = copy.deepcopy(E)
        bad[0]["hsn"] = "9999"
        self.assertEqual(verify_grounding.check(bad), [bad[0]["source_entry"]])


class Lookup(unittest.TestCase):
    def test_hsn_prefix(self):
        self.assertTrue(any("ghee" in e["description"].lower() for e in lookup.search("0405", E)))

    def test_keyword(self):
        self.assertTrue(lookup.search("live horses", E))

    def test_no_guessing(self):
        self.assertEqual(lookup.search("flying carpet", E), [])


if __name__ == "__main__":
    unittest.main()
