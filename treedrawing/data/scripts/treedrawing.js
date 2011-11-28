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

// Global TODOs:
// - (AWE) push ipnode bookkeeping/formatting into CSS
// - (AWE) is $("#" + foo.id) the same as $(foo), and is the latter faster?

var startnode = null;
var endnode = null;
var mousenode = null;
var undostack = new Array();
var redostack = new Array();
var ctrlKeyMap = new Object();
var shiftKeyMap = new Object();
var regularKeyMap = new Object();

var name = "#floatMenu";
var menuYloc = null;

var last_event_was_mouse = false;

var globalStyle = $('<style type="text/css"></style>');

String.prototype.startsWith = function(str) {
    return (this.substr(0,str.length) === str);
};

String.prototype.endsWith = function(str) {
    return (this.substr(this.length-str.length) === str);
};


/**
 * unique function by: Shamasis Bhattacharya
 * http://www.shamasis.net/2009/09/fast-algorithm-to-find-unique-items-in-javascript-array/
 */
Array.prototype.unique = function() {
    var o = {}, i, l = this.length, r = [];
    for(i=0; i<l;i+=1) o[this[i]] = this[i];
    for(i in o) r.push(o[i]);
    return r;
};


// TODO(AWE): I think that updating labels on changing nodes works, but
// this fn should be interactively called with debugging arg to test this
// supposition.  When I am confident of the behavior of the code, the
// debugging branch will be optimized/removed.
function resetLabelClasses(alertOnError) {
    var nodes = $(".snode").each(
        function() {
            var node = $(this);
            var label = parseLabel(getLabel(node));
            if (alertOnError) { // TODO(AWE): optimize test inside loop
                var classes = node.attr("class").split(" ");
                // This incantation removes a value from an array.
                classes.indexOf("snode") >= 0 &&
                    classes.splice(classes.indexOf("snode"), 1);
                classes.indexOf("ipnode") >= 0 &&
                    classes.splice(classes.indexOf("ipnode"), 1);
                classes.indexOf(label) >= 0 &&
                    classes.splice(classes.indexOf(label), 1);
                if (classes.length > 0) {
                    alert("Spurious classes '" + classes.join() +
                          "' detected on node id'" + node.attr("id") + "'");
                }
            }
        node.attr("class", "snode " + label);
        });
}


$(document).ready(
    function() {
        resetIds();
        resetLabelClasses(false);
        assignEvents();
        $("#debugpane").empty();

        // inital highlight of IPs
        var snodes = $(".snode");
        for (var i=0; i<snodes.length; i++) {
            var text = getLabel($("#"+snodes[i].id));
            if (isIpNode(text)) {
                $(snodes[i]).addClass('ipnode');
            }
        }

        globalStyle.appendTo("head");

        lastsavedstate = $("#editpane").html();
    });

// menuon=true;
// checks if the given node label is an ip node in the gui coloring sense

function addStyle(string) {
    var style = globalStyle.text() + "\n" + string;
    globalStyle.text(style);
}

function styleTag(tagName, css) {
    // TODO(AWE): this is a really baroque selector.  The alternative
    // (faster?) way to do it is to keep track of the node name as a
    // separate div-level property
    addStyle('*[class*=" ' + tagName + '-"],*[class*=" ' + tagName +
             ' "],*[class$=" ' + tagName + '"] { ' + css + ' }');
}

// TODO(AWE): now that the node label is in the CSS class, can this be
// factored out?
function isIpNode (text) {
        return text.startsWith("IP-SUB") ||
        text.startsWith("IP-MAT") ||
        text.startsWith("IP-IMP") ||
        text.startsWith("IP-INF");

//        return contains( ipnodes, parseLabel(text) );
}

// returns true if array a contains object o
function contains(a, obj) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] === obj) {
      return true;
    }
  }
  return false;
}


function isEmpty (text) {
    if (text.startsWith("*") || text.startsWith("{") ||
        text.split("-")[0] == "0") {
        return true;
    }
    return false;
}

function showContextMenu() {
    var e = window.event;
    var element = e.target || e.srcElement;
    var elementId = element.id;
    if (elementId == "sn0") {
        clearSelection();
        return;
    }

    var left = $(element).offset().left + 4;
    var top = $(element).offset().top + 17;
    left = left + "px";
    top = top + "px";

    var conl = $("#conLeft"),
        conr = $("#conRight"),
        conm = $("#conMenu");

    conl.empty();
    loadContextMenu(elementId);

    // Make the columns equally high
    conl.height("auto");
    conr.height("auto");
    if (conl.height() < conr.height()) {
        conl.height(conr.height());
    } else {
        conr.height(conl.height());
    }

    conm.css("left",left);
    conm.css("top",top);
    conm.css("visibility","visible");
}

function hideContextMenu() {
    $("#conMenu").css("visibility","hidden");
}

function addCommand(dict, fn, arg) {
    // TODO(AWE): allow multiple arguments, via surgery on arguments array.
    var commandMap;
    if (dict.ctrl) {
        commandMap = ctrlKeyMap;
    } else if (dict.shift) {
        commandMap = shiftKeyMap;
    } else {
        commandMap = regularKeyMap;
    }
    commandMap[dict.keycode] = {
        func: fn,
        args: [arg]
    };
}

function stackTree() {
    undostack.push($("#editpane").html());
    // Keep this small, for memory reasons
    undostack = undostack.slice(-15);
}

function redo() {
    var nextstate = redostack.pop();
    if (!(nextstate == undefined)) {
        var editPane = $("#editpane");
        var currentstate = editPane.html();
        undostack.push(currentstate);
        editPane.empty();
        editPane.append(nextstate);
        clearSelection();
        $(".snode").mousedown(handleNodeClick);
    }
}

function undo() {
    var prevstate = undostack.pop();
    if (!(prevstate == undefined)) {
        var editPane = $("#editpane");
        var currentstate=$("#editpane").html();
        redostack.push(currentstate);
        editPane.empty();
        editPane.append(prevstate);
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
    $(document).mousewheel(handleMouseWheel);
}

function editLemmaOrLabel() {
    if (isLeafNode(startnode)) {
        editLemma();
    } else {
        displayRename();
    }
}

function handleMouseWheel(e, delta) {
    if (e.shiftKey && startnode) {
        var nextNode;
        if (delta < 0) { // negative means scroll down, counterintuitively
             nextNode = $(startnode).next().get(0);
        } else {
            nextNode = $(startnode).prev().get(0);
        }
        if (nextNode) {
            selectNode(nextNode.id);
            scrollToShowSel();
        }
    }
}

function handleKeyDown(e) {
    if ((e.ctrlKey && e.shiftKey) || e.metaKey || e.altKey) {
        // unsupported modifier combinations
        return;
    }
    var commandMap;
    if (e.ctrlKey) {
        commandMap = ctrlKeyMap;
    } else if (e.shiftKey) {
        commandMap = shiftKeyMap;
    } else {
        commandMap = regularKeyMap;
    }
    last_event_was_mouse = false;
    if (!commandMap[e.keyCode]) {
        return;
    }
    e.preventDefault();
    var theFn = commandMap[e.keyCode].func;
    var theArgs = commandMap[e.keyCode].args;
    theFn.apply(undefined, theArgs);
}


function handleNodeClick(e) {
    e = e || window.event;
    var elementId = (e.target || e.srcElement).id;
    if (e.button == 2) {
        // rightclick
        if (!elementId) {
            return; // prevent this if clicking a trace, for now
        } if (startnode && !endnode) {
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
        if (e.shiftKey && startnode) {
            var node = document.getElementById(elementId);
            endnode = node;
            updateSelection();
            e.preventDefault(); // Otherwise, this sets the text
                                // selection in the browser...
        } else {
            selectNode(elementId);
            if (e.ctrlKey) {
                makeNode("XP");
            }
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


function clearSelection() {
    window.event.preventDefault();
    startnode = endnode = null;
    resetIds();
    updateSelection();
    hideContextMenu();
}

function updateSelection() {
    document.getElementById("labsel1").innerHTML = "null";
    document.getElementById("labsel2").innerHTML = "null";
    if (startnode) {
        document.getElementById("labsel1").innerHTML = startnode.id;
        //startnode.setAttribute('class','snodesel');
    }
    if (endnode) {
        document.getElementById("labsel2").innerHTML=endnode.id;
        //endnode.setAttribute('class','snodesel');
    }

    // update selection display
    $('.snode').removeClass('snodesel');

    if (startnode) {
        $(startnode).addClass('snodesel');
    }

    if (endnode) {
        $(endnode).addClass('snodesel');
    }
}

function scrollToShowSel() {
    function isTopVisible(elem) {
        var docViewTop = $(window).scrollTop();
        var docViewBottom = docViewTop + $(window).height();
        var elemTop = $(elem).offset().top;

        return ((elemTop <= docViewBottom) && (elemTop >= docViewTop));
    }
    if (!isTopVisible(startnode)) {
        window.scroll(0, $(startnode).offset().top - $(window).height() * 0.25);
    }
}

function isPossibleTarget(node) {
    // cannot move under a tag node
    // TODO(AWE): what is the calling convention?  can we optimize this jquery call?
    if ($("#"+node).children().first().is("span")) {
        return false;
    }
    return true;
}

function currentText(root) {
    var text = $(root).find('.wnode').filter(
        function() {
            return !isEmpty(this.textContent);
        }).text();
    return text;
}

function moveNode(targetParent){
    var parent_ip = $(startnode).parents("#sn0>.ipnode,#sn0").first();
    var textbefore = currentText(parent_ip);
    if (!isPossibleTarget(targetParent)) {
        // can't move under a tag node
    } else if ($(startnode).parent().children().length == 1) {
        // alert("cant move an only child");
    } else if ($("#"+targetParent).parents().is("#"+startnode.id)) {
        // alert("can't move under one's own child");
    } else if ($(startnode).parents().is("#"+targetParent)) {
        // move up if moving to a node that is already my parent
        // alert( startnode.id );
        var firstchildId = $(startnode).parent().children().first().
            closest("div").attr("id");
        var lastchildId = $(startnode).parent().children().last().
            closest("div").attr("id");
        if (startnode.id == firstchildId) {
            stackTree();
            $(startnode).insertBefore($("#"+targetParent).children().filter(
                                                 $(startnode).parents()));
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
            } else {
                resetIds();
                //   updateSelection();
            }
        } else if (startnode.id == lastchildId) {
            stackTree();
             $(startnode).insertAfter($("#"+targetParent).children().
                                      filter($(startnode).parents()));
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
        var tokenMerge = isRootNode( $(startnode) );
        var maxindex = maxIndex( getTokenRoot($("#"+targetParent) ).attr("id") );
        var movednode = $(startnode);
        if (parseInt( startnode.id.substr(2) ) > parseInt(targetParent.substr(2))) {
            stackTree();
            if (tokenMerge) {
                addToIndices( movednode, maxindex );
                movednode.appendTo("#"+targetParent);
                resetIds();
            } else {
                movednode.appendTo("#"+targetParent);
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
            movednode.insertBefore($("#"+targetParent).children().first());
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
}

function isRootNode(node) {
        return node.filter("#sn0>.snode").size() > 0;
}

function moveNodes(targetParent) {
    var parent_ip = $(startnode).parents("#sn0>.ipnode,#sn0").first();
    var textbefore = currentText(parent_ip);
    var destination=$("#"+targetParent);
    stackTree();
    if (parseInt(startnode.id.substr(2)) > parseInt(endnode.id.substr(2))) {
        // reverse them if wrong order
        var temp = startnode;
        startnode = endnode;
        endnode = temp;
    }
    // TODO: check if they are really sisters
    if ($(startnode).siblings().is("#"+endnode.id)) {
        // then, collect startnode and its sister up until endnode
        var oldtext = currentText(parent_ip);
        //stackTree();
        $(startnode).add($(startnode).nextUntil("#"+endnode.id)).
            add("#"+endnode.id).wrapAll('<div xxx="newnode" class="snode">XP</div>');
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
    } else if ($(startnode).parent().children().length == 1) {
        //alert("cant move an only child");
        undo();
        redostack.pop();
        return;
    } else if ($("#"+targetParent).parents().is("#"+startnode.id)) {
        //alert("can't move under one's own child");
        undo();
        redostack.pop();
        return;
    } else if ($(startnode).parents().is("#"+targetParent)) {
        // move up if moving to a node that is already my parent
        var firstchildId = $(startnode).parent().children().first().
            closest("div").attr("id");
        var lastchildId = $(startnode).parent().children().last().
            closest("div").attr("id");

        if (startnode.id == firstchildId) {
            //stackTree();
            $(startnode).insertBefore($("#"+targetParent).children().
                                      filter($(startnode).parents()));
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
             $(startnode.id).insertAfter($("#"+targetParent).children().
                                         filter($(startnode).parents()));
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
            $(startnode).appendTo("#"+targetParent);
            if (currentText(parent_ip) != textbefore) {
                undo();
                redostack.pop();
                return;
            } else {
                resetIds();
                //   updateSelection();
            }
            //}
        } else if (parseInt( startnode.id.substr(2) ) <
                   parseInt(targetParent.substr(2))) {
            //stackTree();
            $(startnode).insertBefore($("#"+targetParent).children().first());
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

    $(startnode).replaceWith($("#"+startnode.id+">*"));
    clearSelection();
}

/*
 *  Making leafs
*/

function leafBefore() {
    makeLeaf(true);
}

function leafAfter() {
    makeLeaf(false);
}

function makeLeaf(before, label, word, targetId) {
    if (!label) {
        label = "WADVP";
    }
    if (!word) {
        word = "0";
    }
    if (!targetId) {
        targetId = startnode.id;
    }

    var lemma = false;
    var temp = word.split("-");
    if (temp.length > 1) {
        lemma = temp.pop();
        word = temp.join("-");
    }

    var startRoot = null;
    var endRoot = null;

    if (endnode) {
        startRoot = getTokenRoot($(startnode)).attr("id");
        endRoot = getTokenRoot($(endnode)).attr("id");
        stackTree();
        if (startRoot == endRoot) {
            word = "*ICH*";
            lemma = "*ICH*";
            label = getLabel($(endnode));
            if (label.startsWith("W")) {
                word = "*T*";
                label = label.substr(1);
            }
            var toadd = maxIndex(startRoot) + 1;
            word = word + "-" + toadd;
            appendExtension($(endnode), toadd);
        } else { // abort if selecting from different tokens
            undo();
            redostack.pop();
            return;
        }
    }

    var newleaf = "<div class='snode " + label + "'>" + label +
        "<span class='wnode'>" + word;
    if (lemma) {
        newleaf += "<span class='lemma " + lemmaClass + "'>-" + lemma + "</span>";
    }
    newleaf += "</span></div>\n";
    newleaf = $(newleaf);
    if (before) {
        newleaf.insertBefore("#" + targetId);
    } else {
        newleaf.insertAfter("#" + targetId);
    }
    startnode = null;
    endnode = null;
    resetIds();
    selectNode(newleaf.attr("id"));
    updateSelection();
}

function emergencyExitEdit() {
    // This function is to hack around a bug (which can't yet be
    // reproduced) in the label editor which sometimes causes it to freeze
    // and not accept the return key to terminate editing.  It is designed
    // to be called from the Chrome JS console.
    function postChange(newNode) {
        if (isIpNode(getLabel(newNode))) {
            newNode.addClass("ipnode");
        } else {
            newNode.removeClass("ipnode");
        }
        newNode.addClass(getLabel(newNode));
        startnode = endnode = null;
        resetIds();
        updateSelection();
        document.body.onkeydown = handleKeyDown;
    }
    var newphrase = $("#leafphrasebox").val().toUpperCase()+" ";
    var newtext = $("#leaftextbox").val();
    var newlemma;
    var useLemma = $('#leaflemmabox').size() > 0;
    if (useLemma) {
        newlemma = $('#leaflemmabox').val();
        newlemma = newlemma.replace("<","&lt;");
        newlemma = newlemma.replace(">","&gt;");
    }
    newtext = newtext.replace("<","&lt;");
    newtext = newtext.replace(">","&gt;");
    var replText = "<div class='snode'>" +
            newphrase + " <span class='wnode'>" + newtext;
    if (useLemma) {
        replText += "<span class='lemma " + lemmaClass + "'>-" +
            newlemma + "</span>";
    }
    replText += "</span></div>";
    var replNode = $(replText);
    $("#leafeditor").replaceWith(replNode);
    postChange(replNode);
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
        function postChange(newNode) {
            if(isIpNode(getLabel(newNode))) {
                newNode.addClass("ipnode");
            } else {
                newNode.removeClass("ipnode");
            }
            newNode.addClass(getLabel(newNode));
            startnode = endnode = null;
            resetIds();
            updateSelection();
            document.body.onkeydown = handleKeyDown;
            // TODO(AWE): check that theNewPhrase id gets removed...it
            // doesn't seem to?
        }
        var label = getLabel($(startnode));
        if ($("#"+startnode.id+">.wnode").size() > 0) {
            // this is a terminal
            var word, lemma, useLemma;
            if ($("#" + startnode.id + ">.wnode>.lemma").size() > 0) {
                var preword = $.trim($(startnode).children().first().text());
                preword = preword.split("-");
                lemma = preword.pop();
                word = preword.join("-");
                useLemma = true;
            } else {
                word = $.trim($(startnode).children().first().text());
                useLemma = false;
            }

            var editorHtml = "<div id='leafeditor' class='snode'>" +
                "<input id='leafphrasebox' class='labeledit' type='text' value='" +
                label +
                "' /><input id='leaftextbox' class='labeledit' type='text' value='" +
                word +
                "' />";
            if (useLemma) {
                editorHtml += "<input id='leaflemmabox' class='labeledit' " +
                    "type='text' value='" + lemma + "' />";
            }
            editorHtml += "</div>";

            var editor=$(editorHtml);
            $(startnode).replaceWith(editor);
            if (!isEmpty(word)) {
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
                        var newlemma;
                        if (useLemma) {
                            newlemma = $('#leaflemmabox').val();
                            newlemma = newlemma.replace("<","&lt;");
                            newlemma = newlemma.replace(">","&gt;");
                        }
                        newtext = newtext.replace("<","&lt;");
                        newtext = newtext.replace(">","&gt;");
                        var replText = "<div class='snode'>" +
                            newphrase + " <span class='wnode'>" + newtext;
                        if (useLemma) {
                            replText += "<span class='lemma " + lemmaClass + "'>-" +
                                newlemma + "</span>";
                        }
                        replText += "</span></div>";
                        var replNode = $(replText);
                        $("#leafeditor").replaceWith(replNode);
                        postChange(replNode);
                    }
                });
            setTimeout(function(){ $("#leafphrasebox").focus(); }, 10);
        } else {
            // this is not a terminal
            var editor=$("<input id='labelbox' class='labeledit' type='text' value='" +
                         label + "' />");
            var origNode = $(startnode);
            textNode(origNode).replaceWith(editor);
            $("#labelbox").keydown(
                function(event) {
                    if (event.keyCode == '9') {
                        // tab, do nothing
                          var elementId = (event.target || event.srcElement).id;
                    }
                    if (event.keyCode == '32') {
                        space(event);
                    }
                    if (event.keyCode == '13') {
                        var newphrase = $("#labelbox").val().toUpperCase();
                        $("#labelbox").replaceWith(newphrase + " ");
                        postChange(origNode);
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

function changeJustLabel (oldlabel, newlabel) {
    var label = oldlabel;
    var index = parseIndex(oldlabel);
    if (index > 0) {
        label = parseLabel(oldlabel);
        var indextype = parseIndexType(oldlabel);
        return newlabel+indextype+index;
    }
    return newlabel;
}

function toogleJustExtension (oldlabel, extension) {
    var index = parseIndex(oldlabel);
    var indextype = "";
    if (index > 0) {
        indextype = parseIndexType(oldlabel);
    }
    var extendedlabel = parseLabel(oldlabel);

    var currentextensions = new Array();
    var textension = false;
    for (var i = extensions.length-1; i>-1; i--) {
        if (extension == extensions[i]) {
            textension = true;
        } else {
            textension = false;
        }

        if(extendedlabel.endsWith(extensions[i])) {
            if (!textension) {
                currentextensions.push(extensions[i]);
            }
            extendedlabel = extendedlabel.substr(
                0,extendedlabel.length - extensions[i].length);
        } else if (textension) {
            currentextensions.push( extensions[i] );
        }
    }

    var out = extendedlabel;
    var count = currentextensions.length;
    // TODO(AWE): out += currentextensions.join("")
    for (i=0; i < count; i++) {
        out += currentextensions.pop();
    }
    if (index > 0) {
        out += indextype;
        out += index;
    }
    return out;
}

function parseExtensions (label) {
    var index = parseIndex( label );
    var indextype = "";
    if (index > 0) {
        indextype = parseIndexType(label);
    }
    var extendedlabel = parseLabel(label);
    var currentextensions = new Array();

    for (var i = extensions.length-1; i>-1; i--) {
        if (extendedlabel.endsWith(extensions[i])) {
            currentextensions.push(extensions[i]);
            extendedlabel = extendedlabel.substr(
                0,extendedlabel.length-extensions[i].length);
        }
    }

    var out = "";
    var count = currentextensions.length;
    // TODO(AWE): out += currentextensions.join("")
    for (i = 0; i < count; i++) {
        out += currentextensions.pop();
    }
    return out;
}

function toggleExtension(extension) {
    // there has to be a startnode
    if (!startnode) {
        return;
    }
    // there can't be an endnode
    if (endnode) {
        return;
    }

    if (!isPossibleTarget(startnode.id) &&
        !isEmpty(wnodeString($(startnode)))) {
        return;
    }
    stackTree();
    var textnode = textNode($(startnode));
    var oldlabel=$.trim(textnode.text());
    var newlabel = toogleJustExtension(oldlabel, extension);
    textnode.replaceWith(newlabel + " ");
}

function setLabel(labels) {
    if (!startnode) {
        return;
    }
    if (!isPossibleTarget(startnode.id) &&
        !isEmpty(wnodeString($(startnode)))) {
        return;
    }
    stackTree();
    var textnode = textNode($(startnode));
    var oldlabel = $.trim(textnode.text());
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
    if (isIpNode(newlabel)) {
        $(startnode).addClass("ipnode");
    } else {
        $(startnode).removeClass("ipnode");
    }
    $(startnode).removeClass(parseLabel(oldlabel)).addClass(parseLabel(newlabel));
}

function makeNode(label) {
    // check if something is selected
    var parent_ip = $(startnode).parentsUntil(".ipnode", ".ipnode");
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
        $(startnode).wrapAll('<div xxx="newnode" class="snode ' + label + '">'
                             + label + ' </div>\n');
    } else {
        if (parseInt(startnode.id.substr(2)) > parseInt(endnode.id.substr(2))) {
            // reverse them if wrong order
            var temp = startnode;
            startnode = endnode;
            endnode = temp;
        }

        // check if they are really sisters XXXXXXXXXXXXXXX
        if ($(startnode).siblings().is("#"+endnode.id)) {
            // then, collect startnode and its sister up until endnode
            var oldtext = currentText(parent_ip);
            stackTree();
            $(startnode).add($(startnode).nextUntil("#"+endnode.id)).add(
                "#"+endnode.id).wrapAll('<div xxx="newnode" class="snode ' +
                                        label + '">' + label + ' </div>\n');
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

function pruneNode() {
    if (startnode && !endnode) {
        var deltext = $(startnode).children().first().text();
        // if this is a leaf, todo XXX fix
        if (isEmpty(deltext)) {
            // it is ok to delete leaf if is empty/trace
            stackTree();
            $(startnode).remove();
            startnode = endnode = null;
            resetIds();
            updateSelection();
            return;
        } else if (!isPossibleTarget(startnode.id)) {
            // but other leaves are not deleted
            return;
        } else if (startnode.id == "sn0") {
            return;
        }

        stackTree();

        var toselect = $("#"+startnode.id+">*").first();
        $(startnode).replaceWith($("#"+startnode.id+">*"));
        startnode = endnode = null;
        resetIds();
        selectNode(toselect.attr("id"));
        updateSelection();
    }
}

function setNodeLabel(node, label, noUndo) {
    if (!noUndo) {
        stackTree();
    }
    textNode(node).replaceWith($.trim(label)+" ");
}

function appendExtension(node,extension,type) {
    if(!type) {
        type="-";
    }
    setNodeLabel(node, getLabel(node) + type + extension, true);
}

function getTokenRoot(node) {
    if(isRootNode(node)) {
        return node;
    }
    return $("#sn0>.snode").filter($(node).parents($("#sn0>.snode")));
}

/*
 * returns value of lowest index if there are any indices, returns -1 otherwise
*/
function minIndex (tokenRoot, offset) {
    var allSNodes = $("#" + tokenRoot + " .snode,#" + tokenRoot + " .wnode");
    var highnumber = 9000000;
    var index = highnumber;
    var label, lastpart;
    for (var i=0; i < allSNodes.length; i++){
        label = getLabel($(allSNodes[i]));
        lastpart = parseInt(label.substr(label.lastIndexOf("-")+1));
        if (!isNaN(parseInt(lastpart))) {
            if (lastpart != 0 && lastpart >=offset) {
                index = Math.min(lastpart, index);
            }
        }
    }
    if (index == highnumber) {
        return -1;
    }

    if (index < offset) {
        return -1;
    }

    return index;
}

function parseIndex (label) {
    var index = -1;
    var lastindex = Math.max(label.lastIndexOf("-"),label.lastIndexOf("="));
    if (lastindex == -1) {
        return -1;
    }
    var lastpart = parseInt(label.substr(lastindex+1));
    if(!isNaN(parseInt(lastpart))) {
        index = Math.max(lastpart, index);
    }
    if (index == 0) {
        return -1;
    }
    return index;
}

function parseLabel (label) {
    var index = parseIndex(label);
    if (index > 0) {
        var lastindex = Math.max(label.lastIndexOf("-"),
                                 label.lastIndexOf("="));
        var out = $.trim("" + label.substr(0,lastindex));
        return out;
    }
    return $.trim(label);
}


function getIndex(node) {
    var label = getLabel(node);
    return parseIndex(label);
}

function parseIndexType(label){
    var lastindex = Math.max(label.lastIndexOf("-"), label.lastIndexOf("="));
    return label.charAt(lastindex);
}

function getIndexType (node) {
    if (getIndex(node) < 0) {
        return -1;
    }

    var label = getLabel(node);
    var lastpart = parseIndexType(label);
    return lastpart;
}


function getNodesByIndex(tokenRoot, ind) {
    var nodes = $("#" + tokenRoot + " .snode,#" + tokenRoot + " .wnode").filter(
        function(index) {
            // TODO(AWE): is this below correct?  optimal?
            return getIndex($(this)) == ind;
        });
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

function addToIndices(tokenRoot, numberToAdd) {
    var ind = 1;
    var maxindex = maxIndex(tokenRoot.attr("id"));
    var nodes = tokenRoot.find(".snode,.wnode").andSelf();
    nodes.each(function(index) {
                   var nindex = getIndex($(this));
                   if(nindex>0) {
                       var label = getLabel($(this)).substr(
                           0, getLabel($(this)).length - 1);
                       label = label + (nindex + numberToAdd);
                       setNodeLabel($(this), label, true);
                   }
               });
}

function maxIndex(tokenRoot) {
    var allSNodes = $("#" + tokenRoot + ",#" + tokenRoot + " .snode,#" +
                      tokenRoot + " .wnode");
    var temp = "";
    var ind = 0;
    var label;

    for (var i=0; i < allSNodes.length; i++) {
        label = getLabel($(allSNodes[i]));
        ind = Math.max(parseIndex(label), ind);
    }
    return ind;
}

function removeIndex(node) {
        setNodeLabel($(node),
                     getLabel($(node)).substr(0, getLabel($(node)).length - 2 ),
                     true);
}

function coIndex() {
    if (startnode && !endnode) {
        if (getIndex($(startnode)) > 0) {
            stackTree();
            removeIndex(startnode);
        }
    } else if (startnode && endnode) {
        // don't do anything if different token roots
        var startRoot = getTokenRoot($(startnode)).attr("id");
        var endRoot = getTokenRoot($(endnode)).attr("id");
        if (startRoot != endRoot) {
            return;
        }
        // if both nodes already have an index
        if (getIndex($(startnode)) > 0 && getIndex($(endnode)) > 0) {
            // and if it is the same index
            if (getIndex($(startnode)) == getIndex($(endnode))) {
                var theIndex=getIndex($(startnode));
                var types = "" + getIndexType($(startnode)) +
                    "" + getIndexType($(endnode));
                // remove it
                stackTree();

                if (types == "=-") {
                    removeIndex(startnode);
                    removeIndex(endnode);
                    appendExtension($(startnode), theIndex, "=");
                    appendExtension($(endnode), theIndex, "=");
                } else if( types == "--" ){
                    removeIndex(endnode);
                    appendExtension($(endnode), getIndex($(startnode)),"=");
                } else if (types == "-=") {
                    removeIndex(startnode);
                    removeIndex(endnode);
                    appendExtension($(startnode), theIndex,"=");
                    appendExtension($(endnode), theIndex,"-");
                } else if (types == "==") {
                    removeIndex(startnode);
                    removeIndex(endnode);
                }
            }

        } else if (getIndex($(startnode)) > 0 && getIndex($(endnode)) == -1) {
            stackTree();
            appendExtension($(endnode), getIndex($(startnode)));
        } else if (getIndex($(startnode)) == -1 && getIndex($(endnode)) > 0) {
            stackTree();
            appendExtension( $(startnode), getIndex($(endnode)) );
        } else { // no indices here, so make them
            startRoot = getTokenRoot($(startnode)).attr("id");
            endRoot = getTokenRoot($(endnode)).attr("id");
            // if start and end are within the same token, do coindexing
            if(startRoot == endRoot) {
                var index = maxIndex(startRoot) + 1;
                stackTree();
                appendExtension($(startnode), index);
                appendExtension($(endnode), index);
            }
        }
    }
}


function resetIds() {
    var snodes = $(".snode");
    for (var i = 0; i < snodes.length; i++) {
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

function toLabeledBrackets(node) {
    var out = node.clone();
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

function getLabel(node) {
    return $.trim(textNode(node).text());
}

function textNode(node) {
    return node.contents().filter(function() {
                                         return this.nodeType == 3;
                                     }).first();
}

function isLeafNode(node) {
    return $("#" + node.id + ">.wnode").size() > 0;
}
