.PHONY: doc

api-doc:
	jsdoc -v -d=api-doc treedrawing/data/scripts/treedrawing.js
	mv api-doc/symbols/_global_.html api-doc/symbols/global.html
	find api-doc -name "*.html" -print0 | xargs -0 sed -i'.bak' \
		-e 's/_global_/global/g'
	find api-doc -name "*.bak" -print0 | xargs -0 rm

deploy-docs: api-doc
	cp -r api-doc ../annotald-doc

