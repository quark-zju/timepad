{div, br, hr, textarea, span, pre, input, label, button} = React.DOM

getText = (url, cb) ->
  oReq = new XMLHttpRequest
  oReq.addEventListener 'load', -> cb @responseText
  oReq.open 'GET', url
  oReq.send()

getBinary = (url, cb) ->
  oReq = new XMLHttpRequest
  oReq.addEventListener 'load', -> cb @response
  oReq.open 'GET', url
  oReq.responseType = 'arraybuffer'
  oReq.send()

intToDate = (epoch) ->
  new Date(epoch * 1000)

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
    # export to window.$l so hackers could play with it
    window.$l = @linelog = new MemLinelog
    @state =
      lineMap: {} # rev, linenum -> line content
      ctimeMap: {}   # rev -> creation time
      publicMap: {}  # rev -> public desc
      content: ''
      showAnnotated: true
      showRev: null
      autoCommit: true
      startRev: null

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

  handleShowAnnotatedChange: (e) ->
    @setState showAnnotated: e.target.checked

  handleStartRevChange: (e) ->
    rev = parseInt(e.target.value)
    @setState startRev: rev

  handleShowRevChange: (e) ->
    rev = parseInt(e.target.value)
    if rev < @state.startRev
      @setState startRev: rev
    if rev == @linelog.getMaxRev()
      rev = null
    @setState showRev: rev

  handleRevisionBarMouseMove: (xs, e) ->
    if e.buttons == 1
      @handleRevisionBarClick(xs, e, @y)

  handleRevisionBarClick: (xs, e, y) ->
    # find rev
    rev = null
    if e.target.tagName == 'SPAN'
      rev = e.target.dataset.rev
    else
      minDelta = 1e100
      width = xs[xs.length - 1][1] + 1
      curPos = ((e.nativeEvent.offsetX - 1) / 0.98) * width / e.target.clientWidth # see getLeftCss
      for revpos in xs
        [tRev, pos, date, pub] = revpos
        d = Math.abs(curPos - pos)
        if d < minDelta
          rev = tRev
          minDelta = d

    if not rev?
      return
    else
      rev = parseInt(rev)

    newState = {}
    if not y?
      @y = y = e.nativeEvent.offsetY
    if y <= e.target.clientHeight / 2
      # set startRev
      newState.startRev = rev
      if rev >= @state.showRev and @state.showRev != null
        newState.showRev = rev
        newState.startRev = null
    else
      # set showRev
      if rev <= @state.startRev
        newState.startRev = null
      newState.showRev = rev
    if newState.showRev == @linelog.getMaxRev()
      newState.showRev = null # so showRev points to new revisions

    needUpdate = false
    for k, v of newState
      if @state[k] != v
        needUpdate = true
        break
    if needUpdate
      @setState newState

  handleAutoCommitChange: (e) ->
    value = e.target.checked
    @setState autoCommit: value
    if value
      @commit @refs.editor.value

  handleLoadExample: (e) ->
    name = 'mdiff.py'
    await
      getBinary "assets/examples/#{name}.linelog.bin", defer linelogBuffer
      getText "assets/examples/#{name}.alllines.json", defer allLines

    ctimeMap = {}
    lineMap = {}
    publicMap = {}
    @linelog.setRawBytes(linelogBuffer)
    lineinfos = @linelog.getAllLines()
    allLines = JSON.parse(allLines)
    for line, i in allLines
      info = lineinfos.get(i)
      k = info[0..1]
      rev = parseInt(k[0])
      lineMap[k] = line['line']
      ctimeMap[k[0]] = intToDate(line['date'][0])
      publicMap[rev] = line
    startRev = lineinfos.get(parseInt(Math.random() * (allLines.length - 1)))[0]
    # reconstruct the current revision
    content = ''
    @linelog.annotate(@linelog.getMaxRev())
    lines = @linelog.getAnnotateResult()
    for i in [0...lines.size()]
      info = lines.get(i)
      k = info[0..1]
      content += lineMap[k]
    @lastAnnotatedRev = -1
    @refs.editor.value = content
    @setState {ctimeMap, lineMap, content, publicMap, startRev, showRev: null}

  handleDoubleClickLine: (key, e) ->
    m = @state.lineMap
    content = m[key]
    newContent = prompt("Edit a line in rev #{key[0]}", content)
    if newContent != null && newContent != content
      m[key] = newContent
      @setState lineMap: m
      e.stopPropagation()
      e.preventDefault()

  getShowRev: ->
    rev = @state.showRev
    if rev == null
      rev = @linelog.getMaxRev()
    rev

  getLineContentMapSize: ->
    size = 0
    for k, v of @state.lineMap
      if v
        size += k.length + v.length + 4
    size

  render: ->
    div className: 'columns', style: {height: '100%'},
      div className: 'column',
        textarea id: 'editor', ref: 'editor', onChange: @handleTextChange.bind(@)
      div className: 'column scroll', style: {maxWidth: '50%'},
        if @linelog.getMaxRev() == 0
          @renderReadme()
        else
          @renderControls()
        if @state.showAnnotated
          @renderAnnotated()

  renderReadme: ->
    div className: 'readmeFrame',
      pre className: 'readme',
        '''
        This is a demo that shows the ability to "source control" a single
        file in the javascript world using a data structure [1] inspired by
        the "interleaved deltas" [2] idea.

        <- Try '''
        React.DOM.a onClick: @handleLoadExample.bind(@), title: 'mercurial/mdiff.py', 'an example file'
        br()
        '''
        <- And/or type something in the editor

        Source code is available at [3].

        [1]: https://bitbucket.org/facebook/hg-experimental/src/8af0e0/linelog
        [2]: https://en.wikipedia.org/wiki/Interleaved_deltas
        [3]: https://github.com/quark-zju/timepad
        '''

  renderControls: ->
    maxRev = @linelog.getMaxRev()
    rev = @getShowRev()
    startRev = @state.startRev
    div className: 'controls',
      div className: 'control',
        label className: 'checkbox level-left',
          input className: 'level-item', type: 'checkbox', checked: @state.autoCommit, onChange: @handleAutoCommitChange.bind(@)
          span className: 'level-item', "Real-time committing"
        div className: 'desc',
          'When turned on, changes to the left textbox will be recorded in real-time. '
          'Try turn this off and do some non-trivial edits, and turn this on again. '
          "The size of linelog (without line contents or commit metadata) is #{@linelog.getActualSize()} bytes. "
      div className: 'control',
        label className: 'checkbox',
          input className: 'level-item', type: 'checkbox', checked: @state.showAnnotated, onChange: @handleShowAnnotatedChange.bind(@)
          span className: 'level-item', 'Show annotated lines'
        div className: 'desc',
          'When turned on, annotated lines will be rendered below. Turn off if React rendering hurts perf. '
          'Select a RANGE of revisions from the bar below to see the lines related to them. Click at the upper area to pick a starting revision, and the lower area for an ending revision. '
          'Double-click a line to edit its content in THAT revision. This shows simple stack editing without merge conflicts. It could be made to support more complex cases, also see '
          React.DOM.a href: 'assets/hgabsorb-note.pdf', 'hg absorb'
          '. '
          'Revisions of existing history (with known commit hashes) are in green. Local history in blue. Place your mouse over them to see commit hashes, authors, and dates. '
      if @state.showAnnotated
        div className: 'control',
          @renderRevisionSelector()

  renderRevisionSelector: ->
    timeMap = @state.ctimeMap
    publicMap = @state.publicMap

    xs = [] # [[rev, pos, date, publicInfo]]
    posMap = {} # rev -> pos
    lastDate = null
    lastPos = 0
    lastRev = -1
    localScale = 1
    for rev in [0..@linelog.getMaxRev()]
      date = timeMap[rev]
      if !date
        continue
      pub = publicMap[rev]
      pos = if lastRev == -1
              1
            else
              diffSeconds = Math.max(1, (date - lastDate) / 1000.0)
              lastPos + Math.sqrt(diffSeconds) * localScale
      if !pub and localScale == 1
        localScale = pos * 0.42 / (@linelog.getMaxRev() - xs.length + 1)
      xs.push([rev, pos, date, pub])
      posMap[rev] = pos
      lastDate = date
      lastPos = pos
      lastRev = rev

    width = lastPos + 1
    getLeftCss = (pos) -> "calc(#{pos * 98.0 / width}% + 1px)"

    showRev = @state.showRev or @linelog.getMaxRev()
    startRev = @state.startRev or showRev

    div className: 'rev-selector', onMouseDown: @handleRevisionBarClick.bind(@, xs), onMouseMove: @handleRevisionBarMouseMove.bind(@, xs),
      xs.map (revpos) =>
        [rev, pos, date, pub] = revpos
        m = moment(timeMap[rev])
        title = if pub
                  "#{rev}:#{pub['node'][0..7]} by #{pub['user']} at #{m.format('MMM Do YY')}"
                else
                  "#{rev}:(local change) #{m.fromNow()}"
        span key: rev, className: "rev-dot #{pub and 'public'}", 'data-rev': rev, style: {left: getLeftCss(pos)}, title: title
      span className: "rev-left-slider #{@state.startRev or 'follow'}", style: {left: getLeftCss(posMap[startRev])}
      span className: "rev-right-slider #{@state.showRev or 'follow'}", style: {left: getLeftCss(posMap[showRev])}

  renderAnnotated: ->
    annotated = @getAnnotated @getShowRev()
    maxRev = @linelog.getMaxRev()
    endRev = @state.showRev or maxRev
    startRev = @state.startRev or endRev
    showDeleted = (startRev != endRev)
    if showDeleted
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
      pub = @state.publicMap[rev] # public info
      if deleted and (rev < startRev or rev > endRev)
        continue
      if pub
        rgb = '78, 154, 6'
        desc = "#{pub['node'][0..7]} by #{pub['user']} at #{m.format('MMM Do YY')} (rev,linenum=#{k})"
        revStr = "#{rev}"
        short = '          '[0..(7 - revStr.length)] + revStr
      else
        rgb = '114, 159, 207'
        desc = "Local change at #{m.fromNow()} (rev,linenum=#{k})"
        short = m.format('HH:mm:ss')
      color = "rgba(#{rgb}, #{rev / maxRev})"
      rows.push pre key: k, className: "line #{deleted and 'deleted'} #{pub and 'public'}", title: desc, onDoubleClick: @handleDoubleClickLine.bind(@, k),
        span className: 'timestamp', style: {backgroundColor: color}, short
        span className: "line-content", @state.lineMap[k]
    if rows.length > 0
      div className: 'annotated', style: {height: "100%", maxWidth: '100%'},
        rows

document.addEventListener 'DOMContentLoaded', ->
  ReactDOM.render React.createElement(App), document.querySelector('#root')
