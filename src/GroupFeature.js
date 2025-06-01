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
}

module.exports = GroupFeature
