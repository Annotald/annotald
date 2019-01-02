import unittest, textwrap

from annotald import util

import nltk.tree as T

class UtilTest(unittest.TestCase):
    maxDiff = None

    def test_safeJson(self):
        d = dict(foo = 'foo"bar')
        s = util.safe_json(d)
        self.assertEqual(s, '{&#34;foo&#34;: &#34;foo\&#34;bar&#34;}')

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
        test_tree = T.Tree.fromstring("( (IP-MAT (NP-SBJ (D this-this)) (BEP is-is) (NP-PRD (D a-a) (N test-test))))")
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
        self.assertMultiLineEqual(util.treeToHtml(T.Tree.fromstring("(FOO-1 bar)"), None),
                                  "<div class=\"snode FOO\">FOO-1" +
                                  "<span class=\"wnode\">bar</span></div>")

    def test_treeToHtml_mult_daughters(self):
        anomalous = T.Tree.fromstring("(FOO (BAR baz quux))")
        self.assertRaises(util.AnnotaldException, util.treeToHtml, anomalous, None)

    def test_treeToHtml_NUM(self):
        num = T.Tree.fromstring("(FOO (X two-2))")
        self.assertMultiLineEqual(util.treeToHtml(num, "dash"),
                                  """
<div class=\"snode FOO\">FOO <div class=\"snode X\">X<span class=\"wnode\">two-2</span></div></div>
                                  """.strip())

    def test_treeToHtml_metadata(self):
        md = T.Tree.fromstring("( (FOO (BAR baz)) (ID foobar-1) (METADATA (AUTHOR me)))")
        html = util.treeToHtml(md, "dash")
        # We need both because of indeterminacy
        tgt1 = """
<div class=\"snode FOO\" data-metadata=\"{&#34;ID&#34;: &#34;foobar-1&#34;, &#34;METADATA&#34;: {&#34;AUTHOR&#34;: &#34;me&#34;}}\">FOO <div class=\"snode BAR\">BAR<span class=\"wnode\">baz</span></div></div>
                                  """.strip()
        tgt2 = """
<div class="snode FOO" data-metadata="{&#34;METADATA&#34;: {&#34;AUTHOR&#34;: &#34;me&#34;}, &#34;ID&#34;: &#34;foobar-1&#34;}">FOO <div class="snode BAR">BAR<span class="wnode">baz</span></div></div>
        """.strip()
        tgt_list = [tgt1, tgt2]
        self.assertIn(html, tgt_list)

    def test_treeToHtml_bad_metadata(self):
        md = T.Tree.fromstring("( (FOO (BAR baz)) (ID foobar-1) (METADATA (AUTHOR me)) (BAD metadata))")
        self.assertRaises(util.AnnotaldException, util.treeToHtml, md, None)

    def test_deepTreeToHtml(self):
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
        treestrings = ["(FOO 1)", "(BAR (BAZ a) (QUUX b))"]
        l = [T.Tree.fromstring(t) for t in treestrings]
        self.assertEqual(util.nodeListToDict(l),
                         {
                             'FOO': "1",
                             'BAR': {
                                 'BAZ': "a",
                                 'QUUX': "b"
                             }
                         })

    def test_metadataToDict(self):
        m = T.Tree.fromstring("(METADATA (FOO 1) (BAR (BAZ a) (QUUX b)))")
        self.assertEqual(util.metadataToDict(m),
                         {
                             'FOO': "1",
                             'BAR': {
                                 'BAZ': "a",
                                 'QUUX': "b"
                             }
                         })

    def test_scrubText(self):
        text = """
foo bar

/*
foo bar
*/
/~*
foo bar
*~/
<+ foo bar +>
        """.strip()
        self.assertMultiLineEqual(util.scrubText(text),
                                  "foo bar\n\n")
        bad_text = """
/*
foo bar
        """
        self.assertRaises(util.AnnotaldException, util.scrubText, bad_text)

    def test_squashAt(self):
        l = ['chocolate-@','@chip']
        self.assertEqual(util._squashAt(*l), "chocolate-chip")
        l = ['chocolate-@','chip']
        self.assertEqual(util._squashAt(*l), "chocolate-@ chip")
        l = ['chocolate-','@chip']
        self.assertEqual(util._squashAt(*l), "chocolate- @chip")

    def test_isEmpty(self):
        tree = T.Tree.fromstring("((CODE foo) (NP *T*-1) (C 0) (NUM 0) (N foo))")
        p = tree.pos()
        t = p[0]
        self.assertTrue(util._isEmpty(t))
        t = p[1]
        self.assertTrue(util._isEmpty(t))
        t = p[2]
        self.assertTrue(util._isEmpty(t))
        t = p[3]
        self.assertFalse(util._isEmpty(t))
        t = p[4]
        self.assertFalse(util._isEmpty(t))

    def test_updateVersionCookie(self):
        vc = "( (VERSION (BAR (BAZ quux)) (FOO bar)))"
        self.assertEqual(util.updateVersionCookie(vc, "FOO", "baz"),
                         "( (VERSION (BAR (BAZ quux)) (FOO baz)))")
        self.assertEqual(util.updateVersionCookie(vc, "BAR.BAZ", "baz"),
                         "( (VERSION (BAR (BAZ baz)) (FOO bar)))")
        self.assertEqual(util.updateVersionCookie(vc, "BAR", "baz"),
                         "( (VERSION (BAR baz) (FOO bar)))")
        self.assertEqual(util.updateVersionCookie(
            "( (VERSION (FOO baz) (BAR baz)))", "BAR.BAZ", "baz"),
                         "( (VERSION (BAR (BAZ baz)) (FOO baz)))")

    def test_dictToMetadata(self):
        self.assertEqual(util.dictToMetadata({
            "FORMAT": "dash",
            "HASH": {
                "MD5": "none"
            }
        }, "VERSION"),
                         T.Tree.fromstring("(VERSION (FORMAT dash) (HASH (MD5 none)))"))

    def test_getIndex(self):
        cases = [("(NP-1 (D foo))", 1, "-"),
                 ("(NP *T*-1)", 1, "-"),
                 ("(XP *ICH*-3)", 3, "-"),
                 ("(XP *-34)", 34, "-"),
                 ("(XP *CL*-1)", 1, "-"),
                 ("(XP=4 (X foo))", 4, "="),
                 ("(XP *FOO*-1)", None, None),
                 ("(NP (D foo))", None, None)]
        for (s, i, t) in cases:
            self.assertEqual(util._getIndex(T.Tree.fromstring(s)), i)
            self.assertEqual(util._getIndexType(T.Tree.fromstring(s)), t)
            self.assertEqual(util._hasIndex(T.Tree.fromstring(s)), i is not None)

    def test_setIndex(self):
        cases = [("(NP-1 (D foo))", "(NP (D foo))"),
                 ("(NP *T*-1)", "(NP *T*)"),
                 ("(XP *ICH*-3)", "(XP *ICH*)"),
                 ("(XP *-34)", "(XP *)"),
                 ("(XP *CL*-1)", "(XP *CL*)"),
                 ("(XP=4 (X foo))", "(XP (X foo))"),
                 ("(XP *FOO*-1)", "(XP *FOO*-1)"),
                 ("(NP (D foo))", "(NP (D foo))")]
        for (orig, new) in cases:
            self.assertEqual(util._stripIndex(T.Tree.fromstring(orig)),
                             T.Tree.fromstring(new))

    def test_setIndex(self):
        cases = [("(NP-1 (D foo))", "(NP-7 (D foo))"),
                 ("(NP *T*-1)", "(NP *T*-7)"),
                 ("(XP *ICH*-3)", "(XP *ICH*-7)"),
                 ("(XP *-34)", "(XP *-7)"),
                 ("(XP *CL*-1)", "(XP *CL*-7)"),
                 ("(XP=4 (X foo))", "(XP=7 (X foo))"),
                 ("(XP *FOO*-1)", "(XP-7 *FOO*-1)"),
                 ("(NP (D foo))", "(NP-7 (D foo))")]

        for (orig, new) in cases:
            self.assertEqual(util._setIndex(T.Tree.fromstring(orig), 7),
                             T.Tree.fromstring(new))

    def test_rewriteIndices(self):
        t = """
( (IP-MAT-14 (NP-SBJ-3 (D This))
             (PRO-CL-6 lo)
             (VBP is)
             (NP-PRD=3 (D-6 a)
                       (NP *CL*-6)
                       (N test))))
        """
        r = """
( (IP-MAT-1  (NP-SBJ-2 (D This))
             (PRO-CL-3 lo)
             (VBP is)
             (NP-PRD=2 (D-3 a)
                       (NP *CL*-3)
                       (N test))))
        """
        self.assertEqual(util.rewriteIndices(T.Tree.fromstring(t)), T.Tree.fromstring(r))
