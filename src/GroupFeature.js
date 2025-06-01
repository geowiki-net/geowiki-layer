const SublayerFeature = require('./SublayerFeature')

class GroupFeature extends SublayerFeature {
  compileTwigData () {
    const result = {
      id: this.id,
      sublayer_id: this.sublayer.options.sublayer_id,
      tags: this.object.tags(),
      members: []
    }

    this.sublayer.emit('twigData', this.object, this, result)
    this.sublayer.master.emit('twigData', this.object, this, result)

    return result
  }
}

module.exports = GroupFeature
