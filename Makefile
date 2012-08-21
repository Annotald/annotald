.PHONY: api-doc priv-doc deploy-docs test all-docs doc

api-doc:
	jsdoc -d api-doc -c doc/conf.json -t templates/awe \
		treedrawing/data/scripts/treedrawing.js \
		treedrawing/data/scripts/treedrawing.utils.js \
		treedrawing/data/scripts/treedrawing.contextMenu.js

deploy-docs: api-doc doc
	cp -r api-doc ../annotald-doc
	cp -r doc/*.html doc/*.css doc/images ../annotald-doc/doc

priv-doc:
	jsdoc -p -d priv-doc -c doc/conf.json -t templates/awe \
		treedrawing/data/scripts/treedrawing.js \
		treedrawing/data/scripts/treedrawing.utils.js \
		treedrawing/data/scripts/treedrawing.contextMenu.js

doc: doc/devel.html doc/user.html

doc/devel.html: doc/devel.adoc
	cd doc && make devel.html

doc/user.html: doc/user.adoc
	cd doc && make user.html

all-docs: api-doc priv-doc doc

test:
	nosetests2 -w treedrawing --with-coverage --cover-erase \
		--cover-package=util --cover-package=logs
	coverage2 html
