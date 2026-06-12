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
      query: 'nwr[highway=primary]',
      feature: {
        styles: 'casing,default',
        style: {
          text: '{{ tags.name }}',
          color: 'white',
          width: 4
        },
        'style:casing': 'color: black\nwidth: 8'
      }
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

    done()
  })

  it('GeowikiLayer moveto', function (done) {
    const expectedAdd = ['w272672835']
    const expectedRemove = []
    const expectedUpdate = ['w272672835']
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

      geowikiLayer.features().forEach(feature => {
        // Check twigData.map
        assert.deepEqual(
          feature.twigData.map,
          {
            zoom: 18,
            center: { lat: 48.198499999999996, lon: 16.3375 },
            metersPerPixel: 0.3980410394453913
          }
        )

        const styles = feature.getStyles()
        assert.deepEqual({
          casing: { color: 'black', width: 8 },
          default: { text: 'Neubaugürtel', color: 'white', width: 4 }
        }, styles)
      })

      done()
    })
  })
})
