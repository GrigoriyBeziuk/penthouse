import csstree from 'css-tree'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import normaliseCssAst from './util/normaliseCssAst'
import chai from 'chai'

import ffRemover from '../lib/postformatting/unused-fontface-remover'
import unusedKeyframeRemover from '../lib/postformatting/unused-keyframe-remover'
import unwantedPropertiesRemover from '../lib/postformatting/unwanted-properties-remover'
import embeddedbase64Remover from '../lib/postformatting/embedded-base64-remover'

chai.should() // binds globally on Object

function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

process.setMaxListeners(0)

describe('penthouse post formatting tests', function () {
  it('should remove propertiesToRemove', function (done) {
    const originalCss = `
      body {
        transition: all 0.5s;
        -webkit-transition: all 0.5s;
        cursor: pointer;
        pointer-events: null;
        -webkit-tap-highlight-color: blue;
        -moz-user-select: none;
        user-select: none;
      }
      @media all {
        body {
          pointer-events: null;
        }
      }
    `
    const propertiesToRemove = [
      '(.*)transition(.*)',
      'cursor',
      'pointer-events',
      '(-webkit-)?tap-highlight-color',
      '(.*)user-select'
    ]

    const ast = normaliseCssAst(originalCss)
    const astRules = csstree.toPlainObject(ast).children
    const resultRules = unwantedPropertiesRemover(astRules, propertiesToRemove)
    resultRules.length.should.eql(0)
    done()
  })

  it('should remove embedded base64', function (done) {
    const originalCss = read(path.join(__dirname, 'static-server', 'embedded-base64--remove.css')).toString()

    const ast = normaliseCssAst(originalCss)
    const astRules = csstree.toPlainObject(ast).children
    // NOTE: penthouse's default max uri length is 1000.
    const resultRules = embeddedbase64Remover(astRules, 250)
    const resultAst = csstree.fromPlainObject({
      type: 'StyleSheet',
      loc: null,
      children: resultRules
    })
    var expectedAst = normaliseCssAst('body{}@media (min-width: 10px){body{}}')
    resultAst.should.eql(expectedAst)
    done()
  })

  it('should remove @fontface rule, because it is not used', function (done) {
    var fontFaceRemoveCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove.css')
    var fontFaceRemoveExpectedCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove--expected.css')
    var fontFaceRemoveCss = read(fontFaceRemoveCssFilePath).toString()
    var fontFaceRemoveExpectedCss = read(fontFaceRemoveExpectedCssFilePath).toString()

    const ast = normaliseCssAst(fontFaceRemoveCss)
    const astRules = csstree.toPlainObject(ast).children
    var resultRules = ffRemover(astRules)
    const resultAst = csstree.fromPlainObject({
      type: 'StyleSheet',
      loc: null,
      children: resultRules
    })

    const expectedAst = normaliseCssAst(fontFaceRemoveExpectedCss)
    resultAst.should.eql(expectedAst)
    done()
  })

  it('should only keep @keyframe rules used in critical css', function (done) {
    const originalCss = read(path.join(__dirname, 'static-server', 'unused-keyframes.css'), 'utf8')
    const expextedCss = read(path.join(__dirname, 'static-server', 'unused-keyframes--expected.css'), 'utf8')

    try {
      const ast = normaliseCssAst(originalCss)
      const astRules = csstree.toPlainObject(ast).children

      var resultRules = unusedKeyframeRemover(astRules)
      const resultAst = csstree.fromPlainObject({
        type: 'StyleSheet',
        loc: null,
        children: resultRules
      })

      var expectedAst = normaliseCssAst(expextedCss)
      resultAst.should.eql(expectedAst)
      done()
    } catch (ex) {
      done(ex)
    }
  })

  it('should not remove transitions but still remove cursor from css', function (done) {
    var fullCssFilePath = path.join(__dirname, 'static-server', 'transition-full.css')
    var expectedCssFilePath = path.join(__dirname, 'static-server', 'transition-crit--expected.css')
    var expectedCss = read(expectedCssFilePath).toString()

    penthouse({
      url: staticServerFileUrl('transition.html'),
      css: fullCssFilePath,
      width: 800,
      height: 450,
      propertiesToRemove: [
        'cursor',
        'pointer-events',
        '(-webkit-)?tap-highlight-color',
        '(.*)user-select'
      ]
    })
      .then(result => {
        var resultAst = normaliseCssAst(result)
        var expectedAst = normaliseCssAst(expectedCss)

        resultAst.should.eql(expectedAst)
        done()
      })
      .catch(done)
  })
})
