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
                 resetIds();
                 resetLabelClasses(false);
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

function runTests() {
    numtests = testfailures = 0;
    showDialogBox("Test Results", '<textarea id="testMsgBox" style="' +
                  'width: 100%;height: 100%;"></textarea>');

    suite("Init", function () {
        expectEqualText("initial test HTML",
                        $("#editpane").html(),
                        "<divclass=\"snode\"id=\"sn0\"><divclass=\"snodeIP-MAT\
ipnode\"data-metadata=\"{&quot;ID&quot;:&quot;test-01&quot;}\"id=\"sn1\">IP-MA\
T<divclass=\"snodeNP-SBJ\"id=\"sn2\">NP-SBJ<divclass=\"snodeD\"id=\"sn3\">D<sp\
anclass=\"wnode\">This</span></div></div><divclass=\"snodeBEP\"id=\"sn4\">BEP<\
spanclass=\"wnode\">is</span></div><divclass=\"snodeNP-PRD\"id=\"sn5\">NP-PRD<\
divclass=\"snodeD\"id=\"sn6\">D<spanclass=\"wnode\">a</span></div><divclass=\"\
snodeN\"id=\"sn7\">N<spanclass=\"wnode\">test</span></div></div></div></div>");

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

    logTest("");
    logTest("Test results: " + (numtests - testfailures) + "/" + numtests +
            " passed (" +
            Math.round(100 * (numtests - testfailures) / numtests) + "%)");
}






// Local Variables:
// js2-additional-externs: ("$" "JSON" "showDialogBox" "formToDictionary" "\
// dictionaryToForm" "_" "toLabeledBrackets" "startnode" "endnode" "\
// wnodeString" "updateSelection" "leafBefore" "resetIds" "\
// resetLabelClasses" "getLabel")
// indent-tabs-mode: nil
// End:
