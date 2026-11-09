/* Apply the saved light / dark choice before the page is drawn, so it does not flash
 * in the computer's default theme and then switch (most visible right after signing
 * in, which reloads the page). Loaded in <head> WITHOUT defer, before anything else.
 * app.js still owns the toggle button; this only sets the starting theme. */
(function () {
  "use strict";
  try {
    var saved = localStorage.getItem("tt-theme");
    if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
  } catch (error) { /* storage off: follow the computer's setting */ }
})();
