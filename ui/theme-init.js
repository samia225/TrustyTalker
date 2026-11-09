/* Light mode is the default. Apply the saved light / dark choice before the page is drawn, so it does not flash
 * in the computer's default theme and then switch (most visible right after signing
 * in, which reloads the page). Loaded in <head> WITHOUT defer, before anything else.
 * app.js still owns the toggle button; this only sets the starting theme. */
(function () {
  "use strict";
  try {
    var saved = localStorage.getItem("tt-theme");
    // Light by default; dark only when the person has chosen it with the toggle.
    document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light";
  } catch (error) { document.documentElement.dataset.theme = "light"; /* storage off: still light */ }
})();
