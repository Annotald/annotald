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
    // adverb phrase shortcuts
    addCommand({ keycode: 66 }, setLabel, ["ADVP", "ADVP-DIR", "ADVP-LOC", "ADVP-TMP"]); // b
    // adverbial CPs
    addCommand({ keycode: 66, shift: true }, setLabel, ["CP-ADV","CP-PRP","CP-RES"]); // shift + b
    addCommand({ keycode: 67 }, coIndex); // c
    addCommand({ keycode: 68 }, pruneNode); // d
    addCommand({ keycode: 68, shift: true}, setLabel, ["CLPRT","INTJ","INTJP","PRTQ","FW","AN","KE"]); // shift + d
    addCommand({ keycode: 68, ctrl: true}, setLabel, ["NEG"]); // ctrl + d
    // NP-within-NP shortcuts
    addCommand({ keycode: 69 }, setLabel, ["NP-ATR","NP-PRN","NP-PAR","NP-CMP","NP-COM"]); // e
    addCommand({ keycode: 69, shift: true }, setLabel, ["NP"]); // shift + e
    addCommand({ keycode: 69, ctrl: true }, setLabel, ["NY"]); // ctrl + e
    addCommand({ keycode: 70 }, setLabel, ["PP"]); // f
    addCommand({ keycode: 70, shift: true }, toggleVerbalExtension, "-FUT"); // shift + f
    addCommand({ keycode: 70, ctrl: true }, setLabel, "FRAG"); // ctrl + f
    // adjective phrase shortcuts
    addCommand({ keycode: 71 }, setLabel, ["ADJP","ADJP-PRD","ADJP-SPR","ADJX","ADJY"]); // g
    addCommand({ keycode: 71, shift: true }, setLabel, ["NP-AGT"]); // shift + g

    addCommand({ keycode: 81 }, setLabel, ["CONJP"]); // q
    addCommand({ keycode: 81, shift: true}, setLabel, ["CP-QUE"]); // shift + q
    addCommand({ keycode: 81, ctrl: true}, setLabel, ["QP","QTP","QX","QY"]); // ctrl + q
    
    // relative clauses and variations thereof
    addCommand({ keycode: 82 }, setLabel, ["CP-REL","CP-CAR","CP-CMP","CP-EOP","CP-EXL","CP-FRL"]); // r
    addCommand({ keycode: 82, shift: true }, setLabel, ["RRC"]); // shift + r
    // basic sentence-level elements
    addCommand({ keycode: 83 }, setLabel, ["IP-MAT","IP-IMP","IP-SUB"]); // s
    addCommand({ keycode: 83, shift: true}, setLabel, ["IP"]); // shift + s
    addCommand({ keycode: 83, ctrl: true}, setLabel, ["IY"]); // ctrl + s
    // -SPE IP-level extensions
    addCommand({ keycode: 83, ctrl: true}, setLabel, ["IP-MAT-SPE","IP-IMP-SPE"]);
    // complement CPs
    addCommand({ keycode: 84 }, setLabel, ["CP-THT","CP-COM","CP-DEG"]); // t

    // participial clauses
    addCommand({ keycode: 86 }, setLabel, ["IP-PPL","IP-ABS","IP-SMC","IP-PPL-COM"]); // v
    // infinitive clauses
    addCommand({ keycode: 86, shift: true }, setLabel, ["IP-INF","IP-INF-COM","IP-INF-PRP","IP-INF-SBJ","IP-INF-ABS"]); // shift + v
    // argument NP shortcuts
    addCommand({ keycode: 87 }, setLabel, ["NP-SBJ","NP-OB1","NP-OB2","NP-OBP","NP-OBQ","NP-PRD"]); // w
    addCommand({ keycode: 87, shift: true }, setLabel, ["WADJP","WADVP","WNP","WPP","WQP"]); // shift + w
    addCommand({ keycode: 88 }, makeNode, "XP"); // x
    addCommand({ keycode: 88, shift: true }, setLabel, ["XP"]); // shift + x

    addCommand({ keycode: 90 }, undo); // z

    // left hand number commands
    addCommand({ keycode: 49 }, leafBefore); // 1
    addCommand({ keycode: 50 }, leafAfter); // 2
    // non-argument NP shortcuts
    addCommand({ keycode: 51 }, setLabel, ["NX","NP-ADT","NP-ADV","NP-AGT","NP-DIR","NP-INS","NP-LOC","NP-MSR","NP-SPR","NP-TMP","NP-VOC"]); // 3
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

}


/*
 * Default phrase label suggestions in context menu 
 */
var defaultConMenuGroup = ["VBP","VBPP","VBD","VBDP","VBN","VBNP","VBS","VBSP","VBO","VBOP","VBI","VBIP","VBDX","VBIX","VBNX","VBOX","VBPX","VBSX"];

/**
 * Phrase labels that are suggested in context menu when one of the other ones is set
 */
function customConMenuGroups(){
    addConMenuGroup( ["ADJ","ADJ$","ADJA","ADJD","ADJR","ADJS"] );
    addConMenuGroup( ["ADJP","ADJP-PRD","ADJP-SPR","ADJX","ADJY"] );
    addConMenuGroup( ["ADV","ADVR","ADVS","NEG","P"] );
    addConMenuGroup( ["ADVP","ADVP-DIR","ADVP-LOC","ADVP-TMP","PP"] );
    addConMenuGroup( ["AN","KE"] );
    addConMenuGroup( ["BED","BEI","BEN","BEO","BEP","BES","BPR"] );
    addConMenuGroup( ["CLGE","CLPRO","CLPRO$","CLPROA","CLPROD","CLPRT","CLQ","CLQ$","CLQA","CLQD","CLTE"] );
    addConMenuGroup( ["C","CONJ","CONJ0"] );
    addConMenuGroup( ["D","D$","DA","DD","DS","DS$","DSA","DSD"] );
    addConMenuGroup( ["INTJ","INTJP","FW","PRTQ"] );
    addConMenuGroup( ["Q","Q$","QA","QD","QR","QS","QV"] );
    addConMenuGroup( ["NUM","N","N$","NA","ND","NPR","NPR$","NPRA","NPRD","NPRS","NPRS$","NPRSA","NPRSD","NS","NS$","NSA","NSD"] );
    addConMenuGroup( ["NX","NY","NP-ADT","NP-ADV","NP-AGT","NP-DIR","NP-INS","NP-LFD","NP-LOC","NP-MSR","NP-RSP","NP-SPR","NP-TMP","NP-VOC","QP"] );
    addConMenuGroup( ["NP-SBJ","NP-OB1","NP-OB2","NP-OBP","NP-OBQ","NP-PRD","NP-ATR","NP-PRN","NP-PAR","NP-CMP","NP-COM"] );
    addConMenuGroup( ["VPR","VPRP","VPR$","VPRP$","VPRA","VPRPA","VPRD","VPRPD"] );
    addConMenuGroup( ["WADJ","WADJ$","WADJA","WADJD","WADV","WD","WD$","WDA","WDD","WP","WPRO","WPRO$","WPROA","WPROD","WQ"] );
    addConMenuGroup( ["WADJP","WADJX","WADVP","WADVX","WNP","WNX","WPP","WQP"] );
    addConMenuGroup( ["CP","CP-ADV","CP-CAR","CP-COM","CP-CMP","CP-DEG","CP-EOP","CP-EXL","CP-FRL","CP-PRP","CP-QUE","CP-REL","CP-RES","CP-THT"] );
    addConMenuGroup( ["IP","IY","RRC","IP-ABS","IP-IMP","IP-INF","IP-INF-COM","IP-INF-PRP","IP-INF-SBJ","IP-MAT","IP-PPL","IP-PPL-COM","IP-SMC","IP-SUB"] );
    addConMenuGroup( ["QP","QX","QY"] );
    //addConMenuGroup( [] );
}

/*
 * Context menu items for "leaf before" shortcuts
 */
function customConLeafBefore(){
        addConLeafBefore( "CODE", "{BKMK}");
	addConLeafBefore( "NP-SBJ", "*con*");
	addConLeafBefore( "NP-SBJ", "*pro*");
        addConLeafBefore( "NP-SBJ", "*");
	addConLeafBefore( "BEP-IMPF", "*");
	addConLeafBefore( "BED-IMPF", "*");
	addConLeafBefore( "WADVP", "0");
	addConLeafBefore( "WNP", "0");
	addConLeafBefore( "WADJP", "0");
	addConLeafBefore( "C", "0");
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
