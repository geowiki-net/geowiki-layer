const strToStyle = require('./strToStyle')
const isTrue = require('./isTrue')

class SublayerFeature {
  constructor (object, sublayer) {
    this.object = object
    this.id = object.id
    this.sublayer = sublayer
    this.isShown = false
    this.flags = {}

    this.geometry = null
    this.object.on('update', () => {
      this.geometry = null
    })
  }

  updateFlags () {
    const shownFeatureOptions = this.sublayer.shownFeatureOptions[this.id]

    this.flags = {}
    shownFeatureOptions.forEach(options => {
      if (options.flags) {
        options.flags.forEach(flag => {
          this.flags[flag] = true
        })
      }
    })
  }

  processObject () {
    let k
    const ob = this.object
    const showOptions = {
      styles: []
    }

    // don't need to process object anymore
    global.clearTimeout(this.sublayer._scheduledReprocesses[this.id])
    delete(this.sublayer._scheduledReprocesses[this.id])

    if (ob.id in this.sublayer.shownFeatureOptions) {
      this.sublayer.shownFeatureOptions[ob.id].forEach(function (opt) {
        if ('styles' in opt) {
          showOptions.styles = showOptions.styles.concat(opt.styles)
        }
      })
    }

    const objectData = this.evaluate()

    const exclude = isTrue(objectData.exclude)

    if (exclude) {
      objectData.styles = []
    }

    if (this.isShown) {
      this.feature.addTo(this.sublayer.map)
      for (k in this.features) {
        if (objectData.styles && objectData.styles.indexOf(k) !== -1 && this.styles && this.styles.indexOf(k) === -1) {
          this.features[k].addTo(this.sublayer.map)
        }
        if (objectData.styles && objectData.styles.indexOf(k) === -1 && this.styles && this.styles.indexOf(k) !== -1) {
          this.sublayer.map.removeLayer(this.features[k])
        }
      }
    }
    this.styles = objectData.styles

    this.layouts = {}
    for (const k in this.sublayer.options.layouts) {
      if (typeof this.sublayer.options.layouts[k] === 'function') {
        this.layouts[k] = this.sublayer.options.layouts[k]({ object: objectData })
      } else {
        this.layouts[k] = this.sublayer.options.layouts[k]
      }
    }

    this.id = ob.id
    this.layer_id = this.sublayer.options.id
    this.sublayer_id = this.sublayer.options.sublayer_id
    this.data = objectData

    if (this.sublayer.master.onUpdate) {
      this.sublayer.master.onUpdate(this)
    }

    this.sublayer.master.emit('update', this.object, this)
    this.sublayer.emit('update', this.object, this)
  }

  _popupOpen (e) {
    const popupContent = this.layouts.popup
    if (popupContent !== null) {
      e.popup.setContent(popupContent)
      e.popup.currentHTML = popupContent
    }
  }

  _popupClose (e) {
    e.popup.currentHTML = null
  }

  evaluate () {
    this.twigData = this.compileTwigData()

    global.currentMapFeature = this
    const objectData = {}
    for (const k in this.sublayer.options.feature) {
      if (typeof this.sublayer.options.feature[k] === 'function') {
        objectData[k] = this.sublayer.options.feature[k](this.twigData)
      } else {
        objectData[k] = this.sublayer.options.feature[k]
      }
    }
    delete global.currentMapFeature

    const styleIds = []
    for (const k in objectData) {
      const m = k.match(/^style(|:(.*))$/)
      if (m) {
        const style = objectData[k]
        const styleId = typeof m[2] === 'undefined' ? 'default' : m[2]

        if (typeof style === 'string' || 'twig_markup' in style) {
          objectData[k] = strToStyle(style)
        }

        if (this.sublayer.options.stylesNoAutoShow.indexOf(styleId) === -1) {
          styleIds.push(styleId)
        }
      }
    }

    if (!('features' in this)) {
      this.features = {}
    }

    objectData.styles =
      'styles' in objectData
        ? objectData.styles
        : 'styles' in this.sublayer.options
          ? this.sublayer.options.styles
          : styleIds
    if (typeof objectData.styles === 'string' || 'twig_markup' in objectData.styles) {
      const styles = objectData.styles.trim()
      if (styles === '') {
        objectData.styles = []
      } else {
        objectData.styles = styles.split(/,/).map(style => style.trim())
      }
    }

    return objectData
  }

  compileTwigData () {
    const ob = this.object

    const result = {
      id: ob.id,
      sublayer_id: this.sublayer.options.sublayer_id,
      osm_id: ob.osm_id,
      type: ob.type,
      tags: ob.tags,
      meta: ob.meta,
      flags: this.flags,
      members: [],
      const: this.sublayer.options.const
    }

    if (ob.geometry) {
      if (!this.geometry) {
        this.geometry = JSON.stringify(ob.GeoJSON().geometry)
      }
      result.geometry = this.geometry

      if (Array.isArray(ob.geometry)) {
        result.is_area = ob.geometry[0].lat === ob.geometry[ob.geometry.length - 1].lat && ob.geometry[0].lon === ob.geometry[ob.geometry.length - 1].lon
      } else if (ob.geometry.type) {
        if (ob.geometry.type === 'Feature' && ob.geometry.geometry) {
          result.is_area = ['Polygon', 'MultiPolygon'].includes(ob.geometry.geometry.type)
        } else if (ob.geometry.type === 'FeatureCollection' && ob.geometry.features) {
          result.is_area = !!ob.geometry.features
            .map(f => f.geometry && ['Polygon', 'MultiPolygon'].includes(f.geometry.type))
            .filter(v => v)
            .length
        }
      } else if (ob.geometry.lat && ob.geometry.lon) {
        result.is_area = true
      }
    }

    if (ob.memberFeatures) {
      ob.memberFeatures.forEach((member, sequence) => {
        const r = {
          id: member.id,
          sequence,
          type: member.type,
          osm_id: member.osm_id,
          role: ob.members[sequence].role,
          tags: member.tags,
          meta: member.meta,
          dir: member.dir,
          connectedPrev: member.connectedPrev,
          connectedNext: member.connectedNext
        }

        result.members.push(r)
      })
    }

    for (const k in this.sublayer.master.globalTwigData) {
      result[k] = this.sublayer.master.globalTwigData[k]
    }

    this.sublayer.emit('twigData', ob, this, result)
    this.sublayer.master.emit('twigData', ob, this, result)

    return result
  }

  show () {
    if (!this.sublayer.map) {
      return
    }

    this.map = this.sublayer.map

    this.feature.addTo(this.map)
    for (let i = 0; i < this.styles.length; i++) {
      const k = this.styles[i]
      if (k in this.features) {
        this.features[k].addTo(this.map)
      }
    }

    this.object.on('update', this.sublayer.scheduleReprocess.bind(this.sublayer, this.id))

    this.isShown = true
  }

  hide () {
    this.sublayer.master.emit('remove', this.object, this)
    this.sublayer.emit('remove', this.object, this)

    if (this.sublayer.master.onDisappear) {
      this.sublayer.master.onDisappear(this)
    }

    this.object.off('update', this.sublayer.scheduleReprocess.bind(this.sublayer, this.id))

    this.isShown = false
  }

  recalc () {
    this.sublayer.scheduleReprocess(this.id)
  }
}

module.exports = SublayerFeature
