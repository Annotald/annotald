// Copyright (c) 2011 Anton Karl Ingason, Aaron Ecay

// This file is part of the Annotald program for annotating
// phrase-structure treebanks in the Penn Treebank style.

// This file is distributed under the terms of the GNU Lesser General
// Public License as published by the Free Software Foundation, either
// version 3 of the License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser
// General Public License for more details.

// You should have received a copy of the GNU Lesser General Public
// License along with this program.  If not, see
// <http://www.gnu.org/licenses/>.

var startnode=null;
var endnode=null;
var mousenode=null;
var undostack=new Array();
var redostack=new Array();
var commands=new Object();

var name = "#floatMenu";
var menuYloc = null;

var last_event_was_mouse = false;

String.prototype.startsWith = function(str){
    return (this.substr(0,str.length) === str);
};

String.prototype.endsWith = function(str){
        // alert(this.substr(this.length-str.length));
    return (this.substr(this.length-str.length) === str);
};

/**
 * unique function by: Shamasis Bhattacharya
 * http://www.shamasis.net/2009/09/fast-algorithm-to-find-unique-items-in-javascript-array/
 */
Array.prototype.unique = function() {
                var o = {}, i, l = this.length, r = [];    for(i=0; i<l;i+=1) o[this[i]] = this[i];    for(i in o) r.push(o[i]);    return r;
};


$(document).ready(
    function() {
        resetIds();
        assignEvents();
        $("#debugpane").empty();

        // make menu float
        menuYloc = parseInt($(name).css("top").substring(0, $(name).css("top").indexOf("px")));

        $(window).scroll(
            function () {
                var offset = menuYloc+$(document).scrollTop()+"px";
                $(name).animate({top:offset},{duration:500,queue:false});
            });

        // inital highlight of IPs
        var snodes = $(".snode");
        for (var i=0; i<snodes.length; i++) {
                var text = $("#"+snodes[i].id).contents().filter(
                    function() {
                        return this.nodeType == 3;
                    }).first().text();
            if (isIpNode(text)) {
                $("#"+snodes[i].id).addClass('ipnode');
            }
        }

        // setup context menu

        lastsavedstate = $("#editpane").html();
    });

// menuon=true;
// checks if the given node label is an ip node in the gui coloring sense

// TODO(AWE): now that the node label is in the CSS class, can this be
// factored out?
function isIpNode( text ){
//        alert(ipnodes.length);
/* TODO(AWE)
        for( i=0; i<ipnodes.length; i++){
                if( ipnodes[i].startsWith(text) ){
                        return true;
                }
        }
        */
        return text.startsWith("IP-SUB") || text.startsWith("IP-MAT") || text.startsWith("IP-IMP") || text.startsWith("IP-INF");

//        return contains( ipnodes, parseLabel(text) );
}

// returns true if array a contains object o
function contains(a, obj){
  for(var i = 0; i < a.length; i++) {
    if(a[i] === obj ){
      return true;
    }
  }
  return false;
}


function isEmpty( text ){
         if( text.startsWith("*") ){
            return true;
         }
         if( text.startsWith("{") ){
                 return true;
         }
         if( text == 0 ){
                 return true;
         }

         return false;
}

function showContextMenu(){

                  e = window.event;
                  var elementId = (e.target || e.srcElement).id;


                if( elementId == "sn0" ){
                        clearSelection();
                        return;
                }

                left = $("#"+elementId).offset().left+4;
                toppos = $("#"+elementId).offset().top+17;
                left = left + "px";
                top = top + "px";

        $("#conLeft").empty();
        loadContextMenu(elementId);

        // Make the columns equally high
        $("#conLeft").height( "auto" );
        $("#conRight").height( "auto" );
        if( $("#conLeft").height() < $("#conRight").height() ){
                $("#conLeft").height( $("#conRight").height() );
        }
        else {
                $("#conRight").height( $("#conLeft").height() );
        }

        $("#conMenu").css("left",left);
        $("#conMenu").css("top",toppos);
        $("#conMenu").css("visibility","visible");
}

function hideContextMenu(){
        $("#conMenu").css("visibility","hidden");
}

function addCommand( keycode, type, label ){
        commands[keycode]=new function(){
                this.type = type;
                this.label=label;
        };
}

function stackTree(){
        undostack.push( $("#editpane").html() );
}

function redo(){
        var nextstate = redostack.pop();
        if( !(nextstate == undefined) ){
                currentstate=$("#editpane").html();
                undostack.push(currentstate);
                $("#editpane").empty();
                $("#editpane").append(nextstate);
                clearSelection();
                $(".snode").mousedown(handleNodeClick);
        }
}

function undo() {
        var prevstate = undostack.pop();

        if( !(prevstate == undefined) ) {
                currentstate=$("#editpane").html();
                redostack.push(currentstate);

                $("#editpane").empty();
                $("#editpane").append(prevstate);
                clearSelection();
                $(".snode").mousedown(handleNodeClick);
        }
}

function saveHandler (data) {
    if (data['result'] == "success") {
        // TODO(AWE): ad time of alst successful save
        $("#saveresult").html("<div style='color:green'>Save success</div>");
    } else {
        lastsavedstate = "";
        $("#saveresult").html("<div style='color:red'>Save FAILED!!</div>");
    }
}

function save() {
    $("#saveresult").html("");
    var tosave = toLabeledBrackets($("#editpane"));
    $.post("/doSave", {trees: tosave}, saveHandler);
    lastsavedstate = $("#editpane").html();
}

function assignEvents() {
    // load custom commands from user settings file
    customCommands();
    document.body.onkeydown = handleKeyDown;
    $(".snode").mousedown(handleNodeClick);
    $("#butsave").mousedown(save);
    $("#butundo").mousedown(undo);
    $("#butredo").mousedown(redo);
    $("#butexit").mousedown(quitServer);
    $("#editpane").mousedown(clearSelection);
    $("#conMenu").mousedown(hideContextMenu);
}


function handleKeyDown(e) {
    // TODO(AWE): can we make this function dispatch on arbitrary code,
    // instead of a string argument?
    // TODO(AWE): allow specification of modifier keys

    if (e.ctrlKey && e.keyCode == 83) {
        save();
        e.preventDefault();
    } else if (commands[e.keyCode] != null) {
        var type = commands[e.keyCode]["type"];
        var label = commands[e.keyCode]["label"];
        switch (type) {
        case "makenode":
            if (e.shiftKey) {
                setLabel(label);
            } else {
                makeNode(label);
            }
            break;
        case "toggleextension":
            toggleExtension(label);
            break;
        case "undo":
            undo();
            break;
        case "redo":
            redo();
            break;
        case "prunenode":
            pruneNode();
            break;
        case "coindex":
            coIndex();
            break;
        case "clearselection":
            clearSelection();
            break;
        case "rename":
            displayRename();
            e.preventDefault();
            break;
        case "setlabel":
            setLabel(label);
            break;
        case "leafbefore":
            leafBefore();
            break;
        case "leafafter":
            leafAfter();
            break;
        case  "toggleLemmata":
            toggleLemmata();
            break;
        case  "editLemma":
            editLemma();
            break;
        }
        last_event_was_mouse = false;
    }
}

function handleNodeClick(e) {
    e = e || window.event;
    var elementId = (e.target || e.srcElement).id;
    if (e.button == 2) {
        // rightclick
        if (!elementId) {
            return; // prevent this if clicking a trace, for now
        }
        if (startnode && !endnode) {
            if (startnode.id != elementId) {
                e.stopPropagation();
                moveNode(elementId);
            } else {
                showContextMenu();
            }
        } else if (startnode && endnode) {
            e.stopPropagation();
            moveNodes(elementId);
        } else {
            showContextMenu();
        }
    } else {
        // leftclick
        hideContextMenu();
        selectNode(elementId);
        if (e.ctrlKey) {
            makeNode("XP");
        }
    }
    e.stopPropagation();
    last_event_was_mouse = true;
}

function selectNode(nodeId) {
    // fix???
    var node = document.getElementById(nodeId);

    if (nodeId == "sn0") {
        clearSelection();
        return;
    }

    if (node == startnode) {
        startnode = null;
        if (endnode) {
            startnode = endnode;
            endnode = null;
        }
    } else if (startnode == null) {
        startnode = node;
    } else {
        if (last_event_was_mouse) {
            if (node == endnode) {
                endnode = null;
            } else {
                endnode = node;
            }
        } else {
            endnode = null;
            startnode = node;
        }
    }
    updateSelection();
}


function clearSelection(){
        window.event.preventDefault();
        startnode=null; endnode=null;
        resetIds();
        updateSelection();
    hideContextMenu();
}

function updateSelection(){

        document.getElementById("labsel1").innerHTML="null";
        document.getElementById("labsel2").innerHTML="null";
        if( startnode ){
                document.getElementById("labsel1").innerHTML=startnode.id;
                //startnode.setAttribute('class','snodesel');
        }
        if( endnode ){
                document.getElementById("labsel2").innerHTML=endnode.id;
                //endnode.setAttribute('class','snodesel');
        }

        // update selection display
        $('.snode').removeClass('snodesel');

        //$("#conMenu").attr("style,","display:block");
        if( startnode ){
                $("#"+startnode.id).addClass('snodesel');
        }

        if( endnode ){
                $("#"+endnode.id).addClass('snodesel');
        }


}

function isPossibleTarget(node){

        // cannot move under a tag node
        if( $("#"+node).children().first().is("span") ){
                return false;
        }
/*
        if(node == "s01"){
                return false;
        }
*/
        return true;
}

function currentText(root){
        return wnodeString(root);
}

function moveNode(targetParent){
    var parent_ip = $("#" + startnode.id).parentsUntil(".ipnode", ".ipnode");
    var textbefore = currentText(parent_ip);
    if (!isPossibleTarget(targetParent)) {
        // can't move under a tag node
    } else if ($("#"+startnode.id).parent().children().length == 1) {
        // alert("cant move an only child");
    } else if ($("#"+targetParent).parents().is("#"+startnode.id)) {
        // alert("can't move under one's own child");
    } else if ($("#"+startnode.id).parents().is("#"+targetParent)) {
        // move up if moving to a node that is already my parent
        // alert( startnode.id );
        var firstchildId = $("#"+startnode.id).parent().children().first().closest("div").attr("id");
        var lastchildId = $("#"+startnode.id).parent().children().last().closest("div").attr("id");
        if (startnode.id == firstchildId) {
            stackTree();
            $("#"+startnode.id).insertBefore($("#"+targetParent).children().filter(
                                                 $("#"+startnode.id).parents()));
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
            } else {
                resetIds();
                //   updateSelection();
            }
        } else if (startnode.id == lastchildId) {
            stackTree();
             $("#"+startnode.id).insertAfter($("#"+targetParent).children().filter($("#"+startnode.id).parents()));
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
            } else {
                resetIds();
                //   updateSelection();
            }
        } else {
            // alert("cannot move from this position");
        }
    } else { // otherwise move under my sister
        // if( parseInt( startnode.id.substr(2) ) >  parseInt( targetParent.substr(2) ) ){
        var tokenMerge = isRootNode( $("#"+startnode.id) );
        var maxindex = maxIndex( getTokenRoot($("#"+targetParent) ).attr("id") );
        var movednode = $("#"+startnode.id);
        // alert(maxindex);
        // ZZZZZZZZZZ
        // alert( getTokenRoot( node(targetParent) ).attr("id") );
        //alert( getTokenRoot($("#"+startnode.id) ).attr("id") );
        if (parseInt( startnode.id.substr(2) ) > parseInt(targetParent.substr(2))) {
            stackTree();
            if (tokenMerge) {
                addToIndices( movednode, maxindex );
                $("#"+startnode.id).appendTo("#"+targetParent);
                resetIds();
            } else {
                $("#"+startnode.id).appendTo("#"+targetParent);
                if (currentText(parent_ip) != textbefore)  {
                    undo();
                    redostack.pop();
                } else {
                    resetIds();
                }
            }
        } else if( parseInt( startnode.id.substr(2) ) <
                   parseInt( targetParent.substr(2) ) ) {
            stackTree();
            if (tokenMerge) {
                addToIndices( movednode, maxindex );
            }
            $("#"+startnode.id).insertBefore( $("#"+targetParent).children().first() );
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
            } else {
                resetIds();
                // if( tokenMerge ){
                //            addToIndices( movednode, maxindex );
                // }
                //   updateSelection();
            }
        }
    }
    clearSelection();
    //        menuon=true;
}

function isRootNode( node ){
        return node.filter("#sn0>.snode").size() > 0;
}

// return jquery node based on annotald id
function node(aid){
        return $("#"+aid);
}

function moveNodes(targetParent) {
    var parent_ip = $("#" + startnode.id).parentsUntil(".ipnode", ".ipnode");
    var textbefore = currentText(parent_ip);
    var destination=$("#"+targetParent);
    stackTree();
    if (parseInt(startnode.id.substr(2)) > parseInt(endnode.id.substr(2))) {
        // reverse them if wrong order
        var temp = startnode;
        startnode = endnode;
        endnode = temp;
    }
    // check if they are really sisters XXXXXXXXXXXXXXX
    if ($("#"+startnode.id).siblings().is("#"+endnode.id)) {
        // then, collect startnode and its sister up until endnode
        var oldtext = currentText(parent_ip);
        //stackTree();
        $("#"+startnode.id).add($("#"+startnode.id).nextUntil("#"+endnode.id)).add("#"+endnode.id).wrapAll('<div xxx="newnode" class="snode">XP</div>');
        // undo if this messed up the text order
        if (currentText(parent_ip) != oldtext) {
            undo();
            redostack.pop();
            return;
        }
    } else {
        return; // the are not sisters
    }
    resetIds();
    var toselect = $(".snode[xxx=newnode]").first();
    // alert(toselect.attr("id"));

    // BUG when making XP and then use context menu: todo XXX
    clearSelection();
    selectNode( toselect.attr("id") );
    toselect.attr("xxx",null);
    updateSelection();
    resetIds();
    //toselect.mousedown(handleNodeClick);

    targetParent = destination.attr("id");

    if( ! isPossibleTarget(targetParent) ){
        //alert("can't move under a tag node");
        undo(); redostack.pop(); return;
    } else if ($("#"+startnode.id).parent().children().length == 1) {
        //alert("cant move an only child");
        undo();
        redostack.pop();
        return;
    } else if ($("#"+targetParent).parents().is("#"+startnode.id)) {
        //alert("can't move under one's own child");
        undo();
        redostack.pop();
        return;
    } else if ($("#"+startnode.id).parents().is("#"+targetParent)) {
        // move up if moving to a node that is already my parent
        // alert( startnode.id );
        var firstchildId = $("#"+startnode.id).parent().children().first().closest("div").attr("id");
        var lastchildId = $("#"+startnode.id).parent().children().last().closest("div").attr("id");

        if (startnode.id == firstchildId) {
            //stackTree();
            $("#"+startnode.id).insertBefore( $("#"+targetParent).children().filter($("#"+startnode.id).parents()));
            //resetIds();
            //pruneNode();

            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
                return;
            } else {
                resetIds();
                //   updateSelection();
            }
        } else if (startnode.id == lastchildId) {
            //stackTree();
             $("#"+startnode.id).insertAfter($("#"+targetParent).children().filter($("#"+startnode.id).parents()));
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
                return;
            } else {
                resetIds();
                //   updateSelection();
            }
        } else {
            // alert("cannot move from this position");
            undo();
            redostack.pop();
            return;
        }
    } else {
        // otherwise move under my sister
        // if( parseInt( startnode.id.substr(2) ) >  parseInt( targetParent.substr(2) ) ){
        if (parseInt( startnode.id.substr(2) ) > parseInt(targetParent.substr(2))) {
            //if( $("#"+startnode.id).siblings().is("#"+startnode.id+"~.snode") ){
            //stackTree();
            $("#"+startnode.id).appendTo("#"+targetParent);
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
                return;
            } else {
                resetIds();
                //   updateSelection();
            }
            //}
        } else if (parseInt( startnode.id.substr(2) ) < parseInt(targetParent.substr(2))) {               //stackTree();
            $("#"+startnode.id).insertBefore( $("#"+targetParent).children().first() );
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
                return;
            } else {
                resetIds();
                //   updateSelection();
            }
        }
    }

    // AWE: unused --> delete?
    // var toprune = $("#"+toselect.attr("id")+">*").first();
    $("#"+startnode.id).replaceWith($("#"+startnode.id+">*"));
    clearSelection();
}

function trim( s ){
        return s.replace(/^\s*/, "").replace(/\s*$/, "");
}

/*
 *  Making leafs
*/

function leafBefore(){
        makeLeaf(true);
}

function leafAfter(){
        makeLeaf(false);
}

function makeLeaf(before, label, word, targetId, fixed){

        if (!label) {
                label = "WADVP";
        }
        if (!word) {
                word = "0";
        }
        if (!targetId) {
                targetId = startnode.id;
        }

        startRoot = null;
        endRoot = null;

        if (endnode) {
                startRoot = getTokenRoot( $("#"+startnode.id) ).attr("id");
                endRoot = getTokenRoot( $("#"+endnode.id) ).attr("id");
                // alert(startRoot + " - " + endRoot );

                stackTree();
                if (startRoot == endRoot) {

                        word = "*ICH*";
                        label = getLabel($(endnode));

                        if (label.startsWith("W")) {
                                word = "*T*";
                                label = label.substr(1);
                        }
                        toadd = maxIndex(startRoot) + 1;
                //        alert(toadd);
                        word = word + "-" + toadd;
                        appendExtension($(endnode), toadd);
                }
                else { // abort if selecting from different tokens
                        undo(); redostack.pop(); return;
                }
        }


        newleaf = $("<div class='snode'>" + label + " <span class='wnode'>" + word + "</span></div>");
        if (before) {
                //alert(word + " x " + targetId );
                newleaf.insertBefore("#" + targetId);
        }
        else {
                //alert(word + "y");
                newleaf.insertAfter("#" + targetId);
        }
        startnode = null;
        endnode = null;
        resetIds();

        selectNode( $(newleaf).attr("id") );
        updateSelection();


}                        

function isNonWord(word){
                if( word.startsWith("*") ){
                        return true;
                }
                if( word.startsWith("{") ){
                        return true;
                }
                if( word == "0" ){
                        return true;
                }

                return false;
}

function displayRename() {
    if (startnode && !endnode) {
        stackTree();
        document.body.onkeydown = null;
        function space(event) {
            var elementId = (event.target || event.srcElement).id;
            $("#"+elementId).val( $("#"+elementId).val() );
            event.preventDefault();
        }
        function postChange(newphrase) {
            if(isIpNode(newphrase)) {
                $("#theNewPhrase").addClass("ipnode");
            } else {
                $("#theNewPhrase").removeClass("ipnode");
            }
            startnode = null; endnode = null;
            resetIds();
            updateSelection();
            document.body.onkeydown = handleKeyDown;
        }
        var label = $("#"+startnode.id).contents().filter(
            function() {
                  return this.nodeType == 3;
            }).first().text();
        label = $.trim(label);
        if ($("#"+startnode.id+">.wnode").size() > 0) {
            // this is a terminal
            var preword = $.trim($("#"+startnode.id).children().first().text());
            preword = preword.split("-");
            var lemma = preword.pop();
            var word = preword.join("-");
            var editor=$("<div id='leafeditor' class='snode'><input id='leafphrasebox' class='labeledit' type='text' value='"+label+"' /> <input id='leaftextbox' class='labeledit' type='text' value='"+word+"' /><input id='leaflemmabox' class='labeledit' type='text' value='" + lemma + "' /></div>");
            $("#"+startnode.id).replaceWith(editor);
            if (!isNonWord(word)) {
                $("#leaftextbox").attr("disabled", true);
            }
            $("#leafphrasebox,#leaftextbox,#leaflemmabox").keydown(
                function(event) {
                    if (event.keyCode == '9') {
                          var elementId = (event.target || event.srcElement).id;
                    }
                    if (event.keyCode == '32') {
                        space(event);
                    }
                    if (event.keyCode == '13') {
                        var newphrase = $("#leafphrasebox").val().toUpperCase()+" ";
                        var newtext = $("#leaftextbox").val();
                        var newlemma = $('#leaflemmabox').val();
                        newtext = newtext.replace("<","&lt;");
                        newtext = newtext.replace(">","&gt;");
                        newlemma = newlemma.replace("<","&lt;");
                        newlemma = newlemma.replace(">","&gt;");
                          $("#leafeditor").replaceWith(
                            "<div id='theNewPhrase' class='snode'>" + newphrase +
                                " <span class='wnode'>" + newtext +
                                "<span class='lemma " + lemmaClass + "'>-" +
                                newlemma + "</span></span></div>" );
                        postChange(newphrase);
                    }
                });
            setTimeout(function(){ $("#leafphrasebox").focus(); }, 10);
        } else {
            // this is not a terminal
            var editor=$("<input id='labelbox' class='labeledit' type='text' value='" +
                         label + "' />");
            $("#"+startnode.id).contents().filter(
                function() {
                      return this.nodeType == 3;
                }).first().replaceWith(editor);
            $("#labelbox").keydown(
                function(event) {
                    if(event.keyCode == '9'){
                        // tab, do nothing
                          var elementId = (event.target || event.srcElement).id;
                    }
                    if(event.keyCode == '32'){
                        space(event);
                    }
                    if(event.keyCode == '13'){
                        var newphrase = $("#labelbox").val().toUpperCase()+" ";
                          $("#labelbox").replaceWith(newphrase);
                        postChange(newphrase);
                    }
                });
            setTimeout(function(){ $("#labelbox").focus(); }, 10);
        }
    }
}

function editLemma() {
    var foo = $("#"+startnode.id+">.wnode>.lemma");
    if (startnode && !endnode && foo.size() > 0) {
        stackTree();
        document.body.onkeydown = null;
        function space(event) {
            var elementId = (event.target || event.srcElement).id;
            $("#"+elementId).val( $("#"+elementId).val() );
            event.preventDefault();
        }
        function postChange() {
            startnode = null; endnode = null;
            // Need we do this?
            resetIds();
            updateSelection();
            document.body.onkeydown = handleKeyDown;
        }
        var lemma = $("#"+startnode.id+">.wnode>.lemma").text();
        lemma = lemma.substring(1);
        var editor=$("<span id='leafeditor' class='wnode'><input id='leaflemmabox' class='labeledit' type='text' value='" + lemma + "' /></span>");
        $("#"+startnode.id+">.wnode>.lemma").replaceWith(editor);
        $("#leaflemmabox").keydown(
            function(event) {
                if (event.keyCode == '9') {
                      var elementId = (event.target || event.srcElement).id;
                    event.preventDefault();
                }
                if (event.keyCode == '32') {
                    space(event);
                }
                if (event.keyCode == '13') {
                    var newlemma = $('#leaflemmabox').val();
                    newlemma = newlemma.replace("<","&lt;");
                    newlemma = newlemma.replace(">","&gt;");
                    $("#leafeditor").replaceWith("<span class='lemma " +
                                                 lemmaClass + "'>-" +
                                                 newlemma + "</span>");
                    postChange();
                }
            });
        setTimeout(function(){ $("#leaflemmabox").focus(); }, 10);
    }
}

function changeJustLabel( oldlabel, newlabel ){
        label = oldlabel;
        index = parseIndex(oldlabel);
        //alert(index);
        if( index > 0 ){
                label = parseLabel(oldlabel);
                indextype = parseIndexType(oldlabel);
                return newlabel+indextype+index;
        }
        // alert(label);
        return newlabel;
}

function toogleJustExtension( oldlabel, extension ){
                //out = oldlabel;
                index = parseIndex( oldlabel );
                indextype="";
                if( index > 0 ){
                        indextype=parseIndexType(oldlabel);
                }
                extendedlabel = parseLabel(oldlabel);

                currentextensions = new Array();
            textension = false;
                for( i=extensions.length-1; i>-1; i--){
                        if( extension == extensions[i] ){
                                textension = true;
                        }
                        else {
                                textension = false;
                        }

                        //alert( "'"+ extendedlabel+ "' '" +extensions[i] +"'"  );
                        //alert( extendedlabel.endsWith( extensions[i] )  )
                        if( extendedlabel.endsWith( extensions[i] ) ){
                                //alert("y");

                                if( !textension ){
                                        currentextensions.push( extensions[i] );
                                }
                                extendedlabel = extendedlabel.substr(0,extendedlabel.length-extensions[i].length);
                                //alert(extendedlabel);
                        }
                        else if (textension) {
                                currentextensions.push( extensions[i] );
                        }

                        //alert( "'"+ extendedlabel+ "' '" +extensions[i] +"'"  );
                }

                out = extendedlabel;
                count = currentextensions.length;
                for( i=0; i<count; i++){
                        out+=currentextensions.pop();
                }
                if( index > 0 ){
                        out+=indextype;
                        out+=index;
                }

                return out;
}

function parseExtensions( label ){
        //alert("'"+label+"'");
                        index = parseIndex( label );
                indextype="";
                if( index > 0 ){
                        indextype=parseIndexType(label);
                }
                extendedlabel = parseLabel(label);
                currentextensions = new Array();

                for( i=extensions.length-1; i>-1; i--){

                        //alert( "'"+ extendedlabel+ "' '" +extensions[i] +"'"  );
                        //alert( extendedlabel.endsWith( extensions[i] )  )
                        if( extendedlabel.endsWith( extensions[i] ) ){
                                //alert("y");

                                currentextensions.push( extensions[i] );

                                extendedlabel = extendedlabel.substr(0,extendedlabel.length-extensions[i].length);
                                //alert(extendedlabel);
                        }
                }

                out = "";
                count = currentextensions.length;
                for( i=0; i<count; i++){
                        out+=currentextensions.pop();
                }
                /*
                if( index > 0 ){
                        out+=indextype;
                        out+=index;
                }
                        */
                return out;
}

function toggleExtension(extension){

        // there has to be a startnode
        if( !startnode ){
                return;
        }

    // there can't be an endnode
        if( endnode ){
                return;
        }

        if( !isPossibleTarget(startnode.id) && !isEmpty(  wnodeString( $("#"+startnode.id) )  ) ){
                return;
        }


        stackTree();
        textnode = $("#"+startnode.id).contents().filter(function() {
                          return this.nodeType == 3;
                }).first();
        oldlabel=trim(textnode.text());
        newlabel =          toogleJustExtension(oldlabel,extension);
        textnode.replaceWith(newlabel+" ");



        //alert( "XXX: "+ toogleJustExtension(oldlabel,"-SPE") );

}

function setLabel(labels) {
    if (!isPossibleTarget(startnode.id) &&
        !isEmpty(wnodeString($("#"+startnode.id)))) {
        return;
    }
    stackTree();
    var textnode = $("#"+startnode.id).contents().filter(
        function() {
            return this.nodeType == 3;
        }).first();
    var oldlabel = trim(textnode.text());
    var newlabel = null;
    // TODO(AWE): make this more robust!
    if (!(labels instanceof Array)) {
        var prefix = oldlabel.indexOf("-") > 0 ?
            oldlabel.substr(0,oldlabel.indexOf("-")) :
            oldlabel;
        var new_labels = labels[prefix];
        if (!new_labels) {
            for (i in labels) {
                new_labels = labels[i];
                break;          // TODO(AWE): this is ugly, but I can't
                                // figure out how to get the zero-th
                                // property of an object in JS... :-/
            }
        }
        labels = new_labels;
    }
    for (var i = 0; i < labels.length; i++ ) {
        if (labels[i] == parseLabel(oldlabel)) {
            if (i < labels.length - 1) {
                newlabel = labels[i + 1];
            } else {
                newlabel = labels[0];
            }
        }
    }
    if (!newlabel) {
        newlabel = labels[0];
    }
    newlabel = changeJustLabel(oldlabel,newlabel);
    textnode.replaceWith(newlabel + " ");
    if (isIpNode(label[0])) {
        $("#"+startnode.id).addClass("ipnode");
    } else {
        $("#"+startnode.id).removeClass("ipnode");
    }
}

function makeNode(label) {
    // check if something is selected
    var parent_ip = $("#" + startnode.id).parentsUntil(".ipnode", ".ipnode");
    if (!startnode) {
        return;
    }
    // FIX, note one node situation
    //if( (startnode.id == "sn0") || (endnode.id == "sn0") ){
    // can't make node above root
    //        return;
    //}
    // make end = start if only one node is selected
    if (!endnode) {
        // if only one node, wrap around that one
        stackTree();
        $("#"+startnode.id).wrapAll('<div xxx="newnode" class="snode">'+label+' </div>');
    } else {
        if (parseInt(startnode.id.substr(2)) > parseInt(endnode.id.substr(2))) {
            // reverse them if wrong order
            var temp = startnode;
            startnode = endnode;
            endnode = temp;
        }

        // check if they are really sisters XXXXXXXXXXXXXXX
        if ($("#"+startnode.id).siblings().is("#"+endnode.id)) {
            // then, collect startnode and its sister up until endnode
            var oldtext = currentText(parent_ip);
            stackTree();
            $("#"+startnode.id).add($("#"+startnode.id).nextUntil("#"+endnode.id)).add("#"+endnode.id).wrapAll('<div xxx="newnode" class="snode">'+label+'</div>');
            // undo if this messed up the text order
            if( currentText(parent_ip) != oldtext) {
                undo();
                redostack.pop();
            }
        }
    }

    startnode = null;
    endnode = null;

    // toselect = $(".snode[xxx=newnode]").first();
    //        alert(toselect.attr("xxx"));

    resetIds();
    var toselect = $(".snode[xxx=newnode]").first();
    // alert(toselect.attr("id"));

    // BUG when making XP and then use context menu: todo XXX
    selectNode(toselect.attr("id"));
    toselect.attr("xxx",null);
    updateSelection();
    resetIds();

    toselect.mousedown(handleNodeClick);
    // connectContextMenu( toselect );
}


/*
function traceBefore(){
        makeTrace(true);
}

function traceAfter(){
        makeTrace(false);
}

function makeTrace( before ){
        if( startnode && endnode ){
                if( getLabel($(startnode) )
                makeLeaf(before,"ADVP","*T*");
        }
}
*/

function pruneNode(){
        if( startnode && !endnode ){

                deltext = $("#"+startnode.id).children().first().text();

                // if this is a leaf, todo XXX fix
                if( deltext == "0" || deltext.charAt(0) == "*" || deltext.charAt(0) == "{" || deltext.charAt(0) == "<" ){
                        // it is ok to delete leaf if is empty/trace
                        stackTree();
                        $("#"+startnode.id).remove();
                        startnode=null;
                        endnode=null;
                        resetIds();
                        updateSelection();
                        return;
                } // but other leafs are not deleted
                else if( ! isPossibleTarget(startnode.id) ){
                        return;
                }
                else if( startnode.id == "sn0" ){
                        return;
                }

//                $("#"+startnode.id+">*:text").remove();
                stackTree();

                toselect = $("#"+startnode.id+">*").first();
                $("#"+startnode.id).replaceWith( $("#"+startnode.id+">*") );
                startnode=null;
                endnode=null;
                resetIds();
                selectNode( toselect.attr("id") );
                 updateSelection();

/*
                startnode.removeChild(startnode.firstChild);
                while (startnode.firstChild)
                {
                    startnode.parentNode.insertBefore(startnode.firstChild, startnode);
                }
                startnode.parentNode.removeChild(startnode);

                startnode=null;
                endnode=null;
                 updateSelection();
                resetIds();
*/
        }
}

function setNodeLabel(node, label, noUndo){
        if (!noUndo) {
                stackTree();
        }
        node.contents().filter(function() {
                          return this.nodeType == 3;
        }).first().replaceWith($.trim(label)+" ");

                          if( isIpNode( $.trim(label) ) ){
                            node.addClass("ipnode");
                          }
                          else {
                                  node.removeClass("ipnode");
                          }
}

function getLabel(node){
        return $.trim(node.contents().filter(function() {
                          return this.nodeType == 3;
                }).first().text());
}

function appendExtension(node,extension,type){
        if( !type ){ type="-";}

        setNodeLabel(node,getLabel(node)+type+extension,true);
/*
        node.contents().filter(function() {
                          return this.nodeType == 3;
                }).first().replaceWith( $.trim(getLabel(node))+"-"+extension+" " );
*/
}

function getTokenRoot(node){
        if( isRootNode(node) ){
                return node;
        }
        //        return $("#sn0>.snode").filter($("#"+node.id).parents($("#sn0>.snode")));
        return $("#sn0>.snode").filter($(node).parents($("#sn0>.snode")));
}

/*
 * returns value of lowest index if there are any indices, returns -1 otherwise
*/
function minIndex( tokenRoot, offset ){
                        allSNodes = $("#"+tokenRoot+" .snode,#"+tokenRoot+" .wnode");
                        // temp="";
                        highnumber=9000000;
                        index=highnumber;
                        for( i=0; i<allSNodes.length; i++){
                                label=getLabel( $(allSNodes[i]) );
                                lastpart=parseInt( label.substr(label.lastIndexOf("-")+1) );
                                // lastpart=label.substr(label.lastIndexOf("-")+1);
                                // temp+=" "+lastpart;
                                if( ! isNaN( parseInt(lastpart) ) ){
                                        if( lastpart != 0 && lastpart >=offset){
                                                index = Math.min( lastpart, index );
                                        }
                                }
                        }
                        if( index == highnumber ){return -1;}

                        if( index < offset){return -1;}

                        // alert(temp);
                        return index;
}

function parseIndex( label ){
        index=-1;
        lastindex=Math.max(label.lastIndexOf("-"),label.lastIndexOf("="));
        if( lastindex == -1 ){
                return -1;
        }

        lastpart=parseInt( label.substr(lastindex+1) );

        if( ! isNaN( parseInt(lastpart) ) ){
                index = Math.max( lastpart, index );
        }
        if( index == 0){
                return -1;
        }

        return index;
}

// TODO(AWE): make sure this interacts well with lemmata!
function parseLabel( label ){
        index=parseIndex(label);

        if( index > 0 ){
                lastindex=Math.max(label.lastIndexOf("-"),label.lastIndexOf("=") );

                out = trim( ""+label.substr(0,lastindex) );
                return out;
        }

        return label;
}


function getIndex( node ){
        // alert( "eee"+ getLabel( node ) );

        label=getLabel( node );
        return parseIndex( label );
}

function parseIndexType(label){
        lastindex=Math.max(label.lastIndexOf("-"),label.lastIndexOf("="));
        lastpart=label.charAt(lastindex);
        return lastpart;
}

function getIndexType( node ){
        if( getIndex(node) < 0 ){
                return -1;
        }

        label=getLabel( node );
        lastpart = parseIndexType(label);
        return lastpart;
}


function getNodesByIndex(tokenRoot, ind){
        nodes = $("#"+tokenRoot+" .snode,#"+tokenRoot+" .wnode").filter(function(index) {
          return getIndex( $(this) )==ind;
        });
        // alert("count "+nodes.size() );
        return nodes;
}

/*
function updateIndices( tokenRoot ){
        ind=1;

        // alert( minIndex( tokenRoot, index )  );

        while( minIndex( tokenRoot, ind ) != -1){
                // alert( "startind: "+ind+" minind"+ minIndex( tokenRoot, ind )  );
                minindex = minIndex( tokenRoot, ind );

                nodes = getNodesByIndex(tokenRoot,minindex);

                // alert("sss" + nodes.size() );

                 nodes.each(function(index) {
                      label=getLabel($(this)).substr(0,getLabel($(this)).length-1);
                      label=label+ind;
                      setNodeLabel( $(this), label, true );
                });
                ind++;
                // replaceIndex( tokenRoot, minindex, index ); XXX todo getbyindex
        }
}
*/

function addToIndices( tokenRoot, numberToAdd ){

        var ind = 1;


        maxindex = maxIndex(tokenRoot.attr("id"));

        nodes = tokenRoot.find(".snode,.wnode").andSelf();
        nodes.each( function(index) {
                nindex = getIndex($(this));
                if( nindex>0){

                      label=getLabel($(this)).substr(0,getLabel($(this)).length-1);
                      label=label+(nindex+numberToAdd);
                      setNodeLabel( $(this), label, true );
                }
        });


}

function maxIndex( tokenRoot ){
                        //alert( "tr: "+tokenRoot );
                        allSNodes = $("#"+tokenRoot+",#"+tokenRoot+" .snode,#"+tokenRoot+" .wnode");
                         temp="";
                        ind=0;
                        /*
                        for( i=0; i<allSNodes.length; i++){
                                label=getLabel( $(allSNodes[i]) );
                                lastpart=parseInt( label.substr(label.lastIndexOf("-")) );
                                 lastpart=label.substr(label.lastIndexOf("-")+1);
                                 temp+=" "+lastpart;
                                if( ! isNaN( parseInt(lastpart) ) ){
                                        index = Math.max( lastpart, index );
                                }
                        }
                        */
                        for( i=0; i<allSNodes.length; i++){
                                label=getLabel( $(allSNodes[i]) );
                                ind = Math.max( parseIndex(label), ind );
                         }
                        // alert(temp);
                        // alert(ind);
                        return ind;
}

function removeIndex( node ){
        setNodeLabel( $(node), getLabel( $(node)).substr(0, getLabel( $(node)).length-2 ), true );
}

function coIndex(){

        if( startnode && !endnode ){
                if( getIndex($(startnode)) > 0 ){
                        stackTree();
                        removeIndex(startnode);
                }
        }
        else if( startnode && endnode ){

            // don't do anything if different token roots
                        startRoot = getTokenRoot($(startnode)).attr("id");
                        endRoot = getTokenRoot($(endnode)).attr("id");
                        if( startRoot != endRoot ){
                                return;
                        }


                // if both nodes already have an index
                if( getIndex($(startnode)) > 0 && getIndex($(endnode)) > 0 ){

                        // and if it is the same index
                        if( getIndex($(startnode)) == getIndex($(endnode)) ){
                                theIndex=getIndex($(startnode));
                                types = ""+getIndexType($(startnode))+""+getIndexType($(endnode));

                                //alert(types);
                                // remove it
                                stackTree();

                                //alert(types);

                                if( types == "=-"){
                                  removeIndex(startnode);
                                  removeIndex(endnode);
                                  appendExtension( $(startnode), theIndex,"=" );
                                  appendExtension( $(endnode), theIndex,"=" );
                                }
                                else if( types == "--" ){
                                  removeIndex(endnode);
                                  appendExtension( $(endnode), getIndex($(startnode)),"=" );
                                }
                                else if( types == "-=" ){
                                  removeIndex(startnode);
                                  removeIndex(endnode);
                                  appendExtension( $(startnode), theIndex,"=" );
                                  appendExtension( $(endnode), theIndex,"-" );
                                }
                                else if( types == "==" ){
                                  removeIndex(startnode);
                                  removeIndex(endnode);
                                }
                        }

                }
                else if ( getIndex($(startnode)) > 0 && getIndex($(endnode)) == -1 ){
                        stackTree();
                        appendExtension( $(endnode), getIndex($(startnode)) );
                }
                else if ( getIndex($(startnode)) == -1 && getIndex($(endnode)) > 0 ){
                        stackTree();
                        appendExtension( $(startnode), getIndex($(endnode)) );
                }
                else { // no indices here, so make them

                        startRoot = getTokenRoot($(startnode)).attr("id");
                        endRoot = getTokenRoot($(endnode)).attr("id");
                        // alert( lowestIndex(startRoot) );

                        // if start and end are within the same token, do coindexing
                        if( startRoot == endRoot ){
                                index = maxIndex(startRoot)+1;
                                stackTree();
                                appendExtension($(startnode),index);
                                appendExtension($(endnode),index);
                        }
                }
                // updateIndices(startRoot);
        }
}


function resetIds(){
        var snodes = $(".snode"); // document.getElementsByClassName("snode");
        for (i = 0; i < snodes.length; i++) {
                snodes[i].id = "sn" + i;
        }
}



//                $("#"+snodes[i].id).addClass('snodesel');
/*
                text = $("#"+snodes[i].id).contents().filter(function() {
                          return this.nodeType == 3;
                }).first().text();
                if( trim(text).startsWith("IP-SUB") ){
                        $("#"+snodes[i].id).addClass('snodesel');
                }
*/

//                snodes[i].="sn"+i;
                //snodes[i].onmousedown=null;
                //snodes[i].onmousedown=handleNodeClick;


        // assignEvents();


function wnodeString(node) {
    var text = $(node).find('.wnode').text();
    return text;
}

function toLabeledBrackets( node ){
        // return recurseNode(node,"");
        out=node.clone();
        out.find("#sn0>.snode").after("\n\n");
        out.find("#sn0>.snode").before("( ");
        out.find("#sn0>.snode").after(")");

        out.find(".snode").before("(");
        out.find(".snode").after(")");
        out.find(".wnode").before(" ");

        return out.text();
}

var lemmaClass = "lemmaHide";

function toggleLemmata() {
    $('.lemma').toggleClass('lemmaShow');
    $('.lemma').toggleClass('lemmaHide');
    lemmaClass = lemmaClass == "lemmaHide" ? "lemmaShow" : "lemmaHide";
}

var lastsavedstate = $("#editpane").html();

function quitServer() {
    if ($("#editpane").html() != lastsavedstate) {
        alert("Cannot exit, unsaved changes exist.");
    } else {
        $.post("/doExit");
        setTimeout(function(res) {
                       // I have no idea why this works, but it does
                       window.open('', '_self', '');
                       window.close();
               }, 100);
    }
}
