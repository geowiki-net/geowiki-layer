const GroupObject = require('./GroupObject')

class GroupFeature {
  constructor (id, sublayer) {
    this.id = id
    this.sublayer = sublayer
    this.isShown = false
    this.flags = {}
    this.object = new GroupObject(id)
  }
}

module.exports = GroupFeature
