// Copyright (c) 2011 Anton Karl Ingason, Aaron Ecay

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

var conmenus = new Object();
var conleafs = new Array();

function addConMenu(label, suggestions) {
    conmenus[label] = {
        suggestions : suggestions
    };
}

function addConLeaf(suggestion, before, label, word) {
    var conleaf = {
        suggestion : suggestion,
        before : before,
        label : label,
        word : word
    };

    conleafs.push(conleaf);
}

/**
 * Add a group of labels to the context menu.
 *
 * When activating the context menu, if the label of the targeted node belongs
 * to one of these groups, the other entries in the group will be suggested as
 * new labels.
 *
 * @param {Array of String} group
 */
function addConMenuGroup(group) {
    for(var i = 0; i < group.length; i++){
        addConMenu(group[i], group);
    }
}

// Load the custom context menu groups from user settings file
customConMenuGroups();

/**
 * Add a terminal node to the context menu.
 *
 * Add a terminal node that the context menu will allow inserting in the tree.
 *
 * @param {String} phrase the label of the leaf
 * @param {String} terminal the text of the leaf
 */
function addConLeafBefore(phrase, terminal) {
    addConLeaf("&lt; (" + phrase + " " + terminal + ")",
               true, phrase, terminal);
}

/**
 * Add a terminal node to the context menu.
 *
 * Add a terminal node that the context menu will allow inserting in the tree
 * after the sleected node.
 *
 * @param {String} phrase the label of the leaf
 * @param {String} terminal the text of the leaf
 */
function addConLeafAfter(phrase, terminal) {
    addConLeaf("(" + phrase + " " + terminal + ") &gt;",
               false, phrase, terminal);
}

// Load the custom context menu "leaf before" items
customConLeafBefore();

var defaultsPhrases = defaultConMenuGroup;

/**
 * Compute the suggested changes for the context menu for a label.
 *
 * @param {String} label
 * @private
 */
function getSuggestions(label) {
    var indstr = "",
        indtype = "",
        theCase = "";
    if (parseIndex(label) > 0) {
        indstr = parseIndex(label);
        indtype = parseIndexType(label);
    }
    label = parseLabel(label);
    theCase = labelGetCase(label);
    if (theCase !== "") {
        theCase = "-" + theCase;
    }
    label = labelRemoveCase(label);

    var suggestions = new Array();
    var menuitems = defaultsPhrases;
    if (conmenus[label] != null) {
        menuitems = conmenus[label].suggestions;
    }

    for (var i = 0; i < menuitems.length; i++) {
        var menuitem = menuitems[i];
        if (isCaseLabel(menuitem)) {
            menuitem += theCase;
        }
        suggestions.push(menuitem + indtype + indstr);
    }
    return _.uniq(suggestions);
}

/**
 * Populate the context menu for a given node.
 *
 * Does not display the menu.
 *
 * @param {DOM node} nodeOrig
 * @private
 */
function loadContextMenu(nodeOrig) {
    var nO = $(nodeOrig),
        nodeIndex = getIndex(nO),
        indexSep = "",
        indexString = "",
        nodelabel = getLabel(nO),
        newnode,
        i;
    function loadConMenuMousedown () {
        var e = window.event;
        var elementId = (e.target || e.srcElement).id;
        var suggestion = "" + $(this).text();
        touchTree(nO);
        setNodeLabel(nO, suggestion);
        undoBarrier();
        hideContextMenu();
    }

    if (nodeIndex > -1 && !shouldIndexLeaf(nO)) {
        indexSep = parseIndexType(nodelabel);
        indexString = indexSep + parseIndex(nodelabel);
        nodelabel = parseLabel(nodelabel);
    }
    $("#conLeft").empty();
    $("#conLeft").append($("<div class='conMenuHeading'>Label</div>"));


    var suggestions = getSuggestions(nodelabel);
    for (i = 0; i < suggestions.length; i++) {
        if (suggestions[i] != nodelabel) {
            newnode = $("<div class='conMenuItem'><a href='#'>" +
                            suggestions[i]+indexString+"</a></div>");
            $(newnode).mousedown(loadConMenuMousedown);
            $("#conLeft").append(newnode);
        }
    }

    // do the right side context menu
    $("#conRight").empty();

    if (displayCaseMenu) {
        if (hasCase(nO) || isCasePhrase(nO)) {
            $("#conRight").append($("<div class='conMenuHeading'>Case</div>"));
            caseMarkers.forEach(function(c) {
                newnode = $("<div class='conMenuItem'><a href='#'>-" + c +
                                "</a></div>");
                $(newnode).mousedown(setCaseOnTag(nodeOrig, c));
                $("#conRight").append(newnode);
            });
        }
    }

    // do addleafbefore
    $("#conRight").append($("<div class='conMenuHeading'>Leaf before</div>"));
    for (i = 0; i < conleafs.length; i++) {
        newnode = $("<div class='conMenuItem'><a href='#'>" +
                        conleafs[i].suggestion + "</a></div>");
        $(newnode).mousedown(doConLeaf(conleafs[i], nodeOrig));
        $("#conRight").append(newnode);
    }

    $("#conRightest").empty();
    $("#conRightest").append($("<div class='conMenuHeading'>Toggle ext.</div>"));

    // TODO: make only a subset of the extensions togglable, i.e. introduce a
    // new variable togglableExtensions
    for (i = 0; i < extensions.length; i++) {
        // do the right side context menu
        newnode = $("<div class='conMenuItem'><a href='#'>" +
                        extensions[i] + "</a></div>");
        $(newnode).mousedown(doToggleExtension(nodeOrig, extensions[i]));
        $("#conRightest").append(newnode);
    }
}

/**
 * Toggle the extension of a node.
 *
 * A context menu action function.
 *
 * @param {DOM node} node
 * @param {String} extension the extension to toggle
 * @returns {Function} A function which, when called, will execute the action.
 * @private
 */
function doToggleExtension(node, extension) {
    return function() {
        touchTree($(node));
        clearSelection();
        selectNode(node);
        toggleExtension(extension);
        undoBarrier();
        hideContextMenu();
        clearSelection();
    };
}

/**
 * Set the case of a node.
 *
 * A context menu action function.  Recurses into children of this node,
 * stopping when a barrier (case node or explicitly defined barrier) is
 * reached.
 *
 * @param {DOM node} node
 * @param {String} theCase the case to assign
 * @returns {Function} A function which, when called, will execute the action.
 * @private
 */
function setCaseOnTag(node, theCase) {
    function doKids(n, override) {
        if (isCaseNode(n)) {
            setCase(n, theCase);
        } else if (_.contains(caseBarriers, getLabel(n).split("-")[0]) &&
                   !n.parent().is(".CONJP") &&
                   !override) {
            // nothing
        } else {
            n.children(".snode").each(function() {
                doKids($(this));
            });
        }
    }
    return function() {
        var n = $(node);
        touchTree(n);
        doKids(n, true);
        undoBarrier();
    };
}

/**
 * Insert a leaf node.
 *
 * A context menu action function.
 *
 * @param {Object} conleaf an object describing the leaf to be added.  Has the
 * following keys:
 *
 * - `before` Boolean, insert this leaf beofre or fter the target
 * - `label` String, the label of the node to insert
 * - `word` String, the text of the node to insert
 * @param {DOM node} node
 * @returns {Function} A function which, when called, will execute the action.
 * @private
 */
function doConLeaf(conleaf, node) {
    return function() {
        makeLeaf(conleaf.before, conleaf.label, conleaf.word, node, true);
        undoBarrier();
        hideContextMenu();
    };
}

// Local Variables:
// js2-additional-externs: ("$" "setTimeout" "customCommands\
// " "customConLeafBefore" "customConMenuGroups" "extensions" "vextensions\
// " "clause_extensions" "JSON" "makeLeaf" "stackTree" "getLabel" "setNodeLabel\
// " "hideContextMenu" "clearSelection" "toggleExtension" "selectNode\
// " "parseIndex" "parseLabel" "defaultConMenuGroup" "getIndex" "parseIndexType\
// " "displayCaseMenu" "caseTags" "casePhrases" "hasCase" "touchTree\
// " "startnode" "_" "setCase" "caseBarriers" "isCasePhrase" "isCaseNode\
// " "isCaseLabel" "labelHasCase" "labelGetCase" "labelRemoveCase" "shouldIndexLeaf")
// indent-tabs-mode: nil
// End:
