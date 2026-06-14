/* eslint camelcase: 0 */
const Events = require('events')
const BoundingBox = require('boundingbox')
const twig = require('twig')
const GeowikiAPI = require('@geowiki-net/geowiki-api')
const escapeHtml = require('html-escape')
const DOMPurify = require('./dompurify')
const turf = {
  intersect: require('@turf/intersect').default
}

const Sublayer = require('./Sublayer')
const Memberlayer = require('./Memberlayer')
const compileFeature = require('./compileFeature')
const compileTemplate = require('./compileTemplate')

class OverpassLayer extends Events {
  constructor (options) {
    super()
    if (!options) {
      options = {}
    }

    this.options = options

    this.geowikiAPI = 'geowikiAPI' in this.options ? this.options.geowikiAPI : global.geowikiAPI
    this.options.minZoom = 'minZoom' in this.options ? this.options.minZoom : 16
    if (typeof this.options.query === 'object') {
      this.options.minZoom = Object.keys(options.query)[0]
    }
    this.options.maxZoom = 'maxZoom' in this.options ? this.options.maxZoom : undefined
    this.options.feature = 'feature' in this.options ? this.options.feature : {}
    this.options.feature.style = 'style' in this.options.feature ? this.options.feature.style : {}
    this.options.feature.title = 'title' in this.options.feature ? this.options.feature.title : function (ob) { return escapeHtml(ob.tags.name || ob.tags.operator || ob.tags.ref || ob.id) }
    this.options.feature.body = 'body' in this.options.feature ? this.options.feature.body : ''
    this.options.feature.markerSymbol = 'markerSymbol' in this.options.feature ? this.options.feature.markerSymbol : '<img anchorX="13" anchorY="42" width="25" height="42" signAnchorX="0" signAnchorY="-30" src="img/map_pointer.png">'
    this.options.feature.markerSign = 'markerSign' in this.options.feature ? this.options.feature.markerSign : null
    this.options.queryOptions = 'queryOptions' in this.options ? this.options.queryOptions : {}
    if (!('properties' in this.options.queryOptions)) {
      this.options.queryOptions.properties = GeowikiAPI.ALL
    }
    this.options.styleNoBindPopup = this.options.styleNoBindPopup || []
    this.options.stylesNoAutoShow = this.options.stylesNoAutoShow || []
    this.options.layouts = this.options.layouts || {}
    this.options.layouts.popup = this.options.layouts.popup ||
      '<h1>{{ object.popupTitle|default(object.title) }}</h1>' +
      '{% if object.popupDescription or object.description %}<div class="description">{{ object.popupDescription|default(object.description) }}</div>{% endif %}' +
      '{% if object.popupBody or object.body %}<div class="body">{{ object.popupBody|default(object.body) }}</div>{% endif %}'

    compileFeature(this.options.feature, twig, { autoescape: true })
    compileFeature(this.options.layouts, twig, { autoescape: false })

    this.currentRequest = null
    this.lastZoom = null

    this.mainlayer = new Sublayer(this, options)

    this.subLayers = {
      main: this.mainlayer
    }

    if (this.options.members) {
      this.options.queryOptions.properties = GeowikiAPI.TAGS | GeowikiAPI.META | GeowikiAPI.MEMBERS | GeowikiAPI.BBOX
      this.options.queryOptions.memberProperties = GeowikiAPI.ALL
      this.options.queryOptions.members = true

      const memberOptions = {
        id: this.options.id,
        sublayer_id: 'member',
        minZoom: this.options.minZoom,
        maxZoom: this.options.maxZoom,
        feature: this.options.memberFeature,
        styleNoBindPopup: this.options.styleNoBindPopup || [],
        stylesNoAutoShow: this.options.stylesNoAutoShow || [],
        layouts: this.options.layouts,
        const: this.options.const
      }
      if (this.options.updateAssets) {
        memberOptions.updateAssets = this.options.updateAssets
      }
      compileFeature(memberOptions.feature, twig)

      this.memberlayer = new Memberlayer(this, memberOptions)
      this.subLayers.member = this.memberlayer
    }
  }

  setLayout (id, layout) {
    this.options.layouts[id] = compileTemplate(layout, twig, { autoescape: false })
  }

  hideAll (force) {
    for (const k in this.subLayers) {
      this.subLayers[k].hideAll(force)
    }
  }

  remove () {
    for (const k in this.subLayers) {
      this.subLayers[k].hideAll(true)
      this.subLayers[k].remove()
    }

    this.abortRequest()
    this.emit('layerremove')
  }

  abortRequest () {
    if (this.currentRequest) {
      if (this.onLoadEnd) {
        this.onLoadEnd({
          request: this.currentRequest,
          error: null
        })
      }

      this.currentRequest.abort()
      this.currentRequest = null
    }
  }

  /**
   * set an additional filter. Will intiate a check_update_map()
   * @param {GeowikiAPI.Filter|object|null} filter A filter. See GeowikiAPI.Filter for details.
   */
  setFilter (filter) {
    this.filter = filter
    this.check_update_map()
    this.recalc()
  }

  calcGlobalTwigData () {
    const center = this.bounds.getCenter()
    this.globalTwigData = {
      map: {
        zoom: this.zoom,
        center,
        metersPerPixel: 40075016.686 * Math.abs(Math.cos(center.lat / 180 * Math.PI)) / Math.pow(2, this.zoom + 8)
      }
    }

    this.emit('globalTwigData', this.globalTwigData)
  }

  /**
   * set or clear attribution. if cleared, it will read/request the
   * attribution from GeowikiAPI (either geowikiAPI.options.attribution or
   * geowikiAPI.meta.copyright).
   * @param {string} [attribution] A HTML string
   * containing the attribution.
   */
  setAttribution (attribution = null) {
    // TODO: in GeowikiAPI provide a getAttribution() function
    if (attribution === null) {
      if (this.geowikiAPI.options.attribution || this.geowikiAPI.meta) {
        attribution = this.geowikiAPI.options.attribution ?? this.geowikiAPI.meta.copyright
      } else {
        this.geowikiAPI.once('load', () => this.setAttribution())
      }
    }

    this.options.attribution = DOMPurify.sanitize(attribution)

    if (this.options.attribution) {
      this.hideAll()
      this._process()
    }
  }

  moveTo (options, callback) {
    if (!this.options.attribution) {
      this.setAttribution()
    }

    this.bounds = new BoundingBox(options.bounds)
    this.zoom = options.zoom

    this._process(callback)
  }

  _process (callback) {
    if (!callback) {
      callback = () => {}
    }

    const queryOptions = JSON.parse(JSON.stringify(this.options.queryOptions))

    if (this.options.bounds) {
      const bounds = turf.intersect(this.bounds.toGeoJSON(), this.options.bounds)

      if (!bounds) {
        for (const k in this.subLayers) {
          this.subLayers[k].hideAll()
        }
        return callback()
      }
    }

    if (this.zoom < this.options.minZoom ||
       (this.options.maxZoom !== undefined && this.zoom > this.options.maxZoom)) {
      for (const k in this.subLayers) {
        this.subLayers[k].hideAll()
      }

      // abort remaining request
      this.abortRequest()

      return callback()
    }

    for (const k in this.subLayers) {
      this.subLayers[k].hideNonVisible(this.bounds)
    }

    let query = this.options.query
    if (typeof query === 'object') {
      query = query[Object.keys(query).filter(function (x) { return x <= this.zoom }.bind(this)).reverse()[0]]
    }

    const twigData = { ...this.globalTwigData }
    this.emit('twigData', null, this, twigData)
    const template = compileTemplate(query, twig, twigData)
    if (typeof template === 'function') {
      query = template(twigData)
    }

    if (query !== this.lastQuery) {
      const filter = new GeowikiAPI.Filter(query)
      this.mainlayer.hideNonVisibleFilter(filter)
      this.lastQuery = query
    }

    queryOptions.filter = this.filter
    if (this.filter !== this.lastFilter) {
      const filter = new GeowikiAPI.Filter(this.filter)
      this.mainlayer.hideNonVisibleFilter(filter)
      this.lastFilter = this.filter
    }

    // update global twig data
    this.calcGlobalTwigData()

    // When zoom level changed, update visible objects
    if (this.lastZoom !== this.zoom) {
      for (const k in this.subLayers) {
        this.subLayers[k].zoomChange()
      }
      this.lastZoom = this.zoom
    }

    // Abort current requests (in case they are long-lasting - we don't need them
    // anyway). Data which is being submitted will still be loaded to the cache.
    this.abortRequest()

    if (!query) {
      return callback()
    }

    for (const k in this.subLayers) {
      this.subLayers[k].startAdding()
    }

    if (this.options.members) {
      queryOptions.memberBounds = this.bounds
      queryOptions.memberCallback = (err, ob) => {
        if (err) {
          return console.error('unexpected error', err)
        }

        this.memberlayer.add(ob)
      }
    }

    this.currentRequest = this.geowikiAPI.BBoxQuery(query, this.bounds,
      queryOptions,
      (err, ob) => {
        if (err) {
          console.log('unexpected error', err)
        }

        this.mainlayer.add(ob)
      },
      function (err, r) {
        console.log(r)
        if (this.onLoadEnd) {
          this.onLoadEnd({
            request: this.currentRequest,
            error: err
          })
        }

        for (const k in this.subLayers) {
          this.subLayers[k].finishAdding()
        }

        this.currentRequest = null
        callback(err)
      }.bind(this)
    )

    if (this.onLoadStart) {
      this.onLoadStart({
        request: this.currentRequest
      })
    }
  }

  recalc () {
    if (!this.map || !this.map._loaded) {
      return
    }

    this.calcGlobalTwigData()
    for (const k in this.subLayers) {
      this.subLayers[k].recalc()
    }
  }

  scheduleReprocess (id) {
    for (const k in this.subLayers) {
      this.subLayers[k].scheduleReprocess(id)
    }
  }

  updateAssets (div, objectData) {
    for (const k in this.subLayers) {
      this.subLayers[k].updateAssets(div, objectData)
    }
  }

  get (id, callback) {
    let done = false

    this.geowikiAPI.get(id,
      {
        properties: GeowikiAPI.ALL
      },
      (err, ob) => {
        if (err === null) {
          callback(err, ob)
        }

        done = true
      },
      (err) => {
        if (!done) {
          callback(err, null)
        }
      }
    )
  }

  show (id, options, callback) {
    let sublayer = this.mainlayer
    if (options.sublayer_id) {
      sublayer = this.subLayers[options.sublayer_id]
    }

    const request = sublayer.show(id, options, callback)
    const result = {
      id: id,
      sublayer_id: options.sublayer_id,
      options: options,
      hide: request.hide
    }

    return result
  }

  hide (id) {
    this.mainlayer.hide(id)
  }

  /**
   * get the degrees by which the world should be shifted, to show map features at the current view port (e.g. when you wrap over -180 or 180 longitude). E.g. near lon 180, the Eastern hemisphere (lon 0 .. 180) does not have to be shifted, the Western hemisphere (lon -180 .. 0) has to be shifted by 360 degrees.
   * @return {number[]} An array with two elements: degrees to shift the Western hemisphere, degrees to shift the Eastern hemisphere. Each value is a multiple of 360.
   */
  getShiftWorld () {
    return [
      Math.floor((this.bounds.getCenter().lng + 270) / 360) * 360,
      Math.floor((this.bounds.getCenter().lng + 90) / 360) * 360
    ]
  }

  features () {
    return Object.values(this.subLayers)
      .map(l => l.features())
      .flat()
  }
}

module.exports = OverpassLayer
