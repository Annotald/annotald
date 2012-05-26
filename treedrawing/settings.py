# This Python file uses the following encoding: utf-8

# List of paths to javascript files which should be included in the
# Annotald UI
extraJavascripts = []

# Set this to True if you are an Annotald developer or otherwise need to
# debug Annotald's jQuery code
debugJs = False

# This should be a dictionary, with the keys being the names of
# validation queries, and the values being a Pythin function (or other
# callable).  The function should accept two arguments -- the file
# header, and the file content, both as strings of parenthesized trees.
# It should return a string, which will be interpreted as the new
# content for the UI.

# Tips:
# - use the OrderedDict class (form the collections module) to preserve
#   the order of the validators in the menu

validators = {}

# from lovett.annotald import stdinValidator, flagIf
# validators = {
#     "example of a stdin validation query": stdinValidator("/path/to/script.py"),
#     "example of a lovett validator": flagIf(lovett expression),
#     "example of a corpussearch-based validator": TODO
# }
