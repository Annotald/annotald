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

// Load the custom context menu "leaf before" items
customConLeafBefore();

var defaultsPhrases = defaultConMenuGroup;

function getSuggestions(label) {
    var indstr = "",
        indtype = "";
    if (parseIndex(label) > 0) {
        indstr = parseIndex(label);
        indtype = parseIndexType(label);
    }
    label = parseLabel(label);

    var suggestions = new Array();
    var menuitems = defaultsPhrases;
    if (conmenus[label] != null) {
        menuitems = conmenus[label].suggestions;
    }

    for (var i=0; i < menuitems.length; i++){
        var menuitem = menuitems[i];
        suggestions.push(menuitem + indtype + indstr);

        if (conmenus[menuitem] != null) {
            var iitems = conmenus[menuitem].suggestions;
            for (var j=0; j < iitems.length; j++) {
                suggestions.push(iitems[j] + indtype + indstr);
            }
        }
    }
    return suggestions.unique();
}

// Arg is dom node
function loadContextMenu(nodeOrig) {
    var nodeIndex = getIndex($(nodeOrig)),
        indexSep = "",
        indexString = "",
        nodelabel = getLabel($(nodeOrig)),
        newnode,
        i;
    function loadConMenuMousedown () {
        var e = window.event;
        var elementId = (e.target || e.srcElement).id;
        var suggestion = "" + $(this).text();
        setNodeLabel($(nodeOrig), suggestion);
        hideContextMenu();
    }

    if (nodeIndex > -1) {
        indexSep = parseIndexType(nodelabel);
        indexString = indexSep + parseIndex(nodelabel);
        nodelabel = parseLabel(nodelabel);
    }
    $("#conLeft").empty();
    $("#conLeft").append($("<div class='conMenuHeading'>Label</div>"));


    var suggestions = getSuggestions(nodelabel);
    for (var i = 0; i < suggestions.length; i++) {
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
        $("#conRight").append($("<div class='conMenuHeading'>Case</div>"));

        if (hasCase(nodeOrig) || isCasePhrase(nodeOrig)) {
            caseMarkers.forEach(function(c) {
                newnode = $("<div class='conMenuItem'><a href='#'>-" + c +
                                "</a></div>");
                $(newnode).mousedown(setCaseOnTag(nodeOrig, nodelabel, c));
                $("#conRight").append(newnode);
            });
        }
    }

    // do addleafbefore
    $("#conRight").append($("<div class='conMenuHeading'>Leaf before</div>"));
    for (i = 0; i < conleafs.length; i++) {
        newnode = $("<div class='conMenuItem'><a href='#'>" +
                        conleafs[i].suggestion + "</a></div>");
        $(newnode).mousedown(doConLeaf(i, conleafs[i], nodeOrig));
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

function doToggleExtension(node, extension) {
    return function() {
        touchTree(node);
        clearSelection();
        selectNode(node);
        toggleExtension(extension);
        hideContextMenu();
        clearSelection();
    };
}

/*
 * set case just on this one tag
 */
function setCaseOnTag(node, oldLabel, theCase) {
    function doKids(n) {
        n.children(".snode").each(function() {
            if (hasCase(n)) {
                setCase(n, theCase);
            } else if (isCaseNode(n) && !n.parent().is(".CONJP")) {
                // nothing
            } else {
                doKids(n);
            }
        });
    }
    return function() {
        touchTree(node);
        doKids(node);
    };
}

function doConLeaf(idx,conleaf,node) {
    return function() {
        makeLeaf(conleaf.before, conleaf.label, conleaf.word, node, true);
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
// " "startnode")
// indent-tabs-mode: nil
// End:
