CFLAGS ?= -O2 -Wall -Wextra
CXXFLAGS ?= -O2 -Wall -Wextra

.PHONY: all clean

all: memlinelog.js

memlinelog.js: memlinelog.bc linelog.bc
	echo 'window.MemLinelog=Module.MemLinelog;' > postjs.js
	emcc -Oz --bind --memory-init-file 0 -s NO_FILESYSTEM=1 -s NO_EXIT_RUNTIME=1 -s EXPORTED_RUNTIME_METHODS="[]" -s ELIMINATE_DUPLICATE_FUNCTIONS=1 --post-js postjs.js -o $@ $^

memlinelog.bc: memlinelog.cpp
	em++ ${CXXFLAGS} -std=c++11 -o $@ $^

linelog.bc: ../linelog.c
	emcc ${CFLAGS} -I.. -o $@ $^

clean:
	rm -f *.bc memlinelog.js postjs.js
