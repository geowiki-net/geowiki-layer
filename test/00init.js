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
    geowikiLayer.moveTo({
      bounds: {
        minlat: 48.198, minlon: 16.337,
        maxlat: 48.199, maxlon: 16.338
      },
      zoom: 18
    }, function () {
      done()
    })
  })
})
