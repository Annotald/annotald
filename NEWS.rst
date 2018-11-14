News
====

Release 1.3.9
-------------

This release fixes further bugs relating to the installation of NLTK.  A
patched version of NLTK is now used to avoid such occurrences.

Release 1.3.8
-------------

This release fixes a bug which caused errors on installation related to
an old version of NLTK.  It also fixed an issue with the display of CODE
nodes in the text preview.

Release 1.3.7
-------------

This release fixes one bug with the displayRename function (L key).

Release 1.3.6
-------------

This release fixes two silly bugs in the last one.  The pattern that is
unintentionally developing is that every other release is an immediate
hotfix! :-/

Release 1.3.5
-------------

This release fixes 5 issues:

- Movement keys (arrows and page up/down) are no longer counted as
  interrupting sequences of mouse clicks.
- guessLeafNode properly treats \*T* and \*ICH* as non-leafs
- addConLeafAfter is now added
- The urtext window is a little smarter
- leafAfter inserts (VB *) by default now

Release 1.3.4
-------------

This release really fixes the bug supposedly fixed by 1.3.3.

Release 1.3.3
-------------

This release fixes one bug.

- Fix error in hash-trees.  Thanks to Ariel for reporting.

Release 1.3.2
-------------

This release fixes one bug.

- Fix bug whereby undoing the deletion of a root level node
  (e.g. IP-MAT) could do weird and nasty things.  Thanks to Ariel for
  reporting.

Release 1.3.1
-------------

This release fixes one bug.

- Fix bug whereby a newer, incompatible version of the NLTK library
  could be installed with Annotald.

Release 1.3
-----------

A release with bug and documentation fixes.  Thanks to Ariel Diertani,
Sandra, and Catarina for testing and feedback.

- Fix (?) unexplained crashes
- Fix errors in the interaction between the context menu and undo
  features
- Document a bug in CherryPy installation that affects some users

Release 1.2.1
-------------

A release with some bug fixes and new features.  Thanks to Ariel
Diertani for testing and feature ideas.

New feature:

- Add display of the text and token ID of the selected node

Bug fixes:

- Don’t add the index of a node to context menu label suggestions, if
  the index is contained on the node’s text (as in the case of a trace)
- Fix a corner case in the shouldIndexLeaf function dealing with * empty
  categories (not \*X* type traces).

Release 1.2
-----------

A release with some bug fixes and new features.

New features:

- Node collapsing is added, bound to Shift+C by default.  Users with a
  custom `settings.js` file should add a line such as the following to
  enable this functionality: `addCommand({ keycode: 67, shift: true },
  toggleCollapsed);`
- Long `CODE` nodes are now truncated with an ellipse by default.  This
  change could be applied to all nodes if there is user demand.
- Server mode is added.  By default, Annotald displays a page asking
  whether a user really intends to edit a file, to avoid confusion in
  multi-user environments.  To turn off this prompt, users may either
  navigate to `http://localhsot:port/<username>` directly, or use a
  variable in `settings.py` to disable the prompt.  Consult the user’s
  manual for details

Bug fixes:

- Disallow saving while editing of a node label (as a textbox) is in
  progress
- Allow using the mouse to select text in a node label editing textbox

Release 1.1.4
-------------

A single-bugfix release:

- Fix a bug which could prevent the saving of trees on exit

Release 1.1.3
-------------

A release with some minor fixes.  Changes:

- Previously, Annotald would reindent the .psd file on every save.  This
  proved to be slow for large files.  Now Annotald reindents the file on
  exit (only).  This means users **ought to** use the exit button in the
  Annotald browser UI to exit, and not kill Annotald in the terminal.
  It is also possible to use the reindent auxiliary command to reindent
  a file of trees
- The `annotald-aux` command was extended with `cat-settings-js` and
  `cat-settings-py` commands, which write the contents of the default
  Javascript and Python settings files to standard output (whence they
  may be piped into a file and further edited.
- The `annotald-aux` command also was extended with the `reindent`
  command, which takes a .psd file as an argument and reindents it.
- It is no longer possible to move empty nodes (traces, comments,
  etc.).  It remains possible to move a non-terminal dominating only an
  empty node(s), so if you must move an empty node create a dummy XP as
  a “handle” to use for grabbing on.
- Deleting a trace now deletes the numeric index from its antecedent, if
  the antecedent is now the only node to bear that index.  (If there is
  another coindexed trace besides the one deleted, the index will
  survive.)
- The search features were improved, especially incremental search.

Thanks to Beatrice and Tony for problem reports and discussion.

Release 1.1.2
-------------

A bugfix release.  Changes:

- Fix overapplication of case in context menu.  (Thanks to Joel for
  report)
- Fix crash when time log db is corrupt.  (Thanks to Sandra for report)
- Fixes in formatting of documentation.  (Thanks to Beatrice for report)
- Various code cleanups.

Release 1.1.1
-------------

A hotfix release.  Changes:

- Fix the height of the context menu (thanks to Jana for reporting)
- Fix the interaction of the context menu and case tags.  Case is now
  factored out of context menu calculations, just like numerical indices
  (thanks to Joel for reporting)
- Fix calculation of the set of alternatives for the context menu
  (thanks to Joel for reporting)

The user’s manual also acquired an improved section on installation and
remote access.

Release 1.1
-----------

Changes:

- Annotald is now tested on Python 2.6+ and 3.3+.  Annotald officially
  supports (only) these versions of Python
- Annotald is now distributed through PyPI, the official python package
  archive
- Many bugs fixed

Release 1.0
-----------

This is the first release since 12.03.  The version numbering scheme has
changed.

Significant changes in this version:

- A user’s manual was written
- Significant under-the-hood changes to allow the editing of large files
  in Annotald without overly taxing the system CPU or RAM
- A structural search feature was added
- The case-related functions in the context menu were made portable
- A comprehensive time-logging facility was added
- The facility to display only a certain number of trees, instead of a
  whole file at once, was added
- A metadata editor for working with the deep format was added (the
  remaining support for this format remains unimplemented)
- A python settings file was added, in addition to the javascript
  settings file
- The facility to add custom CSS rules via a file was added
- Significant changes of interest to developers:
  - A developer’s manual was written
  - Test suites for javascript and python code were added

Release 12.03
-------------

This is the first release since 11.12.

Potentially backwards-incompatible changes:

- The handling of dash tags has been overhauled.  Annotald now has
  three separate lists of allowable dash tags: one list for dash tags
  on word-level labels, one for dash tags on clausal nodes (IP and CP),
  and one for dash tags on non-clausal non-leaf nodes.  Refer to the
  settings.js file distributed with Annotald to see how to configure
  these options.
- Annotald is now licensed under the GPL, version 3 or higher.

Other changes:

- Added support for validation queries.  Use the command-line option -v
  <path> to the annotald script to specify a validation script.  Click the
  “Validate” button in the annotald interface to invoke the script.  The
  script should read trees on standard input, and write (possibly modified)
  trees to standard output.  The output of the script will replace the
  content of the annotald page.  By convention, the script should add the
  dash tag -FLAG to nodes that are considered errors.  The “next error”
  button will scroll the document to the next occurrence of FLAG.  The
  fixError function is available for user keybindings, and removes the
  -FLAG from the selected node.  The -FLAG tag is automatically removed by
  Annotald on save.
  NOTE: the specifics of this interface are expected to change in future
  versions.
- Added a comment editor.  Press ‘l’ with a comment selected to pop up a
  text box to edit the text of the comment.  Spaces in the original text
  are converted to underscores in the tree representation.  A comment is
  defined as a CODE node whose text is enclosed in curly braces {}, and
  the first part of the text inside the braces is one of “COM:”,
  “TODO:”, or “MAN:”.  The three types of comment can be toggled
  between, using the buttons at the bottom left of the dialog box.
- Added time-logging support.  Annotald will write a “timelog.txt” file
  in the working directory, with information about when the program is
  started/stopped/the file is saved.  Jana Beck’s (as yet unreleased)
  CorpusReader tool can be used to calculate parsing time and
  words-per-hour statistics.
- Added a facility to edit CorpusSearch .out files.  These files have
  extraneous comments added by CS.  Give the -o command-line flag to the
  annotald program, and the comments will be removed so that Annotald
  can successfully parse the trees.
- Annotald successfully runs on systems which have Python 3 as the
  “python” command.  This relies on the existence of Python 2.x as the
  “python2” command.
- Added support for clitic traces.  When creating a movement trace with
  the leafBefore and leafAfter functions, if the original phrase has the
  dash tag -CL, the trace inserted will be ``*CL*``.
- Annotald now colors IP-level nodes and the topmost “document” node
  differently.
- Bug fixes.

Release 11.12
-------------

Changes:

- Various bugs fixed
- Support for ID and METADATA nodes, as sisters of the clause root.
  (Currently, nodes other than ID and METADATA will not work.)
- Change how the coloring is applied to clause roots.  Call
  styleIpNodes() in settings.js after setting the ipnodes variable.
- Add mechanism to hide certain tags from view; see settings.js for
  details.
- Added mousewheel support; use shift+wheel-up/-down to move through the
  tree, sisterwise
- Limit undo history to 15 steps.  This limits how much memory is used
  by Annotald, which could be very high.
- Allow (optional) specification of port on the commandline:
  annotald -p <number> <optional settings file> <.psd file>
  This allows multiple instances of Annotald ot be running at once (each
  on a different port)

Release 11.11
-------------

Changes:

- Proper Unicode support on OS X and Linux
- Remove dependency on a particular charset in parsed files
- Code cleanup (see hacking.txt for instructions/style guide)
- Add support for lemmata in (POS word-lemma) format
- Speed up the moving of nodes in some cases
- Add a notification message when save completes successfully
- Add an “exit” button, which kills the Annotald server and closes the
  browser window.  Exit will fail if there are unsaved changes
- Change behavior of mouse click selection.  Previously, the following
  behavior was extant:
  1) Click a node
  2) Change the node’s label with a keybaord command
  3) Click another node to select it
  Result: the just-clicked node is made the selection endpoint
  This can be surprising.  Now, in order to make a secondary selection,
  the two mouseclicks must immediately follow each other, without any
  intervening keystrokes.
- Allow context-sensitive label switching commands.  See the included
  settings.js file for an example
- (Experimental) Add a CSS class to each node in the tree corresponding
  to its syntactic label.  This facilitates the specification of
  additional CSS rules (for an example, see the settings file)
- Keybindings can now be specified with control and shift modifier keys
  (though not both together).  The second argument (action to be taken)
  for a binding can now be an arbitrary javascript function; the third
  argument is the argument (singular for now) to be passed to the
  function.

IcePaHC version
---------------

Initial version
