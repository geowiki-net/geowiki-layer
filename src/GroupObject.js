const ee = require('event-emitter')

class GroupObject {
  constructor (id) {
    this.id = id
    this.members = {}
    this.memberOf = []
  }

  add (feature) {
    this.members[feature.id] = feature
    this.emit('update', this)
  }

  remove (feature) {
    delete this.members[feature.id]
    this.emit('update', this)
  }

  has (feature) {
    return feature.id in this.members
  }

  intersects (bbox) {
    let intersectsBbox = false

    let r = Object.values(this.members)
      .some(member => {
        let  r = member.intersects(bbox)
        if (r === 1) {
          intersectsBbox = true
        }

        return r === 2
      })

    return r ? 2 : intersectsBbox ? 1 : 0
  }

  leafletFeature (options) {
    let layers =
      Object.values(this.members)
        .map(member => member.leafletFeature(options))

    let group = L.featureGroup(layers)
//    this.on('update', () => {
//      group.clearLayers()
//      Object.values(this.members)
//        .forEach(member => {
//          group.addLayer(member.leafletFeature(param, options))
//        })
//    })

    return group
  }
}

ee(GroupObject.prototype)

module.exports = GroupObject
