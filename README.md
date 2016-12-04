timepad
=======

I suck at naming projects. The two words come from "Time Machine" and
"Notepad" - you get the general idea - is it just the "undo/redo" feature that
every editor has? Kind of.

This is a demo project that shows the ability to "source control" a single
file in the javascript world where lines are treated as first-class citizens.

Check the [demo page](quark-zju.github.io/timepad/) to get an idea of what it
could do. Basically, it could do:

  - Real-time annotate information for every line so every line has timestamps
    automatically. No need to run "commit" using traditional source control
    software.
  - Provide a "all lines" view that shows all deleted lines. It's very helpful
    (I'm being subjective) if the history is long - in which case you can see
    how the code evolves in just a single page.

Possibilities:

  - Integrate with Atom-like editor. Why not? It's javascript.
  - Track lines accurately. Think about running some slow linter
    asynchronously, and the user is editing the file at the same time.
    The line numbers returned by the linter could be inaccurate.
  - Integrate with whatever source control tool who can provide the linelog
    information so the history could be concatenated when editing a file
    tracked by the source control tool.

How to build?
-------------
`make`.

* To be able to rebuild `index.html`, `slimrb` (which is part of the `slim`
  ruby gem) is needed.
* To be able to rebuild `app.js`, `coffee` (which is part of the `coffee` npm
  package) is needed.
* To be able to rebuild `memlinelog.js`, `emscripten`
  ([homepage](http://emscripten.org/)) is needed.

How to run locally?
------------------

Start any web server that serves static files.
Example: `python2 -m SimpleHTTPServer`, and open `http://localhost:8000`.

License
-------
GPL2. See LICENSE for details.
