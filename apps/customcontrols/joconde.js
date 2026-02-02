mviewer.customControls.joconde = (function () {
  return {
    init: function () {
      if (mviewer.customLayers["joconde"]) {
        mviewer.customLayers["joconde"].init();
      }
    },
    destroy: function () {},
  };
})();
