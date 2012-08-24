#!/usr/bin/env python2

import nltk.tree as T
import sys
import annotald.util

def main(frm, to):
    with open(frm, "r") as f:
        trees = f.read()
    annotald.util.writeTreesToFile(None, trees, to)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
    
