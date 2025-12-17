// Utility to build packet entries; not exported to clients.
function entry(word, h1, h2, h3, h4) {
  return { word, hints: [h1, h2, h3, h4] };
}

module.exports = { entry };
