# This Python file uses the following encoding: utf-8

"""
treedrawing.py
Created 2011/10/10
@author: Anton Karl Ingason
@author: Jana E. Beck
@author: Aaron Ecay
@copyright: GNU Lesser General Public License
http://www.gnu.org/licenses/ This program is distributed in the hope
that it will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
PURPOSE. See the GNU Lesser General Public License for more details.
@contact: jana.eliz.beck@gmail.com
"""

VERSION = "11.12"

import os.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

import re
import sys, subprocess
import cherrypy, json
import nltk.tree as T
import string as STR
import optparse
import subprocess

# JB: codecs necessary for Unicode Greek support
import codecs

# Ripped from NLTK.tree and fixed to not do stupid things with Unicode
# NLTK is distributed under the Apache License 2.0, which looks (to AWE)
# to be compatible with redistribution under the LGPL3.
def unicode_pprint_flat(tree, nodesep, parens, quotes):
    childstrs = []
    for child in tree:
        if isinstance(child, T.Tree):
            childstrs.append(unicode_pprint_flat(child, nodesep, parens, quotes))
        elif isinstance(child, tuple):
            childstrs.append(u"/".join(child))
        elif isinstance(child, basestring) and not quotes:
            childstrs.append(u'%s' % child)
        else:
            childstrs.append(u'%r' % child)
    if isinstance(tree.node, basestring):
        return u'%s%s%s %s%s' % (parens[0], tree.node, nodesep,
                                 STR.join(childstrs), parens[1])
    else:
        return u'%s%r%s %s%s' % (parens[0], tree.node, nodesep,
                                 STR.join(childstrs), parens[1])

# TODO: this will be much easier when we use nltk.tree...
def queryVersionCookie(string, fmt):
    versionRe = re.compile("\\(FORMAT (" + fmt + ")\\)")
    temp = versionRe.search(string)
    if temp:
        return temp.group(1)
    else:
        return None

def treeToHtml(tree, version, extra_data = None):
    if isinstance(tree[0], str) or isinstance(tree[0], unicode):
        # Leaf node
        if len(tree) > 1:
            raise Error("Leaf node with more than one daughter!")
        res = '<div class="snode">' + tree.node + '<span class="wnode">'
        temp = tree[0].split("-")
        if version == "dash" and len(temp) > 1:
            temp = tree[0].split("-")
            lemma = temp.pop()
            word = "-".join(temp)
            res += word + '<span class="lemma lemmaHide">-' + lemma + '</span>'
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
                    raise Error("root tree has too many/unknown daughters!")
                else:
                    real_root = daughter
        xtra_data = " ".join(map(lambda x: unicode_pprint_flat(x,'','()',False),
                                 sisters))
        return treeToHtml(real_root, version, xtra_data)
    else:
        res = '<div class="snode"'
        if extra_data:
            if "\"" in extra_data:
                # TODO(AWE): relax this restriction
                raise Error("can't cope with ID/METADATA containing double-quote yet!")
            res += ' title="' + extra_data + '"' # blatant abuse of HTML...
        res += '>' + tree.node + ' '
        res += "\n".join(map(lambda x: treeToHtml(x, version), tree))
        res += "</div>"
        return res

class Treedraw(object):

    # JB: added __init__ because was throwing AttributeError: 'Treedraw'
    # object has no attribute 'thefile'
    def __init__(self, options, args):
        if len(args) == 1:
            self.thefile = args[0]
        else:
            raise Error("Annotald requires exactly one .psd file argument")
        fileMatch = re.search("^.*?([0-9A-Za-z\.]*)$", self.thefile)
        self.shortfile = fileMatch.group(1)
        self.options = options

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
            if "Darwin" in os.uname():
                f = codecs.open(self.thefile, 'w', 'utf-8')
            else:
                f = open(self.thefile, 'w')
            f.write(self.versionCookie + "\n\n")
            tosave = trees.strip()
            f.write(tosave)
            f.close()
            cmdline = 'java -classpath ' + CURRENT_DIR + '/../CS_Tony_oct19.jar' + \
                ' csearch.CorpusSearch ' + CURRENT_DIR + '/nothing.q ' + \
                self.thefile
            # check_call throws on child error exit
            subprocess.check_call(cmdline.split(" "))
            os.rename(self.thefile + '.out', self.thefile)
            cherrypy.response.headers['Content-Type'] = 'application/json'
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
            if "Darwin" in os.uname():
                utf8_writer = codecs.getwriter("utf-8")
                stream = utf8_writer(validator.stdin)
                stream.write(self.versionCookie + "\n\n")
                stream.write(tovalidate)
            else:
                validator.stdin.write(self.versionCookie + "\n\n")
                validator.stdin.write(tovalidate)
            validator.stdin.close()
            if "Darwin" in os.uname():
                utf8_reader = codecs.getreader("utf-8")
                stream = utf8_reader(validator.stdout)
                validated = stream.read()
            else:
                validated = validator.stdout.read()
            validatedHtml = self.loadPsd(None, text = validated)

            return json.dumps(dict(result = "success",
                                   html = validatedHtml))
        except Exception as e:
            print "something went wrong: %s, %s" % (type(e), e)
            return json.dumps(dict(result = "failure"))

    @cherrypy.expose
    def doExit(self):
        print "Exit message received"
        raise SystemExit(0)

    def loadPsd(self, fileName, text = None):
        # TODO(AWE): remove
        # self.thefile = fileName

        mac = False

        if text:
            currentText = text
        else:
            f = open(fileName, 'r')
            # no longer using codecs to open the file, using .decode('utf-8')
            # instead when in Mac OS X
            if "Darwin" in os.uname():
                mac = True
                if self.options.bool:
                    currentText = self.scrubOutput(f, mac)
                else:
                    currentText = f.read().decode('utf-8')
            else:
                if self.options.bool:
                    currentText = self.scrubOutput(f, mac)
                else:
                    currentText = f.read()

        # TODO(AWE): remove the one-line restriction
        versionRe = re.compile('^\( \(VERSION.*$', re.M)
        versionMatch = versionRe.search(currentText)
        self.versionCookie = ""
        if versionMatch:
            self.versionCookie = versionMatch.group()
        useLemmata = queryVersionCookie(self.versionCookie, fmt = "dash")
        currentText = re.sub(versionRe, '', currentText)
        currentText = currentText.replace("<","&lt;")
        currentText = currentText.replace(">","&gt;")
        trees = currentText.split("\n\n")

        alltrees = '<div class="snode">'
        for tree in trees:
            tree = tree.strip()
            if not tree == "":
                nltk_tree = T.Tree(tree)
                alltrees = alltrees + treeToHtml(nltk_tree, useLemmata)

        alltrees = alltrees + '</div>'
        return alltrees

    def scrubOutput(self, f, mac):

        if mac:
            tmp2 = f.readlines()
            tmp = []
            for line in tmp2:
                tmp.append(line.decode('utf-8'))
        else:
            tmp = f.readlines()

        currentText = ""

        comment = False

        for line in tmp:
            if line.startswith("/*") or line.startswith("/~*"):
                comment = True
            elif not comment:
                currentText = currentText + line
            elif line.startswith("*/") or line.startswith("*~/"):
                comment = False
            else:
                pass

        return currentText

    ## def loadTxt(self, fileName):
    ##     print
    ##     print "I'm here!"
    ##     print
    ##     if self.options.bool:
    ##         f = open(fileName, "rU")
    ##         currentText = ""
    ##         for line in f:
    ##             if line.startswith("/*") or line.startswith("/~*"):
    ##                 comment = True
    ##             elif not comment:
    ##                 currentText = currentText + line
    ##             elif line.startswith("*/") or line.startswith("*~/"):
    ##                 comment = False
    ##             else:
    ##                 pass
    ##     else:
    ##         f = open(fileName)
    ##         currentText = f.read()
    ##     trees = currentText.split("\n\n")
    ##     tree0 = trees[1].strip();
    ##     words = tree0.split('\n');
    ##     thetree = '<div class="snode">IP-MAT'
    ##     wordnr = 0
    ##     for word in words:
    ##             thetree = thetree + '<div class="snode">X<span class="wnode">' + \
    ##                 word + '</span></div>'

    ##     thetree = thetree + "</div>"
    ##     return thetree

    @cherrypy.expose
    def index(self):
        currentSettings = open(self.options.settings).read()
        currentTree = self.loadPsd(self.thefile)

        # Chicken and egg: treedrawing.js must go before the
        # currentSettings, so that the functions there are defined for
        # currentSettings.  But currentSettings in turn must define some
        # functions for treedrawing.contextMenu.js.
        return """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>  <title>Annotald</title>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <link rel="stylesheet" type="text/css" href="css/treedrawing.css"
          type="text/css"></link>
        <script type= "application/javascript" src="scripts/jquery.js"/></script>
        <script type= "application/javascript" src="scripts/jquery.mousewheel.min.js"/>
        </script>
        <script type= "application/javascript" src="scripts/treedrawing.js"/></script>
        <script type= "application/javascript"/>""" + currentSettings + """</script>
        <script type= "application/javascript"
          src="scripts/treedrawing.contextMenu.js"/></script>


</head>
<body oncontextmenu="return false;">
<div style="display:none"><span>Sel1: </span><span id="labsel1">null</span></div>
<div style="display:none"><span>Sel2: </span><span id="labsel2">null</span></div>

<br />

<div id="floatMenu">
<div style="background-color: #2E2E2E; color: white; font-weight: bold;">
  Annotald """ + VERSION + """
</div>

Editing: """+self.shortfile+""" <br />
<input class="menubutton" type="button" value="Save" id="butsave"><br />
<input class="menubutton" type="button" value="Undo" id="butundo"><br />
<input class="menubutton" type="button" value="Redo" id="butredo"><br />
<input class="menubutton" type="button" value="Exit" id="butexit"><br />

<div id="debugpane"></div>
<div id="saveresult"></div>
</div>

<div id="toolsMenu">
<div class="menuTitle">Tools</div>
<input class="menubutton" type="button" value="Validate"
  id="butvalidate"><br />
<input class="menubutton" type="button" value="Next Error"
  id="butnexterr"><br />
<div id="toolsMsg"></div>
</div>
</div>
<div id="editpane">"""+currentTree+"""</div>


                <div id="conMenu">
                  <div id="conLeft" class="conMenuColumn">
                        <div class="conMenuItem"><a href="#edit">IP-SUB</a></div>
                        <div class="conMenuItem"><a href="#cut">IP-INF</a></div>
                        <div class="conMenuItem"><a href="#copy">IP-SMC</a></div>
                        <div class="conMenuItem"><a href="#paste">-SPE</a></div>
                        <div class="conMenuItem"><a href="#delete">-PRN</a></div>
                        <div class="conMenuItem"><a href="#quit">-XXX</a></div>
                  </div>

                  <div id="conRight" class="conMenuColumn">
                        <div class="conMenuItem"><a href="#edit">XXX</a></div>
                        <div class="conMenuItem"><a href="#cut">XXX</a></div>
                  </div>

          <div id="conRightest" class="conMenuColumn">
            <div class="conMenuItem"><a href="#edit">XXX</a></div>
            <div class="conMenuItem"><a href="#cut">XXX</a></div>
           </div>
                </div>

</body>
</html>"""


#index.exposed = True
parser = optparse.OptionParser(usage = "%prog [options] file.psd",
                               version = "Annotald " + VERSION)
parser.add_option("-s", "--settings", action = "store",
                  type = "string", dest = "settings",
                  help = "path to settings.js file")
parser.add_option("-v", "--validator", action = "store",
                  type = "string", dest = "validator",
                  help = "path to a validation script")
parser.add_option("-p", "--port", action = "store",
                  type = "int", dest = "port",
                  help = "port to run server on")
parser.add_option("-o", "--out", dest = "bool",
                  default = False, action = "store_true",
                  help = "boolean for identifying CorpusSearch output files")
parser.set_defaults(port = 8080,
                    settings = sys.path[0] + "/settings.js")
(options, args) = parser.parse_args()

cherrypy.config.update({'server.socket_port': options.port})

cherrypy.quickstart(Treedraw(options, args))
