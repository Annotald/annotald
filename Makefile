.PHONY: api-doc private-doc deploy-docs test

api-doc:
	jsdoc -v -d=api-doc treedrawing/data/scripts/treedrawing.js \
		treedrawing/data/scripts/treedrawing.utils.js
	mv api-doc/symbols/_global_.html api-doc/symbols/global.html
	find api-doc -name "*.html" -print0 | xargs -0 sed -i'.bak' \
		-e 's/_global_/global/g'
	find api-doc -name "*.bak" -print0 | xargs -0 rm

deploy-docs: api-doc
	cp -r api-doc ../annotald-doc

private-doc:
	jsdoc -v -p -d=priv-doc treedrawing/data/scripts/treedrawing.js \
		treedrawing/data/scripts/treedrawing.utils.js

test:
	nosetests2 -w treedrawing --with-coverage --cover-erase --cover-package=util
	coverage2 html
