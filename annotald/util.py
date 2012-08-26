# This Python file uses the following encoding: utf-8
# This file copyright © 2012 by Aaron Ecay

# This file is part of Annotald.
#
# Annotald is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#
# Annotald is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
# details.
#
# You should have received a copy of the GNU General Public License along with
# Annotald.  If not, see <http://www.gnu.org/licenses/>.

# TODO(AWE): many of these functions should be moved into Lovett, once it is
# public.

# TODO: docstrings

# TODO: subclass nltk.tree to allow dictionary-like subscripting???

# TODO: add a file-saving test that really exercises the unicode fns

# Time travel
from __future__ import unicode_literals

# Standard library
import codecs
import hashlib
import json
import os
import pkg_resources
import re
import subprocess
import sys
import tempfile

# External libraries
import nltk.tree as T

# Conditional imports
if os.name == "nt": # pragma: no cover
    import win32process

class AnnotaldException(Exception):
    pass

def safe_json(dict):
    j = json.dumps(dict)
    return j.replace('"', "&#34;")

def queryVersionCookie(tree, key):
    if tree == "" or not tree:
        return None
    t = T.Tree(tree)[0]
    if t.node != "VERSION":
        return
    return _queryVersionCookieInner(t, key)

def _queryVersionCookieInner(tree, key):
    # TODO: maybe we should just convert the version cookie into a dict
    # and use that
    keys = key.split(".")
    f = filter(lambda n: n.node == keys[0], tree)
    if len(f) == 1:
        if len(keys) == 1:
            return f[0][0]
        else:
            return _queryVersionCookieInner(f[0], ".".join(keys[1:]))
    else:
        return None

def treeToHtml(tree, version, extra_data = None):
    if isinstance(tree[0], basestring):
        # Leaf node
        if len(tree) > 1:
            raise AnnotaldException("Leaf node with more than one " +
                                    "daughter!: %s" % tree)
        cssClass = re.sub("[-=][0-9]+$", "", tree.node)
        res = '<div class="snode ' + cssClass + '">' + tree.node + \
              '<span class="wnode">'
        temp = tree[0].split("-")
        if version == "dash" and len(temp) > 1 and tree.node != "CODE":
            temp = tree[0].split("-")
            lemma = temp.pop()
            word = "-".join(temp)
            if lemma.isdigit() and tree.node != "NUM":
                # If the lemma is all numbers, it is probably a trace index.
                # Do nothing special with it.
                res += word + "-" + lemma
            else:
                res += word + '<span class="lemma">-' + lemma + '</span>'
        else:
            res += tree[0]
        res += '</span></div>'
        return res
    elif tree.node == "":
        # Root node
        sisters = []
        real_root = None
        for daughter in tree:
            if daughter.node == "ID" or daughter.node == "METADATA":
                # TODO(AWE): conditional is non-portable
                sisters.append(daughter)
            else:
                if real_root:
                    raise AnnotaldException(
                        "root tree has too many/unknown daughters!: %s" % tree)
                else:
                    real_root = daughter
        xtra_data = sisters
        return treeToHtml(real_root, version, xtra_data)
    else:
        cssClass = re.sub("[-=][0-9]+$", "", tree.node)
        res = '<div class="snode ' + cssClass + '"'
        if extra_data:
            res += ' data-metadata="' + safe_json(nodeListToDict(extra_data)) + '"'
        res += '>' + tree.node + ' '
        res += "\n".join(map(lambda x: treeToHtml(x, version), tree))
        res += "</div>"
        return res

def labelFromLabelAndMetadata(label, metadata):
    # TODO: Remove indices, allow customizable "dash tags" (phantom), indices,
    # etc.
    return label

def cssClassFromLabel(label):
    # TODO
    return label

def orthoFromTree(tree):
    orthoNodes = [t for t in tree if t.node == "ORTHO"]
    if len(orthoNodes) == 1:
        return orthoNodes[0][0]
    metadata = [t for t in tree if t.node == "META"]
    if len(metadata) == 1:
        metadata = metadata[0]
        altOrthoNode = [t for t in metadata if t.node == "ALT-ORTHO"]
        if len(altOrthoNode) == 1:
            return altOrthoNode[0][0]
    return "XXX-ORTHO-UNKNOWN"

def nodeListToDict(nodes):
    return metadataToDict(T.Tree("FOO", nodes))

def metadataToDict(metadata):
    d = {}
    for datum in metadata:
        if isinstance(datum[0], T.Tree):
            d[datum.node] = metadataToDict(datum)
        else:
            d[datum.node] = datum[0]
    return d

# TODO: unify the calling convention of these fns, so we don't need *args
def deepTreeToHtml(tree, *args):
    if tree.node == "META":
        # Metadata nodes have an empty string as html representation.
        return ""
    isLeaf = True
    metadata = None
    isSimpleLeaf = False
    if isinstance(tree[0], basestring):
        isSimpleLeaf = True
    else:
        for t in tree:
            if t.node == "META":
                # Find this tree's metadata; we will need it later
                metadata = t
            elif isinstance(t[0], T.Tree):
                # if this tree has branching daughters, other than META,
                # then it is not a leaf.
                isLeaf = False

    # Find out what to call this node
    theLabel = labelFromLabelAndMetadata(tree.node, metadata)
    # Start building the result
    res = '<div class="snode ' + \
        cssClassFromLabel(theLabel) + '"'
    if metadata:
        res += ' data-metadata="' + safe_json(metadataToDict(metadata)) + '"'
    res += '>' + theLabel + ' '
    if isSimpleLeaf:
        res += '<span class="wnode">' + \
            tree[0] + '</span>'
    elif isLeaf:
        res += '<span class="wnode">' + \
            orthoFromTree(tree) + '</span>'
    else:
        leafHtml = "".join(map(lambda x: deepTreeToHtml(x), tree))
        res += leafHtml
    res += '</div>'
    return res

def writeTreesToFile(meta, trees, filename):
    trees = trees.split("\n\n")
    trees = filter(lambda x: x != "", trees)
    trees = map(T.Tree, trees)
    trees = map(_formatTree, trees)
    with open(filename, "w") as f:
        if meta and meta != "":
            f.write(meta + "\n\n")
        f.write("\n\n".join(trees))

def _formatTree(tree, indent = 0):
    if len(tree) == 1 and isinstance(tree[0], basestring):
        # This is a leaf node
        return u"(%s %s)" % (unicode(tree.node), unicode(tree[0]))
    else:
        s = u"(%s " % (unicode(tree.node))
        l = len(s)
        leaves = (u"\n" + u" " * (indent + l)).join(
            map(lambda x: _formatTree(x, indent + l), tree))
        return u"%s%s%s" % (s, leaves, u")")

def corpusSearchValidate(queryFile): # pragma: no cover
    # TODO: how to test?
    def corpusSearchValidateInner(version, trees):
        tf = tempfile.NamedTemporaryFile(delete = False)
        name = tf.name
        tf.write(trees)
        tf.close()
        # TODO: this will break when merging anton's branch
        cmdline = 'java -classpath ' + \
                  pkg_resoureces.resource_filename(
                      "annotald", 'CS_Tony_oct19.jar') + \
                  ' csearch.CorpusSearch ' + queryFile + ' ' + name + \
                  ' -out ' + name + '.out'
        # make sure console is hidden in windows py2exe version
        if os.name == "nt":
            subprocess.check_call(cmdline.split(" "),
                                  creationflags = win32process.CREATE_NO_WINDOW)
        else:
            subprocess.check_call(cmdline.split(" "))

        with open(name + ".out") as f:
            newtrees = f.read()
        newtrees = scrubText(newtrees)
        os.unlink(name)
        os.unlink(name + ".out")

        return newtrees

    return corpusSearchValidateInner

def scrubText(text):
    output = ""
    comment = False
    for line in text.split("\n"):
        if line.startswith("/*") or line.startswith("/~*"):
            comment = True
        elif line.startswith("<+"):
            # Ignore parser-mode comments
            pass
        elif not comment:
            output = output + line + "\n"
        elif line.startswith("*/") or line.startswith("*~/"):
            comment = False
        else: # pragma: no cover
            # Should never happen!
            pass

    if comment:
        raise AnnotaldException("Unterminated comment in input file!")

    return output

# TODO: is this needed?
def get_main_dir():
   if main_is_frozen():
       return os.path.dirname(sys.executable)
   return os.path.dirname(__file__)

class Blackhole(object):
    softspace = 0
    def write(self, text):
        pass
