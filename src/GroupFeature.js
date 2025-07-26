const twig = require('twig')
const SublayerFeature = require('./SublayerFeature')

class GroupFeature extends SublayerFeature {
  compileTwigData () {
    if (!this.geometry) {
      this.geometry = twig.filters.raw(JSON.stringify(this.object.GeoJSON().geometry))
    }

    const result = {
      id: this.id,
      sublayer_id: this.sublayer.options.sublayer_id,
      tags: this.object.tags(),
      geometry: this.geometry,
      members: []
    }

    this.sublayer.emit('twigData', this.object, this, result)
    this.sublayer.master.emit('twigData', this.object, this, result)

    return result
  }
}

module.exports = GroupFeature
