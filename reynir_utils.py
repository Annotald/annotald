"""
This Python file uses the following encoding: utf-8
This file copyright © 2018 by Haukur Barri Símonarson

This file is part of Annotald.

Annotald is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option)
any later version.

Annotald is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
details.

You should have received a copy of the GNU General Public License along with
Annotald.  If not, see <http://www.gnu.org/licenses/>.


This module implements an interface to the Reynir parser for Icelandic that
converts the result into a mostly IcePaHC conformant schema. This feature is primarily
intended to be used as a preprocessing step before parsing by hand.

In order to use it, you must first install the ReynirPackage,
   pip install reynir
"""

import os

from nltk import Tree

try:
    from reynir import Reynir
except ImportError as e:
    print(
        (
            "You must first install ReynirPackage before using reynir_utils.py"
            "(pip install reynir)"
        )
    )

import annotald.util as util

_CASE_MAP = {"nf": "N", "þf": "A", "þgf": "D", "ef": "G"}
_DEGREE_MAP = {"ms": "R", "evb": "S", "esb": "S", "est": "S"}
_NUMBER_MAP = {"et": "", "ft": "S"}
_SPECIAL_VERB_MAP = {"vera": "BE", "gera": "DO", "hafa": "HV", "verða": "RD,"}

_NP_TAG_MAP = {
    "pfn": "PRO",
    "abfn": "PRO",
    "no": "N",
    "fn": "Q",
    "no": "N",
    "person": "NPR",
    "entities": "NPR",
    "sérnafn": "NPR",
}

_MOOD_MAP = {"fh": "I", "bh": "I", "vh": "S"}

_TENSE_MAP = {"nt": "P", "þt": "D"}

CASES = frozenset(_CASE_MAP.keys())
NUMBERS = frozenset(_NUMBER_MAP.keys())
DEGREES = frozenset(_DEGREE_MAP.keys())
MOODS = frozenset(_MOOD_MAP.keys())
TENSES = frozenset(_TENSE_MAP.keys())

MODALS = frozenset(["mega", "munu", "skulu", "vilja", "geta", "fá"])
SPECIAL_VERBS = frozenset(_SPECIAL_VERB_MAP.keys())


_GREYNIR_ICEPACH_NT_MAP = {
    "P": "IP-MAT",
    "S-MAIN": "IP",
    "S": "CP",
    "S-COND": "CP-COND",
    "S-CONS": "CP-CONS",
    "S-REF": "CP-REL",
    "S-EXPLAIN": "IP-INF-PRP",
    "S-QUOTE": "CP-QUOTE",
    "S-PREFIX": "CP-PREFIX",
    "S-ADV-TEMP": "CP-ADV-TMP",
    "S-ADV-PURP": "CP-ADV-PRP",
    "S-ADV-ACK": "CP-ADV-ACK",
    "S-ADV-CONS": "CP-ADV-CONS",
    "S-ADV-CAUSE": "CP-ADV-CAUSE",
    "S-ADV-COND": "CP-ADV-CND",
    "S-THT": "CP-THT",
    "S-QUE": "CP-QUE",
    "VP-SEQ": "VP-SEQ",
    "VP": "VP",
    "VP-PP": "VP-PP",
    "NP": "NP",
    "NP-POSS": "NP-POSS",
    "NP-DAT": "NP-DAT",
    "NP-ADDR": "NP-ADDR",
    "NP-TITLE": "NP-TITLE",
    "NP-AGE": "NP-AGE",
    "NP-MEASURE": "NP-MEASURE",
    "NP-SUBJ": "NP-SBJ",
    "NP-OBJ": "NP-OB1",
    "NP-IOBJ": "NP-OB2",
    "NP-PRD": "NP-PRD",
    "ADVP": "ADVP",
    "ADVP-DATE": "ADVP-TMP",
    "ADVP-DATE-ABS": "ADVP-TMP",
    "ADVP-DATE-REL": "ADVP-TMP",
    "ADVP-TIMESTAMP": "ADVP-TMP",
    "ADVP-TIMESTAMP-ABS": "ADVP-TMP",
    "ADVP-TIMESTAMP-REL": "ADVP-TMP",
    "ADVP-TMP-SET": "ADVP-TMP",
    "ADVP-DUR": "ADVP-TMP",
    "ADVP-DUR-ABS": "ADVP-TMP",
    "ADVP-DUR-REL": "ADVP-TMP",
    "ADVP-DUR-TIME": "ADVP-TMP",
    "PP": "PP",
    "ADJP": "ADJP",
    "IP": "IP",
}


def simpleTree2NLTK(tt):
    """ Convert Reynir SimpleTree to NLTK Tree
        without changing labels """
    if tt._len > 1 or tt._children:
        # Children present: Array or nonterminal
        return Tree(tt.tag, [simpleTree2NLTK(child) for child in tt.children])
    # No children
    if tt._head.get("k") == "PUNCTUATION":
        # Punctuation
        return Tree(tt.text, [tt.text])
    # Terminal
    return Tree(tt.terminal, [tt.text])


def treemap(tree, nonterm_fn, term_fn):
    """ Transform labels of NLTK Tree,
        return a new transformed tree"""
    if util.is_leaf(tree):
        # terminal node
        return Tree(term_fn(tree.label()), [tree[0]])
    else:
        # nonterminal node
        label = nonterm_fn(tree.label())
        children = [treemap(subtree, nonterm_fn, term_fn) for subtree in tree]
        return Tree(label, children)


def reynir_tree_to_icepach(simple_tree, affix_lemma=1):
    """ Outer function for _reynir_tree_to_icepach """
    nltk_tree = _reynir_tree_to_icepach(simple_tree, affix_lemma=affix_lemma)
    return Tree("", nltk_tree)


def _reynir_tree_to_icepach(tree, affix_lemma=1):
    """ Transform Reynir SimpleTree to IcePaHC NLTK Tree """
    if tree._len > 1 or tree._children:
        # Children present: Array or nonterminal
        xp = tree.tag
        xp = _GREYNIR_ICEPACH_NT_MAP.get(xp, xp)
        children = []
        for child in [_reynir_tree_to_icepach(child) for child in tree.children]:
            if isinstance(child, Tree):
                children.append(child)
            else:
                children.extend(child)


        # Merge trees according to:
        # IP-MAT idomsonly IP => (merge IP-MAT IP)
        # !IP idoms IP => (rename IP IP-SUB)
        # !VP-SEQ idoms VP-SEQ => (merge !VP-SEQ VP-SEQ)
        # !VP idoms VP => (merge !VP VP)
        if tree.tag in ("S-MAIN",):
            # Merge P and S-MAIN and IP
            return children
        ext_children = []
        if xp == "IP-MAT" and children and children[0].label() == "IP":
            children = [c for c in children[0] ] + (children[1:])

        for child in children:
            label = child.label()
            if xp and xp[:2] != "IP" and label == "IP":
                ext_children.append(child)
                child.set_label("IP-SUB")
            elif label in ("VP-SEQ", "VP"):
                for desc in child:
                    ext_children.append(desc)
            else:
                ext_children.append(child)

        else:
            node = Tree(xp, ext_children)
            return [node]

    # No children
    if tree._head.get("k") == "PUNCTUATION":
        # Punctuation
        lemma_suffix = "" if not affix_lemma else "-" + tree.text
        return Tree(tree.text, [tree.text + lemma_suffix])

    extra_leaves = []
    leaf_tag = tree.tcat

    if leaf_tag == "ao":
        if tree.lemma.lower() in ("ekki", "eigi", "ei"):
            leaf_tag = "NEG"
        else:
            leaf_tag = "ADV"

    elif leaf_tag in ("pfn", "fn"):
        leaf_tag_stem = _NP_TAG_MAP.get(leaf_tag, "[{0}]".format(leaf_tag))
        if tree.lemma.lower() in ("sá", "þessi", "hinn"):
            leaf_tag_stem = "D"

        leaf_case = CASES.intersection(tree.variants)
        leaf_case = (
            ""
            if not leaf_case
            else _CASE_MAP.get(next(iter(leaf_case)), "[{0}]".format(leaf_case))
        )
        leaf_case_suffix = "" if not leaf_case else "-" + leaf_case

        leaf_tag = "{stem}{case}".format(stem=leaf_tag_stem, case=leaf_case_suffix)

    elif leaf_tag in ("no", "person", "entities", "sérnafn", "fyrirtæki"):
        leaf_tag_stem = _NP_TAG_MAP.get(leaf_tag, "[{0}]".format(leaf_tag))

        leaf_number = "S" if "ft" in tree.all_variants else ""

        leaf_case = CASES.intersection(tree.variants)
        leaf_case = (
            ""
            if not leaf_case
            else _CASE_MAP.get(next(iter(leaf_case)), "[{0}]".format(leaf_case))
        )
        leaf_case_suffix = "" if not leaf_case else "-" + leaf_case

        leaf_tag = "{stem}{number}{case}".format(
            stem=leaf_tag_stem, number=leaf_number, case=leaf_case_suffix
        )
        if "gr" in tree.all_variants:
            lemma_suffix = "" if not affix_lemma else "-hinn"
            det_leaf = Tree("D" + leaf_case_suffix, ["$" + lemma_suffix])
            extra_leaves.append(det_leaf)

    elif leaf_tag == "lo":
        leaf_tag_stem = "ADJ"

        leaf_case = CASES.intersection(tree.all_variants)
        leaf_case = (
            ""
            if not leaf_case
            else "-" + _CASE_MAP.get(next(iter(leaf_case)), "[{0}]".format(leaf_case))
        )
        leaf_case = "" if not leaf_case else leaf_case

        leaf_degree = DEGREES.intersection(tree.all_variants)
        leaf_degree = (
            ""
            if not leaf_degree
            else _DEGREE_MAP.get(next(iter(leaf_degree)), "[{0}]".format(leaf_degree))
        )

        leaf_tag = "{stem}{degree}{case}".format(
            stem=leaf_tag_stem, degree=leaf_degree, case=leaf_case
        )

    elif leaf_tag == "tao":
        leaf_tag = "ADV"

        leaf_degree = DEGREES.intersection(tree.all_variants)
        leaf_degree = (
            ""
            if not leaf_degree
            else _DEGREE_MAP.get(next(iter(leaf_degree)), "[{0}]".format(leaf_degree))
        )
        leaf_tag = "{stem}{degree}".format(stem=leaf_tag, degree=leaf_degree)

    elif leaf_tag == "nhm":
        leaf_tag = "TO"

    elif leaf_tag == "so":
        lemma = tree.lemma.lower()

        leaf_tag = "VB"
        if lemma in MODALS:
            leaf_tag = "MD"
            _ = 1
        elif lemma in SPECIAL_VERBS:
            leaf_tag = _SPECIAL_VERB_MAP.get(lemma, "[{0}]".format(lemma))

        leaf_tense = TENSES.intersection(tree.all_variants)
        leaf_tense = (
            ""
            if not leaf_tense
            else _TENSE_MAP.get(next(iter(leaf_tense)), "[{0}]".format(leaf_tense))
        )

        leaf_mood = MOODS.intersection(tree.all_variants)
        leaf_mood = (
            ""
            if not leaf_mood
            else _MOOD_MAP.get(next(iter(leaf_mood)), "[{0}]".format(leaf_mood))
        )

        if not frozenset(["sagnb", "bh", "lh", "lhþt"]).intersection(tree.all_variants):
            leaf_tag = "{stem}{tense}{mood}".format(
                stem=leaf_tag, tense=leaf_tense, mood=leaf_mood
            )
        elif "sagnb" in tree.all_variants:
            leaf_tag = leaf_tag + "N"
        elif "bh" in tree.all_variants:
            leaf_tag = leaf_tag + "I"
        elif "lh" in tree.all_variants:
            leaf_tag = leaf_tag[:1] + "AG"
        elif "lhþt" in tree.all_variants:
            leaf_tag = leaf_tag[:1] + "AN"

    elif leaf_tag in ("st", "stt"):
        leaf_tag = "C"

    elif leaf_tag == "fs":
        leaf_tag = "P"

    elif leaf_tag == "eo":
        leaf_tag = "ADV"

    elif leaf_tag == ("to", "töl"):
        if lemma == "einn":
            leaf_tag = "ONE"
        else:
            leaf_tag = "NUM"

            leaf_case = CASES.intersection(tree.variants)
            leaf_case = (
                "" if not leaf_case else _CASE_MAP.get(next(iter(leaf_case)), "")
            )
            leaf_case = "" if not leaf_case else "-" + leaf_case

            leaf_tag = "{stem}{case}".format(stem=leaf_tag, case=leaf_case)

    # print("{:>25s}{:>40s}".format(tree.text, tree.terminal_with_all_variants))
    lemma_suffix = "" if not affix_lemma else "-{0}".format(tree.lemma.lower())
    leaf = Tree(leaf_tag, ["{0}{1}".format(tree.text, lemma_suffix)])
    return [leaf] + extra_leaves


def tok_stream_to_null_tree(tok_stream):
    """ Constuct bare minimal NLTK.Tree from a token stream """
    root = Tree("", [Tree("IP-MAT", [Tree("X", [str(tok)]) for tok in tok_stream])])
    return root


def insert_id(tree, prefix, index):
    """ Insert ID element into NLTK.Tree object as child of first node,
        (... ...
             (ID {prefix},.{index}))
    """
    id_str = "{prefix},.{index}".format(prefix=prefix, index=index)
    tree.insert(1, Tree("ID", [id_str]))


def _reynir_sentence_to_nltk(sent):
    """ Transform a parsed sentence from Reynir _Sentence object to
        an NLTK.Tree parse tree """
    if sent.tree is not None:
        nltk_tree = reynir_tree_to_icepach(sent.tree)
    else:
        nltk_tree = tok_stream_to_null_tree([tok.txt for tok in sent._s if tok])
    return nltk_tree


def parse_single(text, affix_lemma=1, id_prefix=None, start_index=1):
    """ Parse a single sentence into mostly IcePaHC conformant parse trees
        using a transformation of reynir's parse trees """
    r = Reynir()
    sent = r.parse_single(text)
    nltk_tree = _reynir_sentence_to_nltk(sent)
    if id_prefix is not None:
        insert_id(nltk_tree, id_prefix, start_index)
    return nltk_tree


def parse_text(text, affix_lemma=1, id_prefix=None, start_index=1):
    """ Parse contiguous text into mostly IcePaHC conformant parse trees
        using a transformation of reynir's parse trees """
    r = Reynir()
    dd = r.parse(text)
    for idx, sent in enumerate(dd["sentences"]):
        nltk_tree = _reynir_sentence_to_nltk(sent)
        if id_prefix is not None:
            insert_id(nltk_tree, id_prefix, start_index + idx)
        yield nltk_tree

def annotate_file(in_path):
    print("Parsing file {0}".format(in_path))
    dirname = os.path.dirname(in_path)
    basename = os.path.basename(in_path)
    out_path = os.path.join(dirname, basename + ".parse")
    print("Output file is {0}".format(out_path))
    with open(in_path, "r") as in_handle:
        text = in_handle.read()
        with open(out_path, "w") as out_handle:
            for tree in parse_text(text, id_prefix=basename):
                formatted_trees = util._formatTree(tree)
                out_handle.write(formatted_trees)
                out_handle.write("\n")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser("Parse a text file of contiguous text into IcePaHC-like parse trees")

    def file_type_guard(path):
        if os.path.isfile(path):
            return path
        raise argparse.ArgumentError("Expected path to a file but got '{0}'".format(path))

    parser.add_argument(
        "-i",
        "--in_path",
        dest="in_path",
        type=file_type_guard,
        required=True,
        default="default",
        help="Path to input file with contiguous text",
    )

    args = parser.parse_args()
    annotate_file(args.in_path)


