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

    _cp_config = { 'tools.staticdir.on'    : True,
                   'tools.staticdir.dir'   : CURRENT_DIR + '/data',
                   'tools.staticdir.index' : 'index.html',
                   'tools.caching.on'      : False
                   }

    @cherrypy.expose
    def doSave(self, trees = None):
        try:
            print "self.thefile is: ", self.thefile
            os.rename(self.thefile, self.thefile + '.bak')
            # JB: using codecs here when in Mac OS X
            f = codecs.open(self.thefile, 'w', 'utf-8')
            f.write(self.versionCookie + "\n\n")
            tosave = trees.strip().replace("-FLAG", "")
            f.write(tosave)
            f.close()
            cmdline = 'java -classpath ' + CURRENT_DIR + '/../CS_Tony_oct19.jar' + \
                ' csearch.CorpusSearch ' + CURRENT_DIR + '/nothing.q ' + \
                self.thefile
            # check_call throws on child error exit
            subprocess.check_call(cmdline.split(" "))
            os.rename(self.thefile + '.out', self.thefile)
            cherrypy.response.headers['Content-Type'] = 'application/json'
            if self.options.timelog:
                with open("timelog.txt", "a") as timelog:
                    timelog.write(self.shortfile + ": Saved at " +
                                  str(datetime.now().isoformat()) + ".\n")
                    self.justexited = False
            return json.dumps(dict(result = "success"))
        except Exception as e:
            print "something went wrong: %s" % e
            cherrypy.response.headers['Content-Type'] = 'application/json'
            return json.dumps(dict(result = "failure"))

    @cherrypy.expose
    def doValidate(self, trees = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        if not self.options.validator:
            return json.dumps(dict(result = "no-validator"))

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
            validatedHtml = self.loadPsd(None, text = validated)

            return json.dumps(dict(result = "success",
                                   html = validatedHtml))
        except Exception as e:
            print "something went wrong: %s, %s" % (type(e), e)
            return json.dumps(dict(result = "failure"))

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
        currentTree = self.loadPsd(None, text="""
( (IP-MAT (NP-SBJ (D This)) (BEP is) (NP-PRD (D a) (N test)))
  (ID test-01))
""")

        # The CURRENT_DIR below is a bit of a hack
        indexTemplate = Template(filename = CURRENT_DIR + "/data/html/index.mako",
                                 strict_undefined = True)

        # Chicken and egg: treedrawing.js must go before the
        # currentSettings, so that the functions there are defined for
        # currentSettings.  But currentSettings in turn must define some
        # functions for treedrawing.contextMenu.js.
        return indexTemplate.render(annotaldVersion = VERSION,
                                    currentSettings = currentSettings,
                                    shortfile = self.shortfile,
                                    currentTree = currentTree,
                                    usetimelog = self.args.timelog,
                                    usemetadata = self.useMetadata,
                                    test = True)

    @cherrypy.expose
    def testLoadTrees(self, trees = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        return json.dumps(dict(trees = self.loadPsd(None, text = trees)))

    def loadPsd(self, fileName, text = None):
        # TODO(AWE): remove
        # self.thefile = fileName

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
        useLemmata = util.queryVersionCookie(self.versionCookie, fmt = "dash")
        currentText = re.sub(versionRe, '', currentText)
        currentText = currentText.replace("<","&lt;")
        currentText = currentText.replace(">","&gt;")
        trees = currentText.split("\n\n")

        alltrees = '<div class="snode">'
        for tree in trees:
            tree = tree.strip()
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

    @cherrypy.expose
    def index(self):
        currentSettings = open(self.options.settings).read()
        currentTree = self.loadPsd(self.thefile)

        # The CURRENT_DIR below is a bit of a hack
        indexTemplate = Template(filename = CURRENT_DIR + "/data/html/index.mako",
                                 strict_undefined = True)

        # Chicken and egg: treedrawing.js must go before the
        # currentSettings, so that the functions there are defined for
        # currentSettings.  But currentSettings in turn must define some
        # functions for treedrawing.contextMenu.js.
        return indexTemplate.render(annotaldVersion = VERSION,
                                    currentSettings = currentSettings,
                                    shortfile = self.shortfile,
                                    currentTree = currentTree,
                                    usetimelog = self.args.timelog,
                                    usemetadata = self.useMetadata,
                                    test = False)


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
parser.add_argument("psd", nargs='+')
parser.set_defaults(port = 8080,
                    settings = sys.path[0] + "/settings.js",
                    pythonSettings = sys.path[0] + "/settings.py")
args = parser.parse_args()
shortfile = re.search("^.*?([0-9A-Za-z\-\.]*)$", args.psd[0]).group(1)


if args.timelog:
    with open("timelog.txt", "a") as timelog:
        timelog.write(shortfile + ": Started at " + \
                          str(datetime.now().isoformat()) + ".\n")

cherrypy.config.update({'server.socket_port': args.port})

cherrypy.quickstart(Treedraw(args, shortfile))
