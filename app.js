// Generated by IcedCoffeeScript 108.0.11
(function() {
  var App, br, button, diffLines, div, dmp, getBinary, getText, hr, input, intToDate, isTrivialChange, label, pre, span, splitLines, textarea, vectorReduce, _ref,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  window.iced = {
    Deferrals: (function() {
      function _Class(_arg) {
        this.continuation = _arg;
        this.count = 1;
        this.ret = null;
      }

      _Class.prototype._fulfill = function() {
        if (!--this.count) {
          return this.continuation(this.ret);
        }
      };

      _Class.prototype.defer = function(defer_params) {
        ++this.count;
        return (function(_this) {
          return function() {
            var inner_params, _ref;
            inner_params = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            if (defer_params != null) {
              if ((_ref = defer_params.assign_fn) != null) {
                _ref.apply(null, inner_params);
              }
            }
            return _this._fulfill();
          };
        })(this);
      };

      return _Class;

    })(),
    findDeferral: function() {
      return null;
    },
    trampoline: function(_fn) {
      return _fn();
    }
  };
  window.__iced_k = window.__iced_k_noop = function() {};

  _ref = React.DOM, div = _ref.div, br = _ref.br, hr = _ref.hr, textarea = _ref.textarea, span = _ref.span, pre = _ref.pre, input = _ref.input, label = _ref.label, button = _ref.button;

  getText = function(url, cb) {
    var oReq;
    oReq = new XMLHttpRequest;
    oReq.addEventListener('load', function() {
      return cb(this.responseText);
    });
    oReq.open('GET', url);
    return oReq.send();
  };

  getBinary = function(url, cb) {
    var oReq;
    oReq = new XMLHttpRequest;
    oReq.addEventListener('load', function() {
      return cb(this.response);
    });
    oReq.open('GET', url);
    oReq.responseType = 'arraybuffer';
    return oReq.send();
  };

  intToDate = function(epoch) {
    return new Date(epoch * 1000);
  };

  dmp = new diff_match_patch;

  diffLines = function(a, b) {
    var a1, a2, b1, b2, blocks, chars, chars1, chars2, len, lineArray, op, push, _i, _len, _ref1, _ref2, _ref3;
    _ref1 = dmp.diff_linesToChars_(a, b), chars1 = _ref1.chars1, chars2 = _ref1.chars2, lineArray = _ref1.lineArray;
    blocks = [];
    a1 = a2 = b1 = b2 = 0;
    push = function(len) {
      if (a1 !== a2 || b1 !== b2) {
        blocks.push([a1, a2, b1, b2]);
      }
      a1 = a2 = a2 + len;
      return b1 = b2 = b2 + len;
    };
    _ref2 = dmp.diff_main(chars1, chars2, false);
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      _ref3 = _ref2[_i], op = _ref3[0], chars = _ref3[1];
      len = chars.length;
      if (op === 0) {
        push(len);
      }
      if (op < 0) {
        a2 += len;
      }
      if (op > 0) {
        b2 += len;
      }
    }
    push(0);
    return blocks;
  };

  splitLines = function(s) {
    var nextPos, pos, result;
    pos = 0;
    result = [];
    while (pos < s.length) {
      nextPos = s.indexOf('\n', pos);
      if (nextPos === -1) {
        nextPos = s.length - 1;
      }
      result.push(s.slice(pos, +nextPos + 1 || 9e9));
      pos = nextPos + 1;
    }
    return result;
  };

  isTrivialChange = function(diffBlocks, annotated, rev) {
    var a1, a2, b1, b2, i, _i, _ref1, _ref2;
    if (diffBlocks.length !== 1) {
      return false;
    }
    _ref1 = diffBlocks[0], a1 = _ref1[0], a2 = _ref1[1], b1 = _ref1[2], b2 = _ref1[3];
    if (a2 - a1 !== 1 || b2 - b1 !== 1 || a1 !== b1) {
      return false;
    }
    if (annotated.get(a1)[0] !== rev) {
      return false;
    }
    for (i = _i = 0, _ref2 = annotated.size(); 0 <= _ref2 ? _i < _ref2 : _i > _ref2; i = 0 <= _ref2 ? ++_i : --_i) {
      if (annotated.get(i)[0] === rev && i !== a1) {
        return false;
      }
    }
    return true;
  };

  vectorReduce = function(vec, f, init) {
    var i, result, _i, _ref1;
    result = init;
    for (i = _i = 0, _ref1 = vec.size(); 0 <= _ref1 ? _i < _ref1 : _i > _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
      result = f(result, vec.get(i));
    }
    return result;
  };

  App = (function(_super) {
    __extends(App, _super);

    function App(props) {
      App.__super__.constructor.call(this, props);
      window.$l = this.linelog = new MemLinelog;
      this.state = {
        lineMap: {},
        ctimeMap: {},
        publicMap: {},
        content: '',
        showAnnotated: true,
        showRev: null,
        autoCommit: true,
        startRev: null
      };
    }

    App.prototype.getAnnotated = function(rev) {
      if (this.lastAnnotatedRev !== rev) {
        this.linelog.annotate(rev);
        this.lastAnnotatedResult = this.linelog.getAnnotateResult();
        this.lastAnnotatedRev = rev;
      }
      return this.lastAnnotatedResult;
    };

    App.prototype.commit = function(content) {
      var a, a1, a2, annotated, b, b1, b2, bi, blines, blocks, ctimeMap, lineMap, rev, trivial, _i, _j, _len, _ref1, _ref2, _ref3;
      a = this.state.content;
      b = content;
      if (b.length > 0 && b.slice(-1) !== '\n') {
        b += '\n';
      }
      if (a === b) {
        return;
      }
      blines = splitLines(b);
      _ref1 = this.state, ctimeMap = _ref1.ctimeMap, lineMap = _ref1.lineMap;
      rev = this.linelog.getMaxRev();
      annotated = this.getAnnotated(rev);
      blocks = diffLines(a, b);
      trivial = isTrivialChange(blocks, annotated, rev);
      if (trivial) {
        a1 = blocks[0][0];
        lineMap[annotated.get(a1).slice(0, 2)] = blines[a1];
      } else {
        rev += 1;
        _ref2 = blocks.reverse();
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          _ref3 = _ref2[_i], a1 = _ref3[0], a2 = _ref3[1], b1 = _ref3[2], b2 = _ref3[3];
          for (bi = _j = b1; b1 <= b2 ? _j <= b2 : _j >= b2; bi = b1 <= b2 ? ++_j : --_j) {
            lineMap[[rev, bi]] = blines[bi];
          }
          this.linelog.replaceLines(rev, a1, a2, b1, b2);
        }
      }
      ctimeMap[rev] = new Date();
      return this.setState({
        lineMap: lineMap,
        ctimeMap: ctimeMap,
        content: b
      });
    };

    App.prototype.handleTextChange = function(e) {
      if (!this.state.autoCommit) {
        return;
      }
      return this.commit(e.target.value);
    };

    App.prototype.handleShowAnnotatedChange = function(e) {
      return this.setState({
        showAnnotated: e.target.checked
      });
    };

    App.prototype.handleStartRevChange = function(e) {
      var rev;
      rev = parseInt(e.target.value);
      return this.setState({
        startRev: rev
      });
    };

    App.prototype.handleShowRevChange = function(e) {
      var rev;
      rev = parseInt(e.target.value);
      if (rev < this.state.startRev) {
        this.setState({
          startRev: rev
        });
      }
      if (rev === this.linelog.getMaxRev()) {
        rev = null;
      }
      return this.setState({
        showRev: rev
      });
    };

    App.prototype.handleRevisionBarMouseMove = function(xs, e) {
      if (e.buttons === 1) {
        return this.handleRevisionBarClick(xs, e, this.y);
      }
    };

    App.prototype.handleRevisionBarClick = function(xs, e, y) {
      var curPos, d, date, k, minDelta, needUpdate, newState, pos, pub, rev, revpos, tRev, v, width, _i, _len;
      rev = null;
      if (e.target.tagName === 'SPAN') {
        rev = e.target.dataset.rev;
      } else {
        minDelta = 1e100;
        width = xs[xs.length - 1][1] + 1;
        curPos = ((e.nativeEvent.offsetX - 1) / 0.98) * width / e.target.clientWidth;
        for (_i = 0, _len = xs.length; _i < _len; _i++) {
          revpos = xs[_i];
          tRev = revpos[0], pos = revpos[1], date = revpos[2], pub = revpos[3];
          d = Math.abs(curPos - pos);
          if (d < minDelta) {
            rev = tRev;
            minDelta = d;
          }
        }
      }
      if (rev == null) {
        return;
      } else {
        rev = parseInt(rev);
      }
      newState = {};
      if (y == null) {
        this.y = y = e.nativeEvent.offsetY;
      }
      if (y <= e.target.clientHeight / 2) {
        newState.startRev = rev;
        if (rev >= this.state.showRev && this.state.showRev !== null) {
          newState.showRev = rev;
          newState.startRev = null;
        }
      } else {
        if (rev <= this.state.startRev) {
          newState.startRev = null;
        }
        newState.showRev = rev;
      }
      if (newState.showRev === this.linelog.getMaxRev()) {
        newState.showRev = null;
      }
      needUpdate = false;
      for (k in newState) {
        v = newState[k];
        if (this.state[k] !== v) {
          needUpdate = true;
          break;
        }
      }
      if (needUpdate) {
        this.setState(newState);
      }
      e.preventDefault();
      return e.stopPropagation();
    };

    App.prototype.handleAutoCommitChange = function(e) {
      var value;
      value = e.target.checked;
      this.setState({
        autoCommit: value
      });
      if (value) {
        return this.commit(this.refs.editor.value);
      }
    };

    App.prototype.handleLoadExample = function(e) {
      var allLines, content, ctimeMap, i, info, k, line, lineMap, lineinfos, linelogBuffer, lines, name, publicMap, rev, startRev, ___iced_passed_deferral, __iced_deferrals, __iced_k;
      __iced_k = __iced_k_noop;
      ___iced_passed_deferral = iced.findDeferral(arguments);
      name = 'mdiff.py';
      (function(_this) {
        return (function(__iced_k) {
          __iced_deferrals = new iced.Deferrals(__iced_k, {
            parent: ___iced_passed_deferral,
            filename: "app.coffee",
            funcname: "App.handleLoadExample"
          });
          getBinary("assets/examples/" + name + ".linelog.bin", __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return linelogBuffer = arguments[0];
              };
            })(),
            lineno: 201
          }));
          getText("assets/examples/" + name + ".alllines.json", __iced_deferrals.defer({
            assign_fn: (function() {
              return function() {
                return allLines = arguments[0];
              };
            })(),
            lineno: 202
          }));
          __iced_deferrals._fulfill();
        });
      })(this)((function(_this) {
        return function() {
          var _i, _j, _len, _ref1;
          ctimeMap = {};
          lineMap = {};
          publicMap = {};
          _this.linelog.setRawBytes(linelogBuffer);
          lineinfos = _this.linelog.getAllLines();
          allLines = JSON.parse(allLines);
          for (i = _i = 0, _len = allLines.length; _i < _len; i = ++_i) {
            line = allLines[i];
            info = lineinfos.get(i);
            k = info.slice(0, 2);
            rev = parseInt(k[0]);
            lineMap[k] = line['line'];
            ctimeMap[k[0]] = intToDate(line['date'][0]);
            publicMap[rev] = line;
          }
          startRev = lineinfos.get(parseInt(Math.random() * (allLines.length - 1)))[0];
          content = '';
          _this.linelog.annotate(_this.linelog.getMaxRev());
          lines = _this.linelog.getAnnotateResult();
          for (i = _j = 0, _ref1 = lines.size(); 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
            info = lines.get(i);
            k = info.slice(0, 2);
            content += lineMap[k];
          }
          _this.lastAnnotatedRev = -1;
          _this.refs.editor.value = content;
          return _this.setState({
            ctimeMap: ctimeMap,
            lineMap: lineMap,
            content: content,
            publicMap: publicMap,
            startRev: startRev,
            showRev: null
          });
        };
      })(this));
    };

    App.prototype.handleDoubleClickLine = function(key, e) {
      var content, m, newContent;
      m = this.state.lineMap;
      content = m[key];
      newContent = prompt("Edit a line in rev " + key[0], content);
      if (newContent !== null && newContent !== content) {
        m[key] = newContent;
        this.setState({
          lineMap: m
        });
        e.stopPropagation();
        return e.preventDefault();
      }
    };

    App.prototype.getShowRev = function() {
      var rev;
      rev = this.state.showRev;
      if (rev === null) {
        rev = this.linelog.getMaxRev();
      }
      return rev;
    };

    App.prototype.getLineContentMapSize = function() {
      var k, size, v, _ref1;
      size = 0;
      _ref1 = this.state.lineMap;
      for (k in _ref1) {
        v = _ref1[k];
        if (v) {
          size += k.length + v.length + 4;
        }
      }
      return size;
    };

    App.prototype.render = function() {
      return div({
        className: 'columns',
        style: {
          height: '100%'
        }
      }, div({
        className: 'column'
      }, textarea({
        id: 'editor',
        ref: 'editor',
        onChange: this.handleTextChange.bind(this)
      })), div({
        className: 'column scroll',
        style: {
          maxWidth: '50%'
        }
      }, this.linelog.getMaxRev() === 0 ? this.renderReadme() : this.renderControls(), this.state.showAnnotated ? this.renderAnnotated() : void 0));
    };

    App.prototype.renderReadme = function() {
      return div({
        className: 'readmeFrame'
      }, pre({
        className: 'readme'
      }, 'This is a demo that shows the ability to "source control" a single\nfile in the javascript world using a data structure [1] inspired by\nthe "interleaved deltas" [2] idea.\n\n<- Try ', React.DOM.a({
        onClick: this.handleLoadExample.bind(this),
        title: 'mercurial/mdiff.py'
      }, 'an example file'), br(), '<- And/or type something in the editor\n\nSource code is available at [3].\n\n[1]: https://bitbucket.org/facebook/hg-experimental/src/8af0e0/linelog\n[2]: https://en.wikipedia.org/wiki/Interleaved_deltas\n[3]: https://github.com/quark-zju/timepad'));
    };

    App.prototype.renderControls = function() {
      var maxRev, rev, startRev;
      maxRev = this.linelog.getMaxRev();
      rev = this.getShowRev();
      startRev = this.state.startRev;
      return div({
        className: 'controls'
      }, div({
        className: 'control'
      }, label({
        className: 'checkbox level-left'
      }, input({
        className: 'level-item',
        type: 'checkbox',
        checked: this.state.autoCommit,
        onChange: this.handleAutoCommitChange.bind(this)
      }), span({
        className: 'level-item'
      }, "Real-time committing")), div({
        className: 'desc'
      }, 'When turned on, changes to the left textbox will be recorded in real-time. ', 'Try turn this off and do some non-trivial edits, and turn this on again. ', "The size of linelog (without line contents or commit metadata) is " + (this.linelog.getActualSize()) + " bytes. ")), div({
        className: 'control'
      }, label({
        className: 'checkbox'
      }, input({
        className: 'level-item',
        type: 'checkbox',
        checked: this.state.showAnnotated,
        onChange: this.handleShowAnnotatedChange.bind(this)
      }), span({
        className: 'level-item'
      }, 'Show annotated lines')), div({
        className: 'desc'
      }, 'When turned on, annotated lines will be rendered below. Turn off if React rendering hurts perf. ', 'Select a RANGE of revisions from the bar below to see the lines related to them. Click at the upper area to pick a starting revision, and the lower area for an ending revision. ', 'Double-click a line to edit its content in THAT revision. This shows simple stack editing without merge conflicts. It could be made to support more complex cases, also see ', React.DOM.a({
        href: 'assets/hgabsorb-note.pdf'
      }, 'hg absorb'), '. ', 'Revisions of existing history (with known commit hashes) are in green. Local history in blue. Place your mouse over them to see commit hashes, authors, and dates. ')), this.state.showAnnotated ? div({
        className: 'control'
      }, this.renderRevisionSelector()) : void 0);
    };

    App.prototype.renderRevisionSelector = function() {
      var date, diffSeconds, getLeftCss, lastDate, lastPos, lastRev, localScale, pos, posMap, pub, publicMap, rev, showRev, startRev, timeMap, width, xs, _i, _ref1;
      timeMap = this.state.ctimeMap;
      publicMap = this.state.publicMap;
      xs = [];
      posMap = {};
      lastDate = null;
      lastPos = 0;
      lastRev = -1;
      localScale = 1;
      for (rev = _i = 0, _ref1 = this.linelog.getMaxRev(); 0 <= _ref1 ? _i <= _ref1 : _i >= _ref1; rev = 0 <= _ref1 ? ++_i : --_i) {
        date = timeMap[rev];
        if (!date) {
          continue;
        }
        pub = publicMap[rev];
        pos = lastRev === -1 ? 1 : (diffSeconds = Math.max(1, (date - lastDate) / 1000.0), lastPos + Math.sqrt(diffSeconds) * localScale);
        if (!pub && localScale === 1) {
          localScale = pos * 0.42 / (this.linelog.getMaxRev() - xs.length + 1);
        }
        xs.push([rev, pos, date, pub]);
        posMap[rev] = pos;
        lastDate = date;
        lastPos = pos;
        lastRev = rev;
      }
      width = lastPos + 1;
      getLeftCss = function(pos) {
        return "calc(" + (pos * 98.0 / width) + "% + 1px)";
      };
      showRev = this.state.showRev || this.linelog.getMaxRev();
      startRev = this.state.startRev || showRev;
      return div({
        className: 'rev-selector',
        onMouseDown: this.handleRevisionBarClick.bind(this, xs),
        onMouseMove: this.handleRevisionBarMouseMove.bind(this, xs)
      }, xs.map((function(_this) {
        return function(revpos) {
          var m, title;
          rev = revpos[0], pos = revpos[1], date = revpos[2], pub = revpos[3];
          m = moment(timeMap[rev]);
          title = pub ? "" + rev + ":" + pub['node'].slice(0, 8) + " by " + pub['user'] + " at " + (m.format('MMM Do YY')) : "" + rev + ":(local change) " + (m.fromNow());
          return span({
            key: rev,
            className: "rev-dot " + (pub && 'public'),
            'data-rev': rev,
            style: {
              left: getLeftCss(pos)
            },
            title: title
          });
        };
      })(this)), span({
        className: "rev-left-slider " + (this.state.startRev || 'follow'),
        style: {
          left: getLeftCss(posMap[startRev])
        }
      }), span({
        className: "rev-right-slider " + (this.state.showRev || 'follow'),
        style: {
          left: getLeftCss(posMap[showRev])
        }
      }));
    };

    App.prototype.renderAnnotated = function() {
      var annotated, color, deleted, desc, endRev, i, info, isDeleted, k, lineSet, lines, m, maxRev, pub, rev, revStr, rgb, rows, short, showDeleted, startRev, _i, _ref1;
      annotated = this.getAnnotated(this.getShowRev());
      maxRev = this.linelog.getMaxRev();
      endRev = this.state.showRev || maxRev;
      startRev = this.state.startRev || endRev;
      showDeleted = startRev !== endRev;
      if (showDeleted) {
        lines = this.linelog.getAllLines();
        lineSet = vectorReduce(annotated, (function(m, v) {
          m[v.slice(0, 2)] = 1;
          return m;
        }), {});
        isDeleted = function(k) {
          return !lineSet[k];
        };
      } else {
        lines = annotated;
        isDeleted = function(k) {
          return false;
        };
      }
      rows = [];
      for (i = _i = 0, _ref1 = lines.size(); 0 <= _ref1 ? _i < _ref1 : _i > _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
        info = lines.get(i);
        k = info.slice(0, 2);
        rev = k[0];
        m = moment(this.state.ctimeMap[rev]);
        deleted = isDeleted(k);
        pub = this.state.publicMap[rev];
        if (deleted && (rev < startRev || rev > endRev)) {
          continue;
        }
        if (pub) {
          rgb = '78, 154, 6';
          desc = "" + pub['node'].slice(0, 8) + " by " + pub['user'] + " at " + (m.format('MMM Do YY')) + " (rev,linenum=" + k + ")";
          revStr = "" + rev;
          short = '          '.slice(0, +(7 - revStr.length) + 1 || 9e9) + revStr;
        } else {
          rgb = '114, 159, 207';
          desc = "Local change at " + (m.fromNow()) + " (rev,linenum=" + k + ")";
          short = m.format('HH:mm:ss');
        }
        color = "rgba(" + rgb + ", " + (rev / maxRev) + ")";
        rows.push(pre({
          key: k,
          className: "line " + (deleted && 'deleted') + " " + (pub && 'public'),
          title: desc,
          onDoubleClick: this.handleDoubleClickLine.bind(this, k)
        }, span({
          className: 'timestamp',
          style: {
            backgroundColor: color
          }
        }, short), span({
          className: "line-content"
        }, this.state.lineMap[k])));
      }
      if (rows.length > 0) {
        return div({
          className: 'annotated',
          style: {
            height: "100%",
            maxWidth: '100%'
          }
        }, rows);
      }
    };

    return App;

  })(React.Component);

  document.addEventListener('DOMContentLoaded', function() {
    return ReactDOM.render(React.createElement(App), document.querySelector('#root'));
  });

}).call(this);
