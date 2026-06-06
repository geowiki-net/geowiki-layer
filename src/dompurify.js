const createDOMPurify = require('dompurify')
const { JSDOM } = require('jsdom')

global.window = new JSDOM('').window
module.exports = createDOMPurify(global.window)
