#!/usr/bin/python2

# TODO: this should be put in a different directory, when annotald is
# converted into a python package

import nltk.tree as T
import sys
import util

def main():
    with open(sys.argv[1], "r") as f:
        trees = f.read()
    util.writeTreesToFile(None, trees, sys.argv[2])

if __name__ == "__main__":
    main()
    
