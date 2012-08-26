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

# TODO: catch C-c exit and log prog exit

VERSION = "12.03-dev"

# Python standard library
import codecs
from datetime import datetime
import json
import os
import pkg_resources
import re
import runpy
import shelve
import subprocess
import sys
import time
import traceback

# Part of the standard library as of 2.7
import argparse
try:
    import win32process
except:
    pass

# External libraries
import cherrypy
import cherrypy.lib.caching
from mako.template import Template
import nltk.tree as T

# Local libraries
import util

class Treedraw(object):
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
        self.eventLog = None    # Will be initialized when needed

        # TODO: this needs to come from an IO library, not ad hoc
        if util.queryVersionCookie(self.versionCookie, "FORMAT") == "deep":
            self.conversionFn = util.deepTreeToHtml
            self.useMetadata = True
        else:
            self.conversionFn = util.treeToHtml
            self.useMetadata = False
        self.showingPartialFile = self.options.oneTree or \
                                  self.options.numTrees > 1
        # TODO: initialize vars with deafult values, so that if they are
        # not set in the file nothing bad happens
        self.pythonOptions = runpy.run_path(args.pythonSettings,
                                            init_globals = {
                                                'extraJavascripts': [],
                                                'debugJs': False,
                                                'validators': {},
                                                'colorCSS': False,
                                                # TODO: this masks a bug
                                                # in jana's branch
                                                'colorCSSPath': "/dev/null",
                                                'corpusSearchValidate':
                                                util.corpusSearchValidate
                                            })
        cherrypy.engine.autoreload.files.add(args.pythonSettings)

    _cp_config = { 'tools.staticdir.on'    : True,
                   'tools.staticdir.dir'   :
                   pkg_resources.resource_filename("annotald", "data/"),
                   'tools.staticdir.index' : 'index.html',
                   'tools.caching.on'      : False
                   }
    
    cherrypy.config.update({ "server.logToScreen" : False })
    cherrypy.config.update({'log.screen': False})    
    cherrypy.config.update({ "environment": "embedded" })

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
                                   reasonCode = 1,
                                   startTime = self.startTime))
        tosave = self.integrateTrees(trees)
        tosave = tosave.replace("-FLAG", "")
        try:
            print "self.thefile is: ", self.thefile
            util.writeTreesToFile(self.versionCookie, trees, self.thefile)
            self.doLogEvent(json.dumps({'type': "save"}))
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
                # TODO: what is going on here?  what is shift? we should
                # be able to just call integratetrees unconditionally
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

            self.doLogEvent(json.dumps({'type': "validate",
                                        'validator': validator}))
            return json.dumps(dict(result = "success",
                                   html = validatedHtml))
        except Exception as e:
            print "something went wrong: %s, %s" % (type(e), e)
            traceback.print_exc()
            return json.dumps(dict(result = "failure",
                                   reason = str(e)))

    @cherrypy.expose
    def doLogEvent(self, eventData):
        eventData = json.loads(eventData) # TODO: so fucking asinine
        if not self.options.timelog:
            return
        if not self.eventLog:
            self.eventLog = shelve.open("annotaldLog.shelve")
        evtTime = time.time()
        # while self.eventLog[str(evtTime)]:
        #     # TODO: this seems like not the right answer...
        #     time.sleep(0.01)
        #     evtTime = time.time()
        eventData['filename'] = self.options.psd[0]
        self.eventLog[str(evtTime)] = eventData
        self.eventLog.sync()
        # TODO: a backup, in case of corruption...remove once confident
        with open("annotaldLog.txt", "a") as f:
            f.write(json.dumps(eventData))
        return ""

    @cherrypy.expose
    def doExit(self):
        print "Exit message received"
        self.doLogEvent(json.dumps({'type': "program-exit"}))
        time.sleep(3)           # Wait for log events from server
        if self.eventLog:
            self.eventLog.close()
            self.eventLog = None
        #forceful exit to make up for lack of proper thread management
        os._exit(0)
        #raise SystemExit(0)

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

    @cherrypy.expose
    def logs(self, **formData):
        import logs
        if not self.options.timelog:
            return
        if not self.eventLog:
            self.eventLog = shelve.open("annotaldLog.shelve")
        return logs.plotPage(self.eventLog, **formData)

    def readTrees(self, fileName, text = None):
        if text:
            currentText = text
        else:
            f = open(fileName, 'r')
            # no longer using codecs to open the file, using .decode('utf-8')
            # instead when in Mac OS X
            currentText = f.read().decode('utf-8')

            if self.options.outFile:
                currentText = util.scrubText(currentText)

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
        version = util.queryVersionCookie(self.versionCookie, "FORMAT")
        alltrees = '<div class="snode">'
        for tree in trees:
            tree = tree.strip()
            tree = tree.replace("<","&lt;")
            tree = tree.replace(">","&gt;")
            if not tree == "":
                nltk_tree = T.Tree(tree)
                alltrees = alltrees + self.conversionFn(nltk_tree, version)

        alltrees = alltrees + '</div>'
        return alltrees

    def renderIndex(self, currentTree, currentSettings, test):
        indexTemplate = Template(
            filename = pkg_resources.resource_filename(
                "annotald", "/data/html/index.mako"),
            strict_undefined = True)

        validators = {}

        try:
            validators = self.pythonOptions['validators']
        except KeyError:
            pass

        useValidator = len(validators) > 0
        validatorNames = validators.keys()

        if self.options.oneTree:
            ti = "1 out of " + str(len(self.trees))
        else:
            ti = ""

        return indexTemplate.render(annotaldVersion = VERSION,
                                    currentSettings = currentSettings,
                                    shortfile = self.shortfile,
                                    currentTree = currentTree,
                                    usetimelog = self.options.timelog,
                                    usemetadata = self.useMetadata,
                                    test = test,
                                    partialFile = self.showingPartialFile,
                                    extraScripts = self.pythonOptions['extraJavascripts'],
                                    colorCSS = self.pythonOptions['colorCSS'],
                                    colorPath = self.pythonOptions['colorCSSPath'],
                                    startTime = self.startTime,
                                    debugJs = self.pythonOptions['debugJs'],
                                    useValidator = useValidator,
                                    validators = validatorNames,
                                    treeIndexStatement = ti,
                                    idle = "Editing."
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

        self.doLogEvent(json.dumps({'type': "page-load"}))
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
                         self.treeIndexStart:self.treeIndexEnd]),
                     treeIndexStart = self.treeIndexStart,
                     treeIndexEnd = self.treeIndexEnd,
                     totalTrees = len(self.trees)))

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

    parser.add_argument("psd", nargs='+') # TODO: nargs = 1?

    parser.set_defaults(port = 8080,
                        settings = pkg_resources.resource_filename(
                            "annotald", "settings.js"),
                        pythonSettings = pkg_resources.resource_filename(
                            "annotald", "/settings.py"),
                        oneTree = False,
                        numTrees = 1)
    args = parser.parse_args(argv)
    shortfile = re.search("^.*?([0-9A-Za-z\-\.]*)$", args.psd[0]).group(1)

    if args.timelog:
        # TODO: code duplicated... :(
        eventLog = shelve.open("annotaldLog.shelve")
        evtTime = time.time()
        eventData = { 'type': "program-start" }
        # while eventLog[str(evtTime)]:
        #     # TODO: this seems like not the right answer...
        #     time.sleep(0.01)
        #     evtTime = time.time()
        eventData['filename'] = args.psd[0]
        eventLog[str(evtTime)] = eventData
        eventLog.close()
        with open("annotaldLog.txt", "a") as f:
            f.write(json.dumps(eventData) + "\n")

    cherrypy.config.update({'server.socket_port': args.port})

    treedraw = Treedraw(args, shortfile)
    cherrypy.quickstart(treedraw)

if __name__ == '__main__':
    _main(sys.argv[1:])
