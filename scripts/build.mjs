import { build } from "esbuild";

const userscriptHeader = `// ==UserScript==
// @name         Wegstatus Polyline Selector
// @namespace    https://wegstatus.nl
// @version      2026.08.24.03
// @description  Copies selected WME segments as one Wegstatus polyline.
// @author       Xander "Xanland" Hoogland & Sjors "GigaaG" Luyckx
// @include      /^https:\\/\\/(www|beta)\\.waze\\.com\\/(?!user\\/)(.{2,6}\\/)?editor([^\\/]?.*)?$/
// @grant        none
// @run-at       document-idle
// ==/UserScript==`;

await build({
  entryPoints: ["src/main.ts"],
  outfile: "wegstatus-polyline-selector.user.js",
  bundle: true,
  format: "iife",
  target: ["chrome110", "firefox115"],
  banner: { js: userscriptHeader },
  charset: "utf8",
  legalComments: "none",
  minify: false,
  sourcemap: false,
  logLevel: "info",
});
