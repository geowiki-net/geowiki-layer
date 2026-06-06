const DOMPurify = require('dompurify')
const twig = require('twig')
const isTrue = require('./isTrue')

class SublayerFeature {
  constructor (object, sublayer) {
    this.object = object
    this.id = object.id
    this.sublayer = sublayer
    this.isShown = false
    this.flags = {}
    this.features = {}

    this.geometry = null

    if (this.object && this.object.on) {
      this.object.on('update', () => {
        this.geometry = null
      })
    }
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
    const ob = this.object
    const showOptions = {
      styles: []
    }

    if (ob.id in this.sublayer.shownFeatureOptions) {
      this.sublayer.shownFeatureOptions[ob.id].forEach(function (opt) {
        if ('styles' in opt) {
          showOptions.styles = showOptions.styles.concat(opt.styles)
        }
      })
    }

    this.twigData = this.compileTwigData()
    this._objectData = {}
    this.renderFeatureValue('pre')

    this.id = ob.id
    this.layer_id = this.sublayer.options.id
    this.sublayer_id = this.sublayer.options.sublayer_id

    if (this.sublayer.master.onUpdate) {
      this.sublayer.master.onUpdate(this)
    }

    this.sublayer.master.emit('update', this.object, this)
    this.sublayer.emit('update', this.object, this)
  }

  /**
   * render a property of the 'feature' definition.
   *
   * @param {string|string[]} key The key of the feature description to be rendered (e.g. 'title'). If an array is passed, the first found layout will be rendered.
   * @return {string|null} Return the result or null of no renderable key has been found.
   */
  renderFeatureValue (key) {
    if (Array.isArray(key)) {
      key = key.find(k => this.sublayer.options.feature[k])
    }

    if (!key) {
      return null
    }

    if (key in this._objectData) {
      return this._objectData[key]
    }

    const template = this.sublayer.options.feature[key]

    if (typeof template === 'function') {
      global.currentMapFeature = this
      this._objectData[key] = template(this.twigData)
      delete global.currentMapFeature
    } else {
      this._objectData[key] = template
    }

    return this._objectData[key]
  }

  /**
   * @param {string|string[]} k Layout ID to be rendered. If an array is passed, the first found layout will be rendered.
   * @return {string|null} Return the result or null of no renderable layout has been found.
   */
  renderLayout (k) {
    if (Array.isArray(k)) {
      for (let i = 0; i < k.length; i++) {
        const r = this.renderLayout(k[i])
        if (r) {
          return r
        }
      }

      return null
    }

    const handler = {
      get (target, prop, receiver) {
        if (prop.match(/^get/)) {
          const key = prop[3].toLowerCase() + prop.substr(4)
          return target.renderFeatureValue(key)
        }
      }
    }

    if (typeof this.sublayer.options.layouts[k] === 'function') {
      return this.sublayer.options.layouts[k]({ object: new Proxy(this, handler) })
    }

    return this.sublayer.options.layouts[k]
  }

  _popupOpen (e) {
    const popupContent = DOMPurify.sanitize(this.renderLayout('popup'))

    if (popupContent !== null) {
      e.popup.setContent(popupContent)
      e.popup.currentHTML = popupContent
    }
  }

  _popupClose (e) {
    e.popup.currentHTML = null
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
        this.geometry = twig.filters.raw(JSON.stringify(ob.GeoJSON().geometry))
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

    if (this.featureMarker && !isTrue(this.data.exclude)) {
      this.featureMarker.addTo(this.map)
      // TODO - updateAssets changed parameters, update dependents
      this.sublayer.updateAssets(this.featureMarker._icon, this.object, this)
    }

    this.object.on('update', this.sublayer.scheduleReprocess.bind(this.sublayer, this.id))

    this.isShown = true
  }

  hide () {
    this.sublayer.master.emit('remove', this.object, this)
    this.sublayer.emit('remove', this.object, this)

    this.map.removeLayer(this.feature)
    for (const k in this.features) {
      this.map.removeLayer(this.features[k])
    }

    if (this.featureMarker) {
      this.map.removeLayer(this.featureMarker)
    }

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
