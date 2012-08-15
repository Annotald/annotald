// Copyright (c) 2011, 2012 Anton Karl Ingason, Aaron Ecay, Jana Beck

// This file is part of the Annotald program for annotating
// phrase-structure treebanks in the Penn Treebank style.

// This file is distributed under the terms of the GNU General
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
// - (AWE) make the dash-tags modular, so that ctrl x -> set XXX, w ->
//   set NP-SBJ doesn't blow away the XXX
// - (AWE) what happens when you delete e.g. an NP node w metadata?
//   Does the metadata get blown away? pro/demoted? Does deletion fail, or
//   raise a prompt?
// - strict mode

var startnode = null;
var endnode = null;
var undostack = new Array();
var redostack = new Array();
var ctrlKeyMap = new Object();
var shiftKeyMap = new Object();
var regularKeyMap = new Object();

var last_event_was_mouse = false;

var globalStyle = $('<style type="text/css"></style>');

var currentIndex = 1;

String.prototype.startsWith = function(str) {
    return (this.substr(0,str.length) === str);
};

String.prototype.endsWith = function(str) {
    return (this.substr(this.length-str.length) === str);
};


/*
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
            var label = $.trim(getLabel(node));
            if (alertOnError) { // TODO(AWE): optimize test inside loop
                var classes = node.attr("class").split(" ");
                // This incantation removes a value from an array.
                classes.indexOf("snode") >= 0 &&
                    classes.splice(classes.indexOf("snode"), 1);
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

// Declare global variables from settings.js
var invisibleCategories, invisibleRootCategories, ipnodes;

function hideCategories() {
    var i;
    for (i = 0; i < invisibleRootCategories.length; i++) {
        addStyle("#sn0>." + invisibleRootCategories[i] + "{display:none;}");
    }
    for (i = 0; i < invisibleCategories.length; i++) {
        addStyle("." + invisibleCategories[i] + "{display:none;}");
    }
}

function styleIpNodes() {
    for (var i = 0; i < ipnodes.length; i++) {
        styleTag(ipnodes[i], "border-top: 1px solid black;" +
                 "border-bottom: 1px solid black;" +
                 "background-color: #C5908E;");
    }
}

function documentReadyHandler() {
    resetIds(true);
    resetLabelClasses(false);
    assignEvents();
    $("#debugpane").empty();

    lastsavedstate = $("#editpane").html();
}

$(document).ready(function () {
    documentReadyHandler();
    globalStyle.appendTo("head");
});

function addStyle(string) {
    var style = globalStyle.text() + "\n" + string;
    globalStyle.text(style);
}

/**
 * Add a css style for a certain tag.
 *
 * @param {String} tagName The tag which to style.  Will match instances of
 * the given tag with additional trailing dash tags.
 * @param {String} css The css style declarations to associate with the tag.
 */
function styleTag(tagName, css) {
    // TODO(AWE): this is a really baroque selector.  The alternative
    // (faster?) way to do it is to keep track of the node name as a
    // separate div-level property
    addStyle('*[class*=" ' + tagName + '-"],*[class*=" ' + tagName +
             ' "],*[class$=" ' + tagName + '"],[class*=" ' + tagName +
             '="] { ' + css + ' }');
}


/**
 * Add a css style for a certain dash tag.
 *
 * @param {String} tagName The tag which to style.  Will match any node with
 * this dash tag.  Should not itself have leading or trailing dashes.
 * @param {String} css The css style declarations to associate with the tag.
 */
function styleDashTag(tagName, css) {
    // TODO(AWE): this is a really baroque selector.  The alternative
    // (faster?) way to do it is to keep track of the node name as a
    // separate div-level property
    addStyle('*[class*="-' + tagName + '-"],*[class*="-' + tagName +
             ' "],*[class$="-' + tagName + '"],[class*="-' + tagName +
             '="] { ' + css + ' }');
}

/**
 * A convenience function to wrap {@link styleTag}.
 *
 * @param {Array} tagNames Tags to style.
 * @param {String} css The css style declarations to associate with the tags.
 */
function styleTags(tagNames, css) {
    for (var i = 0; i < tagNames.length; i++) {
        styleTag(tagNames[i], css);
    }
}

function contains(a, obj) {
    // TODO: find where this is used, remove it
    return (a.indexOf(obj) > -1);
}

/**
 * Test whether a string is empty, i.e. a trace, comment, or other empty
 * category.
 *
 * @param {String} text the text to test.
 */
function isEmpty (text) {
    // TODO(AWE): should this be passed a node instead of a string, and then
    // test whether the node is a leaf or not before giving a return value?  This
    // would simplify the check I had to put in shouldIndexLeafNode, and prevent
    // future such errors.
    if (text.startsWith("*") || text.startsWith("{") ||
        text.split("-")[0] == "0") {
        return true;
    }
    return false;
}

function showContextMenu() {
    var e = window.event;
    var element = e.target || e.srcElement;
    if (element == document.getElementById("sn0")) {
        clearSelection();
        return;
    }

    // TODO(AWE): make this relative to mouse posn?
    var left = $(element).offset().left + 4;
    var top = $(element).offset().top + 17;
    left = left + "px";
    top = top + "px";

    var conl = $("#conLeft"),
        conr = $("#conRight"),
        conm = $("#conMenu");

    conl.empty();
    loadContextMenu(element);

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

/**
 * Add a keybinding command.
 *
 * Calls to this function should be in the `settings.js` file, grouped in a
 * function called `customCommands`
 *
 * @param {Object} dict a mapping of properties of the keybinding.  Can
 * contain:
 * - `keycode`: the numeric keycode for the binding (mandatory)
 * - `shift`: true if this is a binding with shift pressed (optional)
 * - `ctrl`: true if this is a binding with control pressed (optional)
 *
 * @param {Function} fn the function to associate with the keybinding.  Any
 * further arguments to the `addCommand` function are passed to `fn` on each
 * invocation.
 */
function addCommand(dict, fn) {
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
        args: Array.prototype.slice.call(arguments, 2)
    };
}

function stackTree() {
    if (typeof disableUndo !== "undefined" && disableUndo) {
        return;
    } else {
        undostack.push($("#editpane").clone());
        // Keep this small, for memory reasons
        undostack = undostack.slice(-15);
    }
}

/**
 * Invoke redo, if not disabled.
 */
function redo() {
    if (typeof disableUndo !== "undefined" && disableUndo) {
        return;
    } else {
        var nextstate = redostack.pop();
        if (!(nextstate == undefined)) {
            var editPane = $("#editpane");
            var currentstate = editPane.clone();
            undostack.push(currentstate);
            editPane.replaceWith(nextstate);
            clearSelection();
            // next line maybe not needed
            $("#sn0").mousedown(handleNodeClick);
        }
    }
}

/**
 * Invoke undo, if not enabled
 */
function undo() {
    if (typeof disableUndo !== "undefined" && disableUndo) {
        return;
    } else {
        // lots of slowness in the event-handler handling part of jquery.  Perhaps
        // replace that with doing it by hand in the DOM (but with the potential
        // for memory leaks)
        // MDN references:
        // https://developer.mozilla.org/en/DOM/Node.cloneNode
        // https://developer.mozilla.org/En/DOM/Node.replaceChild
        var prevstate = undostack.pop();
        if (!(prevstate == undefined)) {
            var editPane = $("#editpane");
            var currentstate = $("#editpane").clone();
            redostack.push(currentstate);
            editPane.replaceWith(prevstate);
            clearSelection();
            // next line may not be needed
            $("#sn0").mousedown(handleNodeClick);
        }
    }
}

// TODO: move this function to a "utils" section
function safeGet (obj, key, def) {
    if (_.has(obj, key)) {
        return obj[key];
    } else {
        return def;
    }
}

var saveInProgress = false;

function saveHandler (data) {
    if (data['result'] == "success") {
        // TODO(AWE): add time of last successful save
        // TODO(AWE): add filename to avoid overwriting another file
        displayInfo("Save success.");
    } else {
        lastsavedstate = "";
        var extraInfo = "";
        // TODO: let force saving sync the annotald instances, so it's only necessary once?
        if (safeGet(data, 'reasonCode', 0) == 1) {
            extraInfo = " <a href='#' id='forceSave' " +
                "onclick='javascript:save(null, true)'>Force save</a>";
        }
        displayError("Save FAILED!!!: " + data['reason'] + extraInfo);
    }
    saveInProgress = false;
}

function save(e, force) {
    if (!saveInProgress) {
        if (force) {
            force = true;
        } else {
            force = false;
        }
        displayInfo("Saving...");
        saveInProgress = true;
        setTimeout(function () {
            var tosave = toLabeledBrackets($("#editpane"));
            $.post("/doSave", { trees: tosave,
                                startTime: startTime,
                                force: force
                              }, saveHandler).error(function () {
                                  lastsavedstate = "";
                                  saveInProgress = false;
                              });
            try {
                if ($("#idlestatus").html().search("IDLE") != -1) {
                    idle();
                }
            }
            catch (err) {
                }
            lastsavedstate = $("#editpane").html();
        }, 0);
    }
}

function idle() {
    if ($("#idlestatus").html().search("IDLE") != -1) {
        $.post("/doIdle");
        $("#idlestatus").html("<div style='color:#64C465'>Editing.</div>");
    }
    else {
        $.post("/doIdle");
        $("#idlestatus").html("");
        $("#idlestatus").html("<div style='color:#C75C5C'>IDLE.</div>");
    }
}

function navigationWarning() {
    if ($("#editpane").html() != lastsavedstate) {
        return "Unsaved changes exist, are you sure you want to leave the page?";
    }
    return undefined;
}

function assignEvents() {
    // load custom commands from user settings file
    customCommands();
    document.body.onkeydown = handleKeyDown;
    $("#sn0").mousedown(handleNodeClick);
    $("#butsave").mousedown(save);
    if (typeof disableUndo !== "undefined" && disableUndo) {
        $("#undoCtrls").hide();
    } else {
        $("#butundo").mousedown(undo);
        $("#butredo").mousedown(redo);
    }
    $("#butidle").mousedown(idle);
    $("#butexit").unbind("click").click(quitServer);
    $("#butvalidate").unbind("click").click(validateTrees);
    $("#butnexterr").unbind("click").click(nextValidationError);
    $("#butnexttree").unbind("click").click(nextTree);
    $("#butprevtree").unbind("click").click(prevTree);
    $("#butgototree").unbind("click").click(goToTree);
    $("#editpane").mousedown(clearSelection);
    $("#conMenu").mousedown(hideContextMenu);
    $(document).mousewheel(handleMouseWheel);
    window.onbeforeunload = navigationWarning;
}

/**
 * Edit the lemma, if a leaf node is selected, or the label, if a phrasal node is.
 */
function editLemmaOrLabel() {
    if (getLabel($(startnode)) == "CODE" &&
        (wnodeString($(startnode)).substring(0,4) == "{COM" ||
         wnodeString($(startnode)).substring(0,5) == "{TODO" ||
         wnodeString($(startnode)).substring(0,4) == "{MAN")) {
        editComment();
    } else if (isLeafNode(startnode)) {
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
            selectNode(nextNode);
            scrollToShowSel();
        }
    }
}

function handleKeyDown(e) {
    if ((e.ctrlKey && e.shiftKey) || e.metaKey || e.altKey) {
        // unsupported modifier combinations
        return true;
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
        return true;
    }
    e.preventDefault();
    var theFn = commandMap[e.keyCode].func;
    var theArgs = commandMap[e.keyCode].args;
    theFn.apply(undefined, theArgs);
    return false;
}


function handleNodeClick(e) {
    e = e || window.event;
    var element = (e.target || e.srcElement);
    saveMetadata();
    if (e.button == 2) {
        // rightclick
        if (startnode && !endnode) {
            if (startnode != element) {
                e.stopPropagation();
                moveNode(element);
            } else {
                showContextMenu();
            }
        } else if (startnode && endnode) {
            e.stopPropagation();
            moveNodes(element);
        } else {
            showContextMenu();
        }
    } else {
        // leftclick
        hideContextMenu();
        if (e.shiftKey && startnode) {
            endnode = element;
            updateSelection();
            e.preventDefault(); // Otherwise, this sets the text
                                // selection in the browser...
        } else {
            selectNode(element);
            if (e.ctrlKey) {
                makeNode("XP");
            }
        }
    }
    e.stopPropagation();
    last_event_was_mouse = true;
}

/**
 * Select a node, and update the GUI to reflect that.
 *
 * @param {DOM Node} node the node to be selected
 */
function selectNode(node) {
    if (node) {
        if (!(node instanceof Node)) {
            try {
                throw Error("foo");
            } catch (e) {
                console.log("selecting a non-node: " + e.stack);
            }
        }
        if (node == document.getElementById("sn0")) {
            clearSelection();
            return;
        }

        if (node.className == "wnode") {
            node = node.parentNode;
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
    } else {
        try {
            throw Error("foo");
        } catch (e) {
            console.log("tried to select something falsey: " + e.stack);
        }
    }
}

/**
 * Remove any selection of nodes.
 */
function clearSelection() {
    saveMetadata();
    window.event.preventDefault();
    startnode = endnode = null;
    resetIds();
    updateSelection();
    hideContextMenu();
}

function updateSelection() {
    // update selection display
    $('.snodesel').removeClass('snodesel');

    if (startnode) {
        $(startnode).addClass('snodesel');
    }

    if (endnode) {
        $(endnode).addClass('snodesel');
    }

    updateMetadataEditor();
}

/**
 * Scroll the page so that the first selected node is visible.
 */
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
    if ($(node).children().first().is("span")) {
        return false;
    }
    return true;
}

function currentText(root) {
    var nodes = root.get(0).getElementsByClassName("wnode");
    var text = "";
    for (var i = 0; i < nodes.length; i++) {
        var nv = nodes[i].childNodes[0].nodeValue;
        if (!isEmpty(nv)) {
            text += nv;
        }
    }

        // $(root).find('.wnode').map(
        // function() {
        //     return this.childNodes[0];
        // }).text();
    return text;
}

/**
 * Move the selected node(s) to a new position.
 *
 * The movement operation must not change the text of the token.
 *
 * @param {DOM Node} parent the parent node to move selection under.
 */
function moveNode(parent) {
    var parent_ip = $(startnode).parents("#sn0>.snode,#sn0").first();
    var other_parent = $(parent).parents("#sn0>.snode,#sn0").first();
    if (parent == document.getElementById("sn0") ||
        !parent_ip.is(other_parent)) {
        parent_ip = $("#sn0");
    }
    var parent_before;
    var textbefore = currentText(parent_ip);
    var nodeMoved;
    if (!isPossibleTarget(parent)) {
        // can't move under a tag node
    } else if ($(startnode).parent().children().length == 1) {
        // cant move an only child
    } else if ($(parent).parents().is(startnode)) {
        // can't move under one's own child
    } else if ($(startnode).parents().is(parent)) {
        // move up if moving to a node that is already my parent
        if ($(startnode).parent().children().first().is(startnode)) {
            if ($(startnode).parentsUntil(parent).slice(0,-1).
                filter(":not(:first-child)").size() > 0) {
                return;
            }
            stackTree();
            // parent_before = parent_ip.clone();
            $(startnode).insertBefore($(parent).children().filter(
                                                 $(startnode).parents()));
            if (currentText(parent_ip) != textbefore) {
                alert("failed what should have been a strict test");
                // parent_ip.replaceWith(parent_before);
                // if (parent_ip.attr("id") == "sn0") {
                //     $("#sn0").mousedown(handleNodeClick);
                // }
            } else {
                resetIds();
            }
        } else if ($(startnode).parent().children().last().is(startnode)) {
            if ($(startnode).parentsUntil(parent).slice(0,-1).
                filter(":not(:last-child)").size() > 0) {
                return;
            }
            stackTree();
            // parent_before = parent_ip.clone();
            $(startnode).insertAfter($(parent).children().
                                     filter($(startnode).parents()));
            if (currentText(parent_ip) != textbefore) {
                alert("failed what should have been a strict test");
                // parent_ip.replaceWith(parent_before);
                //  if (parent_ip.attr("id") == "sn0") {
                //     $("#sn0").mousedown(handleNodeClick);
                // }
            } else {
                resetIds();
            }
        } else {
            // cannot move from this position
        }
    } else {
        // otherwise move under my sister
        var tokenMerge = isRootNode( $(startnode) );
        var maxindex = maxIndex(getTokenRoot($(parent)));
        var movednode = $(startnode);

        // NOTE: currently there are no more stringent checks below; if that
        // changes, we might want to demote this
        parent_before = parent_ip.clone();

        // where a and b are DOM elements (not jquery-wrapped),
        // a.compareDocumentPosition(b) returns an integer.  The first (counting
        // from 0) bit is set if B precedes A, and the second bit is set if A
        // precedes B.

        // TODO: perhaps here and in the immediately following else if it is
        // possible to simplify and remove the compareDocumentPosition call,
        // since the jQuery subsumes it
        if ((parent.compareDocumentPosition(startnode) & 0x4)
            // check whether the nodes are adjacent.  Ideally, we would like
            // to say selfAndParentsUntil, but no such jQuery fn exists, thus
            // necessitating the disjunction.

            // TODO: too strict
            // &&
            // $(startnode).prev().is(
            //     $(parent).parentsUntil(startnode.parentNode).last()) ||
            // $(startnode).prev().is(parent)
           ) {
            // parent precedes startnode
            stackTree();
            if (tokenMerge) {
                addToIndices(movednode, maxindex);
            }
            movednode.appendTo(parent);
            if (currentText(parent_ip) != textbefore)  {
                parent_ip.replaceWith(parent_before);
                 if (parent_ip.attr("id") == "sn0") {
                    $("#sn0").mousedown(handleNodeClick);
                }
            } else {
                resetIds();
            }
        } else if ((parent.compareDocumentPosition(startnode) & 0x2)
                   // &&
                   // $(startnode).next().is(
                   //     $(parent).parentsUntil(startnode.parentNode).last()) ||
                   // $(startnode).next().is(parent)
                  ) {
            // startnode precedes parent
            stackTree();
            if (tokenMerge) {
                addToIndices(movednode, maxindex);
            }
            movednode.insertBefore($(parent).children().first());
            if (currentText(parent_ip) != textbefore) {
                parent_ip.replaceWith(parent_before);
                 if (parent_ip == "sn0") {
                    $("#sn0").mousedown(handleNodeClick);
                }
            } else {
                resetIds();
            }
        } // TODO: conditional branches not exhaustive
    }
    clearSelection();
}

function isRootNode(node) {
    return node.filter("#sn0>.snode").size() > 0;
}

/**
 * Move several nodes.
 *
 * The two selected nodes must be sisters, and they and all intervening sisters
 * will be moved as a unit.  Calls {@link moveNode} to do the heavy lifting.
 *
 * @param {DOM Node} parent the parent to move the selection under
 */
function moveNodes(parent) {
    var parent_ip = $(startnode).parents("#sn0>.snode,#sn0").first();
    if (parent == document.getElementById("sn0")) {
        parent_ip = $("#sn0");
    }
    if (startnode.compareDocumentPosition(endnode) & 0x2) {
        // endnode precedes startnode, reverse them
        var temp = startnode;
        startnode = endnode;
        endnode = temp;
    }
    if (startnode.parentNode == endnode.parentNode) {
        // collect startnode and its sister up until endnode
        $(startnode).add($(startnode).nextUntil(endnode)).
            add(endnode).
            wrapAll('<div xxx="newnode" class="snode">XP</div>');
        // undo if this messed up the text order
        // if (currentText(parent_ip) != textbefore) {
        //     // TODO: we'd like to remove this if never triggered
        //     console.log("Implausible occurrence");
        //     undo();
        //     redostack.pop();
        //     return;
        // }
    } else {
        return; // they are not sisters
    }
    var toselect = $(".snode[xxx=newnode]").first();
    toselect = toselect.get(0);
    // BUG when making XP and then use context menu: todo XXX

    startnode = toselect;
    moveNode(parent);
    startnode = $(".snode[xxx=newnode]").first().get(0);
    endnode = undefined;
    pruneNode();
    clearSelection();
}

/**
 * Create a leaf node before the selected node.
 *
 * Uses heuristic to determine whether the new leaf is to be a trace, empty
 * subject, etc.
 */
function leafBefore() {
    makeLeaf(true);
}

/**
 * Create a leaf node after the selected node.
 *
 * Uses heuristic to determine whether the new leaf is to be a trace, empty
 * subject, etc.
 */
function leafAfter() {
    makeLeaf(false);
}

// TODO: the hardcoding of defaults in this function is ugly.  We should
// supply a default heuristic fn to try to guess these, then allow
// settings.js to override it.

// TODO: maybe put the heuristic into leafbefore/after, and leave this fn clean?

/**
 * Create a leaf node adjacent to the selection, or a given target.
 *
 * @param {Boolean} before whether to create the node before or after selection
 * @param {String} label the label to give the new node
 * @param {String} word the text to give the new node
 * @param {DOM Node} target where to put the new node (default: selected node)
 */
function makeLeaf(before, label, word, target) {
    if (!(target || startnode)) return;

    if (!label) {
        label = "NP-SBJ";
    }
    if (!word) {
        word = "*con*";
    }
    if (!target) {
        target = startnode;
    }

    var lemma = false;
    var temp = word.split("-");
    if (temp.length > 1) {
        lemma = temp.pop();
        word = temp.join("-");
    }

    var doCoindex = false;

    if (endnode) {
        var startRoot = getTokenRoot($(startnode));
        var endRoot = getTokenRoot($(endnode));
        if (startRoot == endRoot) {
            word = "*ICH*";
            label = getLabel($(endnode));
            if (label.startsWith("W")) {
                word = "*T*";
                label = label.substr(1).replace(/-[0-9]+$/, "");
            } else if (label.split("-").indexOf("CL") > -1) {
                word = "*CL*";
                label = getLabel($(endnode)).replace("-CL", "");
                if (label.substring(0,3) == "PRO") {
                    label = "NP";
                }
            } else if (label.startsWith("CL")) {
                word = "*CL*";
                label = getLabel($(endnode));
            }
            doCoindex = true;
        } else { // abort if selecting from different tokens
            return;
        }
    }

    stackTree();

    var newleaf = "<div class='snode " + label + "'>" + label +
        "<span class='wnode'>" + word;
    if (lemma) {
        newleaf += "<span class='lemma'>-" + lemma +
            "</span>";
    }
    newleaf += "</span></div>\n";
    newleaf = $(newleaf);
    if (before) {
        newleaf.insertBefore(target);
    } else {
        newleaf.insertAfter(target);
    }
    if (doCoindex) {
        startnode = newleaf.get(0);
        coIndex();
    }
    startnode = null;
    endnode = null;
    resetIds();
    selectNode(newleaf.get(0));
    updateSelection();
}

// TODO(AWE) is this still needed?
function emergencyExitEdit() {
    // This function is to hack around a bug (which can't yet be
    // reproduced) in the label editor which sometimes causes it to freeze
    // and not accept the return key to terminate editing.  It is designed
    // to be called from the Chrome JS console.
    function postChange(newNode) {
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
        replText += "<span class='lemma'>-" +
            newlemma + "</span>";
    }
    replText += "</span></div>";
    var replNode = $(replText);
    $("#leafeditor").replaceWith(replNode);
    postChange(replNode);
}

/**
 * Show a dialog box.
 *
 * This function creates keybindings for the escape (to close dialog box) and
 * return (caller-specified behavior) keys.
 *
 * @param {String} title the title of the dialog box
 * @param {String} html the html to display in the dialog box
 * @param {Function} returnFn a function to call when return is pressed
 */
function showDialogBox(title, html, returnFn) {
    document.body.onkeydown = function (e) {
        if (e.keyCode == 27) { // escape
            hideDialogBox();
        } else if (e.keyCode == 13 && returnFn) {
            returnFn();
        }
    };
    html = '<div class="menuTitle">' + title + '</div>' +
        '<div id="dialogContent">' + html + '</div>';
    $("#dialogBox").html(html).get(0).style.visibility = "visible";
    $("#dialogBackground").get(0).style.visibility = "visible";
}

/**
 * Hide the displayed dialog box
 */
function hideDialogBox() {
    $("#dialogBox").get(0).style.visibility = "hidden";
    $("#dialogBackground").get(0).style.visibility = "hidden";
    document.body.onkeydown = handleKeyDown;
}

// TODO(AWE):make configurable
var commentTypes = ["COM", "TODO", "MAN"];
var commentTypeCheckboxes = "";

(function () {
    for (var i = 0; i < commentTypes.length; i++) {
        commentTypeCheckboxes +=
            '<input type="radio" name="commentType" value="' +
            commentTypes[i] + '" id="commentType' + commentTypes[i] +
            '" /> ' + commentTypes[i];
    }
})();

function editComment() {
    if (!startnode || endnode) return;
    var commentRaw = $.trim(wnodeString($(startnode)));
    var commentType = commentRaw.split(":")[0];
    // remove the {
    commentType = commentType.substring(1);
    var commentText = commentRaw.split(":")[1];
    commentText = commentText.substring(0, commentText.length - 1);
    // regex because string does not give global search.
    commentText = commentText.replace(/_/g, " ");
    showDialogBox("Edit Comment", 
                  '<textarea id="commentEditBox">' +
                  commentText + '</textarea><div id="commentTypes">' +
                  commentTypeCheckboxes + '</div><div id="dialogButtons">' +
                  '<input type="button"' +
                  'id="commentEditButton" value="Save" /></div>');
    $("input:radio[name=commentType]").val([commentType]);
    $("#commentEditBox").focus().get(0).setSelectionRange(commentText.length,
                                                          commentText.length);
    function editCommentDone (change) {
        if (change) {
            var newText = $.trim($("#commentEditBox").val());
            if (/_|\n|:|\}|\{|\(|\)/.test(newText)) {
                // TODO(AWE): slicker way of indicating errors...
                alert("illegal characters in comment: illegal characters are" +
                      " _, :, {}, (), and newline");
                // hideDialogBox();
                $("#commentEditBox").val(newText);
                return;
            }
            newText = newText.replace(/ /g, "_");
            commentType = $("input:radio[name=commentType]:checked").val();
            setLabelLL($(startnode).children(".wnode"),
                       "{" + commentType + ":" + newText + "}");
        }
        hideDialogBox();
    }
    $("#commentEditButton").click(editCommentDone);
    $("#commentEditBox").keydown(function (e) {
        if (e.keyCode == 13) {
            // return
            editCommentDone(true);
            return false;
        } else if (e.keyCode == 27) {
            editCommentDone(false);
            return false;
        } else {
            return true;
        }
    });
}

/**
 * Edit the selected node
 *
 * If the selected node is a terminal, edit its label, and lemma.  The text is
 * available for editing if it is an empty node (trace, comment, etc.).  If a
 * non-terminal, edit the node label.
 */
function displayRename() {
    if (startnode && !endnode) {
        stackTree();
        document.body.onkeydown = null;
        $("#sn0").unbind('mousedown');
        var oldClass = getLabel($(startnode));
        function space(event) {
            var element = (event.target || event.srcElement);
            $(element).val($(element).val());
            event.preventDefault();
        }
        function postChange(newNode) {
            if (newNode) {
                newNode.removeClass(oldClass);
                newNode.addClass(getLabel(newNode));
                startnode = endnode = null;
                resetIds();
                updateSelection();
                document.body.onkeydown = handleKeyDown;
                $("#sn0").mousedown(handleNodeClick);
            }
            // TODO(AWE): check that theNewPhrase id gets removed...it
            // doesn't seem to?
        }
        var label = getLabel($(startnode));
        label = label.replace(/'/g, "&#39;");
        var editor;
        if ($(startnode).children(".wnode").size() > 0) {
            // this is a terminal
            var word, lemma, useLemma;
            var isLeafNode = guessLeafNode($(startnode));
            if ($(startnode).children(".wnode").children(".lemma").size() > 0) {
                var preword = $.trim($(startnode).children().first().text());
                preword = preword.split("-");
                lemma = preword.pop();
                word = preword.join("-");
                useLemma = true;
            } else {
                word = $.trim($(startnode).children().first().text());
                useLemma = false;
            }

            // Single quotes mess up the HTML code.
            if (lemma) lemma = lemma.replace(/'/g, "&#39;");
            word = word.replace(/'/g, "&#39;");

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

            editor = $(editorHtml);
            $(startnode).replaceWith(editor);
            if (!isEmpty(word)) {
                $("#leaftextbox").attr("disabled", true);
            }
            $("#leafphrasebox,#leaftextbox,#leaflemmabox").keydown(
                function(event) {
                    var replText, replNode;
                    // if (event.keyCode == 9) {
                    //       var elementId = (event.target || event.srcElement);
                    // }
                    if (event.keyCode == 32) {
                        space(event);
                    }
                    if (event.keyCode == 27) {
                        replText = "<div class='snode'>" +
                            label + " <span class='wnode'>" + word;
                        if (useLemma) {
                            replText += "<span class='lemma'>-" +
                                lemma + "</span>";
                        }
                        replText += "</span></div>";
                        replNode = $(replText);
                        $("#leafeditor").replaceWith(replNode);
                        postChange(replNode);
                    }
                    if (event.keyCode == 13) {
                        var newphrase =
                                $("#leafphrasebox").val().toUpperCase();
                        if (isLeafNode) {
                            if (typeof testValidLeafLabel !== "undefined") {
                                if (!testValidLeafLabel(newphrase)) {
                                    displayWarning("Not a valid leaf label: '" +
                                                   newphrase + "'.");
                                    return;
                                }
                            }
                        } else {
                            if (typeof testValidPhraseLabel !== "undefined") {
                                if (!testValidPhraseLabel(newphrase)) {
                                    displayWarning("Not a valid phrase label: '" +
                                                   newphrase + "'.");
                                    return;
                                }
                            }
                        }
                        var newtext = $("#leaftextbox").val();
                        var newlemma = "";
                        if (useLemma) {
                            newlemma = $('#leaflemmabox').val();
                            newlemma = newlemma.replace(/</g,"&lt;");
                            newlemma = newlemma.replace(/>/g,"&gt;");
                            newlemma = newlemma.replace(/'/g,"&#39;");
                        }
                        newtext = newtext.replace(/</g,"&lt;");
                        newtext = newtext.replace(/>/g,"&gt;");
                        newtext = newtext.replace(/'/g,"&#39;");
                        if (newtext + newlemma == "") {
                            displayWarning("Cannot create an empty leaf.");
                            return;
                        }
                        replText = "<div class='snode'>" +
                            newphrase + " <span class='wnode'>" + newtext;
                        if (useLemma) {
                            replText += "<span class='lemma'>-" +
                                newlemma + "</span>";
                        }
                        replText += "</span></div>";
                        replNode = $(replText);
                        $("#leafeditor").replaceWith(replNode);
                        postChange(replNode);
                    }
                });
            setTimeout(function(){ $("#leafphrasebox").focus(); }, 10);
        } else {
            // this is not a terminal
            editor = $("<input id='labelbox' class='labeledit' " +
                           "type='text' value='" + label + "' />");
            var origNode = $(startnode);
            var isWordLevelConj =
                    origNode.children(".snode").children(".snode").size() == 0 &&
                    // TODO: make configurable
                    origNode.children(".CONJ") .size() > 0;
            textNode(origNode).replaceWith(editor);
            $("#labelbox").keydown(
                function(event) {
                    // if (event.keyCode == 9) {
                    //     // tab, do nothing
                    //       var elementId = (event.target || event.srcElement).id;
                    // }
                    if (event.keyCode == 32) {
                        space(event);
                    }
                    if (event.keyCode == 27) {
                        $("#labelbox").replaceWith(label + " ");
                        postChange(origNode);
                    }
                    if (event.keyCode == 13) {
                        var newphrase = $("#labelbox").val().toUpperCase();
                        if (typeof testValidPhraseLabel !== "undefined") {
                            if (!(testValidPhraseLabel(newphrase) ||
                                  (typeof testValidLeafLabel !== "undefined" &&
                                   isWordLevelConj &&
                                   testValidLeafLabel(newphrase)))) {
                                displayWarning("Not a valid phrase label: '" +
                                              newphrase + "'.");
                                return;
                            }
                        }
                        $("#labelbox").replaceWith(newphrase + " ");
                        postChange(origNode);
                    }
                });
            setTimeout(function(){ $("#labelbox").focus(); }, 10);
        }
    }
}

/**
 * Edit the lemma of a terminal node.
 */
function editLemma() {
    var childLemmata = $(startnode).children(".wnode").children(".lemma");
    if (startnode && !endnode && childLemmata.size() > 0) {
        stackTree();
        document.body.onkeydown = null;
        $("#sn0").unbind('mousedown');
        function space(event) {
            var element = (event.target || event.srcElement);
            $(element).val($(element).val());
            event.preventDefault();
        }
        function postChange() {
            startnode = null; endnode = null;
            // Need we do this?
            resetIds();
            updateSelection();
            document.body.onkeydown = handleKeyDown;
            $("#sn0").mousedown(handleNodeClick);
        }
        var lemma = $(startnode).children(".wnode").children(".lemma").text();
        lemma = lemma.substring(1);
        var editor=$("<span id='leafeditor' class='wnode'><input " +
                     "id='leaflemmabox' class='labeledit' type='text' value='" +
                     lemma + "' /></span>");
        $(startnode).children(".wnode").children(".lemma").replaceWith(editor);
        $("#leaflemmabox").keydown(
            function(event) {
                if (event.keyCode == '9') {
                    // var elementId = (event.target || event.srcElement).id;
                    event.preventDefault();
                }
                if (event.keyCode == '32') {
                    space(event);
                }
                if (event.keyCode == '13') {
                    var newlemma = $('#leaflemmabox').val();
                    newlemma = newlemma.replace("<","&lt;");
                    newlemma = newlemma.replace(">","&gt;");
                    newlemma = newlemma.replace(/'/g,"&#39;");

                    $("#leafeditor").replaceWith("<span class='lemma'>-" +
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

// This function takes 3 arguments: a node label with dash tags and possibly
// indices, a dash tag to toggle (no dash), and a list of possible extensions
// (in L-to-R order).  It returns a string, which is the label with
// transformations applied
function toggleStringExtension (oldlabel, extension, extensionList) {
    if (extension[0] == "-") {
        // temporary compatibility hack for old configs
        extension = extension.substring(1);
        extensionList = extensionList.map(function(s) { return s.substring(1); });
    }
    var index = parseIndex(oldlabel);
    var indextype = "";
    if (index > 0) {
        indextype = parseIndexType(oldlabel);
    }
    var currentLabel = parseLabel(oldlabel);

    // The strategy here is as follows:
    // - split the label into an array of dash tags
    // - operate on the array
    // - reform the array into a string
    currentLabel = currentLabel.split("-");
    var labelBase = currentLabel.shift();
    var idx = currentLabel.indexOf(extension);

    if (idx > -1) {
        // currentLabel contains extension, remove it
        currentLabel.splice(idx, 1);
    } else {
        idx = extensionList.indexOf(extension);
        if (idx > -1) {
            // Loop through the list, stop when we pass the right spot
            for (var i = 0; i < currentLabel.length; i++) {
                if (idx < extensionList.indexOf(currentLabel[i])) {
                    break;
                }
            }
            currentLabel.splice(i, 0, extension);
        } else {
            currentLabel.push(extension);
        }
    }

    var out = labelBase;
    if (currentLabel.length > 0) {
        out += "-" + currentLabel.join("-");
    }
    if (index > 0) {
        out += indextype;
        out += index;
    }
    return out;
}

function guessLeafNode(node) {
    if (typeof testValidLeafLabel   !== "undefined" &&
        typeof testValidPhraseLabel !== "undefined") {
        if (testValidPhraseLabel(getLabel($(node)))) {
            return false;
        } else if (testValidLeafLabel(getLabel($(node)))) {
            return true;
        } else {
            // not a valid label, fall back to structural check
            return isLeafNode(node);
        }
    } else {
        return isLeafNode(node);
    }
}

/**
 * Toggle a dash tag on a node
 *
 * If the node bears the given dash tag, remove it.  If not, add it.  This
 * function attempts to put multiple dash tags in the proper order, according
 * to the configuration in the `vextensions`, `extensions`, and
 * `clause_extensions` variables in the `settings.js` file.
 *
 * @param {String} extension the dash tag to toggle
 * @param {Array of String} [extensionList] override the guess as to the
 * appropriate ordered list of possible extensions is.
 */
function toggleExtension(extension, extensionList) {
    if (!startnode || endnode) return false;

    if (!extensionList) {
        if (guessLeafNode(startnode)) {
            extensionList = vextensions;
        } else if (getLabel($(startnode)).split("-")[0] == "IP" ||
                   getLabel($(startnode)).split("-")[0] == "CP") {
            // TODO: should FRAG be a clause?
            extensionList = clause_extensions;
        } else {
            extensionList = extensions;
        }
    }

    // Tried to toggle an extension on an inapplicable node.
    if (extensionList.indexOf(extension) < 0) {
        return false;
    }

    stackTree();
    var textnode = textNode($(startnode));
    var oldlabel = $.trim(textnode.text());
    // Extension is not de-dashed here.  toggleStringExtension handles it.
    // The new config format however requires a dash-less extension.
    var newlabel = toggleStringExtension(oldlabel, extension, extensionList);
    textnode.replaceWith(newlabel + " ");
    $(startnode).removeClass(oldlabel).addClass(newlabel);

    return true;
}

// added by JEB
// alias for compatibility
function toggleVerbalExtension(extension) {
    toggleExtension(extension);
}

function lookupNextLabel(oldlabel, labels) {
    // labels is either: an array, an object
    var newlabel = null;
    // TODO(AWE): make this more robust!
    if (!(labels instanceof Array)) {
        var prefix = oldlabel.split("-")[0];
        var new_labels = labels[prefix];
        if (!new_labels) {
            new_labels = _.values(labels)[0];
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

    return newlabel;
}

/**
 * Set the label of a node intelligently
 *
 * Given a list of labels, this function will attempt to find the node's
 * current label in the list.  If it is successful, it sets the node's label
 * to the next label in the list (or the first, if the node's current label is
 * the last in the list).  If not, it sets the label to the first label in the
 * list.
 *
 * @param labels a list of labels.  This can also be an object -- if so, the
 * base label (without any dash tags) of the target node is looked up as a
 * key, and its corresponding value is used as the list.  If there is no value
 * for that key, the first value specified in the object is the default.
 */
function setLabel(labels) {
    if (!startnode || endnode) {
        return false;
    }

    stackTree();
    var textnode = textNode($(startnode));
    var oldlabel = $.trim(textnode.text());
    var newlabel = lookupNextLabel(oldlabel, labels);

    if (guessLeafNode($(startnode))) {
        if (typeof testValidLeafLabel !== "undefined") {
            if (!testValidLeafLabel(newlabel)) {
                return false;
            }
        }
    } else {
        if (typeof testValidPhraseLabel !== "undefined") {
            if (!testValidPhraseLabel(newlabel)) {
                return false;
            }
        }
    }

    textnode.replaceWith(newlabel + " ");
    $(startnode).removeClass(parseLabel(oldlabel)).addClass(parseLabel(newlabel));

    return true;
}

/**
 * Create a phrasal node.
 *
 * The node will dominate the selected node or (if two sisters are selected)
 * the selection and all intervening sisters.
 *
 * @param {String} [label] the label to give the new node (default: XP)
 */
function makeNode(label) {
    // check if something is selected
    var parent_ip = $(startnode).parents("#sn0>.snode,#sn0").first();
    if (!startnode) {
        return;
    }
    var parent_before = parent_ip.clone();
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
        if (startnode.compareDocumentPosition(endnode) & 0x2) {
            // startnode and endnode in wrong order, reverse them
            var temp = startnode;
            startnode = endnode;
            endnode = temp;
        }

        // check if they are really sisters XXXXXXXXXXXXXXX
        if ($(startnode).siblings().is(endnode)) {
            // then, collect startnode and its sister up until endnode
            var oldtext = currentText(parent_ip);
            stackTree();
            $(startnode).add($(startnode).nextUntil(endnode)).add(
                endnode).wrapAll('<div xxx="newnode" class="snode ' +
                                        label + '">' + label + ' </div>\n');
            // undo if this messed up the text order
            if(currentText(parent_ip) != oldtext) {
                // TODO: is this plausible? can we remove the check?
                parent_ip.replaceWith(parent_before);
            }
        }
    }

    startnode = null;
    endnode = null;

    resetIds();
    var toselect = $(".snode[xxx=newnode]").first();

    // BUG when making XP and then use context menu: todo XXX

    selectNode(toselect.get(0));
    toselect.attr("xxx",null);
    updateSelection();
    resetIds();

    // toselect.mousedown(handleNodeClick);
}

/**
 * Delete a node.
 *
 * The node can only be deleted if doing so does not affect the text, i.e. it
 * directly dominates no non-empty terminals.
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
        } else if (!isPossibleTarget(startnode)) {
            // but other leaves are not deleted
            return;
        } else if (startnode == document.getElementById("sn0")) {
            return;
        }

        stackTree();

        var toselect = $(startnode).children().first();
        $(startnode).replaceWith($(startnode).children());
        startnode = endnode = null;
        // not needed, strictly removing
        // resetIds();
        selectNode(toselect.get(0));
        updateSelection();
    }
}

/**
 * Sets the label of a node
 *
 * Contains none of the heuristics of {@link setLabel}.
 *
 * @param {JQuery Node} node the target node
 * @param {String} label the new label
 * @param {Boolean} noUndo whether to record this operation for later undo
 */
function setNodeLabel(node, label, noUndo) {
    // TODO: fold this and setLabelLL together...
    if (!noUndo) {
        stackTree();
    }
    setLabelLL(node, label);
}

function setLeafLabel(node, label) {
    if (!node.hasClass(".wnode")) {
        node = node.children(".wnode").first();
    }
    textNode(node).replaceWith($.trim(label));
}

// TODO: need a setLemma function as well

function appendExtension(node, extension, type) {
    if (!type) {
        type="-";
    }
    if (shouldIndexLeaf(node) && !isNaN(extension)) {
        // Adding an index to an empty category, and the EC is not an
        // empty operator.  The final proviso is needed because of
        // things like the empty WADJP in comparatives.
        var oldLabel = textNode(node.children(".wnode").first()).text();;
        setLeafLabel(node, oldLabel + type + extension);
    } else {
        setNodeLabel(node, getLabel(node) + type + extension, true);
    }
}

function getTokenRoot(node) {
    return $(node).parents().andSelf().filter("#sn0>.snode").get(0);
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

function shouldIndexLeaf(node) {
    // The below check bogusly returns true if the leftmost node in a tree is
    // a trace, even if it is not a direct daughter.  Only do the more
    // complicated check if we are at a POS label, otherwise short circuit
    if (node.children(".wnode").size() == 0) return false;
    var str = wnodeString(node);
    return (str.substring(0,3) == "*T*" ||
            str.substring(0,5) == "*ICH*" ||
            str.substring(0,4) == "*CL*" ||
            $.trim(str) == "*");
}

function getIndex(node) {
    if (shouldIndexLeaf(node)) {
        return parseIndex(textNode(node.children(".wnode").first()).text());
    } else {
        return parseIndex(getLabel(node));
    }
}

function parseIndexType(label){
    var lastindex = Math.max(label.lastIndexOf("-"), label.lastIndexOf("="));
    return label.charAt(lastindex);
}

function getIndexType (node) {
    if (getIndex(node) < 0) {
        return -1;
    }
    var label;
    if (shouldIndexLeaf(node)) {
        label = wnodeString(node);
    } else {
        label = getLabel(node);
    }
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

function addToIndices(tokenRoot, numberToAdd) {
    var ind = 1;
    var maxindex = maxIndex(tokenRoot);
    var nodes = tokenRoot.find(".snode,.wnode").andSelf();
    nodes.each(function(index) {
        var curNode = $(this);
        var nindex = getIndex(curNode);
        if (nindex > 0) {
            if (shouldIndexLeaf(curNode)) {
                var leafText = wnodeString(curNode);
                leafText = parseLabel(leafText) + parseIndexType(leafText);
                textNode(curNode.children(".wnode").first()).text(
                    leafText + (nindex + numberToAdd));
            } else {
                var label = getLabel(curNode);
                label = parseLabel(label) + parseIndexType(label);
                label = label + (nindex + numberToAdd);
                setNodeLabel(curNode, label, true);
            }
        }
    });
}

function maxIndex(token) {
    var allSNodes = $(token).find(".snode,.wnode");
    var temp = "";
    var ind = 0;
    var label;

    for (var i = 0; i < allSNodes.length; i++) {
        label = getLabel($(allSNodes[i]));
        ind = Math.max(parseIndex(label), ind);
    }
    return ind;
}

function removeIndex(node) {
    node = $(node);
    if (getIndex(node) == -1) {
        return;
    }
    var label, setLabelFn;
    if (shouldIndexLeaf(node)) {
        label = wnodeString(node);
        setLabelFn = setLeafLabel;
    } else {
        label = getLabel(node);
        setLabelFn = setNodeLabel;
    }
    setLabelFn(node,
               label.substr(0, Math.max(label.lastIndexOf("-"),
                                        label.lastIndexOf("="))),
               true);
}

/**
 * Coindex nodes.
 *
 * Coindex the two selected nodes.  If they are already coindexed, toggle
 * types of coindexation (normal -> gapping -> backwards gapping -> double
 * gapping -> no indices).  If only one node is selected, remove its index.
 */
function coIndex() {
    if (startnode && !endnode) {
        if (getIndex($(startnode)) > 0) {
            stackTree();
            removeIndex(startnode);
        }
    } else if (startnode && endnode) {
        // don't do anything if different token roots
        var startRoot = getTokenRoot($(startnode));
        var endRoot = getTokenRoot($(endnode));
        if (startRoot != endRoot) {
            return;
        }
        // if both nodes already have an index
        if (getIndex($(startnode)) > 0 && getIndex($(endnode)) > 0) {
            // and if it is the same index
            if (getIndex($(startnode)) == getIndex($(endnode))) {
                var theIndex = getIndex($(startnode));
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

function resetIds(really) {
    if (really){
        var snodes = $(".snode");
        for (var i = 0; i < snodes.length; i++) {
            snodes[i].id = "sn" + i;
        }
    }
}

function wnodeString(node) {
    var text = $(node).find('.wnode').text();
    return text;
}

function jsonToTree(json) {
    var d = JSON.parse(json);
    return objectToTree(d);
}

function objectToTree(o) {
    var res = "";
    for (var p in o) {
        if (o.hasOwnProperty(p)) {
            res += "(" + p + " ";
            if (typeof o[p] == "string") { // One of life's grosser hacks
                res += o[p];
            } else {
                res += objectToTree(o[p]);
            }
            res += ")";
        }
    }
    return res;
}

function toLabeledBrackets(node) {
    var out = node.clone();

    // The ZZZZZ is a placeholder; first we want to clean any
    // double-linebreaks from the output (which will be spurious), then we
    // will turn the Z's into double-linebreaks
    out.find(".snode:not(#sn0)").each(function () {
        this.insertBefore(document.createTextNode("("), this.firstChild);
        this.appendChild(document.createTextNode(")"));
    });

    out.find("#sn0>.snode").each(function () {
        $(this).append(jsonToTree(this.getAttribute("data-metadata")));
        this.insertBefore(document.createTextNode("( "), this.firstChild);
        this.appendChild(document.createTextNode(")ZZZZZ"));
    });

    out.find(".wnode").each(function () {
        this.insertBefore(document.createTextNode(" "), this.firstChild);
    });

    out = out.text();
    // Must use rx for string replace bc using a string doesn't get a
    // global replace.
    out = out.replace(/\)\(/g, ") (");
    out = out.replace(/  +/g, " ");
    out = out.replace(/\n\n+/g,"\n");
    out = out.replace(/ZZZZZ/g, "\n\n");
    // If there is a space after the word but before the closing paren, it
    // will make CorpusSearch unhappy.
    out = out.replace(/ +\)/g, ")");
    // Ditto for spaces btw. word and lemma, in dash format
    out = out.replace(/- +/g, "-");


    return out;
}

var lemmataStyleNode, lemmataHidden = false;
(function () {
    lemmataStyleNode = document.createElement("style");
    lemmataStyleNode.setAttribute("type", "text/css");
    document.getElementsByTagName("head")[0].appendChild(lemmataStyleNode);
    lemmataStyleNode.innerHTML = ".lemma { display: none; }";
})();

/**
 * Toggle display of lemmata.
 */
function toggleLemmata() {
    if (lemmataHidden) {
        lemmataStyleNode.innerHTML = "";
    } else {
        lemmataStyleNode.innerHTML = ".lemma { display: none; }";
    }
    lemmataHidden = !lemmataHidden;
}

var lastsavedstate = $("#editpane").html();

function quitServer() {
    if ($("#editpane").html() != lastsavedstate) {
        alert("Cannot exit, unsaved changes exist.");
    } else {
        $.post("/doExit");
        window.onbeforeunload = undefined;
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

// A low-level (LL) version of setLabel.  It is only responsible for changing
// the label; not doing any kind of matching/changing/other crap.
function setLabelLL(node, label) {
    // TODO: don't add numeric indices to the CSS class
    if (node.hasClass("snode")) {
        if (label[label.length - 1] != " ") {
            // Some other spots in the code depend on the label ending with a
            // space...
            label += " ";
        }
    } else if (node.hasClass("wnode")) {
        // Words cannot have a trailing space, or CS barfs on save.
        label = $.trim(label);
    } else {
        return;
    }
    var oldLabel = $.trim(textNode(node).text());
    textNode(node).replaceWith(label);
    if (node.hasClass("snode")) {
        node.removeClass(oldLabel);
        node.addClass($.trim(label));
    }
}

function textNode(node) {
    return node.contents().filter(function() {
                                         return this.nodeType == 3;
                                     }).first();
}

function isLeafNode(node) {
    // TODO (AWE): for certain purposes, it would be desirable to treat leaf
    // nodes as non-leaves.  e.g. for dash tag toggling, a trace should be
    // "not a leaf"
    return $(node).children(".wnode").size() > 0 &&
        !($(node).children(".wnode").text()[0] == "*");
}

var validatingCurrently = false;

function validateTrees(e) {
    if (!validatingCurrently) {
        validatingCurrently = true;
        displayInfo("Validating...");
        setTimeout(function () {
            // TODO: since this is a settimeout, do we need to also make it async?
            validateTreesSync(true, e.shiftKey);
        }, 0);
    }
}

function validateTreesSync(async, shift) {
    var toValidate = toLabeledBrackets($("#editpane"));
    $.ajax("/doValidate",
           { type: 'POST',
             url: "/doValidate",
             data: { trees: toValidate,
                     validator: $("#validatorsSelect").val(),
                     shift: shift
                   },
             success: validateHandler,
             async: async,
             dataType: "json"
           });
}

function validateHandler(data) {
    if (data['result'] == "success") {
        displayInfo("Validate success.");
        $("#editpane").html(data['html']);
        documentReadyHandler();
    } else if (data['result'] == "failure") {
        displayWarning("Validate failed: " + data['reason']);
    }
    validatingCurrently = false;
    // TODO(AWE): more nuanced distinction between validation found errors and
    // validation script itself contains errors
}

function nextValidationError() {
    var docViewTop = $(window).scrollTop();
    var docViewMiddle = docViewTop + $(window).height() / 2;
    var nextError = $(".snode[class*=\"FLAG\"],.snode[class$=\"FLAG\"]").filter(
        function () {
            return $(this).offset().top > docViewMiddle;
        }).first();
    if (nextError) {
        window.scroll(0, nextError.offset().top - $(window).height() * 0.25);
    }
}

function hasDashTag(node, tag) {
    var label = getLabel(node);
    var tags = label.split("-").slice(1);
    return (tags.indexOf(tag) > -1);
}

// TODO: something is wrong with this fn -- it also turns FLAG on
function fixError() {
    if (!startnode || endnode) return;
    var sn = $(startnode);
    if (hasDashTag(sn, "FLAG")) {
        toggleExtension("FLAG", ["FLAG"]);
    }
    updateSelection();
}

function zeroDashTags() {
    if (!startnode || endnode) return;
    stackTree();
    var label = getLabel($(startnode));
    var idx = parseIndex(label),
        idxType = parseIndexType(label),
        lab = parseLabel(label);
    if (idx == -1) {
        idx = idxType = "";
    }
    setLabelLL($(startnode), lab.split("-")[0] + idxType + idx);
}

function getMetadata(node) {
    var m = node.attr("data-metadata");
    if (m) {
        return JSON.parse(m);
    } else {
        return undefined;
    }
}

// TODO(AWE): add getMetadataTU fn, to also do trickle-up of metadata.

function dictionaryToForm(dict, level) {
    if (!level) {
        level = 0;
    }
    var res = "";
    if (dict) {
        res = '<table class="metadataTable"><thead><tr><td>Key</td>' +
            '<td>Value</td></tr></thead>';
        for (var k in dict) {
            if (dict.hasOwnProperty(k)) {
                if (typeof dict[k] == "string") {
                    res += '<tr class="strval" data-level="' + level +
                        '"><td class="key">' + '<span style="width:"' +
                        4*level + 'px;"></span>' + k +
                        '</td><td class="val"><input class="metadataField" ' +
                        'type="text" name="' + k + '" value="' + dict[k] +
                        '" /></td></tr>';
                } else if (typeof dict[k] == "object") {
                    res += '<tr class="tabhead"><td colspan=2>' + k +
                        '</td></tr>';
                    res += dictionaryToForm(dict[k], level + 1);
                }
            }
        }
        res += '</table>';
    }
    return res;
}

function saveMetadata() {
    if ($("#metadata").html() != "") {
        $(startnode).attr("data-metadata",
                          JSON.stringify(formToDictionary($("#metadata"))));
    }
}

function updateMetadataEditor() {
    if (!startnode || endnode) {
        $("#metadata").html("");
        return;
    }
    var addButtonHtml = '<input type="button" id="addMetadataButton" ' +
            'value="Add" />';
    $("#metadata").html(dictionaryToForm(getMetadata($(startnode))) +
                        addButtonHtml);
    $("#metadata").find(".metadataField").change(saveMetadata).
        focusout(saveMetadata).keydown(function (e) {
            if (e.keyCode == 13) {
                $(e.target).blur();
            }
            e.stopPropagation();
            return true;
        });
    $("#metadata").find(".key").click(metadataKeyClick);
    $("#addMetadataButton").click(addMetadataDialog);
}

function formToDictionary(form) {
    var d = {},
        dstack = [],
        curlevel = 0,
        namestack = [];
    form.find("tr").each(function() {
        if ($(this).hasClass("strval")) {
            var key = $(this).children(".key").text();
            var val = $(this).find(".val>.metadataField").val();
            d[key] = val;
            if ($(this).attr("data-level") < curlevel) {
                var new_d = dstack.pop();
                var next_name = namestack.pop();
                new_d[next_name] = d;
                d = new_d;
            }
        } else if ($(this).hasClass("tabhead")) {
            namestack.push($(this).text());
            curlevel = $(this).attr("data-level");
            dstack.push(d);
            d = {};
        }
    });
    if (dstack.length > 0) {
        var len = dstack.length;
        for (var i = 0; i < len; i++) {
            var new_d = dstack.pop();
            var next_name = namestack.pop();
            new_d[next_name] = d;
            d = new_d;
        }
    }
    return d;
}

function metadataKeyClick(e) {
    var keyNode = e.target;
    var html = 'Name: <input type="text" ' +
            'id="metadataNewName" value="' + $(keyNode).text() +
            '" /><div id="dialogButtons"><input type="button" value="Save" ' +
        'id="metadataKeySave" /><input type="button" value="Delete" ' +
        'id="metadataKeyDelete" /></div>';
    showDialogBox("Edit Metadata", html);
    // TODO: make focus go to end, or select whole thing?
    $("#metadataNewName").focus();
    function saveMetadataInner() {
        $(keyNode).text($("#metadataNewName").val());
        hideDialogBox();
        saveMetadata();
    }
    function deleteMetadata() {
        $(keyNode).parent().remove();
        hideDialogBox();
        saveMetadata();
    }
    $("#metadataKeySave").click(saveMetadataInner);
    setInputFieldEnter($("#metadataNewName"), saveMetadataInner);
    $("#metadataKeyDelete").click(deleteMetadata);
}

function addMetadataDialog() {
    // TODO: allow specifying value too in initial dialog?
    var html = 'New Name: <input type="text" id="metadataNewName" value="NEW" />' +
            '<div id="dialogButtons"><input type="button" id="addMetadata" ' +
            'value="Add" /></div>';
    showDialogBox("Add Metatata", html);
    function addMetadata() {
        var oldMetadata = formToDictionary($("#metadata"));
        oldMetadata[$("#metadataNewName").val()] = "NEW";
        $(startnode).attr("data-metadata", JSON.stringify(oldMetadata));
        updateMetadataEditor();
        hideDialogBox();
    }
    $("#addMetadata").click(addMetadata);
    setInputFieldEnter($("#metadataNewName"), addMetadata);
}

function setInputFieldEnter(field, fn) {
    field.keydown(function (e) {
        if (e.keyCode == 13) {
            fn();
            return false;
        } else {
            return true;
        }
    });
}

function displayWarning(html) {
    $("#messageBoxInner").html(html).css("color", "orange");
}

function displayInfo(html) {
    $("#messageBoxInner").html(html).css("color", "green");
}

function displayError(html) {
    $("#messageBoxInner").html(html).css("color", "red");
}

function displayTreeIndex(text) {
    $("#treeIndexDisplay").text(text);
}

// TODO: should allow numeric indices
function basesAndDashes(bases, dashes) {
    function _basesAndDashes(string) {
        var spl = string.split("-");
        var b = spl.shift();
        return (bases.indexOf(b) > -1) &&
            _.all(spl, function (x) { return (dashes.indexOf(x) > -1); });
    }
    return _basesAndDashes;
}

function goToTree() {
    function goTo() {
        var i;
        var treeIndex = $("#gotoInput").val();
        advanceTree(undefined, false, treeIndex - currentIndex);
        hideDialogBox();
    }
    var html = "Enter the index of the tree you'd like to jump to: \
<input type='text' id='gotoInput' value=' ' /><div id='dialogButtons'><input type='button' id='gotoButton'\
 value='GoTo' /></div>";
    showDialogBox("GoTo Tree", html, goTo);
    $("#gotoButton").click(goTo);
    $("#gotoInput").focus();
}

function nextTree(e) {
    var find = undefined;
    if (e.shiftKey) find = "-FLAG";
    advanceTree(find, false, 1);
}

function prevTree(e) {
    var find = undefined;
    if (e.shiftKey) find = "-FLAG";
    advanceTree(find, false, -1);
}

function advanceTree(find, async, offset) {
    var theTrees = toLabeledBrackets($("#editpane"));
    displayInfo("Fetching tree...");
    return $.ajax("/advanceTree",
                  { async: async,
                    success: function(res) {
                        if (res['result'] == "failure") {
                            displayWarning("Fetching tree failed: " + res['reason']);
                        } else {
                            // TODO: what to do about the save warning
                            $("#editpane").html(res['tree']);
                            documentReadyHandler();
                            undostack = new Array();
                            currentIndex = res['treeIndexStart'] + 1;
                            displayInfo("Tree " + currentIndex + " fetched.");
                            displayTreeIndex("Editing tree #" + currentIndex + " out of " + res['totalTrees']);
                        }
                    },
                    dataType: "json",
                    type: "POST",
                    data: { trees: theTrees,
                            find: find,
                            offset: offset
                          }});
}

function splitWord() {
    if (!startnode || endnode) return;
    if (!isLeafNode($(startnode))) return;
    var wordSplit = wnodeString($(startnode)).split("-");
    var origWord = wordSplit[0];
    var origLemma = "XXX";
    if (wordSplit.length == 2) {
        origLemma = "@" + wordSplit[1] + "@";
    }
    var origLabel = getLabel($(startnode));
    function doSplit() {
        var words = $("#splitWordInput").val().split("@");
        if (words.join("") != origWord) {
            displayWarning("The two new words don't match the original.  Aborting");
            return;
        }
        if (words.length != 2) {
            displayWarning("You can only split in one place at a time.");
            return;
        }
        var labelSplit = origLabel.split("+");
        var secondLabel = "X";
        if (labelSplit.length == 2) {
            setLeafLabel($(startnode), labelSplit[0]);
            secondLabel = labelSplit[1];
        }
        setLeafLabel($(startnode), words[0] + "@");
        var hasLemma = $(startnode).find(".lemma").size() > 0;
        makeLeaf(false, secondLabel, "@" + words[1]);
        if (hasLemma) {
            // TODO: move to something like foo@1 and foo@2 for the two pieces
            // of the lemmata
            addLemma(origLemma);
        }
        hideDialogBox();
    }
    var html = "Enter an at-sign at the place to split the word: \
<input type='text' id='splitWordInput' value='" + origWord +
"' /><div id='dialogButtons'><input type='button' id='splitWordButton'\
 value='Split' /></div>";
    showDialogBox("Split word", html, doSplit);
    $("#splitWordButton").click(doSplit);
    $("#splitWordInput").focus();
}

function addLemma(lemma) {
    // This only makes sense for dash-format corpora
    if (!startnode || endnode) return;
    if (!isLeafNode($(startnode))) return;
    var theLemma = $("<span class='lemma'>-" + lemma +
                     "</span>");
    $(startnode).children(".wnode").append(theLemma);
}

function untilSuccess() {
    for (var i = 0; i < arguments.length; i++) {
        var fn = arguments[i][0],
            args = arguments[i].slice(1);
        var res = fn.apply(null, args);
        if (res) {
            return;
        }
    }
}

// TODO: badly need a DSL for forms

// Local Variables:
// js2-additional-externs: ("$" "setTimeout" "customCommands\
// " "customConLeafBefore" "customConMenuGroups" "extensions" "vextensions\
// " "clause_extensions" "JSON" "testValidLeafLabel" "testValidPhraseLabel\
// " "_" "startTime" "console" "loadContextMenu" "disableUndo")
// indent-tabs-mode: nil
// End:
