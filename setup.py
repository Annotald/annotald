from setuptools import setup

import os
import annotald

setup_args = {
      'name': 'annotald'
    , 'version': annotald.__version__
    , 'description': 'A GUI for treebank annotation'
    , 'author': 'Aaron Ecay, Anton Karl Ingason and Jana Beck'
    , 'author_email': 'aaronecay@gmail.com'
    , 'url': 'http://annotald.github.com/'
    , 'license': "GPLv3+"
    , 'classifiers': [
        "Development Status :: 4 - Beta",
        "Intended Audience :: Education",
        "License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)",
        "Topic :: Scientific/Engineering"
    ]
    , 'long_description': (open("README.rst", encoding="utf-8").read() + "\n\n" +
                           open("NEWS.rst", encoding="utf-8").read())
}

setup(
        packages=['annotald']
    , scripts=['bin/annotald', 'bin/annotald-aux']
    , package_data={'annotald': ["data/*/*", "settings.py",
                                    "settings.js",
                                    "CS_Tony_oct19.jar"]}
    , install_requires=["mako", "cherrypy", "argparse", "nltk"]
    , setup_requires = ["setuptools"]
    , provides=["annotald"]
    , **setup_args
)
