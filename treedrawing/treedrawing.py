# This Python file uses the following encoding: utf-8

"""
treedrawing.py
Created 2011/10/10
@author: Anton Karl Ingason
@author: Jana E. Beck
@copyright: GNU Lesser General Public License http://www.gnu.org/licenses/
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
@contact: jana.eliz.beck@gmail.com
"""

VERSION = "0.2"

import os.path
# current_dir = os.path.dirname(os.path.abspath(__file__))
import re
import sys

import cherrypy

# JB: codecs necessary for Unicode Greek support
import codecs

class Treedraw(object):

    # JB: added __init__ because was throwing AttributeError: 'Treedraw' object has no attribute 'thefile'
    def __init__(self):

        self.thefile = ""

    _cp_config = {'tools.staticdir.on' : True,
                  'tools.staticdir.dir' : '~/Annotald/treedrawing/data',
                  'tools.staticdir.index' : 'index.html',
  	           'tools.caching.on' : False,
    }

    @cherrypy.expose
    def doSave(self, trees=None):
	os.system('mv '+self.thefile+' '+self.thefile+'.bak')
        # JB: using codecs here
	f = codecs.open(self.thefile, 'w', 'utf-8')
	tosave = trees.strip()[1:-1]
	f.write(tosave)
	f.close()
	os.system('java -classpath ~/Annotald/CS_Tony_oct19.jar csearch.CorpusSearch ~/Annotald/treedrawing/nothing.q '+self.thefile)
	os.system('mv '+self.thefile+'.out '+self.thefile)

    def loadPsd( self, fileName ):

	self.thefile = fileName

        # JB: using codecs here
	f = codecs.open(fileName, 'r', 'utf-8')
	currentText = f.read()	
	allchars = 'a-zA-Z0-9þæðöÞÆÐÖáéýúíóÁÉÝÚÍÓ\*\"\,\.\?\!\:$\+\-\{\}\_\<\>\/\&\;'
        # greekchars should work with Greek and English, but includes no Extended Latin codepoints (but this will be an easy fix)
        greekchars = ur'0-9a-zA-Z",.;·$-=*\u0370-\u03FF\u1F00-\u1FFF'
	currentText = currentText.replace("<","&lt;");
	currentText = currentText.replace(">","&gt;");
	trees = currentText.split("\n\n")	

	alltrees = '<div class="snode">'
	for tree in trees:
		tree0 = tree.strip()
		tree0 = re.sub('^\(','',tree0)
		tree0 = re.sub('\)$','',tree0).strip()
		tree0 = re.sub('\((['+greekchars+']+) (['+greekchars+']+)\)','<div class="snode">\\1<span class="wnode">\\2</span></div>',tree0)
		tree0 = re.sub('\(','<div class="snode">',tree0)
		tree0 = re.sub('\)','</div>',tree0)		
		alltrees = alltrees + tree0

 	alltrees = alltrees + '</div>'
	return alltrees

    def loadTxt( self, fileName ):
	f = open( fileName )
	currentText = f.read()
	trees = currentText.split("\n\n")
	tree0 = trees[1].strip();
	words = tree0.split('\n');
	thetree='<div class="snode">IP-MAT'
	wordnr=0
	for word in words:
		thetree=thetree+'<div class="snode">X<span class="wnode">'+word+'</span></div>'

	thetree=thetree+"</div>"
	return thetree	
    
    @cherrypy.expose
    def index(self):
        if len(sys.argv)==2:
            currentSettings = open( sys.path[0] + "/settings.js").read()
            filename = sys.argv[1]
            currentTree=self.loadPsd( filename )                
        else:
            print("Usage: annotald [settingsFile.js] file.psd")
        
        return """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> 
<html>
<head>  <title>Annotald</title>
	<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <link rel="stylesheet" type="text/css" href="css/treedrawing.css" type="text/css"></link>
    <script type= "application/javascript"/>"""+ currentSettings + """    </script>
	<script type= "application/javascript" src="scripts/jquery.js"/></script>		
	<script type= "application/javascript" src="scripts/treedrawing.js"/></script>		
	<script type= "application/javascript" src="scripts/treedrawing.contextMenu.js"/></script>		

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

<div id="debugpane">x</div>
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
cherrypy.quickstart(Treedraw())
