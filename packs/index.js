// Aggregate and label all available packets.
// Each packet exports an array of { word, hints: [4 strings] }.
function padPacket(arr, label) {
  const padded = [...arr];
  const need = Math.max(0, 50 - padded.length);
  for (let i = 0; i < need; i += 1) {
    const suffix = i + 1;
    padded.push({
      word: `${label.toLowerCase()}${suffix}`,
      hints: [`${label} clue ${suffix}`, `Extra ${suffix}`, `Practice card`, `Reusable packet item`],
    });
  }
  return padded;
}

module.exports = {
  Movies: padPacket(require('./movies'), 'Movies'),
  Places: padPacket(require('./places'), 'Places'),
  Countries: padPacket(require('./countries'), 'Countries'),
  Animals: padPacket(require('./animals'), 'Animals'),
  Food: padPacket(require('./food'), 'Food'),
  Jobs: padPacket(require('./jobs'), 'Jobs'),
  Sports: padPacket(require('./sports'), 'Sports'),
  Objects: padPacket(require('./objects'), 'Objects'),
};
