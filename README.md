# Comet Observatory

A lightweight, browser-based astronomical toolkit for tracking comets, planets, and the moon. Built with React and Three.js, it runs directly in the browser without needing a complex build step.

## Features

* **Solar System Map (`index.html`):** An interactive 3D map of the solar system showing planet orbits and selected comet trajectories.
* **Comet Catalog (`comets.html`):** A searchable, sortable database of observable comets. Fetches live data from the JPL Small-Body Database (with a curated fallback list).
* **Visible Planets (`planets.html`):** Calculates real-time Altitude, Azimuth, RA, and Dec for planets based on your specific geographic location and time. Great for astrophotography planning.
* **Moon Viewer (`moon.html`):** An interactive 3D moon globe that shows the current lunar phase, illumination, and labeled surface features (maria, craters, and landing sites).

## Tech Stack

* **Frontend Framework:** React 18 (loaded via CDN with Babel standalone)
* **3D Rendering:** Three.js
* **Styling:** Custom CSS with CSS variables for light/dark/sepia theme support
* **Astronomy Math:** Custom `astro.js` engine for VSOP87-lite planet positions, Keplerian orbit solving, and Alt/Az conversions.
