mviewer.customControls.pop = (function () {
  return {
    init: function () {
      if (mviewer.customLayers["pop"]) {
        mviewer.customLayers["pop"].init();
      }
    },
    destroy: function () {},
  };
})();
