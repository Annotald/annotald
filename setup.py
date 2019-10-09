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
    , 'long_description': (open("README.rst").read() + "\n\n" +
                           open("NEWS.rst").read())
}

if os.name == "nt":
    import py2exe
    import glob

    manifest = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1"
manifestVersion="1.0">
<assemblyIdentity
    version="0.64.1.0"
    processorArchitecture="x86"
    name="Controls"
    type="win32"
/>
<description>Annotald/description>
<dependency>
    <dependentAssembly>
        <assemblyIdentity
            type="win32"
            name="Microsoft.Windows.Common-Controls"
            version="6.0.0.0"
            processorArchitecture="X86"
            publicKeyToken="6595b64144ccf1df"
            language="*"
        />
    </dependentAssembly>
</dependency>
</assembly>
"""

    annotald_data_files = []

    annotald_data_files.append(('', ['settings.js', 'CS_Tony_oct19.jar',
                                     'nothing.q', 'user-plain-red.png',
                                     'user-plain-blue.png']))

    html_files = glob.glob('data/html/*.mako')
    annotald_data_files.append(('data/html', html_files))

    image_files = glob.glob('data/images/*.png')
    annotald_data_files.append(('data/images', image_files))

    script_files = glob.glob('data/scripts/*.js')
    annotald_data_files.append(('data/scripts', script_files))

    css_files = glob.glob('data/css/*.css')
    annotald_data_files.append(('data/css', css_files))

    setup(windows=[{"script": "annotald-win.py",
                    "other resources": [24,1, manifest]
                }],
          data_files=annotald_data_files,
          options={"py2exe": {"skip_archive": True}},
          **setup_args)

else:
    setup(
          packages=['annotald']
        , scripts=['bin/annotald', 'bin/annotald-aux']
        , package_data={'annotald': ["data/*/*", "settings.py",
                                     "settings.js",
                                     "CS_Tony_oct19.jar"]}
        , install_requires=["mako", "cherrypy<18", "argparse", "nltk2-fixed==2.0.6"]
        , setup_requires = ["setuptools"]
        , provides=["annotald"]
        , **setup_args
    )
