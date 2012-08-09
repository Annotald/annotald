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
# CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

import re
import sys, subprocess
import cherrypy, json
import nltk.tree as T
import argparse
from mako.template import Template
import util
import runpy
import time
import cherrypy.lib.caching
import traceback

try:
    import win32process
except:
    pass

# JB: codecs necessary for Unicode Greek support
import codecs

from datetime import datetime

class Treedraw(object):
    
    pythonOptions = {'extraJavascripts' : [],
                 'debugJs' : False,
                 'validators' : {} }
    
    # JB: added __init__ because was throwing AttributeError: 'Treedraw'
    # object has no attribute 'thefile'
    def __init__(self, args, shortfile):
        if len(args.psd) == 1:
            self.thefile = args.psd[0]
        else:
            raise Exception("Annotald requires exactly one .psd file argument!")
        self.shortfile = shortfile
        self.options = args
        with open(self.thefile) as f:
            line = f.readline()
        versionRe = re.compile('^\( \(VERSION.*$', re.M)
        versionMatch = versionRe.search(line)
        self.versionCookie = ""
        if versionMatch:
            self.versionCookie = versionMatch.group()

        # TODO: after a respawn these will not be right
        self.inidle = False
        self.justexited = False
        self.startTime = str(int(time.time()))

        # TODO: this needs to come from an IO library, not ad hoc
        if util.queryVersionCookie(self.versionCookie, "FORMAT") == "deep":
            self.conversionFn = util.deepTreeToHtml
            self.useMetadata = True
        else:
            self.conversionFn = util.treeToHtml
            self.useMetadata = False
        self.showingPartialFile = self.options.oneTree or \
                                  self.options.numTrees > 1
        #self.pythonOptions = runpy.run_path(args.pythonSettings)
        cherrypy.engine.autoreload.files.add(args.pythonSettings)

    _cp_config = { 'tools.staticdir.on'    : True,
                   'tools.staticdir.dir'   : util.get_main_dir() + '/data',
                   'tools.staticdir.index' : 'index.html',
                   'tools.caching.on'      : False
                   }

    def integrateTrees(self, trees):
        if self.showingPartialFile:
            trees = trees.strip().split("\n\n")
            self.trees[self.treeIndexStart:self.treeIndexEnd] = trees
            self.treeIndexEnd = self.treeIndexStart + len(trees)
            return "\n\n".join(self.trees)
        else:
            return trees.strip()

    @cherrypy.expose
    def doSave(self, trees = None, startTime = None, force = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        if (startTime != self.startTime) and not (force == "true"):
            return json.dumps(dict(result = "failure",
                                   reason = "non-matching invocations of Annotald",
                                   reasonCode = 1))
        tosave = self.integrateTrees(trees)
        tosave = tosave.replace("-FLAG", "")
        try:
            print "self.thefile is: ", self.thefile
            if os.name == "nt" and os.path.isfile(self.thefile + '.bak'):                               
                os.unlink(self.thefile + '.bak')

            os.rename(self.thefile, self.thefile + '.bak')
            # JB: using codecs here when in Mac OS X
            f = codecs.open(self.thefile, 'w', 'utf-8')
            f.write(self.versionCookie + "\n\n")
            f.write(tosave)
            f.close()
            cmdline = 'java -classpath ' + util.get_main_dir() + '/CS_Tony_oct19.jar' + \
                ' csearch.CorpusSearch ' + util.get_main_dir() + '/nothing.q ' + \
                self.thefile
            # add startupinfo for win
            #if os.name == "nt":
            #startupinfo = subprocess.STARTUPINFO()
            #startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                # check_call throws on child error exit
            #subprocess.STARTF_USESHOWWINDOW = 1
            if os.name == "nt":
                subprocess.check_call(cmdline.split(" "),creationflags = win32process.CREATE_NO_WINDOW)
            else:
                subprocess.check_call(cmdline.split(" "))
            #else:    
            #    subprocess.check_call(cmdline.split(" "))
                                
            if os.name == "nt":
                # Windows cannot do atomic file renames
                os.unlink(self.thefile)
            os.rename(self.thefile + '.out', self.thefile)
            if self.options.timelog:
                with open("timelog.txt", "a") as timelog:
                    timelog.write(self.shortfile + ": Saved at " +
                                  str(datetime.now().isoformat()) + ".\n")
                    self.justexited = False
            return json.dumps(dict(result = "success"))
        except Exception as e:
            print "something went wrong: %s" % e
            traceback.print_exc()
            return json.dumps(dict(result = "failure",
                                   reason = "server got an exception"))

    @cherrypy.expose
    def doValidate(self, trees = None, validator = None, shift = None):
        # TODO: don't dump the current doc's trees if something goes wrong
        # during validate
        cherrypy.response.headers['Content-Type'] = 'application/json'
        try:
            if self.showingPartialFile and shift == "true":
                tovalidate = self.integrateTrees(trees)
            else:
                tovalidate = trees.strip()
            validatedTrees = self.pythonOptions['validators'][validator](
                self.versionCookie, tovalidate
                ).split("\n\n")

            if self.showingPartialFile and shift == "true":
                self.trees = validatedTrees
                validatedHtml = self.treesToHtml(self.trees[
                    self.treeIndexStart:self.treeIndexEnd])
            else:
                validatedHtml = self.treesToHtml(validatedTrees)

            return json.dumps(dict(result = "success",
                                   html = validatedHtml))
        except Exception as e:
            print "something went wrong: %s, %s" % (type(e), e)
            traceback.print_exc()
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
        # TODO: don't set this every time...
        if versionMatch:
            self.versionCookie = versionMatch.group()
        currentText = re.sub(versionRe, '', currentText)
        trees = currentText.strip().split("\n\n")

        return trees

    def treesToHtml(self, trees):
        useLemmata = util.queryVersionCookie(self.versionCookie, "FORMAT") \
                     == "dash"
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
            raise Exception("Unterminated comment in input file!")

        return output

    def renderIndex(self, currentTree, currentSettings, test):
        # The CURRENT_DIR below is a bit of a hack
        indexTemplate = Template(filename = util.get_main_dir() + "/data/html/index.mako",
                                 strict_undefined = True)

        validators = {}

        try:
            validators = self.pythonOptions['validators']
        except KeyError:
            pass

        useValidator = len(validators) > 0
        validatorNames = validators.keys()

        return indexTemplate.render(annotaldVersion = VERSION,
                                    currentSettings = currentSettings,
                                    shortfile = self.shortfile,
                                    currentTree = currentTree,
                                    usetimelog = self.options.timelog,
                                    usemetadata = self.useMetadata,
                                    test = test,
                                    partialFile = self.showingPartialFile,
                                    extraScripts = self.pythonOptions['extraJavascripts'],
                                    startTime = self.startTime,
                                    debugJs = self.pythonOptions['debugJs'],
                                    useValidator = useValidator,
                                    validators = validatorNames
                                    )

    @cherrypy.expose
    def index(self):
        cherrypy.lib.caching.expires(0, force = True)
        currentSettings = open(self.options.settings).read()
        currentTrees = self.readTrees(self.thefile)
        if self.showingPartialFile:
            self.trees = currentTrees
            self.treeIndexStart = 0
            self.treeIndexEnd = self.options.numTrees
            currentHtml = self.treesToHtml(
                self.trees[self.treeIndexStart:self.treeIndexEnd])
        else:
            currentHtml = self.treesToHtml(currentTrees)

        return self.renderIndex(currentHtml, currentSettings, False)

    @cherrypy.expose
    def advanceTree(self, offset = None, trees = None, find = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        offset = int(offset)
        if not self.showingPartialFile:
            return json.dumps(dict(result = 'failure',
                                   reason = 'Not in partial-file mode.'))
        else:
            oldindex = (self.treeIndexStart, self.treeIndexEnd)
            self.integrateTrees(trees)
            while True:
                self.treeIndexStart = self.treeIndexStart + \
                                      offset * self.options.numTrees
                self.treeIndexEnd = self.treeIndexStart + \
                                    self.options.numTrees
                if self.treeIndexEnd >= len(self.trees):
                    self.treeIndexEnd = len(self.trees)
                if self.treeIndexStart >= len(self.trees):
                    self.treeIndexStart, self.treeIndexEnd = oldindex
                    return json.dumps(dict(result = 'failure',
                                       reason = 'At end of file.'))
                elif self.treeIndexStart < 0:
                    self.treeIndexStart, self.treeIndexEnd = oldindex
                    return json.dumps(dict(result = 'failure',
                                           reason = 'At beginning of file.'))
                if not find:
                    # my kingdom for a do...while loop
                    break
                if find in "".join(self.trees[
                        self.treeIndexStart:self.treeIndexEnd]):
                    break

            return json.dumps(
                dict(result = 'success',
                     tree = self.treesToHtml(self.trees[
                         self.treeIndexStart:self.treeIndexEnd])))

def _main(argv):
    parser = argparse.ArgumentParser(description = "A program for annotating parsed corpora",
                                     version = "Annotald " + VERSION,
                                     conflict_handler = "resolve")
    parser.add_argument("-s", "--settings", action = "store", dest = "settings",
                        help = "path to settings.js file")
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
    # TODO: this will not be handled properly if the arg is greater than the
    # number of trees in the file.
    parser.add_argument("-n", "--n-trees-mode", dest = "numTrees",
                         type = int, action = "store",
                         help = "number of trees to show at a time")
    parser.add_argument("psd", nargs='+')
    parser.set_defaults(port = 8080,
                        settings = sys.path[0] + "/settings.js",
                        pythonSettings = sys.path[0] + "/settings.py",
                        oneTree = False,
                        numTrees = 1)
    
    args = parser.parse_args(argv)
    shortfile = re.search("^.*?([0-9A-Za-z\-\.]*)$", args.psd[0]).group(1)
    
    
    if args.timelog:
        with open("timelog.txt", "a") as timelog:
            timelog.write(shortfile + ": Started at " + \
                              str(datetime.now().isoformat()) + ".\n")
    
    cherrypy.config.update({'server.socket_port': args.port})
    
    treedraw = Treedraw(args, shortfile)
    cherrypy.quickstart(treedraw)
    print('test')
    
if __name__ == '__main__':
    _main(sys.argv[1:])


