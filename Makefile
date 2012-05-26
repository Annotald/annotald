.PHONY: doc

doc:
	jsdoc -v -d=doc treedrawing/data/scripts/treedrawing.js
	mv doc/symbols/_global_.html doc/symbols/global.html
	find doc -name "*.html" -print0 | xargs -0 sed -i'.bak' \
		-e 's/_global_/global/g'
	find doc -name "*.bak" -print0 | xargs -0 rm
	cp -r doc ../annotald-doc

