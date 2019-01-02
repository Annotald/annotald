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
// - modularize doc -- namespaces?
// - make key commands for case available

// TODO: for unsaved ch warning: use tolabeledbrax, not html...html is
// sensitive to search highlight, selection, etc

// Table of contents:
// * Initialization
// * User configuration
// ** CSS styles
// ** Key bindings
// * UI functions
// ** Event handlers
// ** Context Menu
// ** Messages
// ** Dialog boxes
// ** Selection
// ** Metadata editor
// ** Splitting words
// ** Editing parts of the tree
// ** Search
// *** HTML strings and other globals
// *** Event handlers
// *** Helper functions
// *** Search interpretation function
// *** The core search function
// * Tree manipulations
// ** Movement
// ** Creation
// ** Deletion
// ** Label manipulation
// ** Coindexation
// * Server-side operations
// ** Saving
// *** Save helper function
// ** Validating
// ** Advancing through the file
// ** Idle/resume
// ** Quitting
// * Undo/redo
// * Misc
// * Misc (candidates to move to utils)
// End TOC

// ===== Initialization

/**
 * This variable holds the selected node, or "start" node if multiple
 * selection is in effect.  Otherwise undefined.
 *
 * @type Node
 */
var startnode = null;
/**
 * This variable holds the "end" node if multiple selection is in effect.
 * Otherwise undefined.
 *
 * @type Node
 */
var endnode = null;
var ctrlKeyMap = {};
var shiftKeyMap = {};
var regularKeyMap = {};

var startuphooks = [];

var last_event_was_mouse = false;
var lastsavedstate = "";

var globalStyle = $('<style type="text/css"></style>');

var lemmataStyleNode, lemmataHidden = true;
(function () {
    lemmataStyleNode = document.createElement("style");
    lemmataStyleNode.setAttribute("type", "text/css");
    document.getElementsByTagName("head")[0].appendChild(lemmataStyleNode);
    lemmataStyleNode.innerHTML = ".lemma { display: none; }";
})();

var currentIndex = 1; // TODO: move to where it goes

if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function(str) {
        return (this.substr(0, str.length) === str);
    };
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(str) {
        return (this.substr(this.length - str.length) === str);
    };
}

function navigationWarning() {
    if ($("#editpane").html() != lastsavedstate) {
        return "Unsaved changes exist, are you sure you want to leave the page?";
    }
    return undefined;
}

function logUnload() {
    logEvent("page-unload");
}

addStartupHook(function() {
    logEvent("page-load");
});

function assignEvents() {
    // load custom commands from user settings file
    customCommands();
    document.body.onkeydown = handleKeyDown;
    $("#sn0").mousedown(handleNodeClick);
    document.body.onmouseup = killTextSelection;
    $("#butsave").mousedown(save);
    $("#butundo").mousedown(undo);
    $("#butredo").mousedown(redo);
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
    window.onunload = logUnload;
}

function styleIpNodes() {
    if (typeof ipnodes !== "undefined") {
        for (var i = 0; i < ipnodes.length; i++) {
            styleTag(ipnodes[i], "border-top: 1px solid black;" +
                     "border-bottom: 1px solid black;" +
                     "background-color: #C5908E;");
        }
    }
}

function addStartupHook(fn) {
    startuphooks.push(fn);
}

function documentReadyHandler() {
    // TODO: something is very slow here; profile
    // TODO: move some of this into hooks
    assignEvents();
    styleIpNodes();
    setupCommentTypes();
    globalStyle.appendTo("head");

    _.each(startuphooks, function (hook) {
        hook();
    });

    lastsavedstate = $("#editpane").html();
}

$(document).ready(function () {
    documentReadyHandler();
});

// ===== User configuration

// ========== CSS styles

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

// ========== Key bindings

/**
 * Add a keybinding command.
 *
 * Calls to this function should be in the `settings.js` file, grouped in a
 * function called `customCommands`
 *
 * @param {Object} dict a mapping of properties of the keybinding.  Can
 * contain:
 *
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

// ===== UI functions

// ========== Event handlers

function killTextSelection() {
    if (dialogShowing) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
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

var keyDownHooks = [];

function addKeyDownHook(fn) {
    keyDownHooks.push(fn);
}

function handleKeyDown(e) {
    if ((e.ctrlKey && e.shiftKey) || e.metaKey || e.altKey) {
        // unsupported modifier combinations
        return true;
    }
    if (e.keyCode == 16 || e.keyCode == 17 || e.keyCode == 18) {
        // Don't handle shift, ctrl, and meta presses
        return true;
    }
    // Becasuse of bug #75, we don't want to count keys used for scrolling as
    // keypresses that interrupt a chain of mouse clicks.
    if (! _.contains([33, //page up
                      34, // page down
                      37,38,39,40 // arrow keys
                     ], e.keyCode)) {
        last_event_was_mouse = false;
    }
    var commandMap;
    if (e.ctrlKey) {
        commandMap = ctrlKeyMap;
    } else if (e.shiftKey) {
        commandMap = shiftKeyMap;
    } else {
        commandMap = regularKeyMap;
    }
    if (!commandMap[e.keyCode]) {
        return true;
    }
    e.preventDefault();
    var theFn = commandMap[e.keyCode].func;
    var theArgs = commandMap[e.keyCode].args;
    _.each(keyDownHooks, function (fn) {
        fn({
            keyCode: e.keyCode,
            shift: e.shiftKey,
            ctrl: e.ctrlKey
           },
          theFn,
          theArgs);
    });
    theFn.apply(undefined, theArgs);
    if (!theFn.async) {
        undoBarrier();
    }
    return false;
}

var clickHooks = [];

function addClickHook(fn) {
    clickHooks.push(fn);
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
                showContextMenu(e);
            }
        } else if (startnode && endnode) {
            e.stopPropagation();
            moveNodes(element);
        } else {
            showContextMenu(e);
        }
    } else {
        // leftclick
        hideContextMenu();
        if (e.shiftKey && startnode) {
            selectNode(element, true);
            e.preventDefault(); // Otherwise, this sets the text
                                // selection in the browser...
        } else {
            selectNode(element);
            if (e.ctrlKey) {
                makeNode("XP");
            }
        }
    }
    _.each(clickHooks, function (fn) {
        fn(e.button);
    });
    e.stopPropagation();
    last_event_was_mouse = true;
    undoBarrier();
}

// ========== Context Menu

function showContextMenu(e) {
    var element = e.target || e.srcElement;
    if (element == document.getElementById("sn0")) {
        clearSelection();
        return;
    }

    var left = e.pageX;
    var top = e.pageY;
    left = left + "px";
    top = top + "px";

    var conl = $("#conLeft"),
        conr = $("#conRight"),
        conrr = $("#conRightest"),
        conm = $("#conMenu");

    conl.empty();
    loadContextMenu(element);

    // Make the columns equally high
    conl.height("auto");
    conr.height("auto");
    conrr.height("auto");
    var h = _.max([conl,conr,conrr], function (x) { return x.height(); });
    conl.height(h);
    conr.height(h);
    conrr.height(h);

    conm.css("left",left);
    conm.css("top",top);
    conm.css("visibility","visible");
}

function hideContextMenu() {
    $("#conMenu").css("visibility","hidden");
}

// ========== Messages

/**
 * Show the message history.
 */
function showMessageHistory() {
    showDialogBox("Messages", "<textarea readonly='readonly' " +
                  "style='width:100%;height:100%;'>" +
                  messageHistory + "</textarea>");
}
addStartupHook(function () {
    $("#messagesTitle").click(showMessageHistory);
});

// ========== Dialog boxes

var dialogShowing = false;

/**
 * Show a dialog box.
 *
 * This function creates keybindings for the escape (to close dialog box) and
 * return (caller-specified behavior) keys.
 *
 * @param {String} title the title of the dialog box
 * @param {String} html the html to display in the dialog box
 * @param {Function} returnFn a function to call when return is pressed
 * @param {Function} hideHook a function to run when hiding the dialog box
 */
function showDialogBox(title, html, returnFn, hideHook) {
    document.body.onkeydown = function (e) {
        if (e.keyCode == 27) { // escape
            if (hideHook) {
                hideHook();
            }
            hideDialogBox();
        } else if (e.keyCode == 13 && returnFn) {
            returnFn();
        }
    };
    html = '<div class="menuTitle">' + title + '</div>' +
        '<div id="dialogContent">' + html + '</div>';
    $("#dialogBox").html(html).get(0).style.visibility = "visible";
    $("#dialogBackground").get(0).style.visibility = "visible";
    dialogShowing = true;
}

/**
 * Hide the displayed dialog box.
 */
function hideDialogBox() {
    $("#dialogBox").get(0).style.visibility = "hidden";
    $("#dialogBackground").get(0).style.visibility = "hidden";
    document.body.onkeydown = handleKeyDown;
    dialogShowing = false;
}

/**
 * Set a handler for the enter key in a text box.
 * @private
 */
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

// ========== Selection

/**
 * Select a node, and update the GUI to reflect that.
 *
 * @param {Node} node the node to be selected
 * @param {Boolean} force if true, force this node to be a secondary
 * selection, even if it wouldn't otherwise be.
 */
function selectNode(node, force) {
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

        while (!$(node).hasClass("snode") && node != document) {
            node = node.parentNode;
        }

        if (node == startnode) {
            startnode = null;
            if (endnode) {
                startnode = endnode;
                endnode = null;
            }
        } else if (startnode === null) {
            startnode = node;
        } else {
            if (startnode && (last_event_was_mouse || force)) {
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
    updateUrtext();
}

function updateUrtext() {
    if (startnode) {
        var tr = getTokenRoot($(startnode));
        var str = currentTextPretty($(tr), " ");
        var md = JSON.parse(tr.getAttribute("data-metadata"));
        var id = (md || {ID: ""}).ID;
        if (id !== "") {
            id = "<b>" + id + "</b>: ";
        }
        $("#urtext").html(id + escapeHtml(str)).show();
    } else {
        $("#urtext").hide();
    }
}

addStartupHook(function () {
    $("#urtext").hide();
});

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

// ========== Metadata editor

function saveMetadata() {
    if ($("#metadata").html() !== "") {
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

// ========== Splitting words

function splitWord() {
    if (!startnode || endnode) return;
    if (!isLeafNode($(startnode)) || isEmpty(wnodeString($(startnode)))) return;
    undoBeginTransaction();
    touchTree($(startnode));
    var wordSplit = wnodeString($(startnode)).split("-");
    var origWord = wordSplit[0];
    var startsWithAt = false, endsWithAt = false;
    if (origWord[0] == "@") {
        startsWithAt = true;
        origWord = origWord.substr(1);
    }
    if (origWord.substr(origWord.length - 1, 1) == "@") {
        endsWithAt = true;
        origWord = origWord.substr(0, origWord.length - 1);
    }
    var origLemma = "XXX";
    if (wordSplit.length == 2) {
        origLemma = "@" + wordSplit[1] + "@";
    }
    var origLabel = getLabel($(startnode));
    function doSplit() {
        var words = $("#splitWordInput").val().split("@");
        if (words.join("") != origWord) {
            displayWarning("The two new words don't match the original.  Aborting");
            undoAbortTransaction();
            return;
        }
        if (words.length < 0) {
            displayWarning("You have not specified where to split the word.");
            undoAbortTransaction();
            return;
        }
        if (words.length > 2) {
            displayWarning("You can only split in one place at a time.");
            undoAbortTransaction();
            return;
        }
        var labelSplit = origLabel.split("+");
        var secondLabel = "X";
        if (labelSplit.length == 2) {
            setLeafLabel($(startnode), labelSplit[0]);
            secondLabel = labelSplit[1];
        }
        setLeafLabel($(startnode), (startsWithAt ? "@" : "") + words[0] + "@");
        var hasLemma = $(startnode).find(".lemma").size() > 0;
        makeLeaf(false, secondLabel, "@" + words[1] + (endsWithAt ? "@" : ""));
        if (hasLemma) {
            // TODO: move to something like foo@1 and foo@2 for the two pieces
            // of the lemmata
            addLemma(origLemma);
        }
        hideDialogBox();
        undoEndTransaction();
        undoBarrier();
    }
    var html = "Enter an at-sign at the place to split the word: \
<input type='text' id='splitWordInput' value='" + origWord +
"' /><div id='dialogButtons'><input type='button' id='splitWordButton'\
 value='Split' /></div>";
    showDialogBox("Split word", html, doSplit);
    $("#splitWordButton").click(doSplit);
    $("#splitWordInput").focus();
}
splitWord.async = true;

// ========== Editing parts of the tree

// TODO: document entry points better
// DONE(?): split these fns up...they are monsters.  (or split to sep. file?)

/**
 * Perform an appropriate editing operation on the selected node.
 */
function editNode() {
    if (getLabel($(startnode)) == "CODE" &&
        _.contains(commentTypes,
                   // strip leading { and the : and everything after
                   wnodeString($(startnode)).substr(1).split(":")[0])
        ) {
        editComment();
    } else {
        displayRename();
    }
}

var commentTypeCheckboxes = "Type of comment: ";

function setupCommentTypes() {
    if (typeof commentTypes !== "undefined") {
        for (var i = 0; i < commentTypes.length; i++) {
            commentTypeCheckboxes +=
                '<input type="radio" name="commentType" value="' +
                commentTypes[i] + '" id="commentType' + commentTypes[i] +
                '" /> ' + commentTypes[i];
        }
    }
}

function editComment() {
    if (!startnode || endnode) return;
    touchTree($(startnode));
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
 * Return the JQuery object with the editor for a leaf node.
 * @private
 */
function leafEditorHtml(label, word, lemma) {
    // Single quotes mess up the HTML code.
    if (lemma) lemma = lemma.replace(/'/g, "&#39;");
    word = word.replace(/'/g, "&#39;");
    label = label.replace(/'/g, "&#39;");

    var editorHtml = "<div id='leafeditor' class='snode'>" +
            "<input id='leafphrasebox' class='labeledit' type='text' value='" +
            label +
            "' /><input id='leaftextbox' class='labeledit' type='text' value='" +
            word +
            "' " + (!isEmpty(word) ? "disabled='disabled'" : "") + " />";
    if (lemma) {
        editorHtml += "<input id='leaflemmabox' class='labeledit' " +
            "type='text' value='" + lemma + "' />";
    }
    editorHtml += "</div>";

    return $(editorHtml);
}

/**
 * Return the JQuery object with the replacement after editing a leaf node.
 * @private
 */
function leafEditorReplacement(label, word, lemma) {
    if (lemma) {
        lemma = lemma.replace(/</g,"&lt;");
        lemma = lemma.replace(/>/g,"&gt;");
        lemma = lemma.replace(/'/g,"&#39;");
    }

    word = word.replace(/</g,"&lt;");
    word = word.replace(/>/g,"&gt;");
    word = word.replace(/'/g,"&#39;");

    // TODO: test for illegal chars in label
    label = label.toUpperCase();

    var replText = "<div class='snode'>" + label +
            " <span class='wnode'>" + word;
    if (lemma) {
        replText += "<span class='lemma'>-" +
            lemma + "</span>";
    }
    replText += "</span></div>";
    return $(replText);
}

/**
 * Edit the selected node
 *
 * If the selected node is a terminal, edit its label, and lemma.  The text is
 * available for editing if it is an empty node (trace, comment, etc.).  If a
 * non-terminal, edit the node label.
 */
function displayRename() {
    // Inner functions
    function space(event) {
        var element = (event.target || event.srcElement);
        $(element).val($(element).val());
        event.preventDefault();
    }
    function postChange(newNode) {
        if (newNode) {
            updateCssClass(newNode, oldClass);
            startnode = endnode = null;
            updateSelection();
            document.body.onkeydown = handleKeyDown;
            $("#sn0").mousedown(handleNodeClick);
            $("#editpane").mousedown(clearSelection);
            $("#butundo").prop("disabled", false);
            $("#butredo").prop("disabled", false);
            $("#butsave").prop("disabled", false);
        }
    }

    // Begin code
    if (!startnode || endnode) {
        return;
    }
    undoBeginTransaction();
    touchTree($(startnode));
    document.body.onkeydown = null;
    $("#sn0").unbind('mousedown');
    $("#editpane").unbind('mousedown');
    $("#butundo").prop("disabled", true);
    $("#butredo").prop("disabled", true);
    $("#butsave").prop("disabled", true);
    var label = getLabel($(startnode));
    var oldClass = parseLabel(label);

    if ($(startnode).children(".wnode").size() > 0) {
        // this is a terminal
        var word, lemma;
        // is this right? we still want to allow editing of index, maybe?
        var isLeaf = isLeafNode($(startnode));
        if ($(startnode).children(".wnode").children(".lemma").size() > 0) {
            var preword = $.trim($(startnode).children().first().text());
            preword = preword.split("-");
            lemma = preword.pop();
            word = preword.join("-");
        } else {
            word = $.trim($(startnode).children().first().text());
        }

        $(startnode).replaceWith(leafEditorHtml(label, word, lemma));

        $("#leafphrasebox,#leaftextbox,#leaflemmabox").keydown(
            function(event) {
                var replText, replNode;
                if (event.keyCode == 32) {
                    space(event);
                }
                if (event.keyCode == 27) {
                    replNode = leafEditorReplacement(label, word, lemma);
                    $("#leafeditor").replaceWith(replNode);
                    postChange(replNode);
                    undoAbortTransaction();
                }
                if (event.keyCode == 13) {
                    var newlabel = $("#leafphrasebox").val().toUpperCase();
                    var newword = $("#leaftextbox").val();
                    var newlemma;
                    if (lemma) {
                        newlemma = $('#leaflemmabox').val();
                    }

                    if (isLeafNode) {
                        if (typeof testValidLeafLabel !== "undefined") {
                            if (!testValidLeafLabel(newlabel)) {
                                displayWarning("Not a valid leaf label: '" +
                                               newlabel + "'.");
                                return;
                            }
                        }
                    } else {
                        if (typeof testValidPhraseLabel !== "undefined") {
                            if (!testValidPhraseLabel(newlabel)) {
                                displayWarning("Not a valid phrase label: '" +
                                               newlabel + "'.");
                                return;
                            }
                        }
                    }
                    if (newword + newlemma === "") {
                        displayWarning("Cannot create an empty leaf.");
                        return;
                    }
                    replNode = leafEditorReplacement(newlabel, newword,
                                                     newlemma);
                    $("#leafeditor").replaceWith(replNode);
                    postChange(replNode);
                    undoEndTransaction();
                    undoBarrier();
                }
                if (event.keyCode == 9) {
                    var element = (event.target || event.srcElement);
                    if ($("#leafphrasebox").is(element)) {
                        if (!$("#leaftextbox").attr("disabled")) {
                            $("#leaftextbox").focus();
                        } else if ($("#leaflemmabox").length == 1) {
                            $("#leaflemmabox").focus();
                        }
                    } else if ($("#leaftextbox").is(element)) {
                        if ($("#leaflemmabox").length == 1) {
                            $("#leaflemmabox").focus();
                        } else {
                            $("#leafphrasebox").focus();
                        }
                    } else if ($("#leaflemmabox").is(element)) {
                        $("#leafphrasebox").focus();
                    }
                    event.preventDefault();
                }
            }).mouseup(function editLeafClick(e) {
                e.stopPropagation();
            });
        setTimeout(function(){ $("#leafphrasebox").focus(); }, 10);
    } else {
        // this is not a terminal
        var editor = $("<input id='labelbox' class='labeledit' " +
                       "type='text' value='" + label + "' />");
        var origNode = $(startnode);
        var isWordLevelConj =
                origNode.children(".snode").children(".snode").size() === 0 &&
                // TODO: make configurable
                origNode.children(".CONJ") .size() > 0;
        textNode(origNode).replaceWith(editor);
        $("#labelbox").keydown(
            function(event) {
                if (event.keyCode == 9) {
                    event.preventDefault();
                }
                if (event.keyCode == 32) {
                    space(event);
                }
                if (event.keyCode == 27) {
                    $("#labelbox").replaceWith(label + " ");
                    postChange(origNode);
                    undoAbortTransaction();
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
                    undoEndTransaction();
                    undoBarrier();
                }
            }).mouseup(function editNonLeafClick(e) {
                e.stopPropagation();
            });
        setTimeout(function(){ $("#labelbox").focus(); }, 10);
    }
}
displayRename.async = true;

/**
 * Edit the lemma of a terminal node.
 */
function editLemma() {
    // Inner functions
    function space(event) {
        var element = (event.target || event.srcElement);
        $(element).val($(element).val());
        event.preventDefault();
    }
    function postChange() {
        startnode = null; endnode = null;
        updateSelection();
        document.body.onkeydown = handleKeyDown;
        $("#sn0").mousedown(handleNodeClick);
        $("#undo").attr("disabled", false);
        $("#redo").attr("disabled", false);
        $("#save").attr("disabled", false);
        undoBarrier();
    }

    // Begin code
    var childLemmata = $(startnode).children(".wnode").children(".lemma");
    if (!startnode || endnode || childLemmata.size() != 1) {
        return;
    }
    document.body.onkeydown = null;
    $("#sn0").unbind('mousedown');
    undoBeginTransaction();
    touchTree($(startnode));
    $("#undo").attr("disabled", true);
    $("#redo").attr("disabled", true);
    $("#save").attr("disabled", true);

    var lemma = $(startnode).children(".wnode").children(".lemma").text();
    lemma = lemma.substring(1);
    var editor=$("<span id='leafeditor' class='wnode'><input " +
                 "id='leaflemmabox' class='labeledit' type='text' value='" +
                 lemma + "' /></span>");
    $(startnode).children(".wnode").children(".lemma").replaceWith(editor);
    $("#leaflemmabox").keydown(
        function(event) {
            if (event.keyCode == 9) {
                event.preventDefault();
            }
            if (event.keyCode == 32) {
                space(event);
            }
            if (event.keyCode == 13) {
                var newlemma = $('#leaflemmabox').val();
                newlemma = newlemma.replace("<","&lt;");
                newlemma = newlemma.replace(">","&gt;");
                newlemma = newlemma.replace(/'/g,"&#39;");

                $("#leafeditor").replaceWith("<span class='lemma'>-" +
                                             newlemma + "</span>");
                postChange();
            }
            // TODO: escape
        });
    setTimeout(function(){ $("#leaflemmabox").focus(); }, 10);
}
editLemma.async = true;

// ========== Search

// TODO: anchor right end of string, so that NP does not match NPR, only NP or NP-X (???)

// TODO: profile this and optimize like crazy.

// =============== HTML strings and other globals

/**
 * The HTML code for a regular search node
 * @private
 * @constant
 */
// TODO: make the presence of a lemma search option contingent on the presence
// of lemmata in the corpus
var searchnodehtml = "<div class='searchnode'>" +
        "<div class='searchadddelbuttons'>" +
        "<input type='button' class='searchornodebut' " +
        "value='|' />" +
        "<input type='button' class='searchdeepnodebut' " +
        "value='D' />" +
        "<input type='button' class='searchprecnodebut' " +
        "value='>' />" +
        "<input type='button' class='searchdelnodebut' " +
        "value='-' />" +
        "<input type='button' class='searchnewnodebut' " +
        "value='+' />" +
        "</div>" +
        "<select class='searchtype'><option>Label</option>" +
        "<option>Text</option><option>Lemma</option></select>: " +
        "<input type='text' class='searchtext' />" +
        "</div>";

/**
 * The HTML code for an "or" search node
 * @private
 * @constant
 */
var searchornodehtml = "<div class='searchnode searchornode'>" +
        "<div class='searchadddelbuttons'>" +
        "<input type='button' class='searchdelnodebut' value='-' />" +
        "</div>" +
        "<input type='hidden' class='searchtype' value='Or' />OR<br />" +
        searchnodehtml + "</div>";

/**
 * The HTML code for a "deep" search node
 * @private
 * @constant
 */
var searchdeepnodehtml = "<div class='searchnode searchdeepnode'>" +
        "<div class='searchadddelbuttons'>" +
        "<input type='button' class='searchdelnodebut' value='-' />" +
        "</div>" +
        "<input type='hidden' class='searchtype' value='Deep' />...<br />" +
        searchnodehtml + "</div>";

/**
 * The HTML code for a "precedes" search node
 * @private
 * @constant
 */
var searchprecnodehtml = "<div class='searchnode searchprecnode'>" +
        "<div class='searchadddelbuttons'>" +
        "<input type='button' class='searchdelnodebut' value='-' />" +
        "</div>" +
        "<input type='hidden' class='searchtype' value='Prec' />&gt;<br />" +
        searchnodehtml + "</div>";

/**
 * The HTML code for a node to add new search nodes
 * @private
 * @constant
 */
var addsearchnodehtml = "<div class='newsearchnode'>" +
        "<input type='hidden' class='searchtype' value='NewNode' />+" +
        "</div>";

/**
 * The HTML code for the default starting search node
 * @private
 * @constant
 */
var searchhtml = "<div id='searchnodes' class='searchnode'><input type='hidden' " +
        "class='searchtype' value='Root' />" + searchnodehtml + "</div>";

/**
 * The last search
 *
 * So that it can be restored next time the dialog is opened.
 * @private
 */
var savedsearch = $(searchhtml);

addStartupHook(function () {
    $("#butsearch").click(search);
    $("#butnextmatch").click(nextSearchMatch);
    $("#butclearmatch").click(clearSearchMatches);
    $("#matchcommands").hide();
});

// =============== Event handlers

/**
 * Clear the highlighting from search matches.
 */
function clearSearchMatches() {
    $(".searchmatch").removeClass("searchmatch");
    $("#matchcommands").hide();
}

/**
 * Scroll down to the next node that matched a search.
 */
function nextSearchMatch(e, fromSearch) {
    if (!fromSearch) {
        if ($("#searchInc").prop('checked')) {
            doSearch();
        }
    }
    scrollToNext(".searchmatch");
}

/**
 * Add a sibling search node
 * @private
 */
function addSearchDaughter(e) {
    var node = $(e.target).parents(".searchnode").first();
    var newnode = $(searchnodehtml);
    node.append(newnode);
    searchNodePostAdd(newnode);
}

/**
 * Add a sibling search node
 * @private
 */
function addSearchSibling(e) {
    var node = $(e.target);
    var newnode = $(searchnodehtml);
    node.before(newnode);
    searchNodePostAdd(newnode);
}

/**
 * Delete a search node
 * @private
 */
function searchDelNode(e) {
    var node = $(e.target).parents(".searchnode").first();
    var tmp = $("#searchnodes").children(".searchnode:not(.newsearchnode)");
    if (tmp.length == 1 && tmp.is(node) &&
        node.children(".searchnode").length === 0) {
        displayWarning("Cannot remove only search term!");
        return;
    }
    var child = node.children(".searchnode").first();
    if (child.length == 1) {
        node.contents(":not(.searchnode)").remove();
        child.unwrap();
    } else {
        node.remove();
    }
    rejiggerSearchSiblingAdd();
}

/**
 * Add an "or" search node
 * @private
 */
function searchOrNode(e) {
    var node = $(e.target).parents(".searchnode").first();
    var newnode = $(searchornodehtml);
    node.replaceWith(newnode);
    newnode.children(".searchnode").replaceWith(node);
    searchNodePostAdd(newnode);
}

/**
 * Add a "deep" search node
 * @private
 */
function searchDeepNode(e) {
    var node = $(e.target).parents(".searchnode").first();
    var newnode = $(searchdeepnodehtml);
    node.append(newnode);
    searchNodePostAdd(newnode);
}

/**
 * Add a "precedes" search node
 * @private
 */
function searchPrecNode(e) {
    var node = $(e.target).parents(".searchnode").first();
    var newnode = $(searchprecnodehtml);
    node.after(newnode);
    searchNodePostAdd(newnode);
}

// =============== Helper functions

/**
 * Indicate that a node matches a search
 *
 * @param {Node} node the node to flag
 */
function flagSearchMatch(node) {
    $(node).addClass("searchmatch");
    $("#matchcommands").show();
}

/**
 * Hook up event handlers after adding a node to the search dialog
 */
function searchNodePostAdd(node) {
    $(".searchnewnodebut").unbind("click").click(addSearchDaughter);
    $(".searchdelnodebut").unbind("click").click(searchDelNode);
    $(".searchdeepnodebut").unbind("click").click(searchDeepNode);
    $(".searchornodebut").unbind("click").click(searchOrNode);
    $(".searchprecnodebut").unbind("click").click(searchPrecNode);
    rejiggerSearchSiblingAdd();
    var nodeToFocus = (node && node.find(".searchtext")) ||
            $(".searchtext").first();
    nodeToFocus.focus();
}

/**
 * Recalculate the position of nodes that add siblings in the search dialog.
 * @private
 */
function rejiggerSearchSiblingAdd() {
    $(".newsearchnode").remove();
    $(".searchnode").map(function() {
        $(this).children(".searchnode").last().after(addsearchnodehtml);
    });
    $(".newsearchnode").click(addSearchSibling);
}

/**
 * Remember the currently-entered search, in order to restore it subsequently.
 * @private
 */
function saveSearch() {
    savedsearch = $("#searchnodes").clone();
    var savedselects = savedsearch.find("select");
    var origselects = $("#searchnodes").find("select");
    savedselects.map(function (i) {
        $(this).val(origselects.eq(i).val());
    });
}

/**
 * Perform the search as entered in the dialog
 * @private
 */
function doSearch () {
    // TODO: need to save val of incremental across searches
    var searchnodes = $("#searchnodes");
    saveSearch();
    hideDialogBox();
    var searchCtx = $(".snode"); // TODO: remove sn0
    var incremental = $("#searchInc").prop('checked');

    if (incremental && $(".searchmatch").length > 0) {
        var lastMatchTop = $(".searchmatch").last().offset().top;
        searchCtx = searchCtx.filter(function () {
            // TODO: do this with faster document position dom call
            return $(this).offset().top > lastMatchTop;
        });
    }

    clearSearchMatches();

    for (var i = 0; i < searchCtx.length; i++) {
        var res = interpretSearchNode(searchnodes, searchCtx[i]);
        if (res) {
            flagSearchMatch(res);
            if (incremental) {
                break;
            }
        }
    }
    nextSearchMatch(null, true);
    // TODO: when reaching the end of the document in incremental search,
    // don't dehighlight the last match, but print a nice message

    // TODO: need a way to go back in incremental search
}

/**
 * Clear any previous search, reverting the dialog back to its default state.
 * @private
 */
function clearSearch() {
    savedsearch = $(searchhtml);
    $("#searchnodes").replaceWith(savedsearch);
    searchNodePostAdd();
}

// =============== Search interpretation function

/**
 * Interpret the DOM nodes comprising the search dialog.
 *
 * This function is treponsible for transforming the representation of a
 * search query as HTML into an executable query, and matching it against a
 * node.
 * @private
 *
 * @param {Node} node the search node to interpret
 * @param {Node} target the tree node to match it against
 * @param {Object} options search options
 * @returns {Node} `target` if it matched the query, otherwise `undefined`
 */

function interpretSearchNode(node, target, options) {
    // TODO: optimize to remove jquery calls, only use regex matching if needed
    // TODO: make case sensitivity an option?
    options = options || {};
    var searchtype = $(node).children(".searchtype").val();
    var rx, hasMatch, i, j;
    var newTarget = $(target).children();
    var childSearches = $(node).children(".searchnode");

    if ($(node).parent().is("#searchnodes") &&
        !$("#searchnodes").children(".searchnode").first().is(node) &&
        !options.norecurse) {
        // special case siblings at root level
        // What an ugly hack, can it be improved?
        newTarget = $(target).siblings();
        for (j = 0; j < newTarget.length; j++) {
            if (interpretSearchNode(node, newTarget[j], { norecurse: true })) {
                return target;
            }
        }
    }

    if (searchtype == "Label") {
        rx = RegExp("^" + $(node).children(".searchtext").val(), "i");
        hasMatch = $(target).hasClass("snode") && rx.test(getLabel($(target)));
        if (!hasMatch) {
            return undefined;
        }
    } else if (searchtype == "Text") {
        rx = RegExp("^" + $(node).children(".searchtext").val(), "i");
        hasMatch = $(target).children(".wnode").length == 1 &&
            rx.test(wnodeString($(target)));
        if (!hasMatch) {
            return undefined;
        }
    } else if (searchtype == "Lemma") {
        rx = RegExp("^" + $(node).children(".searchtext").val(), "i");
        hasMatch = hasLemma($(target)) &&
            rx.test(getLemma($(target)));
        if (!hasMatch) {
            return undefined;
        }
    } else if (searchtype == "Root") {
        newTarget = $(target);
    } else if (searchtype == "Or") {
        for (i = 0; i < childSearches.length; i++) {
            if (interpretSearchNode(childSearches[i], target)) {
                return target;
            }
        }
        return undefined;
    } else if (searchtype == "Deep") {
        newTarget = $(target).find(".snode,.wnode");
    } else if (searchtype == "Prec") {
        newTarget = $(target).nextAll();
    }

    for (i = 0; i < childSearches.length; i++) {
        var succ = false;
        for (j = 0; j < newTarget.length; j++) {
            if (interpretSearchNode(childSearches[i], newTarget[j])) {
                succ = true;
                break;
            }
        }
        if (!succ) {
            return undefined;
        }
    }

    return target;
}

// =============== The core search function

/**
 * Display a search dialog.
 */
function search() {
    var html = "<div id='searchnodes' />" +
            "<div id='dialogButtons'><label for='searchInc'>Incremental: " +
            "</label><input id='searchInc' name='searchInc' type='checkbox' />" +
            // TODO: it seems that any plausible implementation of search is
            // going to use rx, so it doesn't make sense to turn it off
            // "<label for='searchRE'>Regex: </label>" +
            // "<input id='searchRE' name='searchRE' type='checkbox' />" +
            "<input id='clearSearch' type='button' value='Clear' />" +
            "<input id='doSearch' type='button' value='Search' /></div>";
    showDialogBox("Search", html, doSearch, saveSearch);
    $("#searchnodes").replaceWith(savedsearch);
    $("#doSearch").click(doSearch);
    $("#clearSearch").click(clearSearch);
    searchNodePostAdd();
}

// ===== Collapsing nodes

/**
 * Toggle collapsing of a node.
 *
 * When a node is collapsed, its contents are displayed as continuous text,
 * without labels.  The node itself still functions normally with respect to
 * movement operations etc., but its contents are inaccessible.
 */
function toggleCollapsed() {
    if (!startnode || endnode) {
        return false;
    }
    $(startnode).toggleClass("collapsed");
    return true;
}

// ===== Tree manipulations

// ========== Movement

/**
 * Move the selected node(s) to a new position.
 *
 * The movement operation must not change the text of the token.
 *
 * Empty categories are not allowed to be moved as a leaf.  However, a
 * non-terminal containing only empty categories can be moved.
 *
 * @param {Node} parent the parent node to move selection under
 *
 * @returns {Boolean} whether the operation was successful
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
    if (!isPossibleTarget(parent) || // can't move under a tag node
        $(startnode).parent().children().length == 1 || // can't move an only child
        $(parent).parents().is(startnode) || // can't move under one's own child
        isEmptyNode(startnode) // can't move an empty leaf node by itself
       )
    {
        clearSelection();
        return false;
    } else if ($(startnode).parents().is(parent)) {
        // move up if moving to a node that is already my parent
        if ($(startnode).parent().children().first().is(startnode)) {
            if ($(startnode).parentsUntil(parent).slice(0,-1).
                filter(":not(:first-child)").size() > 0) {
                clearSelection();
                return false;
            }
            if (parent == document.getElementById("sn0")) {
                touchTree($(startnode));
                registerNewRootTree($(startnode));
            } else {
                touchTree($(startnode));
            }
            $(startnode).insertBefore($(parent).children().filter(
                                                 $(startnode).parents()));
            if (currentText(parent_ip) != textbefore) {
                alert("failed what should have been a strict test");
            }
        } else if ($(startnode).parent().children().last().is(startnode)) {
            if ($(startnode).parentsUntil(parent).slice(0,-1).
                filter(":not(:last-child)").size() > 0) {
                clearSelection();
                return false;
            }
            if (parent == document.getElementById("sn0")) {
                touchTree($(startnode));
                registerNewRootTree($(startnode));
            } else {
                touchTree($(startnode));
            }
            $(startnode).insertAfter($(parent).children().
                                     filter($(startnode).parents()));
            if (currentText(parent_ip) != textbefore) {
                alert("failed what should have been a strict test");
            }
        } else {
            // cannot move from this position
            clearSelection();
            return false;
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
        if (parent.compareDocumentPosition(startnode) & 0x4) {
            // check whether the nodes are adjacent.  Ideally, we would like
            // to say selfAndParentsUntil, but no such jQuery fn exists, thus
            // necessitating the disjunction.
            // TODO: too strict
            // &&
            // $(startnode).prev().is(
            //     $(parent).parentsUntil(startnode.parentNode).last()) ||
            // $(startnode).prev().is(parent)

            // parent precedes startnode
            undoBeginTransaction();
            if (tokenMerge) {
                registerDeletedRootTree($(startnode));
                touchTree($(parent));
                // TODO: this will bomb if we are merging more than 2 tokens
                // by multiple selection.
                addToIndices(movednode, maxindex);
            } else {
                touchTree($(startnode));
                touchTree($(parent));
            }
            movednode.appendTo(parent);
            if (currentText(parent_ip) != textbefore)  {
                undoAbortTransaction();
                parent_ip.replaceWith(parent_before);
                if (parent_ip.attr("id") == "sn0") {
                    $("#sn0").mousedown(handleNodeClick);
                }
                clearSelection();
                return false;
            } else {
                undoEndTransaction();
            }
        } else if ((parent.compareDocumentPosition(startnode) & 0x2)) {
            // &&
            // $(startnode).next().is(
            //     $(parent).parentsUntil(startnode.parentNode).last()) ||
            // $(startnode).next().is(parent)

            // startnode precedes parent
            undoBeginTransaction();
            if (tokenMerge) {
                registerDeletedRootTree($(startnode));
                touchTree($(parent));
                addToIndices(movednode, maxindex);
            } else {
                touchTree($(startnode));
                touchTree($(parent));
            }
            movednode.insertBefore($(parent).children().first());
            if (currentText(parent_ip) != textbefore) {
                undoAbortTransaction();
                parent_ip.replaceWith(parent_before);
                if (parent_ip == "sn0") {
                    $("#sn0").mousedown(handleNodeClick);
                }
                clearSelection();
                return false;
            } else {
                undoEndTransaction();
            }
        } // TODO: conditional branches not exhaustive
    }
    clearSelection();
    return true;
}

/**
 * Move several nodes.
 *
 * The two selected nodes must be sisters, and they and all intervening sisters
 * will be moved as a unit.  Calls {@link moveNode} to do the heavy lifting.
 *
 * @param {Node} parent the parent to move the selection under
 */
function moveNodes(parent) {
    if (!startnode || !endnode) {
        return;
    }
    undoBeginTransaction();
    touchTree($(startnode));
    touchTree($(parent));
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

    } else {
        return; // they are not sisters
    }
    var toselect = $(".snode[xxx=newnode]").first();
    toselect = toselect.get(0);
    // BUG when making XP and then use context menu: TODO XXX

    startnode = toselect;
    var res = ignoringUndo(function () { moveNode(parent); });
    if (res) {
        undoEndTransaction();
    } else {
        undoAbortTransaction();
    }
    startnode = $(".snode[xxx=newnode]").first().get(0);
    endnode = undefined;
    pruneNode();
    clearSelection();
}

// ========== Creation

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
 * @param {Node} target where to put the new node (default: selected node)
 */
function makeLeaf(before, label, word, target) {
    if (!(target || startnode)) return;

    if (!label) {
        if (before) {
            label = "NP-SBJ";
        } else {
            label = "VB";
        }
    }
    if (!word) {
        if (before) {
            word = "*con*";
        } else {
            word = "*";
        }
    }
    if (!target) {
        target = startnode;
    }

    undoBeginTransaction();
    var isRootLevel = false;
    if (isRootNode($(target))) {
        isRootLevel = true;
    } else {
        touchTree($(target));
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
            }
            doCoindex = true;
        } else { // abort if selecting from different tokens
            undoAbortTransaction();
            return;
        }
    }

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
    selectNode(newleaf.get(0));
    updateSelection();
    if (isRootLevel) {
        registerNewRootTree(newleaf);
    }
    undoEndTransaction();
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
    if (!startnode) {
        return;
    }
    if (!label) {
        label = "XP";
    }
    var rootLevel = isRootNode($(startnode));
    undoBeginTransaction();
    if (rootLevel) {
        registerDeletedRootTree($(startnode));
    } else {
        touchTree($(startnode));
    }
    var parent_ip = $(startnode).parents("#sn0>.snode,#sn0").first();
    var parent_before = parent_ip.clone();
    var newnode = '<div class="snode ' + label + '">' + label + ' </div>\n';
    // make end = start if only one node is selected
    if (!endnode) {
        // if only one node, wrap around that one
        $(startnode).wrapAll(newnode);
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
            $(startnode).add($(startnode).nextUntil(endnode)).add(
                endnode).wrapAll(newnode);
            // undo if this messed up the text order
            if(currentText(parent_ip) != oldtext) {
                // TODO: is this plausible? can we remove the check?
                parent_ip.replaceWith(parent_before);
                undoAbortTransaction();
                clearSelection();
                return;
            }
        } else {
            return;
        }
    }

    var toselect = $(startnode).parent();

    startnode = null;
    endnode = null;

    if (rootLevel) {
        registerNewRootTree(toselect);
    }

    undoEndTransaction();

    selectNode(toselect.get(0));
    updateSelection();
}

// ========== Deletion

/**
 * Delete a node.
 *
 * The node can only be deleted if doing so does not affect the text, i.e. it
 * directly dominates no non-empty terminals.
 */
function pruneNode() {
    if (startnode && !endnode) {
        var deltext = $(startnode).children().first().text();
        if (isLeafNode(startnode) && isEmpty(deltext)) {
            // it is ok to delete leaf if it is empty/trace
            if (isRootNode($(startnode))) {
                // perversely, it is possible to have a leaf node at the root
                // of a file.
                registerDeletedRootTree($(startnode));
            } else {
                touchTree($(startnode));
            }
            var idx = getIndex($(startnode));
            if (idx > 0) {
                var root = $(getTokenRoot($(startnode)));
                var sameIdx = root.find('.snode').filter(function () {
                    return getIndex($(this)) == idx;
                }).not(startnode);
                if (sameIdx.length == 1) {
                    var osn = startnode;
                    startnode = sameIdx.get(0);
                    coIndex();
                    startnode = osn;
                }
            }
            $(startnode).remove();
            startnode = endnode = null;
            updateSelection();
            return;
        } else if (isLeafNode(startnode)) {
            // but other leaves are not deleted
            return;
        } else if (startnode == document.getElementById("sn0")) {
            return;
        }

        var toselect = $(startnode).children().first();
        if (isRootNode($(startnode))) {
            // TODO: ugly and expensive. the alternative is adding a fourth
            // data type to the undo list, I think.
            registerDeletedRootTree($(startnode));
            $(startnode).children().each(function () {
                registerNewRootTree($(this));
            });
        } else {
            touchTree($(startnode));
        }
        $(startnode).replaceWith($(startnode).children());
        startnode = endnode = null;
        selectNode(toselect.get(0));
        updateSelection();
    }
}

// ========== Label manipulation

/**
 * Toggle a dash tag on a node
 *
 * If the node bears the given dash tag, remove it.  If not, add it.  This
 * function attempts to put multiple dash tags in the proper order, according
 * to the configuration in the `leaf_extensions`, `extensions`, and
 * `clause_extensions` variables in the `settings.js` file.
 *
 * @param {String} extension the dash tag to toggle
 * @param {Array<String>} [extensionList] override the guess as to the
 * appropriate ordered list of possible extensions.
 */
function toggleExtension(extension, extensionList) {
    if (!startnode || endnode) return false;

    if (!extensionList) {
        if (guessLeafNode(startnode)) {
            extensionList = leaf_extensions;
        } else if (getLabel($(startnode)).split("-")[0] == "IP" ||
                   getLabel($(startnode)).split("-")[0] == "CP") {
            // TODO: should FRAG be a clause?
            // TODO: make configurable
            extensionList = clause_extensions;
        } else {
            extensionList = extensions;
        }
    }

    // Tried to toggle an extension on an inapplicable node.
    if (extensionList.indexOf(extension) < 0) {
        return false;
    }

    touchTree($(startnode));
    var textnode = textNode($(startnode));
    var oldlabel = $.trim(textnode.text());
    // Extension is not de-dashed here.  toggleStringExtension handles it.
    // The new config format however requires a dash-less extension.
    var newlabel = toggleStringExtension(oldlabel, extension, extensionList);
    textnode.replaceWith(newlabel + " ");
    updateCssClass($(startnode), oldlabel);

    return true;
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

    touchTree($(startnode));

    textnode.replaceWith(newlabel + " ");
    updateCssClass($(startnode), oldlabel);

    return true;
}

// ========== Coindexation

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
            touchTree($(startnode));
            removeIndex(startnode);
        }
    } else if (startnode && endnode) {
        // don't do anything if different token roots
        var startRoot = getTokenRoot($(startnode));
        var endRoot = getTokenRoot($(endnode));
        if (startRoot != endRoot) {
            return;
        }

        touchTree($(startnode));
        // if both nodes already have an index
        if (getIndex($(startnode)) > 0 && getIndex($(endnode)) > 0) {
            // and if it is the same index
            if (getIndex($(startnode)) == getIndex($(endnode))) {
                var theIndex = getIndex($(startnode));
                var types = "" + getIndexType($(startnode)) +
                    "" + getIndexType($(endnode));
                // remove it

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
            appendExtension($(endnode), getIndex($(startnode)));
        } else if (getIndex($(startnode)) == -1 && getIndex($(endnode)) > 0) {
            appendExtension($(startnode), getIndex($(endnode)));
        } else { // no indices here, so make them
            var index = maxIndex(startRoot) + 1;
            appendExtension($(startnode), index);
            appendExtension($(endnode), index);
        }
    }
}

// ===== Server-side operations

// ========== Saving

// =============== Save helper function

// TODO: move to utils?
// TODO: this is not very general, in fact only works when called with
// #editpane as arg
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

var saveInProgress = false;

function saveHandler (data) {
    if (data.result == "success") {
        displayInfo("Save success.");
    } else {
        lastsavedstate = "";
        var extraInfo = "";
        if (safeGet(data, 'reasonCode', 0) == 1) {
            extraInfo = " <a href='#' id='forceSave' " +
                "onclick='javascript:startTime=" + data.startTime +
                ";save(null, {force:true});return false'>Force save</a>";
        } else if (safeGet(data, 'reasonCode', 0) == 2) {
            extraInfo = " <a href='#' id='forceSave' " +
                "onclick='javascript:startTime=" + data.startTime +
                ";save(null, {update_md5:true});return false'>Force save</a>";
        }
        displayError("Save FAILED!!!: " + data.reason + extraInfo);
    }
    saveInProgress = false;
}

function save(e, extraArgs) {
    if (!extraArgs) {
        extraArgs = {};
    }
    if (document.getElementById("leafphrasebox") ||
        document.getElementById("labelbox")) {
        // It should be impossible to trigger a save in these conditions, but
        // it causes data corruption if the save happens,, so this functions
        // as a last-ditch safety.
        displayError("Cannot save while editing a node label.");
        return;
    }
    if (!saveInProgress) {
        displayInfo("Saving...");
        saveInProgress = true;
        setTimeout(function () {
            var tosave = toLabeledBrackets($("#editpane"));
            extraArgs.trees = tosave;
            extraArgs.startTime = startTime;
            $.post("/doSave", extraArgs, saveHandler).error(function () {
                lastsavedstate = "";
                saveInProgress = false;
                displayError("Save failed, could not " +
                             "communicate with server!");
            });
            unAutoIdle();
            lastsavedstate = $("#editpane").html();
        }, 0);
    }
}

// ========== Validating

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
    if (data.result == "success") {
        displayInfo("Validate success.");
        $("#editpane").html(data.html);
        assignEvents();
        prepareUndoIds();
    } else if (data.result == "failure") {
        displayWarning("Validate failed: " + data.reason);
    }
    validatingCurrently = false;
    // TODO(AWE): more nuanced distinction between validation found errors and
    // validation script itself contains errors
}

function nextValidationError() {
    var node = scrollToNext(".snode[class*=\"FLAG\"],.snode[class$=\"FLAG\"]");
    selectNode(node.get(0));
}

// ========== Advancing through the file

function nextTree(e) {
    e = e || {};
    var find = undefined;
    if (e.shiftKey) find = "-FLAG";
    advanceTree(find, false, 1);
}

function prevTree(e) {
    e = e || {};
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
                        if (res.result == "failure") {
                            displayWarning("Fetching tree failed: " + res.reason);
                        } else {
                            // TODO: what to do about the save warning
                            $("#editpane").html(res.tree);
                            documentReadyHandler();
                            nukeUndo();
                            currentIndex = res['treeIndexStart'] + 1;
                            displayInfo("Tree " + currentIndex + " fetched.");
                            displayTreeIndex("Editing tree #" + currentIndex +
                                             " out of " + res['totalTrees']);
                        }
                    },
                    dataType: "json",
                    type: "POST",
                    data: { trees: theTrees,
                            find: find,
                            offset: offset
                          }});
}

function displayTreeIndex(text) {
    $("#treeIndexDisplay").text(text);
}

// TODO: test post-merge
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

// ========== Event logging and idle

// =============== Event logging function

function logEvent(type, data) {
    data = data || {};
    data.type = type;
    payload = { eventData: data };
    $.ajax({
               url: "/doLogEvent",
               async: true,
               dataType: "json",
               type: "POST",
               data: JSON.stringify(payload),
               contentType : "application/json",
               traditional: true
           });
}

// =============== Idle timeout

var idleTimeout = false;
var isIdle = false;

function resetIdleTimeout() {
    if (idleTimeout) {
        clearTimeout(idleTimeout);
    }
    idleTimeout = setTimeout(autoIdle, 30 * 1000);
}

function autoIdle() {
    logEvent("auto-idle");
    becomeIdle();
}

addStartupHook(resetIdleTimeout);

addKeyDownHook(function() {
    unAutoIdle();
    resetIdleTimeout();
});

addClickHook(function() {
    unAutoIdle();
    resetIdleTimeout();
});

function unAutoIdle() {
    if (isIdle) {
        logEvent("auto-resume");
        becomeEditing();
    }
}

// =============== User interface

function becomeIdle() {
    isIdle = true;
    $("#idlestatus").html("<div style='color:#C75C5C'>IDLE.</div>");
    $("#butidle").unbind("mousedown").mousedown(resume);
}

function becomeEditing() {
    isIdle = false;
    $("#idlestatus").html("<div style='color:#64C465'>Editing.</div>");
    $("#butidle").unbind("mousedown").mousedown(idle);
}

function idle() {
    logEvent("user-idle");
    becomeIdle();
}

function resume() {
    logEvent("user-resume");
    becomeEditing();
}

// =============== Key/click logging

addStartupHook(function () {
    // This must be delayed, because this file is loaded before settings.js is
    if (typeof logDetail !== "undefined" && logDetail) {
        addKeyDownHook(function (keydata, fn, args) {
            var key = (keydata.ctrl ? "C-" : "") +
                    (keydata.shift ? "S-" : "") +
                    String.fromCharCode(keydata.keyCode),
                theFn = fn.name + "(" +
                    args.map(function (x) { return JSON.stringify(x); }).join(", ") +
                    ")";
            logEvent("keypress",
                     { key: key,
                       fn: theFn
                     });
        });

        addClickHook(function (button) {
            logEvent("mouse-click",
                     { button: button
                     });
        });

        // TODO: what about mouse movement?
    }
});

// ========== Quitting

function quitServer(e, force) {
    unAutoIdle();
    if (!force && $("#editpane").html() != lastsavedstate) {
        displayError("Cannot exit, unsaved changes exist.  <a href='#' " +
                    "onclick='quitServer(null, true);return false;'>Force</a>");
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

// ===== Undo/redo

// TODO: organize this code

var undoMap,
    undoNewTrees,
    undoDeletedTrees,
    undoStack = [],
    redoStack = [],
    undoTransactionStack = [];

var idNumber = 1;

function prepareUndoIds() {
    $("#sn0>.snode").map(function () {
        $(this).attr("id", "id" + idNumber);
        idNumber++;
    });
    nukeUndo();
}

addStartupHook(prepareUndoIds);

/**
 * Reset the undo system.
 *
 * This function removes any intermediate state the undo system has stored; it
 * does not affect the undo history.
 * @private
 */
function resetUndo() {
    undoMap = {};
    undoNewTrees = [];
    undoDeletedTrees = [];
    undoTransactionStack = [];
}

/**
 * Reset the undo system entirely.
 *
 * This function zeroes out any undo history.
 */
function nukeUndo() {
    resetUndo();
    undoStack = [];
    redoStack = [];
}

/**
 * Record an undo step.
 * @private
 */
function undoBarrier() {
    if (_.size(undoMap) === 0 &&
        _.size(undoNewTrees) === 0 &&
        _.size(undoDeletedTrees) === 0) {
        return;
    }
    undoStack.push({
        map: undoMap,
        newTr: undoNewTrees,
        delTr: undoDeletedTrees
    });
    resetUndo();
    redoStack = [];
}

/**
 * Begin an undo transaction.
 *
 * This function MUST be matched by a call to either `undoEndTransaction`
 * (which keeps all intermediate steps since the start call) or
 * `undoAbortTransaction` (which discards said steps).
 */
function undoBeginTransaction() {
    undoTransactionStack.push({
        map: undoMap,
        newTr: undoNewTrees,
        delTr: undoDeletedTrees
    });
}

/**
 * End an undo transaction, keeping its changes
 */
function undoEndTransaction() {
    undoTransactionStack.pop();
}

/**
 * End an undo transaction, discarding its changes
 */
function undoAbortTransaction() {
    var t = undoTransactionStack.pop();
    undoMap = t.map;
    undoNewTrees = t.newTr;
    undoDeletedTrees = t.delTr;
}

/**
 * Execute a function, discarding whatever effects it has on the undo system.
 *
 * @param {Function} fn a function to execute
 *
 * @returns the result of `fn`
 */
function ignoringUndo(fn) {
    // a bit of a grim hack, but it works
    undoBeginTransaction();
    var res = fn();
    undoAbortTransaction();
    return res;
}

/**
 * Inform the undo system that changes are being made.
 *
 * @param {jQuery} node the node in which changes are being made
 */
function touchTree(node) {
    var root = $(getTokenRoot(node));
    if (!undoMap[root.attr("id")]) {
        undoMap[root.attr("id")] = root.clone();
    }
}

/**
 * Inform the undo system of the addition of a new tree at the root level.
 *
 * @param {jQuery} tree the tree being added
 */
function registerNewRootTree(tree) {
    var newid = "id" + idNumber;
    idNumber++;
    undoNewTrees.push(newid);
    tree.attr("id", newid);
}

/**
 * Inform the undo system of a tree's removal at the root level
 *
 * @param {jQuery} tree the tree being removed
 */
function registerDeletedRootTree(tree) {
    var prev = tree.prev();
    if (prev.length === 0) {
        prev = null;
    }
    undoDeletedTrees.push({
        tree: tree.clone(),
        before: prev && prev.attr("id")
    });
}

/**
 * Perform an undo operation.
 *
 * This is a worker function, wrapped by `undo` and `redo`.
 * @private
 */
function doUndo(undoData) {
    var map = {},
        newTr = [],
        delTr = [];

    _.each(undoData.map, function(v, k) {
        var theNode = $("#" + k);
        map[k] = theNode.clone();
        theNode.replaceWith(v);
    });

    // Add back the deleted trees before removing the new trees, just in case
    // the insertion point of one of these is going to get zapped.  This
    // shouldn't happen, though.
    _.each(undoData.delTr, function(v) {
        var prev = v.before;
        if (prev) {
            v.tree.insertAfter($("#" + prev));
        } else {
            v.tree.prependTo($("#sn0"));
        }
        newTr.push(v.tree.attr("id"));
    });

    _.each(undoData.newTr, function(v) {
        var theNode = $("#" + v);
        var prev = theNode.prev();
        if (prev.length === 0) {
            prev = null;
        }
        delTr.push({
            tree: theNode.clone(),
            before: prev && prev.attr("id")
        });
        theNode.remove();
    });

    return {
        map: map,
        newTr: newTr,
        delTr: delTr
    };
}

/**
 * Perform undo.
 */
function undo() {
    if (undoStack.length === 0) {
        displayWarning("No further undo information");
        return;
    }
    var lastUndo = undoStack.pop();
    redoStack.push(doUndo(lastUndo));
    startnode = endnode = undefined;
    updateSelection();
}

/**
 * Perform redo.
 */
function redo () {
    if (redoStack.length === 0) {
        displayWarning("No further redo information");
        return;
    }
    undoStack.push(doUndo(redoStack.pop()));
    startnode = endnode = undefined;
    updateSelection();
}

// ===== Misc

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
    var label = getLabel($(startnode));
    var idx = parseIndex(label),
        idxType = parseIndexType(label),
        lab = parseLabel(label);
    if (idx == -1) {
        idx = idxType = "";
    }
    touchTree($(startnode));
    setLabelLL($(startnode), lab.split("-")[0] + idxType + idx);
}

// TODO: should allow numeric indices; document
function basesAndDashes(bases, dashes) {
    function _basesAndDashes(string) {
        var spl = string.split("-");
        var b = spl.shift();
        return (bases.indexOf(b) > -1) &&
            _.all(spl, function (x) { return (dashes.indexOf(x) > -1); });
    }
    return _basesAndDashes;
}

function addLemma(lemma) {
    // TODO: This only makes sense for dash-format corpora
    if (!startnode || endnode) return;
    if (!isLeafNode($(startnode)) || isEmpty(wnodeString($(startnode)))) return;
    touchTree($(startnode));
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

function leafOrNot(leaf, not) {
    var fn, args;
    if (guessLeafNode($(startnode))) {
        fn = arguments[0][0];
        args = arguments[0].slice(1);
    } else {
        fn = arguments[1][0];
        args = arguments[1].slice(1);
    }
    fn.apply(null, args);
}

// ===== Misc (candidates to move to utils)

// TODO: move to utils?
function setLeafLabel(node, label) {
    if (!node.hasClass(".wnode")) {
        // why do we do this?  We should be less fault-tolerant.
        node = node.children(".wnode").first();
    }
    textNode(node).replaceWith($.trim(label));
}
// TODO: need a setLemma function as well

// TODO: only called from one place, with indices: possibly specialize name?
function appendExtension(node, extension, type) {
    if (!type) {
        type="-";
    }
    if (shouldIndexLeaf(node) && !isNaN(extension)) {
        // Adding an index to an empty category, and the EC is not an
        // empty operator.  The final proviso is needed because of
        // things like the empty WADJP in comparatives.
        var oldLabel = textNode(node.children(".wnode").first()).text();
        setLeafLabel(node, oldLabel + type + extension);
    } else {
        setNodeLabel(node, getLabel(node) + type + extension, true);
    }
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

// A low-level (LL) version of setLabel.  It is only responsible for changing
// the label; not doing any kind of matching/changing/other crap.
function setLabelLL(node, label) {
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
        // should never happen
        return;
    }
    var oldLabel = parseLabel(getLabel(node));
    textNode(node).replaceWith(label);
    updateCssClass(node, oldLabel);
}

/**
 * Update the CSS class of a node to reflect its label.
 *
 * @param {jQuery} node
 * @param {String} oldlabel (optional) the former label of this node
 */
function updateCssClass(node, oldlabel) {
    if (!node.hasClass("snode")) {
        return;
    }
    if (oldlabel) {
        // should never be needed, but a bit of defensiveness can't hurt
        oldlabel = parseLabel($.trim(oldlabel));
    } else {
        // oldlabel wasn't supplied -- try to guess
        oldlabel = node.attr("class").split(" ");
        oldlabel = _.find(oldlabel, function (s) { return (/[A-Z-]/).match(s); });
    }
    node.removeClass(oldlabel);
    node.addClass(parseLabel(getLabel(node)));
}

//================================================== Obsolete/other

/**
 * Sets the label of a node
 *
 * Contains none of the heuristics of {@link setLabel}.
 *
 * @param {jQuery} node the target node
 * @param {String} label the new label
 * @param {Boolean} noUndo whether to record this operation for later undo
 */
function setNodeLabel(node, label, noUndo) {
    // TODO: fold this and setLabelLL together...
    setLabelLL(node, label);
}

// TODO(AWE): I think that updating labels on changing nodes works, but
// this fn should be interactively called with debugging arg to test this
// supposition.  When I am confident of the behavior of the code, this fn will
// be removed.
function resetLabelClasses(alertOnError) {
    var nodes = $(".snode").each(
        function() {
            var node = $(this);
            var label = $.trim(getLabel(node));
            if (alertOnError) {
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


// TODO: badly need a DSL for forms

// Local Variables:
// js2-additional-externs: ("$" "setTimeout" "customCommands\
// " "customConLeafBefore" "customConMenuGroups" "extensions" "leaf_extensions\
// " "clause_extensions" "JSON" "testValidLeafLabel" "testValidPhraseLabel\
// " "_" "startTime" "console" "loadContextMenu" "safeGet\
// " "jsonToTree" "objectToTree" "dictionaryToForm" "formToDictionary\
// " "displayWarning" "displayInfo" "displayError" "isEmpty" "isPossibleTarget\
// " "isRootNode" "isLeafNode" "guessLeafNode" "getTokenRoot" "wnodeString\
// " "currentText" "getLabel" "textNode" "getMetadata" "hasDashTag\
// " "parseIndex" "parseLabel" "parseIndexType" "getIndex" "getIndexType\
// " "shouldIndexLeaf" "maxIndex" "addToIndices" "changeJustLabel\
// " "toggleStringExtension" "lookupNextLabel" "commentTypes\
// " "invisibleCategories" "invisibleRootCategories" "ipnodes" "messageHistory\
// " "scrollToNext" "clearTimeout" "logDetail" "hasLemma" "getLemma\
// " "logDetail" "isEmptyNode" "escapeHtml")
// indent-tabs-mode: nil
// End:
