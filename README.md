# Campus Plate source code

Campus Plate is a browser-based hackathon prototype for posting, reserving, and collecting surplus portions from catered campus events. It demonstrates a campus food rescue workflow aligned with UN SDG target 12.3.

## Run locally

From this directory, start a static server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [Campus Plate on localhost](http://127.0.0.1:8000/). The application uses ES modules and browser cryptography. Serve it from localhost during development or over HTTPS on a static host.

## Source files

- `dist/index.html` contains the page and both view templates.
- `dist/styles.css` contains the responsive layout and visual styles.
- `dist/app.mjs` renders the interface, handles input, and persists state in browser storage.
- `dist/state.mjs` implements listing, reservation, expiry, cancellation, stock, and collection rules.

The demo comes with three fictitious listings. Switch between **Student** and **Organizer** in the same browser profile to drive both sides of the workflow. **Reset demo** restores the starting data and restarts the pickup windows. State persists on reload when browser storage is available.

For static hosting, publish the contents of `dist/` at the site root. The source link in the app points to `dist/campus-plate-source.zip`. To regenerate that optional download from the current source, run the following from the directory containing this README:

```sh
zip -9 dist/campus-plate-source.zip README.md dist/index.html dist/styles.css dist/app.mjs dist/state.mjs
```
