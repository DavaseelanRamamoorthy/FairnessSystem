function notAvailable() {
  throw new Error("canvas is not available in the browser bundle");
}

module.exports = {
  createCanvas: notAvailable,
  Canvas: function Canvas() {
    return notAvailable();
  },
};
