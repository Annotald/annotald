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

/*
 *  Displays a context menu for setting case extensions according to
 *  the IcePaHC annotation scheme
 *  caseTags indicates which tags should be interpreted as case tags
 *  for this purpose
 */ 
var displayCaseMenu = false;
var caseTags=["N","NS","NPR","NPRS","PRO","D","NUM","ADJ","ADJR","ADJS","Q","QR","QS"];

/* extensions are treated as not part of the label for various purposes, 
 * they are all binary, and they show up in the toggle extension menu  
 */
var extensions=["-XXX","-ZZZ","-SPE","-PRN","-RSP","-LFD","-SBJ"]

/* verbal extensions are treated as not part of the label for various purposes,
 * they are all binary, and they show up in the verbal extension menu (TODO)
 */ 
var vextensions=["-PASS","-IND","-KJV","-FUT","-IMPF","-AOR","-PRF"];

/*
 * Phrase labels in this list (including the same ones with indices and
 * extensions) get a different background color so that the annotator can
 * see the "floor" of the current clause
 * DOESN'T DO ANYTHING YET
 */
var ipnodes=["IP-SUB","IP-MAT","IP-IMP","IP-INF","IP-PPL","RRC"];

/*
 * Keycode is from onKeyDown event.
 * This can for example be tested here:
 * http://www.asquare.net/javascript/tests/KeyCode.html
 */
function customCommands(){
    // left hand commands
    addCommand({ keycode: 65 }, toggleVerbalExtension, "-AOR"); // a
    addCommand({ keycode: 66 }, setLabel, ["ADVP", "ADVP-TMP", "ADVP-LOC", "ADVP-DIR"]); // b
    addCommand({ keycode: 67 }, coIndex); // c
    addCommand({ keycode: 68 }, pruneNode); // d
    addCommand({ keycode: 69 }, setLabel, ["NP-PRN","NP-PAR","NP","NP-COM","NP-ATR"]); // e
    addCommand({ keycode: 69, shift: true }, setLabel, ["NP"]); // shift + e
    addCommand({ keycode: 70 }, setLabel, ["PP"]); // f
    addCommand({ keycode: 70, shift: true }, toggleVerbalExtension, "-FUT"); // shift + f
    addCommand({ keycode: 71 }, setLabel, ["ADJP","ADJP-PRD","ADJP-SPR"]); // g
    addCommand({ keycode: 71, shift: true }, setLabel, ["NP-AGT"]); // shift + g

    addCommand({ keycode: 81 }, setLabel, ["CONJP"]); // q
    addCommand({ keycode: 82 }, setLabel, ["CP-REL","CP-FRL","CP-CAR","CP-EOP"]); // r
    addCommand({ keycode: 83 }, setLabel, ["IP-SUB","IP-MAT","IP-IMP"]); // s
    addCommand({ keycode: 83, shift: true}, setLabel, ["IP"]); // shift + s
    addCommand({ keycode: 84 }, setLabel, ["CP-THT","CP-ADV","CP-CMP","CP-DEG"]); // t

    addCommand({ keycode: 86 }, setLabel, ["IP-INF","IP-INF-COM","IP-SMC","IP-PPL","IP-INF-THT","IP-INF-PRP"]); // v
    addCommand({ keycode: 87 }, setLabel, ["NP-SBJ","NP-OB1","NP-OB2","NP-PRD","NP-OBP","NP-OBQ","NP"]); // w
    addCommand({ keycode: 88 }, makeNode, "XP"); // x
    addCommand({ keycode: 88, shift: true }, setLabel, ["XP"]); // shift + x

    addCommand({ keycode: 90 }, undo); // z

    // left hand number commands
    addCommand({ keycode: 49 }, leafBefore); // 1
    addCommand({ keycode: 50 }, leafAfter); // 2
    addCommand({ keycode: 51 }, setLabel, ["NP-INS","NP-TMP","NP-LOC","NP-ADV","NP-MSR","NP-AGT","NP-CMP","NP-DIR","NP-ADT","NP-VOC","NP"]); // 3
    addCommand({ keycode: 52 }, toggleExtension, "-PRN"); // 4
    addCommand({ keycode: 53 }, toggleExtension, "-SPE"); // 5

    // right hand commands
    //addCommand({ keycode: 72 }, ); // h
    addCommand({ keycode: 73 }, toggleVerbalExtension, "-IMPF"); // i
    addCommand({ keycode: 73, shift: true }, toggleVerbalExtension, "-IND"); // shift + i
    //addCommand({ keycode: 74 }, ); // j
    addCommand({ keycode: 75 }, toggleVerbalExtension, "-KJV"); // k
    addCommand({ keycode: 76 }, editLemmaOrLabel); // l
    addCommand({ keycode: 76, shift: true }, displayRename); // shift + l
    //addCommand({ keycode: 77 }, ); // m
    //addCommand({ keycode: 78 }, ); // n
    //addCommand({ keycode: 79 }, ); // o
    addCommand({ keycode: 80 }, toggleVerbalExtension, "-PASS"); // p
    addCommand({ keycode: 80, shift: true }, toggleVerbalExtension, "-PRF"); // shift + p

    //addCommand({ keycode: 85 }, ); // u

    //addCommand({ keycode: 89 }, ); // y

    addCommand({ keycode: 32 }, clearSelection); // spacebar
    addCommand({ keycode: 192 }, toggleLemmata); // `

    // An example of a context-sensitive label switching command.  If
    // neither NP or PP is the POS, the NP value (first in the dictionary)
    // is chosen by default.
    // addCommand({ keycode: 123 } , setLabel, { NP: ["NP-SBJ", "NP-OB1", "NP-OB2"],
    //                                           PP: ["PP-SBJ", "PP-OB1", "PP-OB2"]});

// addCommand(51,"makenode","NP","NP-PRD","NP-POS"); // 3
// addCommand(188,"clearselection"); // <
// addCommand(78, "makenode","XP"); // n
// addCommand(49,"redo"); // 1
}


/*
 * Default phrase label suggestions in context menu 
 */
var defaultConMenuGroup = ["VBP","VBPP","VBD","VBDP","VBN","VBNP","VBS","VBSP","VBO","VBOP","VBI","VBIP"];

/**
 * Phrase labels that are suggested in context menu when one of the other ones is set
 */
function customConMenuGroups(){
	addConMenuGroup( ["IP-SUB","IP-MAT","IP-INF","IP-IMP","CP-QUE","QTP","FRAG"] );
// add context menu group for IP-PPLs and IP-INFs
	addConMenuGroup( ["ADJP","ADJX","NP-MSR","QP","NP","ADVP","IP-PPL"] );
        addConMenuGroup( ["NP","NX","NP-SBJ","NP-OB1","NP-OB2","NP-OBP","NP-OBQ","NP-PRD","NP-ATR","NP-PAR","NP-COM","NP-PRN", "NP-SPR"] );
        addConMenuGroup( ["NP-INS","NP-TMP","NP-LOC","NP-ADV","NP-MSR","NP-AGT","NP-CMP","NP-DIR","NP-ADT","NP-VOC","QP"] );
	addConMenuGroup( ["PP","ADVP","ADVP-TMP","ADVP-LOC","ADVP-DIR","NP-MSR","NP-ADV"] );	
	addConMenuGroup( ["P","ADV","ADVR","ADVS","ADJ","ADJR","ADJS","C","CONJ"] );
	addConMenuGroup( ["WADVP","WNP","WPP","WQP","WADJP"] );
        addConMenuGroup( ["CP-THT","CP-QUE","CP-REL","CP-DEG","CP-ADV","CP-CMP","CP-COM"] );
        addConMenuGroup( ["N","N$","NA","ND","NS","NS$","NSA","NSD"] );
        addConMenuGroup( ["ADJ","ADJ$","ADJA","ADJD","Q","Q$","QA","QD"] );
        addConMenuGroup( ["PRO","PRO$","PROA","PROD","CLPRO$","CLPROA","CLPROD"] );
        addConMenuGroup( ["VPR","VPRP","VPR$","VPRP$","VPRA","VPRPA","VPRD","VPRPD"] );
}

/*
 * Context menu items for "leaf before" shortcuts
 */
function customConLeafBefore(){
	addConLeafBefore( "NP-SBJ", "*con*");
	addConLeafBefore( "NP-SBJ", "*pro*");
        addConLeafBefore( "NP-SBJ", "*");
	addConLeafBefore( "BEP-IMPF", "*");
	addConLeafBefore( "BED-IMPF", "*");
	addConLeafBefore( "WADVP", "0");
	addConLeafBefore( "WNP", "0");
	addConLeafBefore( "WADJP", "0");
	addConLeafBefore( "C", "0");
        addConLeafBefore( "CODE", "{BKMK}");
	addConLeafBefore( "CODE", "{COM:");	
	addConLeafBefore( "CODE", "{TODO:");
	addConLeafBefore( "CODE", "{MAN:");	
}

// An example of a CSS rule for coloring a POS tag.  The styleTag
// function takes care of setting up a (somewhat complex) CSS rule that
// applies the given style to any node that has the given label.  Dash tags
// are accounted for, i.e. NP also matches NP-FOO (but not NPR).  The
// lower-level addStyle() function adds its argument as CSS code to the
// document.

styleTag("CODE", "color: grey");
