const assert = require('assert')

const GeowikiLayer = require('..')
let geowikiAPI
let geowikiLayer

describe('init', function () {
  it('initialize GeowikiAPI, start loading data', function () {
    geowikiAPI = require('./src/geowikiAPI')
  })

  it('load data into GeowikiAPI', function (done) {
    this.timeout(20000)
    geowikiAPI.on('load', () => done())
  })

  it('initialize GeowikiLayer', function (done) {
    geowikiLayer = new GeowikiLayer({
      geowikiAPI,
      query: 'nwr[building]'
    })

    done()
  })

  it('GeowikiLayer moveto', function (done) {
    const expected = ['w314245157', 'w314245158', 'w314245160', 'w314245161', 'w314245164', 'w314245165', 'w314245167', 'w314245168', 'w314245169', 'w314245170', 'w314245171', 'w314245172', 'w314245176', 'r4222639', 'r4222640'].sort()
    const found = []

    geowikiLayer.moveTo({
      bounds: {
        minlat: 48.198, minlon: 16.337,
        maxlat: 48.199, maxlon: 16.338
      },
      zoom: 18
    }, function () {
      assert.deepEqual(found.sort(), expected, 'Wrong list of map items found')
      done()
    })

    geowikiLayer.on('add', (ob, feature) => {
      found.push(feature.id)
    })
  })
})
