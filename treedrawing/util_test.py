import unittest, textwrap

import util

import nltk.tree as T

class UtilTest(unittest.TestCase):
    maxDiff = None
    def test_queryVersionCookie(self):
        version_string = "( (VERSION (FORMAT dash) (FOO (BAR baz))))"
        self.assertEqual(
            util.queryVersionCookie(version_string,
                                    "FORMAT"),
            "dash")
        self.assertEqual(
            util.queryVersionCookie(version_string,
                                    "FOO.BAR"),
            "baz")
        self.assertEqual(
            util.queryVersionCookie(version_string,
                                    "FOO"),
            T.Tree("BAR", ["baz"]))

        self.assertIsNone(util.queryVersionCookie(version_string,
                                                  "ABC"))

        # Invalid version cookie gives null result
        invalid_version_tree = "( (FOO bar))"
        self.assertIsNone(util.queryVersionCookie(invalid_version_tree,
                                                  "foo"))

        # multiple matches gives null result, only for aberrant key
        multiple_matches = "( (VERSION (FOO bar) (FOO baz) (BAR quux)))"
        self.assertIsNone(util.queryVersionCookie(multiple_matches,
                                                  "FOO"))
        self.assertEqual(util.queryVersionCookie(multiple_matches,
                                                 "BAR"),
                         "quux")

        # Empty input gives null result
        self.assertIsNone(util.queryVersionCookie("", "FOO"))
        self.assertIsNone(util.queryVersionCookie(None, "FOO"))


        

    def test_treeToHtml(self):
        test_tree = T.Tree("( (IP-MAT (NP-SBJ (D this-this)) (BEP is-is) (NP-PRD (D a-a) (N test-test))))")
        self.assertMultiLineEqual(util.treeToHtml(test_tree, None),
                             """
<div class=\"snode IP-MAT\">IP-MAT <div class=\"snode NP-SBJ\">NP-SBJ <div class=\"snode D\">D<span class=\"wnode\">this-this</span></div></div>
<div class=\"snode BEP\">BEP<span class=\"wnode\">is-is</span></div>
<div class=\"snode NP-PRD\">NP-PRD <div class=\"snode D\">D<span class=\"wnode\">a-a</span></div>
<div class=\"snode N\">N<span class=\"wnode\">test-test</span></div></div></div>
                             """.strip())

        self.assertMultiLineEqual(util.treeToHtml(test_tree, "dash"),
                                  """
<div class=\"snode IP-MAT\">IP-MAT <div class=\"snode NP-SBJ\">NP-SBJ <div class=\"snode D\">D<span class=\"wnode\">this<span class=\"lemma\">-this</span></span></div></div>
<div class=\"snode BEP\">BEP<span class=\"wnode\">is<span class=\"lemma\">-is</span></span></div>
<div class=\"snode NP-PRD\">NP-PRD <div class=\"snode D\">D<span class=\"wnode\">a<span class=\"lemma\">-a</span></span></div>
<div class=\"snode N\">N<span class=\"wnode\">test<span class=\"lemma\">-test</span></span></div></div></div>
                                  """.strip())

    def test_treeToHtml_index(self):
        self.assertMultiLineEqual(util.treeToHtml(T.Tree("(FOO-1 bar)"), None),
                                  "<div class=\"snode FOO\">FOO-1" +
                                  "<span class=\"wnode\">bar</span></div>")

    def test_deepTreeToHtml(self):
        pass

    def test_treeToHtml_metadata(self):
        # ID node and such, not in deep format
        # test quote char in metadata
        pass

    def test_labelFromLabelAndMetadata(self):
        self.assertEqual(util.labelFromLabelAndMetadata("foo", {}),
                         "foo")

    def test_cssClassFromLabel(self):
        self.assertEqual(util.cssClassFromLabel("foo"),
                         "foo")

    def test_orthoFromTree(self):
        pass

    def test_nodeListToDict(self):
        l = map(T.Tree, ["(FOO 1)", "(BAR (BAZ a) (QUUX b))"])
        self.assertEqual(util.nodeListToDict(l),
                         {
                             'FOO': "1",
                             'BAR': {
                                 'BAZ': "a",
                                 'QUUX': "b"
                             }
                         })

    def test_metadataToDict(self):
        m = T.Tree("(METADATA (FOO 1) (BAR (BAZ a) (QUUX b)))")
        self.assertEqual(util.metadataToDict(m),
                         {
                             'FOO': "1",
                             'BAR': {
                                 'BAZ': "a",
                                 'QUUX': "b"
                             }
                         })
