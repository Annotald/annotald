// add license

$(document).ready(function () {
    $("#buttests").mousedown(runTests);
    window.onbeforeunload = undefined;
});

var numtests = 0,
    testfailures = 0,
    tests = [],
    currentindent = 0,
    nextTestFails = false;

function logTest(line) {
    $("#testMsgBox").val($("#testMsgBox").val() + line + "\n");
}

function testSucceed(name) {
    numtests++;
    var indent = "";
    for (var i = 0; i < currentindent; i++) {
        indent += " ";
    }
    if (nextTestFails) {
        logTest(indent + "Test '" + name + "' succeeded unexpectedly.");
        nextTestFails = false;
    } else {
        logTest(indent + "Test '" + name + "' succeeded.");
    }
}

function testFail(name, info) {
    numtests++;
    testfailures++;
    var indent = "";
    for (var i = 0; i < currentindent; i++) {
        indent += " ";
    }
    if (nextTestFails) {
        logTest(indent + "Test '" + name + "' failed expectedly: " + info);
        nextTestFails = false;
    } else {
        logTest(indent + "Test '" + name + "' FAILED: " + info);
    }
}

function testFailThrow(name) {
    numtests++;
    testfailures++;
    var indent = "";
    for (var i = 0; i < currentindent; i++) {
        indent += " ";
    }
    logTest("Test '" + name + "' threw an ERROR");
}

function expectEqual(name, x, y) {
    if (_.isEqual(x, y)) {
        testSucceed(name);
    } else {
        testFail(name, "expected: " + JSON.stringify(x) + ", got: " +
                 JSON.stringify(y));
    }
}

function expectEqualText(name, x, y) {
    x = x.replace(/ /g, "").replace(/\n/g, "");
    y = y.replace(/ /g, "").replace(/\n/g, "");
    expectEqual(name, x, y);
}

function failingTest() {
    nextTestFails = true;
}

function suite(name, suite) {
    logTest("Beginning suite " + name);
    currentindent += 2;
    suite.call();
    currentindent -= 2;
    logTest("End suite " + name);
}

function loadTrees(trees) {
    $.ajax("/testLoadTrees",
           { async: false,
             success: function(res) {
                 $("#editpane").html(res['trees']);
                 resetLabelClasses(false);
                 $("#editpane>.snode").attr("id", "sn0");
                 $("#sn0>.snode").map(function () {
                     $(this).attr("id", "id" + idNumber);
                     idNumber++;
                 });
             },
             dataType: "json",
             type: "POST",
             data: {trees: trees}});
}

function selectWord(word, end) {
    var selnode = $("#editpane").find(".wnode").parents().filter(function () {
        return wnodeString($(this)) == word;
    }).get(0);
    if (!end) {
        startnode = selnode;
        endnode = undefined;
    } else {
        endnode = selnode;
    }
    updateSelection();
}

function selectParent(end) {
    if (end) {
        endnode = $(endnode).parent().get(0);
    } else {
        startnode = $(startnode).parent().get(0);
    }
}

function selectNodeByLabel(label, end) {
    var selnode = $("#editpane").find(".snode").filter(function() {
        return getLabel($(this)) == label;
    }).get(0);
    if (!end) {
        startnode = selnode;
        endnode = undefined;
    } else {
        endnode = selnode;
    }
    updateSelection();
}

function logMsg(type) {
    return function (msg) {
        logTest("Got message of type '" + type + "': '" + msg + "'");
    };
}

displayInfo = logMsg("info");
displayWarning = logMsg("warning");
displayError = logMsg("error");

function runTests() {
    numtests = testfailures = 0;
    showDialogBox("Test Results", '<textarea id="testMsgBox" style="' +
                  'width: 100%;height: 100%;"></textarea>');

    suite("Init", function () {
        expectEqualText("initial test HTML",
                        $("#editpane").html(),
                        "<divclass=\"snode\"id=\"sn0\"><divclass=\"snodeIP-MAT\
\"data-metadata=\"{&quot;ID&quot;:&quot;test-01&quot;}\"id=\"id1\">IP-MA\
T<divclass=\"snodeNP-SBJ\">NP-SBJ<divclass=\"snodeD\">D<sp\
anclass=\"wnode\">This</span></div></div><divclass=\"snodeBEP\">BEP<\
spanclass=\"wnode\">is</span></div><divclass=\"snodeNP-PRD\">NP-PRD<\
divclass=\"snodeD\">D<spanclass=\"wnode\">a</span></div><divclass=\"\
snodeN\">N<spanclass=\"wnode\">test</span></div></div></div></div>");

        // don't use -Text here, b/c whitespace is significant to the backend
        expectEqual("totrees is correct",
                    toLabeledBrackets($("#editpane")),
                    "( (IP-MAT (NP-SBJ (D This))\n(BEP is)\n(NP-PRD (D a)\n(N \
test))) (ID test-01))\n\n");
    });

    suite("Metadata", function () {

        var orig = { foo: "bar", baz: "quux" };
        var form = $(dictionaryToForm(orig));

        expectEqual("basic metadata",
                    orig,
                    formToDictionary(form));

        orig.blah = {one: "1", two: "2"};
        form = $(dictionaryToForm(orig));

        expectEqual("recursive metadata",
                    orig,
                    formToDictionary(form));

        orig.blah.three = { apples: "tasty", apple_pie: "tastier" };
        form = $(dictionaryToForm(orig));
        expectEqual("more recursive metadata",
                    orig,
                    formToDictionary(form));

    });

    suite("Movement", function () {
        loadTrees("( (CP-REL (WNP-1 (WD who))\n\
(C 0)\n\
(IP-SUB (IP-SUB (NP-SBJ *T*-1) (VBD danced))\n\
(CONJP (CONJ and)\n\
(IP-SUB (VBD sang))))))");

        selectWord("sang");
        selectWord("who", true);
        selectParent(true);
        leafBefore();
        expectEqualText("ATB movement doesn't copy index",
                        getLabel($(startnode)),
                        "NP");

    });

    suite("Coindexation", function () {
        loadTrees("( (IP-MAT (NP-SBJ (NPR John))\n\
(VBP loves) (NP-OB1 (PRO himself))\n\
(NP *T*)))");
        selectNodeByLabel("NP-SBJ");
        selectNodeByLabel("NP-OB1", true);
        function testCoindexing (cond) {
            coIndex();
            expectEqual(cond + " -- Coindexation works",
                        getIndex($(startnode)),
                        1);
            expectEqual(cond + " -- Coindexation works 2",
                        getIndex($(endnode)),
                        1);
            expectEqual(cond + " -- Coindexation gives same index",
                        getIndex($(startnode)),
                        getIndex($(endnode)));
            expectEqual(cond + " -- Index types",
                        getIndexType($(startnode)) +
                        getIndexType($(endnode)),
                        "--");
            coIndex();
            expectEqual(cond + " -- Type cycling 1",
                        getIndexType($(startnode)) +
                        getIndexType($(endnode)),
                        "-=");
            coIndex();
            expectEqual(cond + " -- Type cycling 2",
                        getIndexType($(startnode)) +
                        getIndexType($(endnode)),
                        "=-");
            coIndex();
            expectEqual(cond + " -- Type cycling 3",
                        getIndexType($(startnode)) +
                        getIndexType($(endnode)),
                        "==");
            coIndex();
            expectEqual(cond + " -- Index removal",
                        getIndex($(startnode)),
                        -1);
            expectEqual(cond + " -- Index removal 2",
                        getIndex($(endnode)),
                        -1);
        }
        testCoindexing("Two phrases");
        selectNodeByLabel("NP", true);
        testCoindexing("Phrase and trace");
        coIndex();
        expectEqual("Index goes to trace leaf",
                    wnodeString($(endnode)),
                    "*T*-1");
    });

    suite("POS tag validation", function () {
        testValidLeafLabel = basesAndDashes(["FOO","BAR","BAZ"],
                                            ["AAA","BBB","CCC"]);
        expectEqual("correct label",
                    testValidLeafLabel("FOO-AAA-CCC"), true);
        expectEqual("incorrect label",
                    testValidLeafLabel("NP-SBJ"), false);

        failingTest();
        expectEqual("correct label with index",
                   testValidLeafLabel("FOO-AAA-1"), true);
    });

    suite("Undo/redo", function () {
        // TODO: coverage is still not total
        loadTrees("( (IP-MAT (NP-SBJ (D this) (BEP is) (NP-PRD (D a) (N test)))))\n\n" +
                  "( (IP-MAT (NP-SBJ (D that) (BEP is) (NP-PRD (D an) (N other)))))");
        var origHtml = $("#editpane").html();

        resetUndo();

        selectWord("other");

        makeNode("FOO");
        undoBarrier();
        undo();
        expectEqualText("undo makeNode",
                        $("#editpane").html(), origHtml);

        selectWord("other");
        makeNode("FOO");
        undoBarrier();
        selectNodeByLabel("FOO");
        pruneNode();
        undoBarrier();
        undo();
        undo();
        expectEqualText("undo pruneNode",
                        $("#editpane").html(), origHtml);

        selectWord("other");
        toggleExtension("FOO", ["FOO"]);
        undoBarrier();
        undo();
        expectEqualText("undo toggleExtension",
                        $("#editpane").html(), origHtml);

        selectWord("other");
        setLabel(["FOO"]);
        undoBarrier();
        undo();
        expectEqualText("undo setLabel",
                        $("#editpane").html(), origHtml);

        selectWord("other");
        selectWord("that", true);
        coIndex();
        undoBarrier();
        undo();
        expectEqualText("undo coIndex",
                        $("#editpane").html(), origHtml);

    });

    logTest("");
    logTest("Test results: " + (numtests - testfailures) + "/" + numtests +
            " passed (" +
            Math.round(100 * (numtests - testfailures) / numtests) + "%)");
}


// Local Variables:
// js2-additional-externs: ("$" "JSON" "showDialogBox" "formToDictionary" "\
// dictionaryToForm" "_" "toLabeledBrackets" "startnode" "endnode" "\
// wnodeString" "updateSelection" "leafBefore" "resetIds" "\
// resetLabelClasses" "getLabel" "testValidLeafLabel" "basesAndDashes" "\
// getIndex" "coIndex" "getIndexType" "makeNode" "undo" "pruneNode" "\
// undoBarrier" "idNumber" "displayInfo" "displayWarning" "displayError" "\
// setLabel" "toggleExtension" "resetUndo")
// indent-tabs-mode: nil
// End:
