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

VERSION = "11.11"

import os.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

import re
import sys, subprocess
import cherrypy, json
import nltk.tree as T

# JB: codecs necessary for Unicode Greek support
import codecs

# TODO: this will be much easier when we use nltk.tree...
def queryVersionCookie(string, fmt):
    versionRe = re.compile("\\(FORMAT (" + fmt + ")\\)")
    temp = versionRe.search(string)
    if temp:
        return temp.group(1)
    else:
        return None

def treeToHtml(tree, version):
    if isinstance(tree[0], str) or \
            isinstance(tree[0], unicode):
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
    else:
        the_class = "snode"
        if tree.node == "":
            the_class = " tree_root"
        res = '<div class="' + the_class + '">' + tree.node + ' '
        res += "\n".join(map(lambda x: treeToHtml(x, version), tree))
        res += "</div>"
        return res

class Treedraw(object):

    # JB: added __init__ because was throwing AttributeError: 'Treedraw'
    # object has no attribute 'thefile'
    def __init__(self):
        self.thefile = ""

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
            tosave = trees.strip()[1:-1]
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
    def doExit(self):
        print "Exit message received"
        raise SystemExit(0)

    def loadPsd(self, fileName):
	self.thefile = fileName
        f = open(fileName, 'r')
        # no longer using codecs to open the file, using .decode('utf-8') instead when in Mac OS X
        if "Darwin" in os.uname():
            currentText = f.read().decode('utf-8')
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
        # TODO(AWE): convert to use nltk.tree
	for tree in trees:
            if not tree == "":
                nltk_tree = T.Tree(tree)
                alltrees = alltrees + treeToHtml(nltk_tree, useLemmata)

 	alltrees = alltrees + '</div>'
	return alltrees

    def loadTxt(self, fileName):
	f = open(fileName)
	currentText = f.read()
	trees = currentText.split("\n\n")
	tree0 = trees[1].strip();
	words = tree0.split('\n');
	thetree = '<div class="snode">IP-MAT'
	wordnr = 0
	for word in words:
		thetree = thetree + '<div class="snode">X<span class="wnode">' + \
                    word + '</span></div>'

	thetree = thetree + "</div>"
	return thetree	
    
    @cherrypy.expose
    def index(self):
        if len(sys.argv) == 2:
            currentSettings = open(sys.path[0] + "/settings.js").read()
            filename = sys.argv[1]
        elif len(sys.argv) == 3:
            currentSettings = open(sys.argv[1]).read()
            filename = sys.argv[2]
        else:
            print("Usage: annotald [settingsFile.js] file.psd")

        currentTree = self.loadPsd(filename)

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

Editing: """+self.thefile+""" <br />
<input class="menubutton" type="button" value="Save" id="butsave"><br />
<input class="menubutton" type="button" value="Undo" id="butundo"><br />
<input class="menubutton" type="button" value="Redo" id="butredo"><br />
<input class="menubutton" type="button" value="Exit" id="butexit"><br />

<div id="debugpane"></div>
<div id="saveresult"></div>
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

if sys.argv[1] == "-p":
    sys.argv.pop(1)
    port = sys.argv.pop(1)
    cherrypy.config.update({'server.socket_port': int(port)})

cherrypy.quickstart(Treedraw())
