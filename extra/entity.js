/*global $: false, getLabel: false, addStartupHook: false, addCommand: false,
 popupChoice: false, toggleExtension: false, startnode: true, endnode: true,
 clearSelection: false, _: false, addStyle: false, styleTag: false,
 getTokenRoot: false, getMetadata: false, setMetadata: false,
 displayWarning: false */

var entityIndex;

function calculateEntityIndex () {
    entityIndex = 100;
    $(".snode").each(function () {
        if (this.id == "sn0") return;
        var idx = getEntityId($(this));
        if (!_.isNaN(idx)) {
            entityIndex = Math.max(entityIndex, idx);
        }
    });
    entityIndex++;
}

addStartupHook(function () {
    calculateEntityIndex();
});

var entityTags = ["COMID","DOCREF","FAC","LOC","MILPLAT",
                  "MONEY","NATLTY","ORG","PERS","QTY",
                  "DATE","DTTM","TIME","TIMESP","VEH"];

var entityRe = RegExp("-(" + entityTags.join("|") + ")[0-9]+$");

function removeEntityTag () {
    if (!startnode || endnode) return;
    var old_label = getLabel($(startnode));
    var match = entityRe.exec(old_label);
    if (match) {
        toggleExtension(match[0], [match[0]]);
    }
    // TODO: remove relationships
}

function tagEntity (type) {
    if (!startnode || endnode) return;
    removeEntityTag();
    var extension = type + entityIndex++;
    toggleExtension(extension, [extension]);

    clearSelection();
}

function buildLabel (type, help, helpUrl) {
    var ret = "<abbr title='" + help + "'>" + type + "</abbr>";
    if (typeof helpUrl !== "undefined") {
        ret += "<sup><a target='_blank' href='" + helpUrl + "'>?</a></sup>";
    }
    return ret;
}

function customCommands() {
    addCommand({ keycode: 69 }, // E
               popupChoice,
               { "A": [buildLabel("COMID", "Communications Identifier"),
                       function () {tagEntity("COMID");}],
                 "X": ["Remove tag", function () { removeEntityTag();
                                                   clearSelection(); }]
               });
    addCommand({ keycode: 32 }, clearSelection); // spacebar
    addCommand({ keycode: 90 }, undo); // z
}

(function () {
    var selector = "";
    _.each(entityTags, function (val) {
        selector += '*[class*="-' + val + '"],';
    });
    selector = selector.substr(0, selector.length - 1);
    addStyle(selector + " {border: 1px solid silver !important; border-left: 4px solid #99CC00 !important;}");
})();

styleTag("NP", "border-color: #CC0000;");

function getEntityId (node) {
    var label = getLabel(node);
    var entityTag = _.find(label.split("-"), function (dt) {
        return entityRe.test("-" + dt);
    });
    if (entityTag === null) {
        return undefined;
    }
    return parseInt(/[0-9]+$/.exec(entityTag));
}

function connectRelationship(type) {
    if (!startnode | !endnode) return;
    if (getTokenRoot($(startnode)) !== getTokenRoot($(endnode))) {
        displayWarning("Can't create a relationship between two different tokens");
        return;
    }
    var id1 = getEntityId($(startnode)), id2 = getEntityId($(endnode));
    if (!id1 || !id2) {
        displayWarning("Can't create a relationship between non-entities");
        return;
    }
    // TODO: if they are not entities, cannot create relationship
    var root = getTokenRoot($(startnode));
    var md = getMetadata($(root));
    var relationships = md["RELS"] || {};
    // TODO: this is a stupid way of representing a relationship, but we need
    // array semantics for metadata instead of dict.
    relationships[id1 + "-" + id2 + "-" + type] = "YES";
    md["RELS"] = relationships;
    setMetadata($(root), md);

    connectNodes($(startnode), $(endnode));
}

function unconnectRelationship () {
    if (!startnode | !endnode) return;
    var root = getTokenRoot($(startnode));
    if (root !== getTokenRoot($(endnode))) {
        return;
    }
    var id1 = getEntityId($(startnode)), id2 = getEntityId($(endnode));
    var md = getMetadata($(root));
    var relationships = md["RELS"] || {};
    // TODO: fix for new relationship representation
    _.each(_.filter(_.keys(relationships), function (k) {
        return k.startsWith(id1 + "-" + id2) || k.startsWith(id2 + "-" + id1);
    }), function (k) {
        delete relationships[k];
    });
    if (_.keys(md["RELS"]).length === 0) {
        delete md["RELS"];
    };
    setMetadata($(root), md);

    unconnectNodes($(startnode), $(endnode));
}

function areRelated (node1, node2) {
    var root = getTokenRoot(node1);
    if (root !== getTokenRoot(node2)) {
        return false;
    }
    var id1 = getEntityId(node1), id2 = getEntityId(node2);
    var md = getMetadata($(root));
    var relationships = md["RELS"] || {};
    // TODO: fix for new relationship representation
    return _.filter(_.keys(relationships), function (k) {
        return k.startsWith(id1 + "-" + id2) || k.startsWith(id2 + "-" + id1);
    }).length > 0;
}

function toggleRelationship (type) {
    if (areRelated($(startnode), $(endnode))) {
        unconnectRelationship();
    } else {
        connectRelationship(type);
    }
}

function drawRelationshipsInRoot (root) {
    var md = getMetadata($(root));
    _.each(md.RELS,
           function (val, key) {
               var parts = key.split("-");
               var id1 = parseInt(parts[0]),
               id2 = parseInt(parts[1]),
               type = parts[2];
               var node1 = $(root).find(".snode").filter(function () {
                   return getEntityId($(this)) == id1;
               }).get(0);
               var node2 = $(root).find(".snode").filter(function () {
                   return getEntityId($(this)) == id2;
               }).get(0);
               // TODO: if node1 or node2 is not found, error
               connectNodes($(node1), $(node2));
           });
}

function drawRelationships () {
    $("#sn0 > .snode").each(function () {
        drawRelationshipsInRoot(this);
    });
}

function undrawRelationshipsInRoot (root) {
    var parentId = root.attr("id");
    $("line").filter(function () {
        return $(this).attr("data-parent") == parentId;
    }).remove();
}

addStartupHook(drawRelationships);

addUndoHook(function (roots) {
    _.each(roots, function (root) {
        undrawRelationshipsInRoot(root);
        drawRelationshipsInRoot(root);
    });
});
