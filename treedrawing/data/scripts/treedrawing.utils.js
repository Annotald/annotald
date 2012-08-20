// Copyright (c) 2012 Anton Karl Ingason, Aaron Ecay, Jana Beck

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

/*
 * Utility functions for Annotald.
 */

// Table of contents:
// * Javascript object manipulation
// * Interconversion of different representations
// * UI helper functions
// * Functions on node representation
// ** Predicates
// ** Accessor functions
// ** Index-related functions
// **********
// End TOC



// TODOs: mark @privates appropriately, consider naming scheme for dom vs JQ args

// ===== Javascript object manipulation

function safeGet (obj, key, def) {
    if (_.has(obj, key)) {
        return obj[key];
    } else {
        return def;
    }
}

// ===== Interconversion of different representations

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

/**
 * Convert a JS disctionary to an HTML form.
 *
 * For the metadator editing code.
 * @private
 */
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

/**
 * Convert an HTML form into a JS dictionary
 *
 * For the metadata editing code
 * @private
 */
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

// ===== UI helper functions

var messageHistory = "";

/**
 * Log the message in the message history.
 * @private
 */
function logMessage(msg) {
    var d = new Date();
    messageHistory += d.toUTCString() + ": " + $("<div>" + msg +
                                                 "</div>").text() +
        "\n";
}

/**
 * Display a warning message in the Annotald UI.
 *
 * @param {String} html the html code of the warning to display
 */
function displayWarning(html) {
    logMessage(html);
    $("#messageBoxInner").html(html).css("color", "orange");
}

/**
 * Display an informational message in the Annotald UI.
 *
 * @param {String} html the html code of the information to display
 */
function displayInfo(html) {
    logMessage(html);
    $("#messageBoxInner").html(html).css("color", "green");
}

/**
 * Display an error message in the Annotald UI.
 *
 * @param {String} html the html code of the error to display
 */
function displayError(html) {
    logMessage(html);
    $("#messageBoxInner").html(html).css("color", "red");
}

/**
 * Scroll to display the next place in the document matching a selector.
 *
 * If no matches, do nothing.
 *
 * @returns {Boolean} an indicator of whether scrolling was performed
 */
function scrollToNext(selector) {
    var docViewTop = $(window).scrollTop();
    var docViewMiddle = docViewTop + $(window).height() / 2;
    var nextError = $(selector).filter(
        function () {
            return $(this).offset().top > docViewMiddle;
        }).first();
    if (nextError.length == 1) {
        window.scroll(0, nextError.offset().top - $(window).height() * 0.25);
    }
    return !!nextError; // convert to boolean and return
}

// ===== Functions on node representation

// ========== Predicates

/**
 * Indicate whether a node has a lemma associated with it.
 *
 * @param {JQuery Node} node
 * @returns {Boolean}
 * @private
 */
// TODO: is private right for this one?
function hasLemma(node) {
    return node.children(".wnode").children(".lemma").length == 1;
}

/**
 * Test whether a string is empty, i.e. a trace, comment, or other empty
 * category.
 *
 * @param {String} text the text to test
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

/**
 * Test whether a node is a possible target for movement.
 *
 * @param {DOM node} node the node to operate on
 */
function isPossibleTarget(node) {
    // cannot move under a tag node
    // TODO(AWE): what is the calling convention?  can we optimize this jquery
    // call?
    if ($(node).children().first().is("span")) {
        return false;
    }
    return true;
}

/**
 * Test whether a node is the root node of a tree.
 *
 * @param {JQuery Node} node the node to operate on
 */
function isRootNode(node) {
    return node.filter("#sn0>.snode").size() > 0;
}

/**
 * Test whether a node is a purely structural leaf.
 *
 * @param {DOM node} node the node to operate on
 */
function isLeafNode(node) {
    return $(node).children(".wnode").size() > 0;
}

/**
 * Test whether a node is a leaf using heuristics.
 *
 * This function respects the results of the `testValidLeafLabel` and
 * `testValidPhraseLabel` functions, if these are defined.
 *
 * @param {DOM node} node the node to operate on
 */
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

// ========== Accessor functions

/**
 * Get the root of the tree that a node belongs to.
 *
 * @param {JQuery Node} node the node to operate on
 */
function getTokenRoot(node) {
    return node.parents().andSelf().filter("#sn0>.snode").get(0);
}

/**
 * Get the text dominated by a given node, without removing empty material.
 *
 * @param {DOM node} node the node to operate on
 */
function wnodeString(node) {
    var text = $(node).find('.wnode').text();
    return text;
}

/**
 * Get the ur-text dominated by a node.
 *
 * This function removes any empty material (traces, comments, etc.)  It does
 * not rejoin words which have been split.  It also does not add spaces.
 *
 * @param {JQuery Node} root the node to operate on
 */ 
function currentText(root) {
    var nodes = root.get(0).getElementsByClassName("wnode");
    var text = "",
        nv;
    for (var i = 0; i < nodes.length; i++) {
        nv = nodes[i].childNodes[0].nodeValue;
        if (!isEmpty(nv)) {
            text += nv;
        }
    }
    return text;
}

/**
 * Get the label of a node.
 *
 *@param {JQuery Node} node the node to operate on
 */
function getLabel(node) {
    return $.trim(textNode(node).text());
}

/**
 * Get the first text node dominated by a node.
 * @private
 *
 * @param {JQuery Node} node the node to operate on
 */
function textNode(node) {
    return node.contents().filter(function() {
                                         return this.nodeType == 3;
                                     }).first();
}

/**
 * Return the lemma of a node, or undefined if none.
 *
 * @param {JQuery Node} node
 * @returns {String}
 */
function getLemma(node) {
    return node.children(".wnode").children(".lemma").first().
        text().substring(1); // strip the dash
}

// TODO: document
function getMetadata(node) {
    var m = node.attr("data-metadata");
    if (m) {
        return JSON.parse(m);
    } else {
        return undefined;
    }
}

/**
 * Test whether a node has a certain dash tag.
 *
 * @param {JQuery Node} node the node to operate on
 * @param {String} tag the dash tag to look for, without any dashes
 */
function hasDashTag(node, tag) {
    var label = getLabel(node);
    var tags = label.split("-").slice(1);
    return (tags.indexOf(tag) > -1);
}

// ========== Index-related functions

/**
 * Return the index portion of a label, or -1 if no index.
 * @private
 *
 * @param {String} label the label to operate on
 */
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

/**
 * Return the non-index portion of a label.
 * @private
 *
 * @param {String} label the label to operate on
 */
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

/**
 * Return the type of index attached to a label, either `"-"` or `"="`.
 * @private
 *
 * @param {String} label the label to operate on
 */
// TODO: document that this doesn't check whether there is a numerical index,
// or actually do the test
function parseIndexType(label) {
    var lastindex = Math.max(label.lastIndexOf("-"), label.lastIndexOf("="));
    return label.charAt(lastindex);
}

/**
 * Return the movement index associated with a node.
 *
 * @param {JQuery Node} node the node to operate on
 */
function getIndex(node) {
    if (shouldIndexLeaf(node)) {
        return parseIndex(textNode(node.children(".wnode").first()).text());
    } else {
        return parseIndex(getLabel(node));
    }
}

/**
 * Return the type of index associated with a node, either `"-"` or `"="`.
 *
 * @param {JQuery Node} node the node to operate on
 */
// TODO: only used once, eliminate?
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

/**
 * Determine whether to place a movement index on the node label or the text.
 *
 * @param {JQuery Node} node the node to operate on
 */
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

/**
 * Get the highest index attested in a token.
 *
 * @param {DOM node} token the token to work on
 */
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

/**
 * Increase the value of a tree's indices by an amount
 * @private
 *
 * @param {JQuery Node} tokenRoot the token to operate on
 * @param {number} numberToAdd
 */
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

// ========== Case-related functions

/**
 * Find the case associated with a node.
 *
 * This function respects the case-related variable `caseMarkers`.  It does
 * not check if a node is in `caseTags`.
 *
 * @param {JQuery Node} node
 * @returns {String} the case on the node, or `""` if none
 */
function getCase(node) {
    var label = parseLabel(getLabel(node)),
        dashTags = _.rest(label.split("-")),
        cases = _.intersection(caseMarkers, dashTags);

    if (cases.length == 0) {
        return "";
    } else if (cases.length == 1) {
        return cases[0];
    } else {
        throw "Tag has two cases: " + label;
    }
}

/**
 * Test if a node has case.
 *
 * This function tests whether a node is in `caseTags`, and then whether it
 * has case.
 *
 * @param {JQuery Node} node
 * @returns {Boolean}
 */
function hasCase(node) {
    var label = parseLabel(getLabel(node)),
        dashTags = label.split("-"),
        theCase;
    if (_.contains(caseTags, dashTags[0])) {
        theCase = getCase(node);
        if (theCase == "") {
            return false;
        } else {
            return true;
        }
    } else {
        return false;
    }
}

/**
 * Test whether a node label corresponds to a case phrase.
 *
 * Based on the `casePhrases` configuration variable.
 *
 * @param {JQuery Node} nodeLabel
 * @returns {Boolean}
 */
function isCasePhrase(node) {
    return _.contains(casePhrases, getLabel(node).split("-")[0]);
}

/**
 * Remove the case from a node.
 *
 * Does not record undo information.
 *
 * @param {JQuery Node} node
 */
function removeCase(node) {
    if (!hasCase(node)) {
        return;
    }
    var theCase = getCase(node),
        label = getLabel(node);
    setNodeLabel(node, label.replace("-" + theCase, ""));
}

/**
 * Set the case on a node.
 *
 * Removes any previous case.  Does not record undo information.
 *
 * @param {JQuery Node} node
 */
function setCase(node, theCase) {
    removeCase(node);
    var osn = startnode;
    startnode = node;
    toggleExtension(theCase, [theCase]);
    startnode = osn;
}

// ==================================================



// TODO: more perspicuous name
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
    for (var i = 0; i < labels.length; i++) {
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

// TODO(AWE): add getMetadataTU fn, to also do trickle-up of metadata.






// TODO: unused?
// TODO: don't pass tokenroot in as id, instead use the jquery object itself
// and use node.find()
// function getNodesByIndex(tokenRoot, ind) {
//     var nodes = $("#" + tokenRoot + " .snode,#" + tokenRoot +
//                   " .wnode").filter(
//         function(index) {
//             // TODO(AWE): is this below correct?  optimal?
//             return getIndex($(this)) == ind;
//         });
//     return nodes;
// }

/*
 * returns value of lowest index if there are any indices, returns -1 otherwise
*/
/* TODO: unused?
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
 */

/* something I wrote long ago, and never used, but might be useful someday
function nextNodeSuchThat(node, pred) {
    var next = node.nextElementSibling;
    if (next) {
        if (pred(next)) {
            return next;
        } else {
            return nextNodeSuchThat(next, pred);
        }
    } else if (node.parentNode) {
        return nextNodeSuchThat(node.parentNode, pred);
    } else {
        return null;
    }
}
*/

// Local Variables:
// js2-additional-externs: ("$" "_" "JSON" "testValidLeafLabel" "\
// testValidPhraseLabel" "caseMarkers" "casePhrases" "caseTags" "\
// startnode")
// indent-tabs-mode: nil
// End:
