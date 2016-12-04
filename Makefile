all: index.html app.js

index.html: index.slim
	slimrb $^ > $@

app.js: app.coffee
	coffee -c $^
