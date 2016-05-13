Annotald
========

Annotald is a program for annotating parsed corpora in the Penn Treebank
format.  For more information on the format (as instantiated by the Penn
Parsed Corpora of Historical English), see `the documentation by
Beatrice Santorini`_.  Annotald was originally written by `Anton
Ingason`_ as part of the `Icelandic Parsed Historical Corpus`_ project.
It is currently being developed by him along with `Jana Beck`_ and
`Aaron Ecay`_.

.. _the documentation by Beatrice Santorini:
    http://www.ling.upenn.edu/hist-corpora/annotation/intro.htm#parsed_files
.. _Anton Ingason: http://linguist.is/
.. _Icelandic Parsed Historical Corpus:
    http://linguist.is/icelandic_treebank/Icelandic_Parsed_Historical_Corpus_(IcePaHC)
.. _Jana Beck: http://www.ling.upenn.edu/~janabeck/
.. _Aaron Ecay: http://www.ling.upenn.edu/~ecay/

Obtaining Annotald
------------------

The central location for Annotald development is `on Github`_.  You can
view or download the program's source code from there.  The latest
release is available as a `Python package`_.  Install it with the
command ``pip install annotald`` .  (Further information about
installation is available in the user’s manual.)

.. _on Github: https://github.com/Annotald/annotald
.. _Python package: https://pypi.python.org/pypi/annotald

Using Annotald
--------------

The `Annotald user’s manual`_ can be found online.  For developers,
there is also `automatically generated API documentation`_.

.. _Annotald user’s manual: http://annotald.github.com/user.html
.. _automatically generated API documentation:
    http://annotald.github.com/api-doc/global.html

License
-------

Annotald is available under the terms of the GNU General Public License
(GPL) version 3 or (at your option) any later version.  Please see the
``LICENSE`` file included with the source code for more information.

Funding Sources
---------------

Annotald development has been funded by the following funding sources:

- Icelandic Research Fund (RANNÍS), grant #090662011: “Viable Language
  Technology beyond English – Icelandic as a Test Case”
- The research funds of `Anthony Kroch`_ at the University of
  Pennsylvania.

.. _Anthony Kroch: http://www.ling.upenn.edu/~kroch/

Third party libraries
---------------------

Annotald uses the following free software libraries and resources:

- `NLTK`_ for manipulating trees
- `Mako`_ and `CherryPy`_ for serving the HTML interface
- `jQuery`_, `Underscore`_, some jQuery plugins, and `zip.js`_ in the browser
- Icons from Google’s `Material Design`_ icon pack

.. _NLTK: http://www.nltk.org/
.. _Mako: http://www.makotemplates.org/
.. _CherryPy: http://www.cherrypy.org/
.. _jQuery: https://jquery.com/
.. _Underscore: http://underscorejs.org/
.. _Material Design: https://github.com/google/material-design-icons
.. _zip.js: https://gildas-lormeau.github.io/zip.js/
