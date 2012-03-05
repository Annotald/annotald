## -*- coding: utf-8 -*-

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<!-- This file copyright © 2012 by Aaron Ecay, Anton Ingason.  It is made
available under the terms of the GNU GPL, version 3 or (at your option)
any later version.  See the LICENSE file for more information. -->

<html>
  <head>
    <title>Annotald</title>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <link rel="stylesheet" type="text/css" href="css/treedrawing.css" type="text/css" />
    <script type= "application/javascript" src="scripts/jquery.js"></script>
    <script type= "application/javascript" src="scripts/jquery.mousewheel.min.js"></script>
    <script type= "application/javascript" src="scripts/treedrawing.js"></script>
    <script type= "application/javascript">  ${currentSettings} </script>
    <script type= "application/javascript" src="scripts/treedrawing.contextMenu.js"></script>

  </head>
  <body oncontextmenu="return false;">
    <br />
    <div id="menus">
      <div id="floatMenu" class="menuPane">
        <div style="background-color: #2E2E2E; color: white; font-weight: bold;">
          Annotald ${annotaldVersion}
        </div>

        Editing: ${shortfile} <br />
        <input class="menubutton" type="button" value="Save" id="butsave" /><br />
        <input class="menubutton" type="button" value="Undo" id="butundo" /><br />
        <input class="menubutton" type="button" value="Redo" id="butredo" /><br />
%if usetimelog:
        <input class="menubutton" type="button" value="Idle/Resume" id="butidle" /><br />
%endif
        <input class="menubutton" type="button" value="Exit" id="butexit" /><br />

        <div id="idlestatus"></div>
        <div id="saveresult"></div>
      </div>

      <div id="toolsMenu" class="menuPane">
        <div class="menuTitle">Tools</div>
        <input class="menubutton" type="button" value="Validate" id="butvalidate" /><br />
        <input class="menubutton" type="button" value="Next Error" id="butnexterr" /><br />
        <div id="toolsMsg"></div>
      </div>
      <div id="metadataEditor"
%if not usemetadata:
           style="visibility:hidden;"
%endif
           >
        <div class="menuTitle">Metadata</div>
        <div id="metadata"></div>
      </div>
    </div>

    <div id="editpane">${currentTree}</div>


    <div id="conMenu">
      <div id="conLeft" class="conMenuColumn">
        <div class="conMenuItem"><a>IP-SUB</a></div>
        <div class="conMenuItem"><a>IP-INF</a></div>
        <div class="conMenuItem"><a>IP-SMC</a></div>
        <div class="conMenuItem"><a>-SPE</a></div>
        <div class="conMenuItem"><a>-PRN</a></div>
        <div class="conMenuItem"><a>-XXX</a></div>
      </div>

      <div id="conRight" class="conMenuColumn">
        <div class="conMenuItem"><a>XXX</a></div>
        <div class="conMenuItem"><a>XXX</a></div>
      </div>

      <div id="conRightest" class="conMenuColumn">
        <div class="conMenuItem"><a>XXX</a></div>
        <div class="conMenuItem"><a>XXX</a></div>
      </div>
    </div>

    <div id="dialogBox" class="menuPane">
    </div>

    <div id="dialogBackground"></div>

  </body>
</html>
