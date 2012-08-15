.PHONY: api-doc priv-doc deploy-docs test all-docs doc

api-doc:
	jsdoc -v -d=api-doc treedrawing/data/scripts/treedrawing.js \
		treedrawing/data/scripts/treedrawing.utils.js \
		treedrawing/data/scripts/treedrawing.contextMenu.js
	mv api-doc/symbols/_global_.html api-doc/symbols/global.html
	find api-doc -name "*.html" -print0 | xargs -0 sed -i'.bak' \
		-e 's/_global_/global/g'
	find api-doc -name "*.bak" -print0 | xargs -0 rm

deploy-docs: api-doc doc
	cp -r api-doc ../annotald-doc
	cp -r doc/*.html doc/*.css doc/images ../annotald-doc/doc

priv-doc:
	jsdoc -v -p -d=priv-doc treedrawing/data/scripts/treedrawing.js \
		treedrawing/data/scripts/treedrawing.utils.js

doc: doc/devel.html doc/user.html

doc/devel.html: doc/devel.adoc
	cd doc && make devel.html

doc/user.html: doc/user.adoc
	cd doc && make user.html

all-docs: api-doc priv-doc doc

test:
	nosetests2 -w treedrawing --with-coverage --cover-erase --cover-package=util
	coverage2 html
