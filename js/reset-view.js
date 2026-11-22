/* Reset / Home: return to the unselected default globe. Leaves layers, desks, and catalog data as they are. window.GD.resetView */
(function (global) {
  const GD = global.GD = global.GD || {};
  const HOME_VIEW = { center: [40, 28], zoom: 1.6, pitch: 0, bearing: 0 };

  function homeView() {
    const src = (GD.globe && GD.globe.HOME_VIEW) || HOME_VIEW;
    return { center: src.center.slice(), zoom: src.zoom, pitch: src.pitch, bearing: src.bearing };
  }

  function resetView() {
    if (GD.playback && GD.playback.pause) GD.playback.pause();

    const map = GD.globe && GD.globe.st && GD.globe.st.map;
    if (GD.mapPointer) {
      if (GD.mapPointer.stopMotion) GD.mapPointer.stopMotion(map);
      if (GD.mapPointer.clearSelection) GD.mapPointer.clearSelection();
    }

    if (GD.newsdesk && GD.newsdesk.selectTopic) GD.newsdesk.selectTopic(null, { silent: true });

    if (GD.callouts && GD.callouts.clear) GD.callouts.clear();
    if (GD.state) GD.state.forcedCards = [];

    const full = global.document && global.document.getElementById && global.document.getElementById("gdFull");
    if (full) full.hidden = true;

    if (GD.research && GD.research.isOpen && GD.research.isOpen() && GD.research.close) GD.research.close();

    if (GD.layout && GD.layout.setPanelVisible) GD.layout.setPanelVisible("inspector", false);

    if (GD.globe) {
      if (GD.globe.st) GD.globe.st.active = -1;
      if (GD.globe.setEpisode && GD.state && GD.state.episode) GD.globe.setEpisode(GD.state.episode, -1);
      const dest = Object.assign(homeView(), { durationSec: 2.2 });
      if (GD.globe.flyTo) GD.globe.flyTo(dest);
    }

    if (GD.ui && GD.ui.renderOverlays) GD.ui.renderOverlays();
    if (GD.ui && GD.ui.renderRundown) GD.ui.renderRundown();
    return { ok: true };
  }

  GD.resetView = resetView;
  GD.resetView.HOME_VIEW = HOME_VIEW;
})(typeof window !== "undefined" ? window : globalThis);
