/* global describe:false, it:false */
const assert = require('assert')

const GeowikiLayer = require('..')
const geowikiAPI = require('./src/geowikiAPI')
let geowikiLayer

describe('simple interactions', function () {
  let foundAdd
  let foundRemove
  let foundUpdate

  it('initialize GeowikiLayer', function (done) {
    geowikiLayer = new GeowikiLayer({
      geowikiAPI,
      query: 'nwr[building]'
    })

    done()
  })

  it('GeowikiLayer moveto', function (done) {
    const expectedAdd = ['w314245157', 'w314245158', 'w314245160', 'w314245161', 'w314245164', 'w314245165', 'w314245167', 'w314245168', 'w314245169', 'w314245170', 'w314245171', 'w314245172', 'w314245176', 'r4222639', 'r4222640'].sort()
    const expectedRemove = []
    const expectedUpdate = ['w314245157', 'w314245158', 'w314245160', 'w314245161', 'w314245164', 'w314245165', 'w314245167', 'w314245168', 'w314245169', 'w314245170', 'w314245171', 'w314245172', 'w314245176', 'r4222639', 'r4222640'].sort()
    foundAdd = []
    foundRemove = []
    foundUpdate = []

    geowikiLayer.moveTo({
      bounds: {
        minlat: 48.198,
        minlon: 16.337,
        maxlat: 48.199,
        maxlon: 16.338
      },
      zoom: 18
    }, function () {
      assert.deepEqual(foundAdd.sort(), expectedAdd, 'Wrong list of added map items found')
      assert.deepEqual(foundRemove.sort(), expectedRemove, 'Wrong list of removed map items found')
      assert.deepEqual(foundUpdate.sort(), expectedUpdate, 'Wrong list of updated map items found')
      done()
    })

    // install add/remove handlers
    geowikiLayer.on('add', (ob, feature) => {
      foundAdd.push(feature.id)
    })
    geowikiLayer.on('remove', (ob, feature) => {
      foundRemove.push(feature.id)
    })
    geowikiLayer.on('update', (ob, feature) => {
      foundUpdate.push(feature.id)
    })
  })

  it('GeowikiLayer moveto', function (done) {
    const expectedAdd = ['w313063260', 'w314245155', 'r4199627', 'r4199634', 'r4222638'].sort()
    const expectedRemove = ['w314245164', 'w314245165', 'r4222639', 'r4222640'].sort()
    const expectedUpdate = ['w313063260', 'w314245155', 'r4199627', 'r4199634', 'r4222638'].sort()
    foundAdd = []
    foundRemove = []
    foundUpdate = []

    geowikiLayer.moveTo({
      bounds: {
        minlat: 48.1985,
        minlon: 16.337,
        maxlat: 48.1995,
        maxlon: 16.338
      },
      zoom: 18
    }, function () {
      assert.deepEqual(foundAdd.sort(), expectedAdd, 'Wrong list of added map items found')
      assert.deepEqual(foundRemove.sort(), expectedRemove, 'Wrong list of removed map items found')
      assert.deepEqual(foundUpdate.sort(), expectedUpdate, 'Wrong list of updated map items found')
      done()
    })
  })
})
