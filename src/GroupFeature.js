const GroupObject = require('./GroupObject')
const SublayerFeature = require('./SublayerFeature')

class GroupFeature extends SublayerFeature {
  constructor (id, sublayer) {
    const object = new GroupObject(id)
    super(object, sublayer)
    this.object = object
    this.id = id
    this.sublayer = sublayer
    this.isShown = false
    this.flags = {}
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
