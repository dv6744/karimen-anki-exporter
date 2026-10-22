import * as esbuild from "esbuild";

const banner = `// ==UserScript==
// @name         karimen-anki-exporter
// @namespace    https://github.com/dv6744/karimen-anki-exporter
// @version      0.1.0
// @description  Export karimen-honmen.com mock exam results to Anki flashcards via AnkiConnect
// @match        https://karimen-honmen.com/*
// @match        https://www.musasi.jp/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @run-at       document-idle
// ==/UserScript==`;

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/karimen-anki-exporter.user.js",
  banner: { js: banner },
});

console.log("Build succeeded: dist/karimen-anki-exporter.user.js");
