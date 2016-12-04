{div, textarea, span, pre, input, label} = React.DOM

dmp = new diff_match_patch

diffLines = (a, b) ->
  {chars1, chars2, lineArray} = dmp.diff_linesToChars_(a, b)
  # dmp.diff_main returns [(op, text), ...], where op could be -1: left, 1:
  # right, 0: both sides. Convert it to mercurial.mdiff.allblocks style:
  # (a1, a2, b1, b2) and only return the differences.
  blocks = []
  a1 = a2 = b1 = b2 = 0
  push = (len) ->
    if a1 != a2 or b1 != b2
      blocks.push([a1, a2, b1, b2])
    a1 = a2 = a2 + len
    b1 = b2 = b2 + len

  for [op, chars] in dmp.diff_main(chars1, chars2, false)
    len = chars.length
    push len if op == 0
    a2 += len if op < 0
    b2 += len if op > 0
  push 0
  blocks

splitLines = (s) ->
  # unlike str.split('\n'), keep "\n"
  pos = 0
  result = []
  while pos < s.length
    nextPos = s.indexOf('\n', pos)
    if nextPos == -1
      nextPos = s.length - 1
    result.push(s[pos..nextPos])
    pos = nextPos + 1
  result

isTrivialChange = (diffBlocks, annotated, rev) ->
  # Test if the change could be merged into a previous revision (i.e. changed
  # all lines that touched by the previous revision). Usually this is just a
  # one-liner change and the previous revision only contains one line.
  return false if diffBlocks.length != 1
  [a1, a2, b1, b2] = diffBlocks[0]
  return false if a2 - a1 != 1 or b2 - b1 != 1 or a1 != b1
  return false if annotated.get(a1)[0] != rev
  # if the last revision changed multiple lines, it's also non-trivial
  for i in [0...annotated.size()]
    if annotated.get(i)[0] == rev and i != a1
      return false
  true

vectorReduce = (vec, f, init) ->
  result = init
  for i in [0...vec.size()]
    result = f result, vec.get(i)
  result

class App extends React.Component
  constructor: (props) ->
    super props
    # linelog should be part of the "state" but it's mutable, expensive to
    # "copy", or "compare". So let's make it an instance variable.
    @linelog = new MemLinelog
    @state =
      lineMap: {} # rev, linenum -> line content
      ctimeMap: {}   # rev -> creation time
      content: ''
      showDeleted: false
      showRev: null
      autoCommit: true

  getAnnotated: (rev) ->
    if @lastAnnotatedRev != rev
      @linelog.annotate(rev)
      @lastAnnotatedResult = @linelog.getAnnotateResult()
      @lastAnnotatedRev = rev
    return @lastAnnotatedResult 

  commit: (content) ->
    a = @state.content
    b = content
    # hack: make sure b ends with '\n'
    b += '\n' if b.length > 0 and b[-1..] != '\n'
    return if a == b
    blines = splitLines(b)
    {ctimeMap, lineMap} = @state
    rev = @linelog.getMaxRev()
    annotated = @getAnnotated(rev)
    blocks = diffLines(a, b)
    trivial = isTrivialChange blocks, annotated, rev
    if trivial
      a1 = blocks[0][0]
      lineMap[annotated.get(a1)[0..1]] = blines[a1]
    else
      rev += 1
      for [a1, a2, b1, b2] in blocks.reverse()
        for bi in [b1..b2]
          lineMap[[rev, bi]] = blines[bi]
        @linelog.replaceLines rev, a1, a2, b1, b2
    ctimeMap[rev] = new Date()
    @setState {lineMap, ctimeMap, content: b}

  handleTextChange: (e) ->
    return unless @state.autoCommit
    @commit e.target.value

  handleShowDeletedChange: (e) ->
    @setState showDeleted: e.target.checked

  handleShowRevChange: (e) ->
    rev = parseInt(e.target.value)
    if rev == @linelog.getMaxRev()
      rev = null
    @setState showRev: rev

  handleAutoCommitChange: (e) ->
    value = e.target.checked
    @setState autoCommit: value
    if value
      @commit @refs.editor.value

  getShowRev: ->
    rev = @state.showRev
    if rev == null
      rev = @linelog.getMaxRev()
    rev

  render: ->
    div className: 'columns', style: {height: '100%'},
      div className: 'column',
        textarea id: 'editor', ref: 'editor', onChange: @handleTextChange.bind(@)
      div className: 'column',
        if @linelog.getMaxRev() == 0
          @renderReadme()
        else
          @renderControls()
        @renderAnnotated()

  renderReadme: ->
    pre className: 'readme', '''
      This is a demo that shows the ability to "source control" a single
      file in the javascript world where every line has a timestamp
      (revision) attached and the annotate view is always enabled. There is
      also a "Show deleted lines" feature that shows all lines ever
      existed in the file to make it easier to understand what's happened
      to the file from the beginning.

      <- Type something in the editor.

      This demo uses an "interleaved deltas" [1] implementation [2], making
      space usage highly efficient and provides the "deleted lines" feature.

      Technically, the annotate feature (except for "Show deleted lines")
      could also be done by maintaining the "undo" snapshots, adding
      timestamps to the snapshots, and pre-calculating annotate information.
      But that is probably less space efficient and will have difficulty
      providing the "deleted lines" feature efficiently.

      Source code is available at [3].

      [1]: https://en.wikipedia.org/wiki/Interleaved_deltas
      [2]: https://bitbucket.org/facebook/hg-experimental/src/8af0e0/linelog
      [3]: https://github.com/quark-zju/timepad
      '''

  renderControls: ->
    maxRev = @linelog.getMaxRev()
    rev = @getShowRev()
    div className: 'level controls',
      label className: 'checkbox level-left',
        input className: 'level-item', type: 'checkbox', checked: @state.autoCommit, onChange: @handleAutoCommitChange.bind(@)
        span className: 'level-item', 'Auto commit'
      label className: 'checkbox level-left',
        input className: 'level-item', type: 'checkbox', checked: @state.showDeleted, onChange: @handleShowDeletedChange.bind(@)
        span className: 'level-item', 'Show deleted lines'
      label className: 'range level-right',
        span className: 'level-item', "Select revision (#{rev})"
        input className: 'level-item', type: 'range', value: rev, min: 0, max: maxRev, onChange: @handleShowRevChange.bind(@)

  renderAnnotated: ->
    annotated = @getAnnotated @getShowRev()
    maxRev = @linelog.getMaxRev()
    if @state.showDeleted
      lines = @linelog.getAllLines()
      lineSet = vectorReduce(annotated, ((m, v) -> m[v[0..1]] = 1; m), {})
      isDeleted = (k) -> not lineSet[k]
    else
      lines = annotated
      isDeleted = (k) -> false
    rows = []
    for i in [0...lines.size()]
      info = lines.get(i)
      k = info[0..1]
      rev = k[0]
      m = moment(@state.ctimeMap[rev])
      deleted = isDeleted(k)
      if deleted
        rgb = '140, 140, 140' 
      else 
        rgb = '78, 154, 6'
      color = "rgba(#{rgb}, #{rev / maxRev})"
      rows.push pre key: k, className: "#{deleted and 'deleted'}", title: "#{m.format()} rev,linenum=#{k}",
        span className: 'timestamp', style: {backgroundColor: color}, m.format('HH:mm:ss')
        span className: "line", @state.lineMap[k]
    rows

document.addEventListener 'DOMContentLoaded', ->
  ReactDOM.render React.createElement(App), document.querySelector('#root')
