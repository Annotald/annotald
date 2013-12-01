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
@contact: aaronecay@gmail.com
"""

from __future__ import unicode_literals

# TODO: catch C-c exit and log prog exit

import annotald

VERSION = annotald.__version__

# Python standard library
import codecs
import getpass
import json
import os
import pkg_resources
import re
import runpy
import shelve
import sys
import time
import traceback

# Part of the standard library as of 2.7
import argparse

# External libraries
import cherrypy
import cherrypy.lib.caching
from mako.template import Template
import nltk.tree as T

# Local libraries
import util


class Treedraw(object):
    def __init__(self, args, shortfile):
        self.thefile = args.psd[0]
        self.shortfile = shortfile
        self.options = args
        self.readVersionCookie(self.thefile)

        # TODO: after a respawn these will not be right
        self.inidle = False
        self.justexited = False
        self.startTime = str(int(time.time()))
        self.eventLog = None    # Will be initialized when needed

        if util.queryVersionCookie(self.versionCookie, "FORMAT") == "deep":
            self.conversionFn = util.deepTreeToHtml
            self.useMetadata = True
        else:
            self.conversionFn = util.treeToHtml
            self.useMetadata = False
        self.showingPartialFile = self.options.oneTree or \
                                  self.options.numTrees > 1
        self.pythonOptions = {'extraJavascripts': [],
                              'debugJs': False,
                              'validators': {},
                              'colorCSS': False,
                              # TODO: this masks a bug in jana's branch
                              'colorCSSPath': "/dev/null",
                              'corpusSearchValidate':
                              util.corpusSearchValidate,
                              'rewriteIndices': True,
                              'serverMode': True}
        if args.pythonSettings is not None:
            if sys.version_info[0] == 2 and sys.version_info[1] < 7 or \
               sys.version_info[0] == 3 and sys.version_info[1] < 2:
                print ("Specifying python settings requires Python v." +
                       ">2.7 or >3.2.")
                sys.exit(1)
            else:
                self.pythonOptions = runpy.run_path(args.pythonSettings,
                                                    init_globals =
                                                    self.pythonOptions)
        cherrypy.engine.autoreload.files.add(args.pythonSettings)

        self.doLogEvent(json.dumps({'type': "program-start",
                                    'filename': self.thefile}))

    _cp_config = { 'tools.staticdir.on'    : True,
                   'tools.staticdir.dir'   :
                   pkg_resources.resource_filename("annotald", "data/"),
                   'tools.staticdir.index' : 'index.html',
                   'tools.caching.on'      : False
                   }
    if os.name == "nt":
        cherrypy.config.update({ "server.logToScreen" : False })
        cherrypy.config.update({ 'log.screen'         : False})
        # TODO: why do we do this? if all it does is remove the bt from the
        # browser, it isn't what we want.
        cherrypy.config.update({ "environment"        : "embedded" })

    def integrateTrees(self, trees):
        trees = trees.strip().split("\n\n")
        if self.showingPartialFile:
            self.trees[self.treeIndexStart:self.treeIndexEnd] = trees
            self.treeIndexEnd = self.treeIndexStart + len(trees)
        else:
            # TODO: this case is mildly inefficent, since we strip and then
            # join
            self.trees = trees
        return "\n\n".join(self.trees)

    @cherrypy.expose
    def doSave(self, trees = None, startTime = None, force = None,
               update_md5 = None):
        # Save failure reason codes
        NON_MATCHING_ANNOTALDS = 1
        NON_MATCHING_HASHES = 2

        cherrypy.response.headers['Content-Type'] = 'application/json'
        if (startTime != self.startTime) and not (force == "true"):
            return json.dumps(dict(result = "failure",
                                   reason = "non-matching invocations of Annotald",  # noqa
                                   reasonCode = NON_MATCHING_ANNOTALDS,
                                   startTime = self.startTime))
        tosave = self.integrateTrees(trees)
        tosave = tosave.replace("-FLAG", "")
        print ("self.thefile is: %s" % self.thefile)
        if update_md5:
            self.versionCookie = util.updateVersionCookie(
                self.versionCookie,
                "HASH.MD5",
                util.hashTrees(trees,
                               self.versionCookie))
        if util.queryVersionCookie(self.versionCookie, "HASH.MD5"):
            print ("checking hash")
            # TODO: document hash function in user manual
            old_hash = util.queryVersionCookie(self.versionCookie,
                                               "HASH.MD5")
            new_hash = util.hashTrees(tosave, self.versionCookie)
            if old_hash != new_hash:
                return json.dumps(dict(result = "failure",
                                       reason = ("corpus text has changed" +
                                                 " (it shouldn't!)"),
                                       reasonCode = NON_MATCHING_HASHES,
                                       startTime = self.startTime))
        tosave = tosave.replace("-FLAG", "")
        try:
            util.writeTreesToFile(self.versionCookie, tosave, self.thefile)
            self.doLogEvent(json.dumps({'type': "save"}))
            return json.dumps(dict(result = "success"))
        except Exception as e:
            print ("something went wrong: %s" % e)
            traceback.print_exc()
            return json.dumps(dict(result = "failure",
                                   reason = "server got an exception"))

    @cherrypy.expose
    def doValidate(self, trees = None, validator = None, shift = None):
        cherrypy.response.headers['Content-Type'] = 'application/json'
        tovalidate = self.integrateTrees(trees)
        self.doLogEvent(json.dumps({'type': "validate",
                                    'validator': validator}))

        # When showing part of the file, a regular click of the validation
        # button validates only the showing trees, whereas shift-click does
        # them all.  This implements that logic.
        if self.showingPartialFile and not shift:
            tovalidate = "\n\n".join(
                self.trees[self.treeIndexStart:self.treeIndexEnd])

        try:
            validatedTrees = self.pythonOptions['validators'][validator](
                self.versionCookie, tovalidate
            ).split("\n\n")
        except Exception as e:
            print ("something went wrong with validation: %s, %s" %
                   (type(e), e))
            traceback.print_exc()
            return json.dumps(dict(result = "failure",
                                   reason = str(e)))

        # What to do with the resultant trees depends on whether they are all
        # the trees in the file, and on whether we want to show all the trees
        # in the file.s
        if self.showingPartialFile:
            if shift == "true":
                self.trees = validatedTrees
                validatedHtml = self.treesToHtml(self.trees[
                    self.treeIndexStart:self.treeIndexEnd])
            else:
                self.integrateTrees(validatedTrees)
                validatedHtml = self.treesToHtml(validatedTrees)
        else:
            self.trees = validatedTrees
            validatedHtml = self.treesToHtml(validatedTrees)

        return json.dumps(dict(result = "success",
                               html = validatedHtml))

    @cherrypy.expose
    def doLogEvent(self, eventData):
        eventData = json.loads(eventData)  # TODO: so fucking asinine
        if not self.options.timelog:
            return
        if not self.eventLog:
            try:
                self.eventLog = shelve.open("annotaldLog.shelve")
            except:
                print ("-" * 60)
                print ("COULD NOT OPEN TIME LOG DB")
                print ("There will thus be no timelogging")
                print ("(If you don't know what this message means, you can" +
                       "ignore it)")
                print ("-" * 60)

                def doLogEvent(eventData):
                    return ""

                # This is a little weird, since the new doLogEvent does not
                # take a self argument.  But the self argument is treated
                # specially, and needs extra magic to work for a monkey-patch
                # like here.
                self.doLogEvent = doLogEvent
                return ""
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
            f.write(str(evtTime) + ": " + json.dumps(eventData) + "\n")
        return ""

    @cherrypy.expose
    def doExit(self):
        print ("Exit message received")
        print ("Reformatting trees")
        if self.pythonOptions['rewriteIndices']:
            print ("...and rewriting indices sequentially")
        print ("Please be patient, this may take some time")
        util.writeTreesToFile(self.versionCookie, "\n\n".join(self.trees),
                              self.thefile,
                              True, self.pythonOptions['rewriteIndices'])
        print ("Done. :)")

        self.doLogEvent(json.dumps({'type': "program-exit"}))
        time.sleep(3)           # Wait for log events from server
        if self.eventLog:
            self.eventLog.close()
            self.eventLog = None
        # forceful exit to make up for lack of proper thread management
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

    def readVersionCookie(self, filename):
        f = codecs.open(filename, 'r', "utf-8")
        currentText = f.read()  # must read the whole thing to avoid reading
                                # half a comment...optimize here, or hope the
                                # disk cache gets used.
        if self.options.outFile:
            currentText = util.scrubText(currentText)

        trees = currentText.strip().split("\n\n")
        vc = trees[0]
        self.versionCookie = ""
        if vc[0:10] == "( (VERSION":
            self.versionCookie = vc

    def readTrees(self, fileName, text = None):
        if text:
            currentText = text
        else:
            f = codecs.open(fileName, 'r', "utf-8")
            currentText = f.read()
            if self.options.outFile:
                currentText = util.scrubText(currentText)

        trees = currentText.strip().split("\n\n")
        vc = trees[0]
        self.versionCookie = ""
        if vc[0:10] == "( (VERSION":
            self.versionCookie = vc
            trees = trees[1:]

        return trees

    def treesToHtml(self, trees):
        version = util.queryVersionCookie(self.versionCookie, "FORMAT")
        alltrees = '<div class="snode" id="sn0">'
        for tree in trees:
            tree = tree.strip()
            tree = tree.replace("<", "&lt;")
            tree = tree.replace(">", "&gt;")
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
                                    extraScripts = self.pythonOptions['extraJavascripts'],  # noqa
                                    colorCSS = self.pythonOptions['colorCSS'],
                                    colorPath = self.pythonOptions['colorCSSPath'],  # noqa
                                    startTime = self.startTime,
                                    debugJs = self.pythonOptions['debugJs'],
                                    useValidator = useValidator,
                                    validators = validatorNames,
                                    treeIndexStatement = ti,
                                    idle = "<div style='color:#64C465'>Editing.</div>"  # noqa
                                    )

    @cherrypy.expose
    def index(self):
        if self.pythonOptions['serverMode']:
            user = getpass.getuser()
            return """
            <html><head><title>Checkpoint</title></head><body>
            <h1>Checkpoint</h1>Are you user %s?<ul><li><b>Yes</b> Open
            <a href="%s">this link</a> to use Annotald on file %s</li><li>
            <b>No</b> You are accessing this Annotald instance by mistake;
            please close your browser window.</li></ul></body></html>""" % (
                user, user, self.shortfile)
        else:
            return self.inner_index()

    @cherrypy.expose(alias=getpass.getuser())
    def inner_index(self):
        cherrypy.lib.caching.expires(0, force = True)
        currentSettings = open(self.options.settings).read()
        currentTrees = self.readTrees(self.thefile)
        self.trees = currentTrees
        if self.showingPartialFile:
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
                                      offset * self.options.numTrees  # noqa
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
    parser = argparse.ArgumentParser(
        description = "A program for annotating parsed corpora",
        conflict_handler = "resolve")
    parser.add_argument(
        "-s", "--settings", action = "store", dest = "settings",
        help = "path to settings.js file")
    parser.add_argument(
        "-p", "--port", action = "store",
        type = int, dest = "port",
        help = "port to run server on")
    parser.add_argument(
        "-o", "--out", dest = "outFile", action = "store_true",
        help = "boolean for identifying CorpusSearch output files")
    parser.add_argument(
        "-q", "--quiet", dest = "timelog", action = "store_false",
        help = "boolean for specifying whether you'd like to \
    silence the timelogging")
    parser.add_argument(
        "-S", "--python-settings", dest = "pythonSettings",
        action = "store", help = "path to Python settings file")
    parser.add_argument(
        "-1", "--one-tree-mode", dest = "oneTree", action = "store_true",
        help = "start Annotald in one-tree mode")
    # TODO: this will not be handled properly if the arg is greater than the
    # number of trees in the file.
    parser.add_argument("-n", "--n-trees-mode", dest = "numTrees",
                         type = int, action = "store",
                         help = "number of trees to show at a time")
    parser.add_argument("-v", "--version", action = "version",
                        version = "This is Annotald v." + annotald.__version__)

    parser.add_argument("psd", nargs=1)

    parser.set_defaults(port = 8080,
                        settings = pkg_resources.resource_filename(
                            "annotald", "settings.js"),
                        pythonSettings = None,
                        oneTree = False,
                        numTrees = 1)
    args = parser.parse_args(argv)

    # TODO: can we calculate this in __init__?
    shortfile = re.search("^.*?([0-9A-Za-z\-\.]*)$", args.psd[0]).group(1)

    cherrypy.config.update({'server.socket_port': args.port})

    treedraw = Treedraw(args, shortfile)
    cherrypy.quickstart(treedraw)

if __name__ == '__main__':
    _main(sys.argv[1:])
