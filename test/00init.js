let geowikiAPI

describe('init', function () {
  it('initialize GeowikiAPI, start loading data', function () {
    geowikiAPI = require('./src/geowikiAPI')
  })

  it('load data into GeowikiAPI', function (done) {
    this.timeout(20000)
    geowikiAPI.on('load', () => done())
  })
})
