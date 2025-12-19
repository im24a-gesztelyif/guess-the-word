// Aggregate all available packets without padding.
// Each packet exports an array of { word, hints: [4 strings] }.
module.exports = {
  Movies: require('./movies'),
  Places: require('./places'),
  Countries: require('./countries'),
  Animals: require('./animals'),
  Food: require('./food'),
  Jobs: require('./jobs'),
  Sports: require('./sports'),
  Objects: require('./objects'),
};
