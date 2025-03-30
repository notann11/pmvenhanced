// ==UserScript==
// @name         PMVHaven Enhancer
// @namespace    http://tampermonkey.net/
// @description  Enhance videos with glow effects, pulse animations, and color boosts
// @match        https://pmvhaven.com/*
// @require      https://raw.githubusercontent.com/notann11/pmvenhanced/refs/heads/main/src/main.js
// @require      https://raw.githubusercontent.com/notann11/pmvenhanced/refs/heads/main/src/amoled.js
// @resource     CSS https://raw.githubusercontent.com/notann11/pmvenhanced/refs/heads/main/src/video-effects.css
// @require      https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.min.js
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // Load CSS from external file
    const css = GM_getResourceText("CSS");
    GM_addStyle(css);

    // Initialize the video effects
    if (typeof initVideoEffects === 'function') {
        initVideoEffects();
    } else {
        console.error('Video effects main.js not loaded correctly');
    }
})();
