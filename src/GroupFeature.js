const GroupObject = require('./GroupObject')
const SublayerFeature = require('./SublayerFeature')

class GroupFeature extends SublayerFeature {
  constructor (object, sublayer) {
    super(object, sublayer)
  }

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
