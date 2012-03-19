# Annotald

Annotald is a program for annotating parsed corpora in the Penn Treebank
format.  For more information on the instantiation of this format by the
Penn Parsed Corpora of Historical English, see [this section of the
documentation by Beatrice Santorini][psd-doc].  Annotald was originally
written by [Anton Ingason][anton] as part of the [Icelandic Parsed Historical
Corpus][icepahc] project.  It is currently being developed by him along
with [Jana Beck][jana] and [Aaron Ecay][aaron].

## Obtaining Annotald

The central location for Annotald development is [on
Github][github-annotald].  You can download the development source
directly using the [git revision control software][git].  The repositiory
has several branches.  The currently active Annotald developers maintain
branches with their first name followed by `-dev`, which represent their
work.  The branch `master` is updated with bugfixes between releases.
Finally, the branch `release` is updated only when a release is made
(every month and for serious bugs).

You can also download the source files from a monthly release from the
[github tags page][tags].  These releases are generally “beta” quality.
No matter which version of the software you use, we appreciate bug
reports.  The best way to submit these is through the [github issues
page][issues].

This summer, we will be working on a stable version of Annotald to
release.  The projected release date is Sep. 1, 2012.

## Annotald Dependencies

Annotald depends on the following software packages to function:

* Python 2.7
* These Python libraries:
  * The Natural Language Toolkit ([NLTK][nltk])
  * [Mako][mako]
* The Google Chrome browser (or the non-Google branded Chromium version)

In addition, Annotald bundles the following libraries.  See the
corresponding files in the repository for the associated license
information:

* [jQuery][jquery]
* jQuery plugins:
  * [contextmenu][contextmenu]
  * [mousewheel][mousewheel]
* [Underscore][underscore]

## Using Annotald

Annotald currently has very little documentation.  Improving this situation
is one of the goals of the stable version.  In the meantime, look at the
`manual.txt` file for instructions, and at the `treedrawing/settings.js`
file for an example of how Annotald is configured.

## License

Annotald is available under the terms of the GNU General Public License
(GPL) version 3 or (at your option) any later version.  Please see the
`LICENSE` file for more information.

## Funding Sources

Annotald development has been funded by the following funding sources:

* From the Icelandic Research Fund (RANNÍS), grant nr. 090662011, Viable
  Language Technology beyond English – Icelandic as a Test Case.


[psd-doc]: http://www.ling.upenn.edu/hist-corpora/annotation/intro.htm#parsed_files
[github-annotald]: https://github.com/janabeck/Annotald
[git]: http://git-scm.com/
[icepahc]: http://linguist.is/icelandic_treebank/Icelandic_Parsed_Historical_Corpus_(IcePaHC)
[anton]: http://linguist.is/
[aaron]: http://www.ling.upenn.edu/~ecay/
[jana]: http://www.ling.upenn.edu/~janabeck/
[tags]: https://github.com/janabeck/Annotald/tags
[issues]: https://github.com/janabeck/Annotald/issues
[nltk]: http://www.nltk.org/
[mako]: http://www.makotemplates.org/
[jquery]: http://jquery.com/
[contextmenu]: http://www.JavascriptToolbox.com/lib/contextmenu/
[mousewheel]: http://archive.plugins.jquery.com/project/mousewheel
[underscore]: http://documentcloud.github.com/underscore/
