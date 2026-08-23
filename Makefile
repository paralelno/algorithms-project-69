install:
	npm install

test:
	npm test

lint:
	npx eslint .

.PHONY: install test lint
