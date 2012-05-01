# This Python file uses the following encoding: utf-8

"""
treedrawing.py
Created 2011/10/10
@author: Anton Karl Ingason
@author: Jana E. Beck
@author: Aaron Ecay
@copyright: GNU General Public License, v. 3 or (at your option) any later
version.  http://www.gnu.org/licenses/ This program is distributed in the hope
that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Lesser General Public License for more details.
@contact: jana.eliz.beck@gmail.com
"""

VERSION = "12.03-dev"

import os.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

import re
import sys, subprocess
import cherrypy, json
import nltk.tree as T
import argparse
import subprocess
from mako.template import Template
import util
import runpy
import time
import cherrypy.lib.caching

# JB: codecs necessary for Unicode Greek support
import codecs

from datetime import datetime

class Treedraw(object):
    # JB: added __init__ because was throwing AttributeError: 'Treedraw'
    # object has no attribute 'thefile'
    def __init__(self, args, shortfile):
        if len(args.psd) == 1:
            self.thefile = args.psd[0]
        else:
            raise Error("Annotald requires exactly one .psd file argument!")
        self.shortfile = shortfile
        self.options = args
        with open(self.thefile) as f:
            line = f.readline()
        versionRe = re.compile('^\( \(VERSION.*$', re.M)
        versionMatch = versionRe.search(line)
        self.versionCookie = ""
        if versionMatch:
            self.versionCookie = versionMatch.group()
        self.inidle = False
        self.justexited = False
        # TODO: this needs to come from an IO library, not ad hoc
        if util.queryVersionCookie(self.versionCookie, "deep"):
            self.conversionFn = util.deepTreeToHtml
            self.useMetadata = True
        else:
            self.conversionFn = util.treeToHtml
            self.useMetadata = False
        self.pythonOptions = runpy.run_path(args.pythonSettings)
        self.startTime = str(int(time.time()))

    _cp_config = { 'tools.staticdir.on'    : True,
                   'tools.staticdir.dir'   : CURRENT_DIR + '/data',
                   'tools.staticdir.index' : 'index.html',
                   'tools.caching.on'      : False
                   }

    def integrateTrees(self, trees):
        if self.options.oneTree:
            del self.trees[self.treeIndex]
            trees = trees.strip().split("\n\n")
            trees.reverse()
            for t in trees:
                self.trees.insert(self.treeIndex, t)
            return "\n\n".join(self.trees)
        else:
            return trees.strip()

    @cherrypy.expose
    def doSave(self, trees = None, startTime = None, force = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        if (startTime != self.startTime) and not (force == "true"):
            return json.dumps(dict(result = "failure",
                                   reason = "non-matching invocations of Annotald"))
        tosave = self.integrateTrees(trees)
        tosave = tosave.replace("-FLAG", "")
        try:
            print "self.thefile is: ", self.thefile
            os.rename(self.thefile, self.thefile + '.bak')
            # JB: using codecs here when in Mac OS X
            f = codecs.open(self.thefile, 'w', 'utf-8')
            f.write(self.versionCookie + "\n\n")
            f.write(tosave)
            f.close()
            cmdline = 'java -classpath ' + CURRENT_DIR + '/../CS_Tony_oct19.jar' + \
                ' csearch.CorpusSearch ' + CURRENT_DIR + '/nothing.q ' + \
                self.thefile
            # check_call throws on child error exit
            subprocess.check_call(cmdline.split(" "))
            os.rename(self.thefile + '.out', self.thefile)
            if self.options.timelog:
                with open("timelog.txt", "a") as timelog:
                    timelog.write(self.shortfile + ": Saved at " +
                                  str(datetime.now().isoformat()) + ".\n")
                    self.justexited = False
            return json.dumps(dict(result = "success"))
        except Exception as e:
            print "something went wrong: %s" % e
            return json.dumps(dict(result = "failure",
                                   reason = "server got an exception"))

    @cherrypy.expose
    def doValidate(self, trees = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        if not self.options.validator:
            return json.dumps(dict(result = "failure",
                                   reason = "No validator specified"))
        try:
            tovalidate = trees.strip()
            # If the validator script is inside the cwd, then it looks like an
            # unqualified path and it gets searched for in $PATH, instead of
            # in the cwd.  So here we make an absolute pathname to fix that.
            abs_validator = os.path.abspath(self.options.validator)
            validator = subprocess.Popen(abs_validator,
                                         stdin = subprocess.PIPE,
                                         stdout = subprocess.PIPE)
            utf8_writer = codecs.getwriter("utf-8")
            stream = utf8_writer(validator.stdin)
            stream.write(self.versionCookie + "\n\n")
            stream.write(tovalidate)
            validator.stdin.close()
            utf8_reader = codecs.getreader("utf-8")
            stream = utf8_reader(validator.stdout)
            validated = stream.read()
            validatedTrees = self.readTrees(None, text = validated)
            validatedHtml = self.treesToHtml(validatedTrees)

            return json.dumps(dict(result = "success",
                                   html = validatedHtml))
        except Exception as e:
            print "something went wrong: %s, %s" % (type(e), e)
            return json.dumps(dict(result = "failure",
                                   reason = str(e)))

    @cherrypy.expose
    def doIdle(self):
        if self.options.timelog:
            if self.inidle:
                with open("timelog.txt", "a") as timelog:
                    timelog.write(self.shortfile + ": Resumed at " +
                                  str(datetime.now().isoformat()) + ".\n")
                self.inidle = False
                self.justexited = False
            else:
                with open("timelog.txt", "a") as timelog:
                    timelog.write(self.shortfile + ": Idled at " +
                                  str(datetime.now().isoformat()) + ".\n")
                self.inidle = True
                self.justexited = False

    @cherrypy.expose
    def doExit(self):
        print "Exit message received"
        if self.options.timelog and not self.justexited:
            with open("timelog.txt", "a") as timelog:
                timelog.write(self.shortfile + ": Stopped at " +
                              str(datetime.now().isoformat()) + ".\n")
                self.justexited = True
        raise SystemExit(0)

    @cherrypy.expose
    def test(self):
        currentSettings = open(self.options.settings).read()
        currentTree = self.readTrees(None, text="""
( (IP-MAT (NP-SBJ (D This)) (BEP is) (NP-PRD (D a) (N test)))
  (ID test-01))
""")
        currentTree = self.treesToHtml(currentTree)

        return self.renderIndex(currentTree, currentSettings, True)

    @cherrypy.expose
    def testLoadTrees(self, trees = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        return json.dumps(dict(
                trees = self.treesToHtml(self.readTrees(None, text = trees))))

    def readTrees(self, fileName, text = None):
        if text:
            currentText = text
        else:
            f = open(fileName, 'r')
            # no longer using codecs to open the file, using .decode('utf-8')
            # instead when in Mac OS X
            currentText = f.read().decode('utf-8')

            if self.options.outFile:
                currentText = self.scrubText(currentText)

        # TODO(AWE): remove the one-line restriction
        versionRe = re.compile('^\( \(VERSION.*$', re.M)
        versionMatch = versionRe.search(currentText)
        self.versionCookie = ""
        if versionMatch:
            self.versionCookie = versionMatch.group()
        currentText = re.sub(versionRe, '', currentText)
        trees = currentText.strip().split("\n\n")

        return trees

    def treesToHtml(self, trees):
        useLemmata = util.queryVersionCookie(self.versionCookie, fmt = "dash")
        alltrees = '<div class="snode">'
        for tree in trees:
            tree = tree.strip()
            tree = tree.replace("<","&lt;")
            tree = tree.replace(">","&gt;")
            if not tree == "":
                nltk_tree = T.Tree(tree)
                alltrees = alltrees + self.conversionFn(nltk_tree, useLemmata)

        alltrees = alltrees + '</div>'
        return alltrees

    def scrubText(self, text):
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
            else:
                # Should never happen!
                pass

        if comment:
            raise Error("Unterminated comment in input file!")

        return output

    def renderIndex(self, currentTree, currentSettings, test):
        # The CURRENT_DIR below is a bit of a hack
        indexTemplate = Template(filename = CURRENT_DIR + "/data/html/index.mako",
                                 strict_undefined = True)

        return indexTemplate.render(annotaldVersion = VERSION,
                                    currentSettings = currentSettings,
                                    shortfile = self.shortfile,
                                    currentTree = currentTree,
                                    usetimelog = self.options.timelog,
                                    usemetadata = self.useMetadata,
                                    test = test,
                                    oneTree = self.options.oneTree,
                                    extraScripts = self.pythonOptions['extraJavascripts'],
                                    startTime = self.startTime,
                                    debugJs = self.pythonOptions['debugJs']
                                    )

    @cherrypy.expose
    def index(self):
        cherrypy.lib.caching.expires(0, force = True)
        currentSettings = open(self.options.settings).read()
        currentTrees = self.readTrees(self.thefile)
        if self.options.oneTree:
            self.trees = currentTrees
            self.treeIndex = 0
            currentHtml = self.treesToHtml([self.trees[self.treeIndex]])
        else:
            currentHtml = self.treesToHtml(currentTrees)

        return self.renderIndex(currentHtml, currentSettings, False)

    @cherrypy.expose
    def nextTree(self, trees = None, find = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        return self.advanceTree(1, trees, find)

    @cherrypy.expose
    def prevTree(self, trees = None, find = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        return self.advanceTree(-1, trees, find)

    def advanceTree(self, offset, trees = None, find = None):
        if not self.options.oneTree:
            return json.dumps(dict(result = 'failure',
                                   reason = 'Not in one-tree mode.'))
        else:
            oldindex = self.treeIndex
            self.integrateTrees(trees)
            while True:
                self.treeIndex = self.treeIndex + offset
                if self.treeIndex >= len(self.trees):
                    self.treeIndex = oldindex
                    return json.dumps(dict(result = 'failure',
                                       reason = 'At end of file.'))
                elif self.treeIndex < 0:
                    self.treeIndex = oldindex
                    return json.dumps(dict(result = 'failure',
                                           reason = 'At beginning of file.'))
                if not find:
                    # my kingdom for a do...while loop
                    break
                if find in self.trees[self.treeIndex]:
                    break

            return json.dumps(
                dict(result = 'success',
                     tree = self.treesToHtml([self.trees[self.treeIndex]])))



#index.exposed = True
parser = argparse.ArgumentParser(usage = "%prog [options] file.psd",
                                 version = "Annotald " + VERSION,
                                 conflict_handler = "resolve")
parser.add_argument("-s", "--settings", action = "store", dest = "settings",
                    help = "path to settings.js file")
parser.add_argument("-v", "--validator", action = "store", dest = "validator",
                    help = "path to a validation script")
parser.add_argument("-p", "--port", action = "store",
                    type = int, dest = "port",
                    help = "port to run server on")
parser.add_argument("-o", "--out", dest = "outFile", action = "store_true",
                    help = "boolean for identifying CorpusSearch output files")
parser.add_argument("-q", "--quiet", dest = "timelog", action = "store_false",
                    help = "boolean for specifying whether you'd like to \
silence the timelogging")
parser.add_argument("-S", "--python-settings", dest = "pythonSettings",
                    action = "store", help = "path to Python settings file")
parser.add_argument("-1", "--one-tree-mode", dest = "oneTree",
                     action = "store_true",
                     help = "start Annotald in one-tree mode")
parser.add_argument("psd", nargs='+')
parser.set_defaults(port = 8080,
                    settings = sys.path[0] + "/settings.js",
                    pythonSettings = sys.path[0] + "/settings.py",
                    oneTree = False)
args = parser.parse_args()
shortfile = re.search("^.*?([0-9A-Za-z\-\.]*)$", args.psd[0]).group(1)


if args.timelog:
    with open("timelog.txt", "a") as timelog:
        timelog.write(shortfile + ": Started at " + \
                          str(datetime.now().isoformat()) + ".\n")

cherrypy.config.update({'server.socket_port': args.port})

cherrypy.quickstart(Treedraw(args, shortfile))
