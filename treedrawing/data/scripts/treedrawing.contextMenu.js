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
    conmenus[label] = new function() {
	this.suggestions = suggestions;
    };
}

function addConLeaf(suggestion, before, label, word) {
    var conleaf = new Object();
    conleaf.suggestion=suggestion;
    conleaf.before=before;
    conleaf.label=label;
    conleaf.word=word;

    conleafs.push(conleaf);
}

function addConMenuGroup(group) {
    for(var i = 0; i < group.length; i++){
        addConMenu(group[i],group);
    }
}

// Load the custom context menu groups from user settings file
customConMenuGroups();

function addConLeafBefore(phrase, terminal) {
    addConLeaf("&lt; (" + phrase + " " + terminal + ")",
               true, phrase, terminal);
}

// Load the custom context menu "leaf before" items
customConLeafBefore();

var defaultsPhrases = defaultConMenuGroup;

function isCasePhrase(nodeLabel) {
    if (nodeLabel.startsWith("NP") ||
        nodeLabel.startsWith("ADJP") ||
        nodeLabel.startsWith("QP")) {
	return true;
    }
    return false;
}

function getSuggestions(label) {
    var indstr = "", indtype = "", extensionstring = "";
    if (parseIndex(label)>0) {
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
	suggestions.push(menuitem + extensionstring + indtype + indstr);

	if (conmenus[menuitem] != null) {
	    var iitems = conmenus[menuitem].suggestions;
	    for (var j=0; j < iitems.length; j++) {
		suggestions.push(iitems[j] + extensionstring + indtype + indstr);
	    }
	}
    }
    return suggestions.unique();
}

function loadContextMenu(nodeId) {
    var nodeIndex = getIndex( $("#"+nodeId) );
    var indexSep = "", indexString = "";
    var node = $("#"+nodeId).clone();
    var nodelabel = $.trim(getLabel(node));
    function loadConMenuMousedown () {
        var e = window.event;
	var elementId = (e.target || e.srcElement).id;
	var suggestion = "" + $(this).text();
	setNodeLabel($("#" + nodeId), suggestion);
	hideContextMenu();
    }

    if (nodeIndex > -1) {
	var lastindex = Math.max(nodelabel.lastIndexOf("-"),
                                 nodelabel.lastIndexOf("="));
	indexSep = nodelabel.charAt(lastindex);
	nodelabel = nodelabel.substr(0, getLabel($(node)).length - 2);
	indexString = indexSep + "" + nodeIndex;
    }
    $("#conLeft").empty();
    $("#conLeft").append($("<div class='conMenuHeading'>Label</div>"));

    // TODO(AWE): not portable
    if (/-[NADG]$/.test(nodelabel)) {
	for (var i = 0; i < caseTags.length; i++) {
	    var theCase=nodelabel.substr(nodelabel.length - 1);
	    var suggestion = caseTags[i] + "-" + theCase;
	    if (suggestion != nodelabel) {
		var newnode = $("<div class='conMenuItem'><a href='#'>" +
                                suggestion + "</a></div>");
		$(newnode).mousedown(loadConMenuMousedown);
		$("#conLeft").append(newnode);
	    }
	}

	var extraNominalSuggestions=["ADV","ES"];
	for (i = 0; i < extraNominalSuggestions.length; i++) {
	    var suggestion = extraNominalSuggestions[i];
	    // suggest ADV
	    var newnode = $("<div class='conMenuItem'><a href='#'>" +
                            suggestion + "</a></div>");
	    $(newnode).mousedown(loadConMenuMousedown);
	    $("#conLeft").append(newnode);
	}
    } else {
	var suggestions = getSuggestions(nodelabel);
	for (var i = 0; i < suggestions.length; i++) {
	    if (suggestions[i] != nodelabel) {
		var newnode = $("<div class='conMenuItem'><a href='#'>" +
                                suggestions[i]+indexString+"</a></div>");
		$(newnode).mousedown(loadConMenuMousedown);
		$("#conLeft").append(newnode);
	    }
	}
    }

    // do the right side context menu
    $("#conRight").empty();

    // Set in user settings file
    if (displayCaseMenu) {
        // TODO(AWE): not portable
	if (/-[NADG]$/.test(nodelabel)) {
	    $("#conRight").append($("<div class='conMenuHeading'>Case</div>"));
	    var newnode = $("<div class='conMenuItem'><a href='#'>-N</a></div>");
	    $(newnode).mousedown(setCaseOnTag(nodeId,nodelabel,"N"));
	    $("#conRight").append(newnode);

	    newnode = $("<div class='conMenuItem'><a href='#'>-A</a></div>");
	    $(newnode).mousedown(setCaseOnTag(nodeId,nodelabel,"A"));
	    $("#conRight").append(newnode);

	    newnode = $("<div class='conMenuItem'><a href='#'>-D</a></div>");
	    $(newnode).mousedown(setCaseOnTag(nodeId,nodelabel,"D"));
	    $("#conRight").append(newnode);

	    newnode = $("<div class='conMenuItem'><a href='#'>-G</a></div>");
	    $(newnode).mousedown(setCaseOnTag(nodeId,nodelabel,"G"));
	    $("#conRight").append(newnode);
	} else if(isCasePhrase(nodelabel)) {
            // TODO(AWE): this is almost-but-not-quite dupe of above.  Unify.
	    $("#conRight").append($("<div class='conMenuHeading'>Case</div>"));

	    var newnode = $("<div class='conMenuItem'><a href='#'>-N</a></div>");
	    $(newnode).mousedown(doSetCase(nodeId,"N"));
	    $("#conRight").append(newnode);

	    newnode = $("<div class='conMenuItem'><a href='#'>-A</a></div>");
	    $(newnode).mousedown(doSetCase(nodeId,"A"));
	    $("#conRight").append(newnode);

	    newnode = $("<div class='conMenuItem'><a href='#'>-D</a></div>");
	    $(newnode).mousedown(doSetCase(nodeId,"D"));
	    $("#conRight").append(newnode);

	    newnode = $("<div class='conMenuItem'><a href='#'>-G</a></div>");
	    $(newnode).mousedown(doSetCase(nodeId,"G"));
	    $("#conRight").append(newnode);
	}
    }

    // do addleafbefore
    $("#conRight").append($("<div class='conMenuHeading'>Leaf before</div>"));
    for (var i = 0; i < conleafs.length; i++) {
	stackTree();
	var newnode = $("<div class='conMenuItem'><a href='#'>" +
                        conleafs[i].suggestion + "</a></div>");
	$(newnode).mousedown(doConLeaf(i,conleafs[i],nodeId));
	$("#conRight").append(newnode);
    }

    $("#conRightest").empty();
    $("#conRightest").append($("<div class='conMenuHeading'>Toggle ext.</div>"));

    for (i = 0; i < extensions.length; i++) {
	// do the right side context menu
	var newnode = $("<div class='conMenuItem'><a href='#'>" +
                        extensions[i] + "</a></div>");
	$(newnode).mousedown(doToggleExtension(nodeId, extensions[i]));
	$("#conRightest").append(newnode);
    }
}

function doToggleExtension(nodeId, extension) {
    return function() {
	stackTree();
	clearSelection();
	selectNode(nodeId);
	toggleExtension(extension);
	hideContextMenu();
	clearSelection();
    };
}

/*
 * set case just on this one tag
 */
function setCaseOnTag(nodeId, oldLabel, theCase) {
    return function() {
	stackTree();
	setNodeLabel($("#"+nodeId),
                     oldLabel.substr(0, oldLabel.length - 2) + "-" + theCase,
                     true);
    };
}

/*
 * set case on all case elements that are daughters of this phrase node
 */
function doSetCase(nodeId, theCase) {
    return function() {
	stackTree();
	var daughters = $("#"+nodeId).children().each(
            function() {
		var childId = $(this).attr("id");
		var oldLabel=$.trim(getLabel($(this)));
                // TODO(AWE): not portable
		if(/-[NADG]$/.test(oldLabel)) {
		    setNodeLabel($("#"+childId),
                                 oldLabel.substr(0, oldLabel.length - 2) +
                                 "-" + theCase,
                                 true);
		}
	    });
    };
}

function doConLeaf(idx,conleaf,nodeId) {
    return function() {
	makeLeaf(conleaf.before, conleaf.label, conleaf.word, nodeId, true);
	hideContextMenu();
    };
}
