/**
 * PMVHaven Enhanced
 * 31 March 2025
*/

// Default configuration
const defaultConfig = {
    // General
    sampleInterval: 100,         // Sampling interval for scene detection
    // Glow settings
    glowSize: 200,               // Size of the glow effect in pixels
    glowOpacity: 0.85,           // Opacity of the glow effect (0-1)
    colorBoost: 1.2,             // Color boost for the glow effect
    // Pulse settings
    pulsateDuration: 200,        // Duration of pulse animation in ms
    pulsateScale: 1.05,          // How much the video grows during pulse
    pulseEffect: 'scale',        // Which pulse effect to use
    cooldownPeriod: 300,         // Milliseconds to wait before allowing another pulse
    // Scene detection parameters
    gridSize: 16,                // Divide video into NxN grid for sampling
    motionThreshold: 60,         // Threshold for motion detection
    colorThreshold: 20,          // Color change threshold
    sceneChangeConfidence: 0.45, // Percentage of grid cells that need to change to trigger scene change
    // Direct CSS filter enhancement
    saturationBoost: 2.0,        // 1.0 = normal, 2.0 = 100% more saturated (double)
    contrastBoost: 1.1,          // 1.0 = normal, 1.1 = 10% more contrast
    // Feature toggles
    enablePulsing: true,         // Set to false to disable the pulsing effect
    enableGlow: true,            // Set to false to disable the color glow effect
    enableSaturation: true,      // Set to false to disable the saturation boost
    enableFocusMode: false,      // New toggle for focus mode
    // UI settings
    controlPanelVisible: true,   // Control panel visibility
    controlPanelPosition: 'center', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    activeSection: 'main',       // Which section is currently visible
    // QoL Settings
    enableDoubleTapSeek: false,  // Double-tap to seek forward/backward
    skipTimeInSeconds: 10,       // How many seconds to skip
    doubleTapThreshold: 300,     // Double-tap detection threshold in ms
    enableZoomDisable: false,    // New toggle to disable double-tap zoom
    enableSortByRating: false,   // New toggle for sorting videos by rating
    enableFixPreview: false,     // Default to disabled
    // Session tracker settings
    enableSessionTracker: false, // Toggle for session tracking
    sessionStartTime: null,      // Start time of the current session
    lastActivityTime: null,      // Last activity time
    isSessionActive: true,       // Whether the session is active
    sessionTimerInterval: null,  // Store the interval ID
    debug: false
};

// Global variables
let config;
let canvas;
let ctx;

// API Key for scrapingdog (reverse image serach api)
const API_KEY = '67e2ae2b660afa78769f8cdc';

// Global variables for source selection
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionCurrent = { x: 0, y: 0 };
let selectionOverlay = null;
let videoContainer = null;

// GIF configuration with defaults
const gifConfig = {
    quality: 15,       // Medium quality default
    duration: 5,       // 5 seconds default
    fps: 10,           // 10 frames per second
    sizePreset: 2,     // Default size preset (Medium)
    isRecording: false,
    frameCount: 0,
    gif: null,
    captureInterval: null,
    workerURL: null,
    canvas: null,
    ctx: null,
    originalTime: 0,   // Store original video time
    wasVideoPaused: true, // Store original video paused state
    lastBlobSize: 0,   // Store the size of the last generated GIF
    livePreviewInterval: null,
    livePreviewCanvas: null,
    livePreviewCtx: null,
    blobUrl: null
};

// Global variables for double-tap functionality
let doubleTapCanvas = null;
let doubleTapVideoElement = null;
let doubleTapInitialized = false;
let lastTap = {
    time: 0,
    x: 0,
    y: 0
};

// Session tracker constants
const SESSION_UPDATE_INTERVAL = 1000; // 1 second in milliseconds
const SESSION_RESET_THRESHOLD = 15 * 60 * 1000; // 15 minutes in milliseconds
const SESSION_INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

/**************************************
 * 1. INITIALIZATION FUNCTIONS
 **************************************/

// Function to initialize the video effects
function initVideoEffects() {
    // Load saved configuration or use defaults
    config = loadConfig();

    // Create canvas for processing
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = config.gridSize;
    canvas.height = config.gridSize;

    // Initialize pulse styles
    updatePulseStyles();

    // Process videos and setup UI after a short delay
    setTimeout(() => {
        processAllVideos();
        setupObserver();
        createShowButton();
        createControlPanel();
        initQolFeatures();
        if (config.enableSessionTracker) {
            initSessionTracker();
        }
        if (config.debug) console.log('Video effects initialized');
    }, 1000);
}

// Initialize QoL features
function initQolFeatures() {
    // If double-tap seeking is enabled, initialize it
    if (config.enableDoubleTapSeek && isTouchDevice()) {
        // Set a one-time initialization
        if (!window.doubleTapInitialized) {
            setTimeout(() => {
                initDoubleTapSeek();
                // monitorVideoNavigation is now called from within initDoubleTapSeek
            }, 1000);
        }
    }

    // Initialize Focus Mode if enabled
    if (config.enableFocusMode) {
        setTimeout(() => handleFocusMode(true), 1000);
    }

    // Initialize session tracker if enabled
    if (config.enableSessionTracker) {
        setTimeout(initSessionTracker, 1000);
    }

    // Initialize zoom disable if enabled
    if (config.enableZoomDisable) {
        handleZoomDisable(true);
    }

    // Initialize sort by rating if enabled
    if (config.enableSortByRating && !sortingInitialized) {
        // Start URL monitoring regardless of current page
        currentSortUrl = window.location.href;
        monitorUrlForSorting();

        // Only initialize the actual sorting if we're on a search page
        if (isSearchPage()) {
            setTimeout(initSortByRating, 1000);
        } else {
            // Mark as initialized to prevent duplicate initialization
            sortingInitialized = true;
        }
    }

    // NEW: Initialize Fix Preview if enabled
    if (config.enableFixPreview && isTouchDevice() && !fixPreviewInitialized) {
        setTimeout(initFixPreview, 1000);
    }
}

/**************************************
 * 2. VIDEO PROCESSING FUNCTIONS
 **************************************/

// Get grid of colors from video (better for scene detection)
function getVideoPixelGrid(video) {
    if (!video || video.videoWidth <= 0) return null;

    try {
        if (!video.hasAttribute('crossorigin')) {
            video.setAttribute('crossorigin', 'anonymous');
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Create a grid of RGB values
        const grid = [];
        let totalR = 0, totalG = 0, totalB = 0;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const index = (y * canvas.width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];

                grid.push({ r, g, b });
                totalR += r;
                totalG += g;
                totalB += b;
            }
        }

        // Calculate average color for glow effect
        let avgR = totalR / grid.length;
        let avgG = totalG / grid.length;
        let avgB = totalB / grid.length;

        // Apply saturation before color boost
        if (config.glowSaturation !== undefined && config.glowSaturation !== 1.0) {
            // Calculate luminance (perceived brightness)
            const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

            // Apply saturation adjustment
            avgR = luminance + (avgR - luminance) * config.glowSaturation;
            avgG = luminance + (avgG - luminance) * config.glowSaturation;
            avgB = luminance + (avgB - luminance) * config.glowSaturation;
        }

        // Apply color boost and ensure values are in valid range
        const avgColor = {
            r: Math.min(255, Math.max(0, Math.round(avgR * config.colorBoost))),
            g: Math.min(255, Math.max(0, Math.round(avgG * config.colorBoost))),
            b: Math.min(255, Math.max(0, Math.round(avgB * config.colorBoost)))
        };

        return { grid, avgColor };
    } catch (error) {
        if (config.debug) console.error('Error in video sampling:', error);

        // Simplified fallback with time-based color
        const time = Date.now() / 1000;
        const r = Math.min(255, Math.round(128 + 127 * Math.sin(time * 0.5)));
        const g = Math.min(255, Math.round(128 + 127 * Math.sin(time * 0.3)));
        const b = Math.min(255, Math.round(128 + 127 * Math.sin(time * 0.7)));

        let avgR = r, avgG = g, avgB = b;

        // Apply saturation to fallback color too
        if (config.glowSaturation !== undefined && config.glowSaturation !== 1.0) {
            const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
            avgR = luminance + (avgR - luminance) * config.glowSaturation;
            avgG = luminance + (avgG - luminance) * config.glowSaturation;
            avgB = luminance + (avgB - luminance) * config.glowSaturation;
        }

        const avgColor = {
            r: Math.min(255, Math.max(0, Math.round(avgR * config.colorBoost))),
            g: Math.min(255, Math.max(0, Math.round(avgG * config.colorBoost))),
            b: Math.min(255, Math.max(0, Math.round(avgB * config.colorBoost)))
        };

        // Create a grid with the same color
        const grid = Array(config.gridSize * config.gridSize).fill().map(() => ({ ...avgColor }));
        return { grid, avgColor };
    }
}

// Calculate color distance between two points
function colorDistance(color1, color2) {
    if (!color1 || !color2) return 0;
    return Math.sqrt(
        Math.pow(color1.r - color2.r, 2) +
        Math.pow(color1.g - color2.g, 2) +
        Math.pow(color1.b - color2.b, 2)
    );
}

// Detect scene change based on grid comparison
function detectSceneChange(currentGrid, previousGrid) {
    if (!currentGrid || !previousGrid || currentGrid.length !== previousGrid.length) {
        return false;
    }

    // 1. Calculate motion score
    let changedCells = 0;
    let totalMotionDistance = 0;
    let maxColorDistance = 0;

    for (let i = 0; i < currentGrid.length; i++) {
        const distance = colorDistance(currentGrid[i], previousGrid[i]);

        // Track total motion across all cells
        totalMotionDistance += distance;

        // Track cells that exceed motion threshold
        if (distance > config.motionThreshold) {
            changedCells++;
        }

        // Track maximum color distance for any cell
        if (distance > maxColorDistance) {
            maxColorDistance = distance;
        }
    }

    // 2. Calculate metrics
    const motionRatio = changedCells / currentGrid.length;  // % of cells with significant motion
    const avgMotionValue = totalMotionDistance / currentGrid.length;  // Average motion across all cells
    const normalizedMaxColor = Math.min(1.0, maxColorDistance / 255); // Normalize max color change (0-1)

    // Store these values for the graph to use
    window._lastMotionRatio = motionRatio;
    window._lastAvgMotionValue = avgMotionValue;
    window._lastMaxColorChange = normalizedMaxColor;

    // 3. Calculate combined score using weighted factors
    // Default weights: 60% motion ratio, 30% avg motion, 10% max color
    const motionRatioWeight = 0.6;
    const avgMotionWeight = 0.3;
    const maxColorWeight = 0.1;

    const combinedScore = (
        (motionRatio * motionRatioWeight) +
        (Math.min(1.0, avgMotionValue / config.motionThreshold) * avgMotionWeight) +
        (normalizedMaxColor * maxColorWeight)
    );

    // Store the combined score for use in the graph
    window._lastCombinedScore = combinedScore;

    if (config.debug) {
        console.log(`Scene detection: Combined score ${combinedScore.toFixed(2)} (motion ratio: ${(motionRatio * 100).toFixed(1)}%, avg motion: ${avgMotionValue.toFixed(1)}, color change: ${(normalizedMaxColor * 100).toFixed(1)}%)`);
    }

    // 4. Return true if combined score exceeds our threshold
    return combinedScore >= config.sceneChangeConfidence;
}

function triggerPulsate(video) {
    // Skip if pulsing is disabled in config
    if (!config.enablePulsing) return;

    // Check cooldown to avoid rapid pulsating
    const now = Date.now();
    if (video._lastPulsateTime && now - video._lastPulsateTime < config.cooldownPeriod) {
        return;
    }

    // NEW: Check if a pulse animation is already in progress
    if (video._pulseInProgress) {
        return;
    }

    // Remove any existing pulse effect classes (just to be safe)
    video.classList.remove('video-pulse-scale', 'video-pulse-glow', 'video-pulse-fade', 'video-pulse-both', 'video-pulse-bpm');

    // Set CSS variables for animation duration and scale
    video.style.setProperty('--pulse-duration', `${config.pulsateDuration}ms`);
    video.style.setProperty('--pulse-scale', `${config.pulsateScale}`);

    // Apply the pulse effect class
    const pulseClass = `video-pulse-${config.pulseEffect}`;
    video.classList.add(pulseClass);

    // Special handling for BPM mode
    if (config.pulseEffect === 'bpm') {
        video.style.setProperty('--pulse-bpm-scale', `${config.pulsateScale}`);
    }

    // Update timestamp for cooldown
    video._lastPulsateTime = now;

    // NEW: Set flag that pulse is in progress
    video._pulseInProgress = true;

    // Remove class after animation completes and reset flag
    setTimeout(() => {
        video.classList.remove(pulseClass);
        // NEW: Reset the in-progress flag when animation completes
        video._pulseInProgress = false;
    }, config.pulsateDuration);

    if (config.debug) console.log('Pulse triggered: ' + config.pulseEffect);
}

function updateVideoMonitor(video) {
    // Store original filter
    const originalFilter = video.style.filter;

    // Temporarily remove saturation for sampling
    if (config.enableSaturation) {
        video.style.filter = 'none';
    }

    // Get pixel data without saturation effects
    const result = getVideoPixelGrid(video);

    // Restore original filter
    video.style.filter = originalFilter;

    if (!result) return;

    const { grid, avgColor } = result;

    // Apply the glow effect using the average color (if enabled)
    if (config.enableGlow) {
        video.style.boxShadow = `0 0 ${config.glowSize}px rgba(${avgColor.r}, ${avgColor.g}, ${avgColor.b}, ${config.glowOpacity})`;
    } else {
        video.style.boxShadow = 'none';
    }

    // Check for scene change if we have previous grid data
    if (video._lastGrid) {
        // Use our combined detection approach
        if (detectSceneChange(grid, video._lastGrid)) {
            triggerPulsate(video);
        }

        // NO separate "first to report wins" check for color change
        // Now using just the one combined scoring system
    }

    // Save current data for next comparison
    video._lastGrid = grid;
    video._lastAvgColor = avgColor;
}

function cleanupVideo(video) {
    if (video._monitorInterval) {
        clearInterval(video._monitorInterval);
        video._monitorInterval = null;
    }
}

function processVideo(video) {
    if (video._sceneDetectionProcessed) return;
    video._sceneDetectionProcessed = true;

    // Try to set crossorigin attribute for CORS content
    if (!video.hasAttribute('crossorigin')) {
        video.setAttribute('crossorigin', 'anonymous');
    }

    // Apply necessary styles
    if (window.getComputedStyle(video).position === 'static') {
        video.style.position = 'relative';
    }

    video.style.transformOrigin = 'center center';

    // Apply transition style for glow effect
    if (config.enableGlow) {
        video.style.transition = `box-shadow ${config.sampleInterval}ms ease-in-out`;
    }

    // Apply CSS filters for saturation boost
    if (config.enableSaturation) {
        const filterValue = getFilterString();
        video.style.setProperty('filter', filterValue, 'important');
        video.style.setProperty('-webkit-filter', filterValue, 'important');
    }

    // Set up event listeners
    video.addEventListener('play', () => {
        cleanupVideo(video); // Clean up any existing intervals

        // Reset tracking variables
        video._lastGrid = null;
        video._lastAvgColor = null;
        video._lastPulsateTime = 0;

        // Initial processing
        updateVideoMonitor(video);

        // Set up interval for continuous monitoring
        video._monitorInterval = setInterval(() => updateVideoMonitor(video), config.sampleInterval);
    });

    video.addEventListener('pause', () => cleanupVideo(video));
    video.addEventListener('ended', () => cleanupVideo(video));

    // Setup a MutationObserver to detect if the video is removed from DOM
    const observer = new MutationObserver((mutations) => {
        if (!document.contains(video)) {
            cleanupVideo(video);
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Start monitoring if video is already playing
    if (!video.paused) {
        updateVideoMonitor(video);
        video._monitorInterval = setInterval(() => updateVideoMonitor(video), config.sampleInterval);
    }
}

function processAllVideos() {
    // Instead of processing all videos, only process the main video player
    const videoPlayer = document.getElementById('VideoPlayer');
    if (videoPlayer && videoPlayer.tagName === 'VIDEO') {
        processVideo(videoPlayer);
    }
}

function setupObserver() {
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // Check if this is our target video
                    if (node.id === 'VideoPlayer' && node.tagName === 'VIDEO') {
                        shouldProcess = true;
                    }
                    // Also check children for our target video
                    else if (node.nodeType === 1) {
                        const videoPlayer = node.querySelector('#VideoPlayer');
                        if (videoPlayer && videoPlayer.tagName === 'VIDEO') {
                            shouldProcess = true;
                        }
                    }
                });
            }
        });

        // Process videos only once per batch of mutations
        if (shouldProcess) {
            processAllVideos();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function updatePulseStyles() {
    // Set CSS variables for animation properties
    document.documentElement.style.setProperty('--pulsate-scale', config.pulsateScale);
    document.documentElement.style.setProperty('--pulsate-duration', `${config.pulsateDuration}ms`);

    // Ensure the CSS file is loaded
    if (!document.getElementById('video-effects-pulse-styles')) {
        const link = document.createElement('link');
        link.id = 'video-effects-pulse-styles';
        link.rel = 'stylesheet';
        link.href = 'video-effects.css'; // Path to your CSS file
        document.head.appendChild(link);
    }
}

/**************************************
 * 3. MENU SYSTEM FUNCTIONS
 **************************************/

// Common helper function for the minimize button
function setupMinimizeButton(panel) {
    const minimizeButton = document.getElementById('effects-minimize');
    if (!minimizeButton) return;

    minimizeButton.addEventListener('click', function () {
        config.controlPanelVisible = !config.controlPanelVisible;
        panel.style.opacity = config.controlPanelVisible ? '1' : '0';
        panel.style.transform = config.controlPanelVisible ? 'scale(1)' : 'scale(0.8)';

        // Change button text
        this.textContent = config.controlPanelVisible ? '_' : '+';

        // If minimized, hide the panel completely
        if (!config.controlPanelVisible) {
            setTimeout(() => {
                if (!config.controlPanelVisible) {
                    panel.style.display = 'none';
                }
            }, 300);
        }

        saveConfig();
    });
}

// Reusable function to create a title bar
function createTitleBar(title) {
    return `
        <div class="title-bar">
            <div><b>${title}</b>${title === 'PMVHaven Enhancer' && config.enableSessionTracker ? ' <span class="session-timer">(0:00)</span>' : ''}</div>
            <div>
                <button id="effects-minimize" style="padding: 2px 8px; margin: 0;">_</button>
            </div>
        </div>
    `;
}

// Reusable function to create a back button
function createBackButton() {
    return `<button id="back-to-main" class="menu-button back-button">Back to Main Menu</button>`;
}

// Add back button event listener
function setupBackButton() {
    document.getElementById('back-to-main').addEventListener('click', function () {
        renderMainMenu();
    });
}

// Main menu
function renderMainMenu() {
    const panel = document.getElementById('video-effects-control');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = `
        ${createTitleBar('PMVHaven Enhancer')}
        <div class="controls">
            <button id="toggle-glow" class="${config.enableGlow ? 'active' : ''}">Glow</button>
            <button id="toggle-pulse" class="${config.enablePulsing ? 'active' : ''}">Pulse</button>
            <button id="toggle-saturation" class="${config.enableSaturation ? 'active' : ''}">Sat</button>
            <button id="toggle-focus" class="${config.enableFocusMode ? 'active' : ''}">Focus</button>
            <button id="toggle-gif" title="Create GIF from video">Gif</button>
            <button id="toggle-whois" title="Reverse image search current video frame">Source</button>
        </div>
        <button id="glow-menu-button" class="menu-button">Glow Settings</button>
        <button id="pulse-menu-button" class="menu-button">Pulse Settings</button>
        <button id="saturation-menu-button" class="menu-button">Saturation Settings</button>
        <button id="qol-menu-button" class="menu-button">QoL Settings</button>
    `;

    // Immediately update the timer display if enabled
    if (config.enableSessionTracker) {
        updateSessionTimerDisplay();
    }

    // Set up button event listeners
    setupMainMenuButtons();
    setupMinimizeButton(panel);
    makeDraggable(panel);
}

// Set up main menu button event listeners
function setupMainMenuButtons() {
    // Source button
    const whoisButton = document.getElementById('toggle-whois');
    if (whoisButton) {
        whoisButton.addEventListener('click', toggleSelectionMode);
    }

    // Initialize GIF components 
    initGifComponents();

    // GIF button
    const gifButton = document.getElementById('toggle-gif');
    if (gifButton) {
        gifButton.addEventListener('click', function () {
            renderGifMenu();
        });
    }

    // QoL Settings button
    const qolButton = document.getElementById('qol-menu-button');
    if (qolButton) {
        qolButton.addEventListener('click', function () {
            renderQolSettingsMenu();
        });
    }

    // Add Focus toggle button listener
    document.getElementById('toggle-focus').addEventListener('click', function () {
        config.enableFocusMode = !config.enableFocusMode;
        this.classList.toggle('active');
        handleFocusMode(config.enableFocusMode);
        saveConfig();
    });

    // Toggle buttons
    document.getElementById('toggle-glow').addEventListener('click', function () {
        config.enableGlow = !config.enableGlow;
        this.classList.toggle('active');
        applySettingsToAllVideos();
    });

    document.getElementById('toggle-pulse').addEventListener('click', function () {
        config.enablePulsing = !config.enablePulsing;
        this.classList.toggle('active');
        saveConfig();
    });

    document.getElementById('toggle-saturation').addEventListener('click', function () {
        config.enableSaturation = !config.enableSaturation;
        this.classList.toggle('active');
        applySettingsToAllVideos();
    });

    // Settings buttons
    document.getElementById('glow-menu-button').addEventListener('click', function () {
        renderGlowMenu();
    });

    document.getElementById('pulse-menu-button').addEventListener('click', function () {
        renderPulseMenu();
    });

    document.getElementById('saturation-menu-button').addEventListener('click', function () {
        renderSaturationMenu();
    });
}

// Glow menu
function renderGlowMenu() {
    const panel = document.getElementById('video-effects-control');
    if (!panel) return;

    // Add a new configuration option if it doesn't exist yet
    if (config.glowSaturation === undefined) {
        config.glowSaturation = 1.0; // Default saturation multiplier
        saveConfig();
    }

    panel.style.display = 'block';
    panel.innerHTML = `
        ${createTitleBar('Glow Settings')}
        <div class="slider-row">
            <span class="slider-label">Size</span>
            <input type="range" id="glow-size-slider" class="slider"
                min="50" max="400" step="10" value="${config.glowSize}">
            <span id="glow-size-value" class="value">${config.glowSize}</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Opacity</span>
            <input type="range" id="glow-opacity-slider" class="slider"
                min="0.1" max="1" step="0.05" value="${config.glowOpacity}">
            <span id="glow-opacity-value" class="value">${config.glowOpacity.toFixed(1)}</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Boost</span>
            <input type="range" id="color-boost-slider" class="slider"
                min="1" max="2" step="0.05" value="${config.colorBoost}">
            <span id="color-boost-value" class="value">${config.colorBoost.toFixed(1)}</span>
        </div>
        <div class="slider-row">
            <span class="slider-label">Saturation</span>
            <input type="range" id="glow-saturation-slider" class="slider"
                min="1" max="5" step="0.1" value="${config.glowSaturation}">
            <span id="glow-saturation-value" class="value">${config.glowSaturation.toFixed(1)}</span>
        </div>
        ${createBackButton()}
    `;

    setupGlowSliders();
    setupBackButton();
    setupMinimizeButton(panel);
    makeDraggable(panel);
}

// Set up glow slider event listeners
function setupGlowSliders() {
    document.getElementById('glow-size-slider').addEventListener('input', function () {
        config.glowSize = parseInt(this.value);
        document.getElementById('glow-size-value').textContent = config.glowSize;
        if (config.enableGlow) {
            applySettingsToAllVideos();
        }
    });

    document.getElementById('glow-opacity-slider').addEventListener('input', function () {
        config.glowOpacity = parseFloat(this.value);
        document.getElementById('glow-opacity-value').textContent = config.glowOpacity.toFixed(1);
        if (config.enableGlow) {
            applySettingsToAllVideos();
        }
    });

    document.getElementById('color-boost-slider').addEventListener('input', function () {
        config.colorBoost = parseFloat(this.value);
        document.getElementById('color-boost-value').textContent = config.colorBoost.toFixed(1);
        if (config.enableGlow) {
            applySettingsToAllVideos();
        }
    });

    document.getElementById('glow-saturation-slider').addEventListener('input', function () {
        config.glowSaturation = parseFloat(this.value);
        document.getElementById('glow-saturation-value').textContent = config.glowSaturation.toFixed(1);
        if (config.enableGlow) {
            applySettingsToAllVideos();
        }
    });
}

// Pulse menu
function renderPulseMenu() {
    const panel = document.getElementById('video-effects-control');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = `
        ${createTitleBar('Pulse Settings')}
        
        <div class="section-title">Animation</div>
        
        <div class="slider-row">
            <span class="slider-label">Scale</span>
            <input type="range" id="pulse-scale-slider" class="slider" 
                   min="1.01" max="1.2" step="0.01" value="${config.pulsateScale}">
            <span id="pulse-scale-value" class="value">${config.pulsateScale.toFixed(2)}</span>
        </div>
        
        <div class="slider-row">
            <span class="slider-label">Speed</span>
            <input type="range" id="pulse-duration-slider" class="slider" 
                   min="100" max="500" step="10" value="${config.pulsateDuration}">
            <span id="pulse-duration-value" class="value">${config.pulsateDuration}</span>
        </div>
        
        <div class="slider-row">
            <span class="slider-label">Cooldown</span>
            <input type="range" id="pulse-cooldown-slider" class="slider" 
                   min="100" max="1000" step="50" value="${config.cooldownPeriod}">
            <span id="pulse-cooldown-value" class="value">${config.cooldownPeriod}</span>
        </div>
        
        <div class="section-title">Detection</div>
        
        <div class="slider-row">
            <span class="slider-label">Motion</span>
            <input type="range" id="motion-threshold-slider" class="slider" 
                   min="20" max="100" step="5" value="${config.motionThreshold}">
            <span id="motion-threshold-value" class="value">${config.motionThreshold}</span>
        </div>
        
        <div class="slider-row">
            <span class="slider-label">Color</span>
            <input type="range" id="color-threshold-slider" class="slider" 
                   min="5" max="50" step="5" value="${config.colorThreshold}">
            <span id="color-threshold-value" class="value">${config.colorThreshold}</span>
        </div>
        
        <div class="slider-row">
            <span class="slider-label">Conf %</span>
            <input type="range" id="scene-confidence-slider" class="slider" 
                   min="0.1" max="0.9" step="0.05" value="${config.sceneChangeConfidence}">
            <span id="scene-confidence-value" class="value">${config.sceneChangeConfidence.toFixed(2)}</span>
        </div>
        
        ${createBackButton()}
    `;

    setupPulseSliders();
    setupBackButton();
    setupMinimizeButton(panel);
    makeDraggable(panel);
}

// Set up pulse slider event listeners
function setupPulseSliders() {
    document.getElementById('pulse-scale-slider').addEventListener('input', function () {
        config.pulsateScale = parseFloat(this.value);
        document.getElementById('pulse-scale-value').textContent = config.pulsateScale.toFixed(2);
        updatePulseStyles();
        saveConfig();
    });

    document.getElementById('pulse-duration-slider').addEventListener('input', function () {
        config.pulsateDuration = parseInt(this.value);
        document.getElementById('pulse-duration-value').textContent = config.pulsateDuration;
        updatePulseStyles();
        saveConfig();
    });

    document.getElementById('pulse-cooldown-slider').addEventListener('input', function () {
        config.cooldownPeriod = parseInt(this.value);
        document.getElementById('pulse-cooldown-value').textContent = config.cooldownPeriod;
        saveConfig();
    });

    document.getElementById('motion-threshold-slider').addEventListener('input', function () {
        config.motionThreshold = parseInt(this.value);
        document.getElementById('motion-threshold-value').textContent = config.motionThreshold;
        saveConfig();
    });

    document.getElementById('color-threshold-slider').addEventListener('input', function () {
        config.colorThreshold = parseInt(this.value);
        document.getElementById('color-threshold-value').textContent = config.colorThreshold;
        saveConfig();
    });

    document.getElementById('scene-confidence-slider').addEventListener('input', function () {
        config.sceneChangeConfidence = parseFloat(this.value);
        document.getElementById('scene-confidence-value').textContent = config.sceneChangeConfidence.toFixed(2);
        saveConfig();
    });
}

// Saturation menu
function renderSaturationMenu() {
    const panel = document.getElementById('video-effects-control');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = `
        ${createTitleBar('Saturation Settings')}
        
        <div class="slider-row">
            <span class="slider-label">Saturation</span>
            <input type="range" id="saturation-slider" class="slider" 
                   min="1" max="4" step="0.1" value="${config.saturationBoost}">
            <span id="saturation-value" class="value">${config.saturationBoost.toFixed(1)}</span>
        </div>
        
        <div class="slider-row">
            <span class="slider-label">Contrast</span>
            <input type="range" id="contrast-slider" class="slider" 
                   min="0.8" max="1.5" step="0.05" value="${config.contrastBoost}">
            <span id="contrast-value" class="value">${config.contrastBoost.toFixed(1)}</span>
        </div>
        
        ${createBackButton()}
    `;

    setupSaturationSliders();
    setupBackButton();
    setupMinimizeButton(panel);
    makeDraggable(panel);
}

// Set up saturation slider event listeners
function setupSaturationSliders() {
    document.getElementById('saturation-slider').addEventListener('input', function () {
        config.saturationBoost = parseFloat(this.value);
        document.getElementById('saturation-value').textContent = config.saturationBoost.toFixed(1);
        if (config.enableSaturation) {
            applySettingsToAllVideos();
        }
    });

    document.getElementById('contrast-slider').addEventListener('input', function () {
        config.contrastBoost = parseFloat(this.value);
        document.getElementById('contrast-value').textContent = config.contrastBoost.toFixed(1);
        if (config.enableSaturation) {
            applySettingsToAllVideos();
        }
    });
}

// QoL settings menu
function renderQolSettingsMenu() {
    const panel = document.getElementById('video-effects-control');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = `
        ${createTitleBar('Quality of Life Settings')}
        
        <div class="toggle-row" ${!isTouchDevice() ? 'title="This feature requires a touch device"' : ''}>
            <span class="toggle-label">Double-tap Seek</span>
            <label class="toggle-switch ${!isTouchDevice() ? 'disabled' : ''}">
                <input type="checkbox" id="double-tap-toggle" 
                       ${config.enableDoubleTapSeek ? 'checked' : ''} 
                       ${!isTouchDevice() ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
        
        <div class="toggle-row" ${!isTouchDevice() ? 'title="This feature requires a touch device"' : ''}>
            <span class="toggle-label">Disable Zoom</span>
            <label class="toggle-switch ${!isTouchDevice() ? 'disabled' : ''}">
                <input type="checkbox" id="zoom-disable-toggle" 
                       ${config.enableZoomDisable ? 'checked' : ''} 
                       ${!isTouchDevice() ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
        
        <!-- Session Tracker Toggle -->
        <div class="toggle-row">
            <span class="toggle-label">Session Timer</span>
            <label class="toggle-switch">
                <input type="checkbox" id="session-tracker-toggle" 
                       ${config.enableSessionTracker ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
        
        <!-- NEW: Sort by Rating Toggle -->
        <div class="toggle-row">
            <span class="toggle-label">Sort by Rating</span>
            <label class="toggle-switch">
                <input type="checkbox" id="sort-by-rating-toggle" 
                       ${config.enableSortByRating ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
        
                <div class="toggle-row" ${!isTouchDevice() ? 'title="This feature requires a touch device"' : ''}>
            <span class="toggle-label">Fix Preview</span>
            <label class="toggle-switch ${!isTouchDevice() ? 'disabled' : ''}">
                <input type="checkbox" id="fix-preview-toggle" 
                       ${config.enableZoomDisable ? 'checked' : ''} 
                       ${!isTouchDevice() ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
        
        ${createBackButton()}
    `;

    setupQolToggles();
    setupBackButton();
    setupMinimizeButton(panel);
    makeDraggable(panel);
}


// Focus mode implementation
function handleFocusMode(enable) {
    // Use an ID for the style element to easily find/remove it
    const focusStyleId = 'pmvhaven-focus-mode-styles';

    if (enable) {
        // Remove existing style if it exists
        const existingStyle = document.getElementById(focusStyleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create a style element for hiding elements
        const style = document.createElement('style');
        style.id = focusStyleId;

        // CSS for hiding elements and centering video
        style.textContent = `
            /* Hide various UI elements */
            .subheader.hidden-sm-and-down,
            #header,
            .mt-4,
            .v-col-sm-6.v-col-md-4.v-col-12,
            .v-footer.v-theme--dark.footer,
            .v-card-title,
            .v-col-md-2.v-col-lg-3.v-col-12,
            .v-col-md-2.v-col-lg-4.v-col-12,
            div[data-v-d40026e9].v-col-md-2.v-col-lg-3.v-col-12,
            div[class*="v-col-md-2"],
            div[class*="v-col-lg-3"],
            .desktopAd,
            .v-row.v-row--no-gutters,
            .svg-inline--fa.fa-user,
            .svg-inline--fa.fa-eye,
            .svg-inline--fa.fa-volume-xmark,
            [style*="color: orange; z-index: 2;"],
            .v-card__text,
            .v-card--link,
            .pb-0.mb-0.pl-1.pr-1,
            .v-row.ma-0.mb-2 {
                display: none !important;
            }
            
            /* Hide divs that contain multiple video links */
            div:has(.v-row a[href^="/video/"]:nth-child(3)) {
                display: none !important;
            }
            
            /* Adjust margins */
            .mt-6 {
                margin-top: 30px !important;
            }
            
            /* Base video styles */
            video, .v-responsive, .v-responsive__content, .v-img, iframe {
                margin: 0 auto !important;
                display: block !important;
                max-width: 100% !important;
                height: auto !important;
            }
            
            /* Landscape mode styles */
            @media (orientation: landscape) and (max-width: 991px) {
                video, .v-responsive, .v-responsive__content, .v-img, iframe {
                    width: 76vw !important;
                }
                
                .mt-6 {
                    margin-top: 0 !important;
                }
            }
            
            /* Desktop override */
            @media (min-width: 1024px) {
                video, .v-responsive, .v-responsive__content, .v-img, iframe {
                    width: auto !important;
                }
            }
            
            /* Fullscreen handling */
            :-webkit-full-screen video,
            :fullscreen video {
                width: 100vw !important;
                height: 100vh !important;
                max-height: 100vh !important;
                object-fit: contain !important;
            }
            
            /* Center content */
            .v-row {
                justify-content: center !important;
            }
            
            .v-col-md-8.v-col-12 {
                margin: 0 auto !important;
                display: flex !important;
                justify-content: center !important;
            }
            
            .v-container {
                max-width: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
            }
        `;

        // Add the style to the document
        document.head.appendChild(style);
    } else {
        // Remove the style element to restore the original UI
        const existingStyle = document.getElementById(focusStyleId);
        if (existingStyle) {
            existingStyle.remove();
        }
    }
}

// Remove double-tap seeking functionality
function removeDoubleTapSeek() {
    if (!doubleTapInitialized && !doubleTapCanvas) return;

    // Clear the monitoring interval if it exists
    if (window.doubleTapMonitorInterval) {
        clearInterval(window.doubleTapMonitorInterval);
        window.doubleTapMonitorInterval = null;
    }

    if (doubleTapCanvas && doubleTapCanvas.parentNode) {
        // Remove event listeners
        doubleTapCanvas.removeEventListener('touchstart', handleDoubleTapTouch);
        doubleTapCanvas.removeEventListener('touchend', handleDoubleTapTouch);

        // Remove canvas
        doubleTapCanvas.parentNode.removeChild(doubleTapCanvas);
        doubleTapCanvas = null;
    }

    // Reset any other state variables
    lastTap = {
        time: 0,
        x: 0,
        y: 0
    };

    doubleTapInitialized = false;
}


// Set up QoL toggle event listeners
function setupQolToggles() {
    // Double-tap toggle event listener
    const doubleTapToggle = document.getElementById('double-tap-toggle');
    if (doubleTapToggle) {
        doubleTapToggle.addEventListener('change', function () {
            const wasEnabled = config.enableDoubleTapSeek;
            config.enableDoubleTapSeek = this.checked;

            // Initialize or remove based on new state
            if (config.enableDoubleTapSeek && !wasEnabled) {
                // If enabling, initialize
                initDoubleTapSeek();
            } else if (!config.enableDoubleTapSeek && wasEnabled) {
                // If disabling, remove event listeners and canvas
                removeDoubleTapSeek();
            }

            saveConfig();
        });
    }
    // Add Fix Preview toggle event listener
    const fixPreviewToggle = document.getElementById('fix-preview-toggle');
    if (fixPreviewToggle) {
        fixPreviewToggle.addEventListener('change', function () {
            const wasEnabled = config.enableFixPreview;
            config.enableFixPreview = this.checked;

            // Initialize or remove based on new state
            if (config.enableFixPreview && !wasEnabled) {
                // If enabling, initialize
                initFixPreview();
            } else if (!config.enableFixPreview && wasEnabled) {
                // If disabling, remove
                removeFixPreview();
            }

            saveConfig();
        });
    }

    // Add zoom disable toggle event listener
    const zoomDisableToggle = document.getElementById('zoom-disable-toggle');
    if (zoomDisableToggle) {
        zoomDisableToggle.addEventListener('change', function () {
            config.enableZoomDisable = this.checked;

            // Apply the setting
            handleZoomDisable(config.enableZoomDisable);

            saveConfig();
        });
    }

    // Session tracker toggle event listener
    const sessionTrackerToggle = document.getElementById('session-tracker-toggle');
    if (sessionTrackerToggle) {
        sessionTrackerToggle.addEventListener('change', function () {
            const wasEnabled = config.enableSessionTracker;
            config.enableSessionTracker = this.checked;

            if (config.enableSessionTracker) {
                // If enabling, reset and start the tracker
                resetSessionTracker();
                initSessionTracker();
            } else {
                // If disabling, stop the tracker and remove the display
                stopSessionTracking();
                removeSessionTimerDisplay();
            }

            saveConfig();
        });
    }

    // Add sort by rating toggle event listener
    const sortByRatingToggle = document.getElementById('sort-by-rating-toggle');
    if (sortByRatingToggle) {
        sortByRatingToggle.addEventListener('change', function () {
            config.enableSortByRating = this.checked;
            console.log("Sort by rating " + (config.enableSortByRating ? "enabled" : "disabled"));

            if (config.enableSortByRating) {
                // Initialize if needed
                initSortByRating();
            } else {
                // Remove sorting if active
                removeSortByRating();
            }

            saveConfig();
        });
    }
}

// Add the Fix Preview functionality
let fixPreviewInitialized = false;
let longPressTimer;
let isLongPress = false;
let currentVideoOverlay = null;
let touchStartY = 0;
let touchScrollTolerance = 20; // Pixels of scrolling allowed before canceling
let globalMuted = true;

// Initialize Fix Preview functionality
function initFixPreview() {
    if (fixPreviewInitialized) return;

    console.log('Initializing Fix Preview feature');

    // Only run on touch devices
    if (!isTouchDevice()) {
        console.log('Fix Preview is designed for touch devices');
        return;
    }

    // Try to load saved preferences
    try {
        // Use localStorage for persistence
        const savedMuted = localStorage.getItem('pmvHavenMuted');
        if (savedMuted !== null) {
            globalMuted = savedMuted === 'true';
            console.log('Loaded muted preference:', globalMuted);
        }
    } catch (e) {
        console.error('Error loading preferences:', e);
    }

    // Add custom styles for overlay and disable problematic site styles
    const style = document.createElement('style');
    style.id = 'fix-preview-styles';
    style.textContent = `
        /* Video overlay styles */
        .custom-video-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
            object-fit: contain;
            background-color: rgba(0, 0, 0, 0.8);
            border-radius: 12px !important;
        }

        .custom-mute-icon {
            position: absolute;
            bottom: 10px;
            right: 10px;
            color: white;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 8px;
            border-radius: 50%;
            z-index: 1005;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            touch-action: manipulation;
            outline: none !important;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -webkit-tap-highlight-color: transparent;
        }

        /* Fix text selection and highlights */
        .v-card, .v-img, .custom-mute-icon {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            -khtml-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
        }

        /* Disable Vuetify ripple effects */
        .v-ripple__container,
        .v-ripple__animation,
        .v-ripple__animation--enter,
        .v-ripple__animation--visible,
        .v-ripple__animation--in {
            display: none !important;
            opacity: 0 !important;
            transform: none !important;
            transition: none !important;
            animation: none !important;
        }

        /* Remove focus and active styles */
        *:focus,
        *:active,
        *.focus-visible,
        .v-card--active {
            outline: none !important;
            -webkit-tap-highlight-color: transparent !important;
            box-shadow: none !important;
        }

        /* Hide card overlays that cause visual effects */
        .v-card__overlay,
        .v-card__underlay {
            opacity: 0 !important;
        }
    `;

    document.head.appendChild(style);

    // Initialize our tracking variables
    touchStartedInsideVideo = false;
    activeVideoElement = null;

    // Set up event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
        isLongPress = false;
        touchStartedInsideVideo = false;
    }, { passive: true });

    // Monitor for and remove ripple effects
    const observer = new MutationObserver(mutations => {
        if (!config.enableFixPreview) return;

        for (const mutation of mutations) {
            if (mutation.addedNodes && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.classList) {  // Element node
                        // Check for ripple containers
                        if (node.classList.contains('v-ripple__container') ||
                            node.classList.contains('v-ripple__animation')) {
                            node.style.display = 'none';
                            node.style.opacity = '0';
                        }
                    }
                }
            }
        }
    });

    // Start observing for ripple effects
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Remove existing ripple containers
    removeRippleElements();

    fixPreviewInitialized = true;
    console.log('Fix Preview initialized');
}
// Remove Fix Preview functionality
function removeFixPreview() {
    if (!fixPreviewInitialized) return;

    console.log('Removing Fix Preview feature');

    // Remove event listeners
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
        isLongPress = false;
    });

    // Remove custom styles
    const style = document.getElementById('fix-preview-styles');
    if (style) {
        style.remove();
    }

    // Hide any active overlays
    hideCurrentOverlay();

    // Remove all created overlays
    document.querySelectorAll('.custom-video-overlay, .custom-mute-icon').forEach(el => {
        el.remove();
    });

    fixPreviewInitialized = false;
    console.log('Fix Preview removed');
}

// Helper function to extract video URL from a card element
function getVideoUrlFromCard(card) {
    // Try to find the video element that might already exist
    const existingVideo = card.querySelector('video');
    if (existingVideo && existingVideo.src) {
        return existingVideo.src;
    }

    // Try to get the ID from the image
    const imgElement = card.querySelector('.v-img');
    if (!imgElement || !imgElement.id) return null;

    const imageId = imgElement.id;
    const videoId = imageId.replace('img', 'vid');

    // Find the video in the document
    const videoElement = document.getElementById(videoId);
    if (videoElement && videoElement.src) {
        return videoElement.src;
    }

    // If we can't find the video, try to construct the URL based on patterns from the page
    const imgSrc = card.querySelector('.v-img__img')?.src;
    if (imgSrc) {
        // Try to derive the video URL from image URL pattern
        return imgSrc.replace(/webp\d+_(.+)\.webp$/, 'videoPreview/comus_$1.mp4');
    }

    return null;
}

// Update mute icon display
function updateMuteIcon(muteIcon, isMuted) {
    if (!muteIcon) return;

    muteIcon.innerHTML = isMuted ?
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"/></svg>' :
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/></svg>';
}

// Save mute preference
function saveMutePreference(isMuted) {
    try {
        localStorage.setItem('pmvHavenMuted', isMuted.toString());
        console.log('Saved muted preference:', isMuted);
    } catch (e) {
        console.error('Error saving preference:', e);
    }
}

// Create video overlay for a given image container
function createVideoOverlay(imgContainer, videoUrl) {
    if (!videoUrl) return null;

    // Check if overlay already exists
    let existing = imgContainer.querySelector('.custom-video-overlay');
    if (existing) return existing;

    // Create video element
    const video = document.createElement('video');
    video.src = videoUrl;
    video.className = 'custom-video-overlay';
    video.loop = true;
    video.playsInline = true;
    video.style.display = 'none'; // Hidden by default

    // Set volume and mute state
    video.volume = 0.3; // 30% volume
    video.muted = globalMuted;

    // Create mute icon
    const muteIcon = document.createElement('div');
    muteIcon.className = 'custom-mute-icon';
    updateMuteIcon(muteIcon, globalMuted);
    muteIcon.style.display = 'none'; // Hidden by default

    // Add them to the container
    imgContainer.appendChild(video);
    imgContainer.appendChild(muteIcon);

    // Add tap handlers for mute/unmute with enhanced touchability
    const handleMuteToggle = (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        e.stopPropagation();

        // Toggle mute state
        globalMuted = !globalMuted;
        video.muted = globalMuted;

        // Update icon
        updateMuteIcon(muteIcon, globalMuted);

        // Save preference
        saveMutePreference(globalMuted);

        // Remove any focus
        document.activeElement.blur();

        // Remove any ripple effects immediately
        setTimeout(() => {
            document.querySelectorAll('.v-ripple__animation').forEach(ripple => {
                ripple.style.display = 'none';
                ripple.style.opacity = '0';
                if (ripple.parentNode && ripple.parentNode.classList.contains('v-ripple__container')) {
                    ripple.parentNode.style.display = 'none';
                }
            });
        }, 0);
    };

    // Add both click and touch events for better responsiveness
    muteIcon.addEventListener('click', handleMuteToggle);
    muteIcon.addEventListener('touchend', handleMuteToggle, { passive: false });

    return video;
}

// Stop and hide any currently playing video overlay
function hideCurrentOverlay() {
    if (currentVideoOverlay) {
        currentVideoOverlay.pause();
        currentVideoOverlay.style.display = 'none';

        // Find and hide the mute icon
        const container = currentVideoOverlay.parentElement;
        const muteIcon = container.querySelector('.custom-mute-icon');
        if (muteIcon) {
            muteIcon.style.display = 'none';
        }

        currentVideoOverlay = null;
    }
}

// Handle touch start - potential start of long press
let touchStartedInsideVideo = false;
let activeVideoElement = null;


// Modify the handleTouchStart function
function handleTouchStart(e) {
    if (!config.enableFixPreview) return;

    // Record initial touch position for scroll tolerance
    if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
    }

    // Check if we're interacting with a video card
    const imgContainer = e.target.closest('.v-img');
    if (!imgContainer) {
        touchStartedInsideVideo = false;
        lastTouchedCard = null;
        return;
    }

    // Flag that touch started inside video
    touchStartedInsideVideo = true;

    // Store reference to the touched card
    lastTouchedCard = imgContainer;

    // Find the card container
    const card = imgContainer.closest('.v-card');
    if (!card) {
        touchStartedInsideVideo = false;
        lastTouchedCard = null;
        return;
    }

    // If we clicked directly on the mute icon of a playing video, don't do anything
    if (e.target.closest('.custom-mute-icon') && currentVideoOverlay) {
        return;
    }

    // Check if the current touch is on the same video that's already playing
    const touchingCurrentVideo = currentVideoOverlay && currentVideoOverlay.parentElement === imgContainer;

    // If we're touching the same video that's already playing, allow scrolling without long press
    if (touchingCurrentVideo) {
        return;
    }

    // Clear existing timer
    clearTimeout(longPressTimer);
    isLongPress = false;

    // Start timing for long press
    longPressTimer = setTimeout(() => {
        isLongPress = true;

        // Get video URL
        const videoUrl = getVideoUrlFromCard(card);
        if (!videoUrl) {
            console.log('Could not find video URL for card');
            return;
        }

        // Hide any currently playing overlay
        hideCurrentOverlay();

        // Create and play the new overlay
        const videoOverlay = createVideoOverlay(imgContainer, videoUrl);
        if (videoOverlay) {
            // Store reference to current active video
            activeVideoElement = videoOverlay;

            // Make sure volume and mute settings are applied before playing
            videoOverlay.volume = 0.3;
            videoOverlay.muted = globalMuted;

            videoOverlay.style.display = 'block';
            videoOverlay.currentTime = 0;

            // Play the video
            const playPromise = videoOverlay.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.error('Error playing video:', err);
                    // If autoplay was prevented, try one more time with user interaction
                    setTimeout(() => {
                        videoOverlay.play().catch(e => console.error('Second play attempt failed:', e));
                    }, 100);
                });
            }

            // Show mute icon
            const muteIcon = imgContainer.querySelector('.custom-mute-icon');
            if (muteIcon) {
                muteIcon.style.display = 'flex';
                updateMuteIcon(muteIcon, globalMuted);
            }

            currentVideoOverlay = videoOverlay;
        }
    }, 300); // Reduced long press threshold to 300ms as you mentioned
}


// Handle touch end
function handleTouchEnd(e) {
    if (!config.enableFixPreview) return;

    // Clear the long press timer
    clearTimeout(longPressTimer);

    // If this was a long press, prevent navigation
    if (isLongPress) {
        // Only call preventDefault if the event is cancelable
        if (e.cancelable) {
            e.preventDefault();
        }
        e.stopPropagation();

        // Prevent the next click using capture
        const preventNextClick = function (clickEvent) {
            clickEvent.stopPropagation();
            if (clickEvent.cancelable) {
                clickEvent.preventDefault();
            }
            document.removeEventListener('click', preventNextClick, true);
        };

        document.addEventListener('click', preventNextClick, true);
    } else {
        // If it was a short tap and not on a mute button or a video container
        // Let's check if this is a new tap on a different element while a video is playing
        if (!e.target.closest('.custom-mute-icon')) {
            // We want to only close the video if the tap ends outside the current video container
            const tappedOnCurrentVideoContainer = currentVideoOverlay &&
                (e.target === currentVideoOverlay.parentElement ||
                    e.target.closest('.v-img') === currentVideoOverlay.parentElement);

            // If we're not tapping on the current video container, hide the video
            if (!tappedOnCurrentVideoContainer) {
                hideCurrentOverlay();
            }
        }
    }

    // Reset flags
    isLongPress = false;
    touchStartedInsideVideo = false;
}

// Handle touch move - allow some scrolling tolerance
function handleTouchMove(e) {
    if (!config.enableFixPreview) return;

    // If the initial touch wasn't inside a video, ignore subsequent moves
    if (!touchStartedInsideVideo) return;

    // If we already triggered the long press, don't cancel
    if (isLongPress) return;

    // Check if the current touch started on the same video that's already playing
    const touchingCurrentVideo = currentVideoOverlay &&
        lastTouchedCard === currentVideoOverlay.parentElement;

    // If we're touching the current playing video, allow scrolling without canceling
    if (touchingCurrentVideo) return;

    // Check if we've exceeded our scroll tolerance
    if (e.touches && e.touches[0]) {
        const touchCurrentY = e.touches[0].clientY;
        const touchDelta = Math.abs(touchCurrentY - touchStartY);

        // Only cancel if scrolled more than our tolerance
        if (touchDelta > touchScrollTolerance) {
            clearTimeout(longPressTimer);
            isLongPress = false;
        }
    } else {
        // If can't measure touch position, use old behavior
        clearTimeout(longPressTimer);
        isLongPress = false;
    }
}


// Remove ripple elements
function removeRippleElements() {
    if (!config.enableFixPreview) return;

    // Remove existing ripple containers
    document.querySelectorAll('.v-ripple__container, .v-ripple__animation').forEach(el => {
        el.style.display = 'none';
        el.style.opacity = '0';
    });

    // Try again after a delay
    setTimeout(removeRippleElements, 1000);
}

let sortRatingObserver = null;
let lastSortedCount = 0;
let isSorting = false;
let sortingInitialized = false;

function isSearchPage() {
    return isSearchPageUrl(window.location.href);
}

function initSortByRating() {
    if (!isSearchPage()) {
        console.log("Sort by Rating only works on search pages");
        return;
    }

    if (sortingInitialized) return;

    console.log("Initializing Sort by Rating feature");

    // Apply styles to hide videos initially
    applySortingStyles();

    // Immediately hide all existing containers on initial load
    document.querySelectorAll(
        '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
        '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
    ).forEach(container => {
        container.classList.remove('pmv-containers-ready');
    });

    // Do initial sort
    setTimeout(sortVideosByRating, 500);

    // Setup observer to detect new videos loading
    setupSortingObserver();

    // Add scroll event listener for infinite scrolling
    window.addEventListener('scroll', debouncedSortCheck);

    // Setup resize handling
    setupResizeHandling();

    // Start monitoring URL changes
    currentSortUrl = window.location.href;
    monitorUrlForSorting();

    sortingInitialized = true;
}

window.addEventListener('load', function () {
    if (config.enableSortByRating && isSearchPage()) {
        // Hide containers immediately on page load of search pages
        document.querySelectorAll(
            '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
            '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
        ).forEach(container => {
            container.classList.remove('pmv-containers-ready');
        });

        // Initialize or reinitialize sorting
        setTimeout(function () {
            // If already initialized, just re-sort
            if (sortingInitialized) {
                sortVideosByRating();
            } else {
                // Otherwise, fully initialize
                initSortByRating();
            }
        }, 300);
    }
});
// Simple solution: Completely disable the sorting effects during resize
// Simplified resize handling to fix visibility issues
function setupResizeHandling() {
    let resizeTimer;

    window.addEventListener('resize', function () {
        // Clear the previous timeout
        clearTimeout(resizeTimer);

        // If we're not on a search page or sorting is disabled, do nothing
        if (!config.enableSortByRating || !isSearchPage()) return;

        // Get all video containers
        const containers = document.querySelectorAll(
            '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
            '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
        );

        // Make all containers visible
        containers.forEach(container => {
            container.style.opacity = '1';
        });

        // Set a timeout to restore normal operation after resize completes
        resizeTimer = setTimeout(function () {
            // Remove direct styles
            containers.forEach(container => {
                container.style.opacity = '';
                container.classList.add('pmv-containers-ready');
            });
        }, 500);
    });
}

function removeSortByRating() {
    if (!sortingInitialized) return;

    console.log("Removing Sort by Rating feature");

    // Disconnect the observer
    if (sortRatingObserver) {
        sortRatingObserver.disconnect();
        sortRatingObserver = null;
    }

    // Remove scroll event listener
    window.removeEventListener('scroll', debouncedSortCheck);

    // Remove the styling
    const sortingStyle = document.getElementById('pmvhaven-sort-styles');
    if (sortingStyle) {
        sortingStyle.remove();
    }

    // Show all containers that might be hidden
    document.querySelectorAll(
        '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
        '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
    ).forEach(container => {
        container.classList.add('pmv-containers-ready');
    });

    sortingInitialized = false;
    lastSortedCount = 0;
}

function applySortingStyles() {
    // Add CSS for hiding video containers initially
    if (!document.getElementById('pmvhaven-sort-styles')) {
        const style = document.createElement('style');
        style.id = 'pmvhaven-sort-styles';
        style.textContent = `
            .v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12,
            .v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12 {
                opacity: 0;
                transition: opacity 0.3s ease-in;
            }
            .pmv-containers-ready {
                opacity: 1 !important;
            }
        `;
        document.head.appendChild(style);
    }
}

function sortVideosByRating() {
    // Don't sort if feature is disabled
    if (!config.enableSortByRating) {
        console.log("Sort by rating is disabled");
        return;
    }

    // Then check if we're on a search page
    if (!isSearchPage()) {
        console.log("Not on a search page, not sorting");
        return;
    }

    // Prevent concurrent sorting operations
    if (isSorting) return;

    isSorting = true;
    console.log("Sorting videos by rating...");

    // Get all video container elements - support both mobile and desktop layouts
    const videoContainers = document.querySelectorAll(
        '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
        '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
    );

    if (videoContainers.length === 0) {
        isSorting = false;
        return;
    }

    // If we haven't added many new videos, don't bother resorting
    if (videoContainers.length <= lastSortedCount + 3 && lastSortedCount > 0) {
        isSorting = false;
        return;
    }

    // Create an array to store video containers with their ratings
    const videosWithRatings = [];

    // Extract ratings and store with container reference
    videoContainers.forEach((container, index) => {
        // Try multiple approaches to find the rating element
        // Approach 1: Check for paragraphs with star icon in responsive content
        const paragraphs = container.querySelectorAll('.v-responsive__content p');
        let ratingElement = null;

        paragraphs.forEach(p => {
            if (p.innerHTML.includes('mdi-star') || p.innerHTML.includes('fa-star')) {
                ratingElement = p;
            }
        });

        // Approach 2: Look for orange-colored text about ratings
        if (!ratingElement) {
            ratingElement = container.querySelector('p[style*="color: orange"][style*="bottom: 3px"]');
        }

        // Approach 3: Look for any element with mdi-star class
        if (!ratingElement) {
            const starIcon = container.querySelector('.mdi-star');
            if (starIcon && starIcon.parentElement) {
                ratingElement = starIcon.parentElement;
            }
        }

        if (ratingElement) {
            // Get the text content
            const ratingHTML = ratingElement.innerHTML;
            const ratingText = ratingElement.textContent.trim();
            let rating = 0;

            // Try different patterns to extract the rating
            // Pattern 1: Extract from text content (e.g. "4.7 / 5" or "0 / 5")
            let ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);

            if (ratingMatch && ratingMatch[1]) {
                rating = parseFloat(ratingMatch[1]);
            } else {
                // Pattern 2: Extract number after the icon closing tag
                ratingMatch = ratingHTML.match(/<\/i>([0-9]+(?:\.[0-9]+)?)/);

                if (ratingMatch && ratingMatch[1]) {
                    rating = parseFloat(ratingMatch[1]);
                } else {
                    // Pattern 3: Extract any decimal number as a fallback
                    ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);

                    if (ratingMatch && ratingMatch[1]) {
                        rating = parseFloat(ratingMatch[1]);
                    }
                }
            }

            // Always include the video, even with rating 0
            videosWithRatings.push({
                container: container,
                rating: rating,
                index: index
            });
        }
    });

    // Sort by rating (highest first, but 0 ratings at the bottom)
    videosWithRatings.sort((a, b) => {
        // Special handling for 0 ratings - they should always be at the bottom
        if (a.rating === 0 && b.rating === 0) return 0; // Both 0, keep original order
        if (a.rating === 0) return 1; // A is 0, put it after B
        if (b.rating === 0) return -1; // B is 0, put it after A

        // Normal comparison for non-zero ratings (highest first)
        return b.rating - a.rating;
    });

    // Get the parent container where all videos are displayed
    if (videosWithRatings.length > 0) {
        const parentContainer = videoContainers[0].parentNode;

        // Reinsert the containers in sorted order
        videosWithRatings.forEach(item => {
            parentContainer.appendChild(item.container);

            // Make sure the containers are visible
            item.container.classList.add('pmv-containers-ready');
        });

        // Update our count of sorted videos
        lastSortedCount = videoContainers.length;

        if (config.debug) {
            console.log(`Sorted ${videoContainers.length} videos by rating`);
        }
    }

    // Reset sorting flag
    isSorting = false;
}

let currentSortUrl = window.location.href;

function isSearchPageUrl(url) {
    return url.startsWith('https://pmvhaven.com/search/');
}

// Add this function to monitor URL changes
function monitorUrlForSorting() {
    // If URL changed, we need to handle the change
    if (currentSortUrl !== window.location.href) {
        const wasSearchPage = isSearchPageUrl(currentSortUrl);
        const isNowSearchPage = isSearchPageUrl(window.location.href);

        // Store the new URL
        currentSortUrl = window.location.href;

        if (config.debug) {
            console.log('URL changed to:', currentSortUrl,
                'Was search:', wasSearchPage,
                'Is now search:', isNowSearchPage);
        }

        // Case 1: Navigated FROM search page TO non-search page
        if (wasSearchPage && !isNowSearchPage) {
            // Make all videos visible
            document.querySelectorAll(
                '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
                '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
            ).forEach(container => {
                container.classList.add('pmv-containers-ready');
            });
        }
        // Case 2: Navigated FROM non-search page TO search page
        else if (!wasSearchPage && isNowSearchPage && config.enableSortByRating) {
            // If we weren't initialized before, initialize now
            if (!sortingInitialized) {
                initSortByRating();
            } else {
                // Reset sorting state
                lastSortedCount = 0;

                // Apply styles again
                applySortingStyles();

                // Hide all current containers
                document.querySelectorAll(
                    '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
                    '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
                ).forEach(container => {
                    container.classList.remove('pmv-containers-ready');
                });

                // Trigger sorting
                setTimeout(sortVideosByRating, 1000);
            }
        }
        // Case 3: Navigated between search pages
        else if (wasSearchPage && isNowSearchPage && config.enableSortByRating) {
            // Reset sorting state
            lastSortedCount = 0;

            // Hide all current containers
            document.querySelectorAll(
                '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
                '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
            ).forEach(container => {
                container.classList.remove('pmv-containers-ready');
            });

            // Trigger sorting
            setTimeout(sortVideosByRating, 1000);
        }
    }

    // Continue checking for URL changes
    requestAnimationFrame(monitorUrlForSorting);
}

function setupSortingObserver() {
    // Create a mutation observer to detect when new videos are loaded
    sortRatingObserver = new MutationObserver((mutations) => {
        if (!config.enableSortByRating || !isSearchPage()) return;

        let shouldResort = false;

        mutations.forEach(mutation => {
            // Check if nodes were added
            if (mutation.addedNodes.length > 0) {
                // Check if any added nodes are video containers or contain them
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (isOrContainsVideoContainer(node)) {
                        shouldResort = true;
                        break;
                    }
                }
            }
        });

        if (shouldResort) {
            // Use the debounced version to prevent rapid consecutive sorts
            debouncedSort();
        }
    });

    // Start observing the document body for changes
    sortRatingObserver.observe(document.body, { childList: true, subtree: true });
}

// Function to determine if an element is a video container
function isVideoContainer(node) {
    if (node.nodeType !== 1) return false; // Not an element node

    // Check if this is a video container - support both mobile and desktop layouts
    return node.classList &&
        node.classList.contains('v-col-sm-6') &&
        node.classList.contains('v-col-md-4') &&
        (node.classList.contains('v-col-lg-4') || node.classList.contains('v-col-lg-2'));
}

// Function to determine if an element is a video container or contains video containers
function isOrContainsVideoContainer(node) {
    if (node.nodeType !== 1) return false; // Not an element node

    // Check if this is a video container
    if (isVideoContainer(node)) {
        return true;
    }

    // Check if it contains video containers
    if (node.querySelectorAll) {
        return node.querySelectorAll(
            '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
            '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
        ).length > 0;
    }

    return false;
}

// Debounced version of the sort function
const debouncedSort = debounce(sortVideosByRating, 1000);

// Check if we need to sort after scrolling
function checkForNewVideosAfterScroll() {
    if (!config.enableSortByRating || !isSearchPage()) return;

    const currentCount = document.querySelectorAll(
        '.v-col-sm-6.v-col-md-4.v-col-lg-4.v-col-12, ' +
        '.v-col-sm-6.v-col-md-4.v-col-lg-2.v-col-12'
    ).length;

    if (currentCount > lastSortedCount) {
        sortVideosByRating();
    }
}

// Debounced version of the scroll check
const debouncedSortCheck = debounce(checkForNewVideosAfterScroll, 500);

// GIF menu
function renderGifMenu() {
    const panel = document.getElementById('video-effects-control');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = `
        ${createTitleBar('GIF Creator')}
        
        <div id="gif-status-display" style="margin: 5px 0; text-align: center;">
            Adjust settings and create GIF
        </div>
        
        <div id="gif-preview-container" style="margin: 10px 0; text-align: center;">
            <!-- GIF preview will appear here -->
        </div>
        
        <div id="gif-menu">
            <div class="slider-row">
                <span class="slider-label">Quality</span>
                <input type="range" id="gif-quality-slider" class="slider"
                    min="5" max="30" step="5" value="${gifConfig.quality}" direction="rtl">
                <span id="gif-quality-value" class="value">${gifConfig.quality === 5 ? 'High' : gifConfig.quality === 15 ? 'Med' : 'Low'}</span>
            </div>
            
            <div class="slider-row">
                <span class="slider-label">Duration</span>
                <input type="range" id="gif-duration-slider" class="slider"
                    min="1" max="10" step="1" value="${gifConfig.duration}">
                <span id="gif-duration-value" class="value">${gifConfig.duration}s</span>
            </div>
            
            <div class="slider-row">
                <span class="slider-label">FPS</span>
                <input type="range" id="gif-fps-slider" class="slider"
                    min="5" max="60" step="1" value="${gifConfig.fps}">
                <span id="gif-fps-value" class="value">${gifConfig.fps}</span>
            </div>
            
            <div class="slider-row">
                <span class="slider-label">Size</span>
                <input type="range" id="gif-size-slider" class="slider"
                    min="0" max="3" step="1" value="${gifConfig.sizePreset}">
                <span id="gif-size-value" class="value">${getSizePresetLabel(gifConfig.sizePreset)}</span>
            </div>
            
            <button id="create-gif-button" class="menu-button create-button">
                Create GIF
            </button>
        </div>
        
        ${createBackButton()}
    `;

    // Add custom CSS for the create button if not already added
    ensureGifButtonStyles();

    setupGifSliders();
    setupBackButton();
    setupMinimizeButton(panel);
    makeDraggable(panel);
}

// Ensure GIF button styles are added
function ensureGifButtonStyles() {
    if (!document.getElementById('gif-button-styles')) {
        const style = document.createElement('style');
        style.id = 'gif-button-styles';
        style.textContent = `
            .create-button {
                background-color: rgba(0, 220, 0, 0.3);
                margin-top: 10px;
            }
            .create-button:hover {
                background-color: rgba(0, 200, 0, 0.568);
            }
            .download-button {
                background-color: rgba(0, 220, 0, 0.3);
                margin: 10px auto;
                width: calc(100% - 20px);
                text-decoration: none !important;
                display: inline-block;
                text-align: center;
            }
            .download-button:hover {
                background-color: rgba(0, 200, 0, 0.568);
                text-decoration: none !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Set up GIF slider event listeners
function setupGifSliders() {
    // Style the quality slider to display high on right
    const qualitySlider = document.getElementById('gif-quality-slider');
    if (qualitySlider) {
        qualitySlider.style.direction = 'rtl';
    }

    // Add event listeners for sliders with auto-save
    document.getElementById('gif-quality-slider').addEventListener('input', function () {
        gifConfig.quality = parseInt(this.value);
        const qualityText = gifConfig.quality === 5 ? 'High' : gifConfig.quality === 15 ? 'Med' : 'Low';
        document.getElementById('gif-quality-value').textContent = qualityText;
        saveGifSettings();
    });

    document.getElementById('gif-duration-slider').addEventListener('input', function () {
        gifConfig.duration = parseInt(this.value);
        document.getElementById('gif-duration-value').textContent = gifConfig.duration + 's';
        saveGifSettings();
    });

    document.getElementById('gif-fps-slider').addEventListener('input', function () {
        gifConfig.fps = parseInt(this.value);
        document.getElementById('gif-fps-value').textContent = gifConfig.fps;
        saveGifSettings();
    });

    document.getElementById('gif-size-slider').addEventListener('input', function () {
        gifConfig.sizePreset = parseInt(this.value);
        document.getElementById('gif-size-value').textContent = getSizePresetLabel(gifConfig.sizePreset);
        saveGifSettings();
    });

    // Add create GIF button listener
    document.getElementById('create-gif-button').addEventListener('click', function () {
        createGifFromCurrentPosition();
    });
}

// Helper function to add CSS once
function injectMenuStyles() {
    if (document.getElementById('pmvhaven-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'pmvhaven-menu-styles';
    style.textContent = `
      /* Common styles for all menus */
      
      .session-timer {
        font-size: 0.85em;
        opacity: 0.8;
        font-weight: normal;
      }
      
      
      .slider-row {
        display: flex;
        align-items: center;
        margin: 10px 0;
        padding: 5px;
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 4px;
      }
      
      .slider-label {
        flex: 0 0 80px;
      }
      
      .slider {
        flex: 1;
        margin: 0 10px;
      }
      
      .value {
        flex: 0 0 40px;
        text-align: right;
      }
      
      .section-title {
        background-color: rgba(97, 0, 0, 0.3);
        padding: 5px;
        margin: 10px 0 5px 0;
        border-radius: 4px;
        text-align: center;
        font-weight: bold;
      }
      
      /* Toggle switch styles */
      .toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 10px 0;
        padding: 5px 10px;
        border-radius: 4px;
        background-color: rgba(0, 0, 0, 0.1);
      }
      
      .toggle-label {
        flex-grow: 1;
        margin-right: 10px;
      }
      
      .toggle-switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
      }
      
      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #525252;
        transition: .4s;
        border-radius: 24px;
      }
      
      .toggle-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      
      input:checked + .toggle-slider {
        background-color: rgba(0, 240, 0, 0.6);
      }
      
      input:checked + .toggle-slider:before {
        transform: translateX(26px);
      }
      
      .toggle-switch.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .toggle-switch.disabled .toggle-slider {
        cursor: not-allowed;
      }
    `;

    document.head.appendChild(style);
}


// Create the control panel
function createControlPanel() {

    console.log("Creating control panel");

    // Check if control panel already exists
    if (document.getElementById('video-effects-control')) {
        console.log("Control panel already exists");
        return;
    }

    // Create panel container
    const panel = document.createElement('div');
    panel.id = 'video-effects-control';

    // Add essential styling
    panel.style.cssText = `
        position: fixed;
        width: 300px;
        background-color: rgba(0, 0, 0, 0.85);
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        z-index: 999991;
        transition: opacity 0.3s, transform 0.3s;
        font-family: Arial, sans-serif;
        padding: 0;
        overflow: hidden;
        top: 100px;
        left: 100px;
        display: block;
        opacity: ${config.controlPanelVisible ? '1' : '0'};
        transform: ${config.controlPanelVisible ? 'scale(1)' : 'scale(0.8)'};
    `;

    document.body.appendChild(panel);
    console.log("Control panel added to document");

    // Apply custom position if it exists
    if (config.customPosition) {
        panel.style.top = config.customPosition.top + 'px';
        panel.style.left = config.customPosition.left + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    // Render the initial menu
    console.log("Rendering main menu");
    injectMenuStyles();
    renderMainMenu();
}

// Create the always visible "Show" button
function createShowButton() {
    // Check if button already exists
    if (document.getElementById('show-video-effects')) {
        return;
    }

    console.log("Creating show button");

    const button = document.createElement('div');
    button.id = 'show-video-effects';
    button.textContent = '✨';
    button.title = 'Toggle Video Effects Panel';

    // Add basic styling to ensure it's visible
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 99999;
        font-size: 20px;
        text-align: center;
    `;

    // Add event listener to toggle the control panel
    button.addEventListener('click', function () {
        console.log("Show button clicked");

        // If panel doesn't exist, create it and make sure it's visible
        if (!document.getElementById('video-effects-control')) {
            console.log("Creating control panel");
            config.controlPanelVisible = true;
            saveConfig();
            createControlPanel();

            // Make sure the panel is visible
            const panel = document.getElementById('video-effects-control');
            if (panel) {
                panel.style.display = 'block';
                panel.style.opacity = '1';
                panel.style.transform = 'scale(1)';
            }
        } else {
            // Toggle the panel visibility
            const panel = document.getElementById('video-effects-control');
            console.log("Panel exists, toggling visibility. Current opacity:", panel.style.opacity);

            // If panel is hidden or specified as hidden in config, show it
            if (panel.style.opacity !== '1' || !config.controlPanelVisible) {
                console.log("Showing panel");
                config.controlPanelVisible = true;
                panel.style.display = 'block';

                // Allow display:block to take effect
                setTimeout(() => {
                    panel.style.opacity = '1';
                    panel.style.transform = 'scale(1)';
                    // Make sure we have menu content
                    if (!panel.innerHTML || panel.innerHTML.trim() === '') {
                        renderMainMenu();
                    }
                }, 10);
            } else {
                // If panel is visible, hide it
                console.log("Hiding panel");
                config.controlPanelVisible = false;
                panel.style.opacity = '0';
                panel.style.transform = 'scale(0.8)';

                // Hide after transition completes
                setTimeout(() => {
                    if (!config.controlPanelVisible) {
                        panel.style.display = 'none';
                    }
                }, 300);
            }

            saveConfig();
        }
    });

    document.body.appendChild(button);
    console.log("Show button added to document");
}

/**************************************
 * 4. SESSION TRACKER FUNCTIONS
 **************************************/

// Initialize session tracker
function initSessionTracker() {
    if (config.enableSessionTracker) {
        // Start a new session if we don't have one
        if (!config.sessionStartTime) {
            resetSessionTracker();
        } else {
            // Check if we need to reset based on elapsed time
            const now = new Date();
            const startTime = new Date(config.sessionStartTime);
            const elapsed = now - startTime;

            if (elapsed >= SESSION_RESET_THRESHOLD) {
                resetSessionTracker();
            }
        }

        // Set up activity listeners
        setupSessionActivityListeners();

        // Start the tracking loop
        startSessionTracking();
    } else {
        // If disabled, clear any existing interval
        stopSessionTracking();
    }
}

// Stop session tracking
function stopSessionTracking() {
    if (config.sessionTimerInterval) {
        clearInterval(config.sessionTimerInterval);
        config.sessionTimerInterval = null;
    }

    // Remove activity listeners
    removeSessionActivityListeners();
}

// Reset session data
function resetSessionTracker() {
    config.sessionStartTime = new Date().toISOString();
    config.lastActivityTime = new Date().toISOString();
    config.isSessionActive = true;
    saveConfig();
}

// Set up event listeners for user activity
function setupSessionActivityListeners() {
    // Skip if already set up
    if (window.sessionListenersActive) return;

    const activityEvents = ['mousedown', 'keydown', 'mousemove', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(eventType => {
        document.addEventListener(eventType, handleSessionUserActivity, { passive: true });
    });

    // Track visibility changes
    document.addEventListener('visibilitychange', handleSessionVisibilityChange);

    // Mark listeners as active
    window.sessionListenersActive = true;
}

// Remove session activity listeners
function removeSessionActivityListeners() {
    if (!window.sessionListenersActive) return;

    const activityEvents = ['mousedown', 'keydown', 'mousemove', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(eventType => {
        document.removeEventListener(eventType, handleSessionUserActivity);
    });

    // Remove visibility listener
    document.removeEventListener('visibilitychange', handleSessionVisibilityChange);

    // Mark listeners as inactive
    window.sessionListenersActive = false;
}

// Handle user activity
function handleSessionUserActivity() {
    if (!config.enableSessionTracker) return;

    config.lastActivityTime = new Date().toISOString();

    if (!config.isSessionActive) {
        config.isSessionActive = true;
    }

    saveConfig();
}

// Handle visibility change events
function handleSessionVisibilityChange() {
    if (!config.enableSessionTracker) return;

    if (document.hidden) {
        config.isSessionActive = false;
    } else {
        config.isSessionActive = true;
        config.lastActivityTime = new Date().toISOString();
    }

    saveConfig();
}

// Start the tracking loop
function startSessionTracking() {
    // Clear any existing interval first
    stopSessionTracking();

    // Create a new interval
    config.sessionTimerInterval = setInterval(function () {
        // Check if we need to reset the session (15 minute inactivity)
        const now = new Date();
        const lastActivity = new Date(config.lastActivityTime);
        const inactivityTime = now - lastActivity;

        if (inactivityTime >= SESSION_INACTIVITY_THRESHOLD) {
            config.isSessionActive = false;
        }

        // Check if we need to reset the session (15 minute session length)
        const startTime = new Date(config.sessionStartTime);
        const sessionLength = now - startTime;

        if (sessionLength >= SESSION_RESET_THRESHOLD) {
            resetSessionTracker();
        }

        // Update the timer display
        updateSessionTimerDisplay();

        saveConfig();
    }, SESSION_UPDATE_INTERVAL);
}

// Update timer display in the panel title
function updateSessionTimerDisplay() {
    if (!config.enableSessionTracker) return;

    // Get the title element
    const titleElement = document.querySelector('#video-effects-control .title-bar div:first-child');
    if (!titleElement) return;

    // Don't modify other menu titles - only apply to main menu
    if (!titleElement.innerHTML.includes('PMVHaven Enhancer')) return;

    // Calculate elapsed time
    const now = new Date();
    const startTime = new Date(config.sessionStartTime);
    const elapsed = now - startTime;

    // Format the duration
    const formattedDuration = formatSessionDuration(elapsed);

    // Update the title text
    if (!titleElement.innerHTML.includes('<span class="session-timer">')) {
        titleElement.innerHTML = `<b>PMVHaven Enhancer</b> <span class="session-timer">(${formattedDuration})</span>`;
    } else {
        // Just update the timer part
        const timerSpan = titleElement.querySelector('.session-timer');
        if (timerSpan) {
            timerSpan.textContent = `(${formattedDuration})`;
        }
    }
}

// Remove timer display from the panel title
function removeSessionTimerDisplay() {
    const titleElement = document.querySelector('#video-effects-control .title-bar div:first-child');
    if (!titleElement) return;

    // Don't modify other menu titles - only apply to main menu
    if (!titleElement.innerHTML.includes('PMVHaven Enhancer')) return;

    // Reset the title text
    titleElement.innerHTML = '<b>PMVHaven Enhancer</b>';
}

// Format duration in milliseconds to YouTube-style format
function formatSessionDuration(duration) {
    const seconds = Math.floor(duration / 1000) % 60;
    const minutes = Math.floor(duration / (1000 * 60)) % 60;
    const hours = Math.floor(duration / (1000 * 60 * 60));

    // Format hours, but only show if there are hours
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // No hours, just show minutes:seconds
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**************************************
 * 5. UTILITY FUNCTIONS
 **************************************/
function createDoubleTapCanvas() {
    // Create canvas element
    doubleTapCanvas = document.createElement('canvas');
    doubleTapCanvas.id = 'double-tap-canvas';
    doubleTapCanvas.style.cssText = `
        position: absolute;
        pointer-events: auto;
        z-index: 999990;
        background-color: transparent;
    `;

    // Add the canvas to the page
    document.body.appendChild(doubleTapCanvas);

    // Add touch event listeners to canvas - now including touchmove
    doubleTapCanvas.addEventListener('touchstart', handleDoubleTapTouch, { passive: true });
    doubleTapCanvas.addEventListener('touchmove', handleDoubleTapTouch, { passive: false });
    doubleTapCanvas.addEventListener('touchend', handleDoubleTapTouch, { passive: false });
}

// Update the lastTap object to include start position for scroll detection
lastTap = {
    time: 0,
    x: 0,
    y: 0,
    startX: 0, // New property to track touch start for scroll detection
    startY: 0  // New property to track touch start for scroll detection
};

function handleDoubleTapTouch(event) {
    // Get touch information
    const touch = event.touches[0] || event.changedTouches[0];
    const touchY = touch.clientY;
    const touchX = touch.clientX;
    const videoRect = doubleTapVideoElement.getBoundingClientRect();

    // Consider the bottom 25% of the video to be the control area
    const controlAreaThreshold = videoRect.height * 0.75;
    const isInControlArea = (touchY - videoRect.top) > controlAreaThreshold;

    // If touch is in control area, let it pass through to video controls
    if (isInControlArea) {
        doubleTapCanvas.style.pointerEvents = 'none';

        // Re-enable canvas after a short delay
        setTimeout(() => {
            if (doubleTapCanvas) {
                doubleTapCanvas.style.pointerEvents = 'auto';
            }
        }, 1000); // Allow enough time to interact with controls

        return; // Don't preventDefault, let event pass through
    }

    // NEW SCROLL DETECTION CODE
    // For touchstart events, just record the initial position but don't prevent default
    if (event.type === 'touchstart') {
        // Store initial Y position for scroll detection
        lastTap.startY = touchY;
        lastTap.startX = touchX;
        return; // Allow event to continue for potential scrolling
    }

    // For touchmove events, we need to detect if this is a scroll vs a tap
    if (event.type === 'touchmove') {
        // Calculate vertical movement
        const deltaY = Math.abs(touchY - lastTap.startY);
        const deltaX = Math.abs(touchX - lastTap.startX);

        // If moved more than threshold, this is a scroll, not a tap
        if (deltaY > 10 || deltaX > 10) {
            // Don't interfere with scroll
            return;
        }

        // If it's a small movement but not clearly a scroll yet, prevent default
        // to avoid both scrolling and tapping
        event.preventDefault();
        return;
    }

    // For touchend events, continue with double-tap detection
    if (event.type === 'touchend') {
        // Calculate movement to confirm this was a tap, not a scroll
        const deltaY = Math.abs(touchY - lastTap.startY);
        const deltaX = Math.abs(touchX - lastTap.startX);

        // If moved too much, this was a scroll attempt, not a tap
        if (deltaY > 10 || deltaX > 10) {
            return; // Let scroll happen naturally
        }

        // This was a tap (not a scroll), so we can safely prevent default
        event.preventDefault();
        event.stopPropagation();

        const currentTime = new Date().getTime();

        // Check if it's a double tap
        const isDoubleTap = (
            currentTime - lastTap.time < config.doubleTapThreshold &&
            Math.abs(touchX - lastTap.x) < 40 &&
            Math.abs(touchY - lastTap.y) < 40
        );

        if (isDoubleTap) {
            // This is a double tap
            const canvasWidth = doubleTapCanvas.width;
            const relativeX = touchX - doubleTapCanvas.getBoundingClientRect().left;
            const tapSide = relativeX < canvasWidth / 2 ? 'left' : 'right';

            // Process the skip
            if (tapSide === 'left') {
                // Skip backward
                doubleTapVideoElement.currentTime = Math.max(0, doubleTapVideoElement.currentTime - config.skipTimeInSeconds);
                drawDoubleTapFeedback('◀◀ ' + config.skipTimeInSeconds + 's');
            } else {
                // Skip forward
                doubleTapVideoElement.currentTime = Math.min(doubleTapVideoElement.duration, doubleTapVideoElement.currentTime + config.skipTimeInSeconds);
                drawDoubleTapFeedback('▶▶ ' + config.skipTimeInSeconds + 's');
            }

            // Reset tap tracking
            lastTap.time = 0;
        } else {
            // This is a first tap
            lastTap.time = currentTime;
            lastTap.x = touchX;
            lastTap.y = touchY;

            // Forward the tap to the video after a delay to allow double-tap detection
            setTimeout(() => {
                if (currentTime === lastTap.time) {
                    // It was a single tap (not part of a double-tap sequence)
                    forwardTapToVideo(touchX, touchY);
                }
            }, config.doubleTapThreshold + 10);
        }
    }
}

// Position canvas over video, but exclude control area
function positionDoubleTapCanvas() {
    if (!doubleTapVideoElement || !doubleTapCanvas) return;

    // Check if video element is still valid and in the DOM
    if (!document.contains(doubleTapVideoElement)) {
        console.log("Video element no longer in DOM, looking for new video");
        const newVideo = document.getElementById('VideoPlayer');
        if (newVideo) {
            doubleTapVideoElement = newVideo;
        } else {
            return; // No video to position for
        }
    }

    const videoRect = doubleTapVideoElement.getBoundingClientRect();

    // Only position if video has a valid size
    if (videoRect.width <= 0 || videoRect.height <= 0) return;

    // Only cover the top 80% of the video, leaving bottom 25% for controls
    const controlsHeight = videoRect.height * 0.25;

    doubleTapCanvas.style.position = 'fixed';
    doubleTapCanvas.style.left = videoRect.left + 'px';
    doubleTapCanvas.style.top = videoRect.top + 'px';
    doubleTapCanvas.width = videoRect.width;
    doubleTapCanvas.height = videoRect.height - controlsHeight; // Exclude control area

    // Make sure canvas is visible and capturing touches
    doubleTapCanvas.style.display = 'block';
}

function setupDoubleTapObservers() {
    // Reposition on resize
    window.addEventListener('resize', positionDoubleTapCanvas);

    // Reposition on scroll
    window.addEventListener('scroll', positionDoubleTapCanvas);

    // Watch for video changes
    const resizeObserver = new ResizeObserver(() => {
        positionDoubleTapCanvas();
    });

    if (doubleTapVideoElement) {
        resizeObserver.observe(doubleTapVideoElement);
    }

    // Use a debounced observer to reduce excessive checks
    let videoCheckTimeout = null;
    let lastCheck = 0;

    const observer = new MutationObserver((mutations) => {
        // Only check every 500ms at most to prevent excessive processing
        const now = Date.now();
        if (now - lastCheck < 500) {
            // Clear any pending timeout
            if (videoCheckTimeout) {
                clearTimeout(videoCheckTimeout);
            }

            // Schedule a check after the cooldown period
            videoCheckTimeout = setTimeout(() => {
                checkVideoElement();
                videoCheckTimeout = null;
            }, 500 - (now - lastCheck));

            return;
        }

        // Do the actual check
        checkVideoElement();
    });

    function checkVideoElement() {
        lastCheck = Date.now();

        // Only run this check if the feature is enabled
        if (!config.enableDoubleTapSeek) return;

        // Check if the video element is still valid
        const currentVideo = document.getElementById('VideoPlayer');

        // Completely different situation - no current video
        if (!currentVideo) return;

        // If our reference is gone or different from current video
        if (!doubleTapVideoElement || !document.contains(doubleTapVideoElement) ||
            doubleTapVideoElement !== currentVideo) {

            // Clean up old resources
            if (doubleTapCanvas && doubleTapCanvas.parentNode) {
                doubleTapCanvas.parentNode.removeChild(doubleTapCanvas);
                doubleTapCanvas = null;
            }

            // Update video reference
            doubleTapVideoElement = currentVideo;

            // Setup observers for the new video
            resizeObserver.observe(doubleTapVideoElement, { box: 'border-box' });

            // Reset initialization and wait for play
            doubleTapInitialized = false;

            // Set up play event for the new video
            const newPlayHandler = function () {
                if (!doubleTapInitialized) {
                    createDoubleTapCanvas();
                    positionDoubleTapCanvas();
                    doubleTapInitialized = true;
                }
                doubleTapVideoElement.removeEventListener('play', newPlayHandler);
            };

            doubleTapVideoElement.addEventListener('play', newPlayHandler);

            // If the video is already playing, trigger the handler immediately
            if (!doubleTapVideoElement.paused) {
                newPlayHandler();
            }
        }
    }

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    // Reposition periodically to handle player UI changes
    setInterval(positionDoubleTapCanvas, 1000);
}

function drawDoubleTapFeedback(text) {
    if (!doubleTapCanvas) return;

    // Instead of drawing on the canvas which moves with the video during pulse effects,
    // let's create a fixed overlay element

    // Remove any existing feedback elements
    const existingFeedback = document.getElementById('double-tap-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }

    // Determine if this is forward or backward
    const isForward = text.includes('▶▶');

    // Extract seconds value
    const seconds = text.match(/\d+/)[0];

    // Create a new fixed position element
    const feedbackElement = document.createElement('div');
    feedbackElement.id = 'double-tap-feedback';

    // Style the element
    feedbackElement.style.cssText = `
        position: fixed;
        padding: 6px 10px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 13px;
        border-radius: 5px;
        z-index: 999999;
        pointer-events: none;
        transition: opacity 0.5s ease;
        text-align: center;
        min-width: 50px;
    `;

    // Get video position
    const videoRect = doubleTapVideoElement.getBoundingClientRect();

    // Position based on direction (left or right side of video)
    const margin = 20; // Distance from edge of video

    if (isForward) {
        // Right side for forward
        feedbackElement.style.left = `${videoRect.right - 80 - margin}px`;
    } else {
        // Left side for backward
        feedbackElement.style.left = `${videoRect.left + margin}px`;
    }

    // Vertical center of video
    feedbackElement.style.top = `${videoRect.top + (videoRect.height / 2) - 16}px`;

    // Set content with appropriate direction indication
    feedbackElement.textContent = isForward ? `+${seconds}s` : `-${seconds}s`;

    // Add to document
    document.body.appendChild(feedbackElement);

    // Fade out and remove after delay
    setTimeout(() => {
        feedbackElement.style.opacity = '0';
        setTimeout(() => {
            if (feedbackElement.parentNode) {
                feedbackElement.parentNode.removeChild(feedbackElement);
            }
        }, 500); // Wait for fade transition to complete
    }, 500);
}

function forwardTapToVideo(x, y) {
    if (!doubleTapVideoElement) return;

    // Create and dispatch touch events to the video
    try {
        let touchObj = new Touch({
            identifier: Date.now(),
            target: doubleTapVideoElement,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
            radiusX: 2.5,
            radiusY: 2.5,
            rotationAngle: 0,
            force: 0.5,
        });

        // TouchStart
        const touchStartEvent = new TouchEvent('touchstart', {
            cancelable: true,
            bubbles: true,
            touches: [touchObj],
            targetTouches: [touchObj],
            changedTouches: [touchObj],
        });

        // TouchEnd
        const touchEndEvent = new TouchEvent('touchend', {
            cancelable: true,
            bubbles: true,
            touches: [],
            targetTouches: [],
            changedTouches: [touchObj],
        });

        // Temporarily hide our canvas
        doubleTapCanvas.style.pointerEvents = 'none';

        // Dispatch events
        doubleTapVideoElement.dispatchEvent(touchStartEvent);
        doubleTapVideoElement.dispatchEvent(touchEndEvent);

        // Restore canvas after a brief delay
        setTimeout(() => {
            if (doubleTapCanvas) {
                doubleTapCanvas.style.pointerEvents = 'auto';
            }
        }, 100);
    } catch (e) {
        console.error('Error forwarding tap:', e);

        // Fallback to simpler click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y
        });
        doubleTapVideoElement.dispatchEvent(clickEvent);
    }
}

function initDoubleTapSeek() {
    // Clean up any existing double tap resources first
    removeDoubleTapSeek();

    // Reset initialized state
    doubleTapInitialized = false;

    // Find video element
    doubleTapVideoElement = document.getElementById('VideoPlayer');
    if (!doubleTapVideoElement) {
        // If video element not found yet, try again later
        setTimeout(initDoubleTapSeek, 1000);
        return;
    }

    // Instead of immediately creating the canvas, wait for the first play event
    const firstPlayHandler = function () {
        // Remove this listener since we only need it once
        doubleTapVideoElement.removeEventListener('play', firstPlayHandler);

        // Create canvas overlay
        createDoubleTapCanvas();

        // Position the canvas
        positionDoubleTapCanvas();

        // Setup resize and mutation observers
        setupDoubleTapObservers();

        doubleTapInitialized = true;
    };

    // Add listener for the first play event
    doubleTapVideoElement.addEventListener('play', firstPlayHandler);

    // If the video is already playing, trigger the handler immediately
    if (doubleTapVideoElement && !doubleTapVideoElement.paused) {
        firstPlayHandler();
    }

    // Start monitoring for navigation
    if (!window.doubleTapMonitorInterval) {
        monitorVideoNavigation();
    }
}

function monitorVideoNavigation() {
    // Only monitor if double tap is enabled
    if (!config.enableDoubleTapSeek) return;

    // Keep track of the current video URL
    let currentVideoUrl = null;
    let lastVideoCheck = 0;

    if (doubleTapVideoElement) {
        currentVideoUrl = doubleTapVideoElement.src;
    }

    // Check periodically for video source changes, but not too frequently
    const checkInterval = setInterval(() => {
        // Skip if feature is disabled
        if (!config.enableDoubleTapSeek) return;

        // Don't check too frequently
        const now = Date.now();
        if (now - lastVideoCheck < 2000) return;
        lastVideoCheck = now;

        const videoPlayer = document.getElementById('VideoPlayer');
        if (videoPlayer && videoPlayer.src && videoPlayer.src !== currentVideoUrl) {
            currentVideoUrl = videoPlayer.src;

            // Only reinitialize if our current reference is outdated
            if (!doubleTapVideoElement || doubleTapVideoElement !== videoPlayer) {
                // Remove existing canvas first
                if (doubleTapCanvas && doubleTapCanvas.parentNode) {
                    doubleTapCanvas.parentNode.removeChild(doubleTapCanvas);
                    doubleTapCanvas = null;
                }

                // Update our reference
                doubleTapVideoElement = videoPlayer;
                doubleTapInitialized = false;

                // Setup initialization on next play
                const playHandler = function () {
                    createDoubleTapCanvas();
                    positionDoubleTapCanvas();
                    doubleTapInitialized = true;
                    videoPlayer.removeEventListener('play', playHandler);
                };

                videoPlayer.addEventListener('play', playHandler);

                // If already playing, initialize now
                if (!videoPlayer.paused) {
                    playHandler();
                }
            }
        }
    }, 3000); // Check every 3 seconds instead of every 1 second

    // Store the interval ID for cleanup
    window.doubleTapMonitorInterval = checkInterval;
}

// Apply changes to all videos when settings change
function applySettingsToAllVideos() {
    document.querySelectorAll('video').forEach(video => {
        // Apply or remove glow effect
        if (config.enableGlow) {
            video.style.transition = `box-shadow ${config.sampleInterval}ms ease-in-out`;
            // The actual color is set in updateVideoMonitor
        } else {
            video.style.boxShadow = 'none';
        }

        // Apply or remove saturation effect
        if (config.enableSaturation) {
            const filterValue = getFilterString();
            video.style.setProperty('filter', filterValue, 'important');
            video.style.setProperty('-webkit-filter', filterValue, 'important');
        } else {
            video.style.setProperty('filter', 'none', 'important');
            video.style.setProperty('-webkit-filter', 'none', 'important');
        }
    });

    // Save settings
    saveConfig();
}

// Save settings function
function saveConfig() {
    GM_setValue('videoEffectsConfig', JSON.stringify(config));
}

// Load settings function
function loadConfig() {
    try {
        const savedConfig = GM_getValue('videoEffectsConfig');
        if (savedConfig) {
            return { ...defaultConfig, ...JSON.parse(savedConfig) };
        }
    } catch (e) {
        console.error('Error loading saved configuration:', e);
    }
    return { ...defaultConfig };
}

// Function to update CSS filter string based on config
function getFilterString() {
    let filters = [];

    if (config.enableSaturation && config.saturationBoost !== 1.0) {
        filters.push(`saturate(${config.saturationBoost})`);
    }

    if (config.contrastBoost !== 1.0) {
        filters.push(`contrast(${config.contrastBoost})`);
    }

    return filters.length > 0 ? filters.join(' ') : 'none';
}

// Make an element draggable (touch and mouse compatible)
function makeDraggable(element) {
    const titleBar = element.querySelector('.title-bar');
    if (!titleBar) return;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;

    // Mouse events
    titleBar.onmousedown = dragMouseDown;

    // Touch events
    titleBar.addEventListener('touchstart', dragTouchStart, { passive: false });

    function dragMouseDown(e) {
        e.preventDefault();
        // Get mouse position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        isDragging = true;

        // Add event listeners for mouse movement and release
        document.onmousemove = elementDrag;
        document.onmouseup = closeDragElement;
    }

    function dragTouchStart(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            // Get touch position at startup
            pos3 = e.touches[0].clientX;
            pos4 = e.touches[0].clientY;
            isDragging = true;

            // Add event listeners for touch movement and end
            document.addEventListener('touchmove', elementTouchDrag, { passive: false });
            document.addEventListener('touchend', closeTouchDragElement);
        }
    }

    function elementDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        // Calculate new position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        // Set element's new position
        updateElementPosition();
    }

    function elementTouchDrag(e) {
        if (!isDragging || e.touches.length !== 1) return;
        e.preventDefault();

        // Calculate new position
        pos1 = pos3 - e.touches[0].clientX;
        pos2 = pos4 - e.touches[0].clientY;
        pos3 = e.touches[0].clientX;
        pos4 = e.touches[0].clientY;

        // Set element's new position
        updateElementPosition();
    }

    function updateElementPosition() {
        // Get current position values
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);

        // Calculate top position
        let top = null;
        if (computedStyle.top !== 'auto') {
            top = (parseInt(computedStyle.top) - pos2);
        } else if (computedStyle.bottom !== 'auto') {
            const bottom = parseInt(computedStyle.bottom);
            top = window.innerHeight - rect.height - bottom + pos2;
            element.style.bottom = 'auto';
        }

        // Calculate left position
        let left = null;
        if (computedStyle.left !== 'auto') {
            left = (parseInt(computedStyle.left) - pos1);
        } else if (computedStyle.right !== 'auto') {
            const right = parseInt(computedStyle.right);
            left = window.innerWidth - rect.width - right + pos1;
            element.style.right = 'auto';
        }

        // Apply new position with bounds checking
        if (top !== null) {
            top = Math.max(0, Math.min(window.innerHeight - rect.height, top));
            element.style.top = top + 'px';
        }

        if (left !== null) {
            left = Math.max(0, Math.min(window.innerWidth - rect.width, left));
            element.style.left = left + 'px';
        }

        // Save position in config
        if (top !== null && left !== null) {
            // Store position as custom properties instead of using the built-in positions
            config.customPosition = { top, left };
            saveConfig();
        }
    }

    function closeDragElement() {
        isDragging = false;

        // Remove event listeners
        document.onmouseup = null;
        document.onmousemove = null;
    }

    function closeTouchDragElement() {
        isDragging = false;

        // Remove event listeners
        document.removeEventListener('touchmove', elementTouchDrag);
        document.removeEventListener('touchend', closeTouchDragElement);
    }

    // Apply custom position if it exists
    if (config.customPosition) {
        element.style.top = config.customPosition.top + 'px';
        element.style.left = config.customPosition.left + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    }
}

function isTouchDevice() {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

/**************************************
 * 6. GIF CREATOR FUNCTIONS
 **************************************/

function captureNextFrame() {
    if (!gifConfig.isRecording) return;

    const video = document.getElementById('VideoPlayer');
    if (!video) return;

    // Capture the current frame
    gifConfig.ctx.drawImage(video, 0, 0, gifConfig.canvas.width, gifConfig.canvas.height);
    gifConfig.gif.addFrame(gifConfig.ctx, {
        copy: true,
        delay: 1000 / gifConfig.fps
    });

    gifConfig.frameCount++;

    const statusDisplay = document.getElementById('gif-status-display');
    if (statusDisplay) {
        const progress = Math.floor((gifConfig.frameCount / (gifConfig.duration * gifConfig.fps)) * 100);
        statusDisplay.textContent = `Recording: ${progress}% (${gifConfig.frameCount} frames)`;
    }

    // Check if we need to capture more frames
    const maxFrames = gifConfig.duration * gifConfig.fps;
    if (gifConfig.frameCount >= maxFrames) {
        stopRecording();
        return;
    }

    // Advance the video to the next frame time
    const timeIncrement = 1 / gifConfig.fps;
    video.currentTime += timeIncrement;

    // Wait for the video to update to the new time
    const onSeeked = function () {
        video.removeEventListener('seeked', onSeeked);
        // Schedule the next frame capture
        requestAnimationFrame(captureNextFrame);
    };

    video.addEventListener('seeked', onSeeked);
}

function initGifWorker() {
    // Create a simple worker script that proxies to the CDN
    const workerCode = `self.importScripts('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');`;
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerURL = URL.createObjectURL(workerBlob);
    return workerURL;
}
// Initialize GIF components
function initGifComponents() {
    if (!gifConfig.workerURL) {
        gifConfig.workerURL = initGifWorker();
    }

    if (!gifConfig.canvas) {
        gifConfig.canvas = document.createElement('canvas');
        gifConfig.ctx = gifConfig.canvas.getContext('2d', { willReadFrequently: true });
    }

    // Load saved settings
    loadGifSettings();
}

// Save GIF settings to localStorage
function saveGifSettings() {
    const settingsToSave = {
        quality: gifConfig.quality,
        duration: gifConfig.duration,
        fps: gifConfig.fps,
        sizePreset: gifConfig.sizePreset
    };

    try {
        localStorage.setItem('pmvhaven_gif_settings', JSON.stringify(settingsToSave));
    } catch (e) {
        console.error('Failed to save GIF settings:', e);
    }
}

// Load GIF settings from localStorage
function loadGifSettings() {
    try {
        const savedSettings = localStorage.getItem('pmvhaven_gif_settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);

            // Apply saved settings
            if (settings.quality !== undefined) gifConfig.quality = settings.quality;
            if (settings.duration !== undefined) gifConfig.duration = settings.duration;
            if (settings.fps !== undefined) gifConfig.fps = settings.fps;
            if (settings.sizePreset !== undefined) gifConfig.sizePreset = settings.sizePreset;
        }
    } catch (e) {
        console.error('Failed to load GIF settings:', e);
    }
}

// Get size preset scaling factor
function getSizePresetScale(preset) {
    switch (preset) {
        case 0: return 4;    // Tiny (1/4)
        case 1: return 3;    // Small (1/3)
        case 2: return 2;    // Medium (1/2)
        case 3: return 1;    // Native
        default: return 2;   // Default to Medium
    }
}

// Get size preset label
function getSizePresetLabel(preset) {
    switch (preset) {
        case 0: return 'Tiny';
        case 1: return 'Small';
        case 2: return 'Medium';
        case 3: return 'Native';
        default: return 'Medium';
    }
}

// Setup GIF functions...
// (Include all your other GIF-related functions)

/**************************************
 * 7. WHOIS IMAGE SEARCH FUNCTIONS
 **************************************/

// Toggle selection mode functions...
// (Include all your image search related functions)
/**
 * Shows a loading overlay with a message
 * @param {string} message - The message to display
 */
function showLoading(message) {
    let loadingOverlay = document.getElementById('whois-loading-overlay');

    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'whois-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-message">${message || 'Loading...'}</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        loadingOverlay.querySelector('.loading-message').textContent = message || 'Loading...';
        loadingOverlay.style.display = 'flex';
    }
}

/**
 * Hides the loading overlay
 */
function hideLoading() {
    const loadingOverlay = document.getElementById('whois-loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Shows search results in a modal
 * @param {Object} results - The search results
 */
function showSearchResults(results) {
    // Create modal if it doesn't exist
    let resultsModal = document.getElementById('whois-results-modal');
    let overlay = document.getElementById('whois-modal-overlay');

    // Remove existing modal and overlay if they exist
    if (resultsModal) resultsModal.remove();
    if (overlay) overlay.remove();

    // Create new modal and overlay
    overlay = document.createElement('div');
    overlay.id = 'whois-modal-overlay';

    resultsModal = document.createElement('div');
    resultsModal.id = 'whois-results-modal';

    document.body.appendChild(overlay);
    document.body.appendChild(resultsModal);

    // Populate modal with content
    resultsModal.innerHTML = `
        <div class="modal-header">
            <h2>Image Search Results</h2>
            <button class="close-button" onclick="document.getElementById('whois-results-modal').remove(); document.getElementById('whois-modal-overlay').remove();">&times;</button>
        </div>
        <div class="results-grid">
            ${results.lens_results.map((item, index) => `
                <div class="result-item">
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                        <img src="${item.original_thumbnail}" alt="${item.title}" class="result-thumbnail">
                        <div class="result-info">
                            <h3 class="result-title">${item.title}</h3>
                            <div class="result-source">${item.source}</div>
                        </div>
                    </a>
                </div>
            `).join('')}
        </div>
    `;

    // Show the modal
    overlay.style.display = 'block';
    resultsModal.style.display = 'block';
}

/**
 * Capture the full video frame and perform search
 */
async function captureFullFrame() {
    try {
        // Show loading indicator
        showLoading('Capturing full frame...');

        // Find the video player
        const videoPlayer = document.getElementById('VideoPlayer');
        if (!videoPlayer || videoPlayer.tagName !== 'VIDEO') {
            alert('Video player not found');
            return;
        }

        // Capture the full video frame
        const base64Image = captureVideoFrame(videoPlayer);
        if (!base64Image) {
            hideLoading();
            alert('Failed to capture video frame');
            return;
        }

        // Show uploading status
        showLoading('Uploading image...');

        // Upload to Catbox
        const imageUrl = await uploadBase64ToCatbox(base64Image, 'full_video_frame.png', 'image/png');

        // Show searching status
        showLoading('Searching for similar images...');

        // Perform reverse image search
        const searchResults = await reverseImageSearch(imageUrl, API_KEY);

        // Hide loading indicator
        hideLoading();

        // Show results
        showSearchResults(searchResults);
    } catch (error) {
        hideLoading();
        alert(`Error: ${error.message}`);
        console.error('Full frame capture error:', error);
    }
}

/**
 * Create a transparent overlay for selection
 */
function createSelectionOverlay() {
    // Create overlay div
    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'selection-overlay';
    selectionOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        display: none;
        z-index: 1000;
    `;

    // Create selection box
    const selectionBox = document.createElement('div');
    selectionBox.id = 'selection-box';
    selectionBox.style.cssText = `
        position: absolute;
        border: 2px solid #ff3333;
        background-color: rgba(255, 51, 51, 0.2);
        display: none;
    `;

    // Create confirmation controls
    const confirmationControls = createConfirmationControls();

    // Add instruction text
    const instructions = document.createElement('div');
    instructions.textContent = 'Click and drag to select a region';
    instructions.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
    `;

    // Append elements
    selectionOverlay.appendChild(selectionBox);
    selectionOverlay.appendChild(confirmationControls);
    selectionOverlay.appendChild(instructions);
    videoContainer.appendChild(selectionOverlay);
}

/**
 * Initialize region selection functionality
 */
function initRegionSelection() {
    // Find the video container
    const videoPlayer = document.getElementById('VideoPlayer');
    if (!videoPlayer) return;

    // Get the parent container that will be used for positioning
    videoContainer = videoPlayer.parentElement;

    // Create selection overlay
    createSelectionOverlay();
}

/**
 * Create confirmation controls with improved event handling
 */
function createConfirmationControls() {
    const confirmationControls = document.createElement('div');
    confirmationControls.id = 'confirmation-controls';
    confirmationControls.style.cssText = `
        position: absolute;
        display: none;
        background-color: rgba(0, 0, 0, 0.7);
        border-radius: 4px;
        padding: 8px;
        color: white;
        font-size: 14px;
        z-index: 1001;
    `;

    // Add buttons
    const searchButton = document.createElement('button');
    searchButton.textContent = 'Search';
    searchButton.style.cssText = `
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 6px 12px;
        margin-right: 8px;
        border-radius: 4px;
        cursor: pointer;
    `;

    // Use addEventListener instead of onclick
    searchButton.addEventListener('click', function (e) {
        // Stop event propagation
        e.stopPropagation();
        e.preventDefault();
        confirmSearch();
    });

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
        background-color: #f44336;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
    `;

    // Use addEventListener instead of onclick
    cancelButton.addEventListener('click', function (e) {
        // Stop event propagation
        e.stopPropagation();
        e.preventDefault();
        cancelSelection();
    });

    // Append elements
    confirmationControls.appendChild(searchButton);
    confirmationControls.appendChild(cancelButton);

    return confirmationControls;
}

/**
 * Initialize the selection overlay
 * @returns {boolean} True if initialized successfully
 */
function initSelectionOverlay() {
    // Find the video player
    const videoPlayer = document.getElementById('VideoPlayer');
    if (!videoPlayer) return false;

    // Get the parent container for positioning
    videoContainer = videoPlayer.parentElement;

    // Create overlay div
    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'selection-overlay';
    selectionOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        display: none;
        z-index: 1000;
    `;

    // Create selection box
    const selectionBox = document.createElement('div');
    selectionBox.id = 'selection-box';
    selectionBox.style.cssText = `
        position: absolute;
        border: 2px solid #ff3333;
        background-color: rgba(255, 51, 51, 0.2);
        display: none;
    `;

    // Create confirmation controls
    const confirmationControls = createConfirmationControls();

    // Add instruction text
    const instructions = document.createElement('div');
    instructions.textContent = 'Click and drag to select a region';
    instructions.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
    `;

    // Add elements
    selectionOverlay.appendChild(selectionBox);
    selectionOverlay.appendChild(confirmationControls);
    selectionOverlay.appendChild(instructions);
    videoContainer.appendChild(selectionOverlay);

    return true;
}

/**
 * Toggle selection mode on/off
 */
function toggleSelectionMode() {
    // Check if this is a touch device
    if (isTouchDevice()) {
        // For touch devices, skip selection and capture full frame
        captureFullFrame();
        return;
    }

    // Create overlay if it doesn't exist
    if (!selectionOverlay) {
        if (!initSelectionOverlay()) {
            alert('Could not initialize selection. Video player not found.');
            return;
        }
    }

    const whoisButton = document.getElementById('toggle-whois');

    if (selectionOverlay.style.display === 'none') {
        // Enable selection mode
        selectionOverlay.style.display = 'block';
        selectionOverlay.style.pointerEvents = 'auto';
        if (whoisButton) whoisButton.classList.add('active');

        // Add event listeners for mouse interaction
        selectionOverlay.addEventListener('mousedown', startSelection);
        selectionOverlay.addEventListener('mousemove', updateSelection);
        selectionOverlay.addEventListener('mouseup', endSelection);
    } else {
        // Disable selection mode
        disableSelectionMode();
    }
}

/**
 * Disable selection mode
 */
function disableSelectionMode() {
    // Hide overlay
    selectionOverlay.style.display = 'none';
    selectionOverlay.style.pointerEvents = 'none';

    // Remove active class from Source button
    const whoisButton = document.getElementById('toggle-whois');
    if (whoisButton) whoisButton.classList.remove('active');

    // Remove event listeners
    selectionOverlay.removeEventListener('mousedown', startSelection);
    selectionOverlay.removeEventListener('mousemove', updateSelection);
    selectionOverlay.removeEventListener('mouseup', endSelection);

    // Hide selection box and confirmation controls
    const selectionBox = document.getElementById('selection-box');
    selectionBox.style.display = 'none';

    const confirmationControls = document.getElementById('confirmation-controls');
    if (confirmationControls) confirmationControls.style.display = 'none';
}

/**
 * Start the selection process
 */
function startSelection(e) {
    // Skip if we're clicking on the confirmation controls
    if (e.target.closest('#confirmation-controls')) {
        return;
    }

    isSelecting = true;

    // Get mouse position relative to the overlay
    const rect = selectionOverlay.getBoundingClientRect();
    selectionStart.x = e.clientX - rect.left;
    selectionStart.y = e.clientY - rect.top;

    // Initialize selection box
    const selectionBox = document.getElementById('selection-box');
    selectionBox.style.left = `${selectionStart.x}px`;
    selectionBox.style.top = `${selectionStart.y}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';

    // Hide confirmation controls when starting a new selection
    const confirmationControls = document.getElementById('confirmation-controls');
    if (confirmationControls) confirmationControls.style.display = 'none';
}

/**
 * Update the selection box as mouse moves
 */
function updateSelection(e) {
    if (!isSelecting) return;

    // Get current mouse position
    const rect = selectionOverlay.getBoundingClientRect();
    selectionCurrent.x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    selectionCurrent.y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    // Update selection box
    const selectionBox = document.getElementById('selection-box');
    const left = Math.min(selectionStart.x, selectionCurrent.x);
    const top = Math.min(selectionStart.y, selectionCurrent.y);
    const width = Math.abs(selectionCurrent.x - selectionStart.x);
    const height = Math.abs(selectionCurrent.y - selectionStart.y);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
}

/**
 * Finalize the selection and perform search
 */
function endSelection(e) {
    // Skip if we're releasing on the confirmation controls
    if (e.target.closest('#confirmation-controls')) {
        return;
    }

    if (!isSelecting) return;
    isSelecting = false;

    // Get final selection dimensions
    const selectionBox = document.getElementById('selection-box');
    const left = parseInt(selectionBox.style.left);
    const top = parseInt(selectionBox.style.top);
    const width = parseInt(selectionBox.style.width);
    const height = parseInt(selectionBox.style.height);

    // Store selection dimensions in data attributes for later use
    selectionBox.dataset.left = left;
    selectionBox.dataset.top = top;
    selectionBox.dataset.width = width;
    selectionBox.dataset.height = height;

    // Check if selection is too small
    if (width < 20 || height < 20) {
        alert('Selection area is too small. Please select a larger area.');
        return;
    }

    // Show confirmation controls
    const confirmationControls = document.getElementById('confirmation-controls');
    if (confirmationControls) {
        // Make sure the confirmation controls are set to have pointer events
        confirmationControls.style.pointerEvents = 'auto';

        // Position confirmation controls near the selection box
        confirmationControls.style.left = `${left}px`;
        confirmationControls.style.top = `${top + height + 10}px`;

        // Make sure confirmation controls don't go off-screen
        const overlayRect = selectionOverlay.getBoundingClientRect();
        if (parseInt(confirmationControls.style.top) + confirmationControls.offsetHeight > overlayRect.height) {
            confirmationControls.style.top = `${top - confirmationControls.offsetHeight - 10}px`;
        }

        confirmationControls.style.display = 'block';
    }
}

/**
 * Confirm search with selected region
 */
function confirmSearch() {
    const selectionBox = document.getElementById('selection-box');
    if (!selectionBox || selectionBox.style.display === 'none') {
        console.error('No selection box found');
        return;
    }

    // Get dimensions from data attributes instead of style
    const left = parseInt(selectionBox.dataset.left);
    const top = parseInt(selectionBox.dataset.top);
    const width = parseInt(selectionBox.dataset.width);
    const height = parseInt(selectionBox.dataset.height);

    console.log('Search confirmed with dimensions:', left, top, width, height);

    // Check if selection is too small
    if (width < 20 || height < 20) {
        alert('Selection area is too small. Please select a larger area.');
        return;
    }

    // Perform the image search with selected region
    performRegionSearch(left, top, width, height);

    // Disable selection mode after search
    disableSelectionMode();
}

/**
 * Cancel selection
 */
function cancelSelection() {
    console.log('Selection cancelled');

    // Hide confirmation controls
    const confirmationControls = document.getElementById('confirmation-controls');
    if (confirmationControls) confirmationControls.style.display = 'none';

    // Hide selection box
    const selectionBox = document.getElementById('selection-box');
    if (selectionBox) selectionBox.style.display = 'none';

    // Disable selection mode by triggering the toggle-whois button
    const whoisButton = document.getElementById('toggle-whois');
    if (whoisButton) {
        // If button is active (has the 'active' class), click it to deactivate
        if (whoisButton.classList.contains('active')) {
            whoisButton.click();
        } else {
            // If the button wasn't active for some reason, disable selection mode directly
            disableSelectionMode();
        }
    } else {
        // If we can't find the button, directly disable selection mode
        disableSelectionMode();
    }
}

/**
 * Capture the selected region and perform search
 */
async function performRegionSearch(left, top, width, height) {
    try {
        // Show loading indicator
        showLoading('Capturing selected region...');

        // Find the video player
        const videoPlayer = document.getElementById('VideoPlayer');
        if (!videoPlayer || videoPlayer.tagName !== 'VIDEO') {
            alert('Video player not found');
            return;
        }

        // Calculate scaling factors
        const scaleX = videoPlayer.videoWidth / selectionOverlay.clientWidth;
        const scaleY = videoPlayer.videoHeight / selectionOverlay.clientHeight;

        // Scale the selection to actual video dimensions
        const sourceX = Math.floor(left * scaleX);
        const sourceY = Math.floor(top * scaleY);
        const sourceWidth = Math.floor(width * scaleX);
        const sourceHeight = Math.floor(height * scaleY);

        // Create a canvas to draw the selected region
        const canvas = document.createElement('canvas');
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;

        // Draw the selected region on the canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            videoPlayer,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, sourceWidth, sourceHeight
        );

        // Convert canvas to base64
        const base64Image = canvas.toDataURL('image/png');
        if (!base64Image) {
            hideLoading();
            alert('Failed to capture selected region');
            return;
        }

        // Show uploading status
        showLoading('Uploading image...');

        // Upload to Catbox
        const imageUrl = await uploadBase64ToCatbox(base64Image, 'video_region.png', 'image/png');

        // Show searching status
        showLoading('Searching for similar images...');

        // Perform reverse image search
        const searchResults = await reverseImageSearch(imageUrl, API_KEY);

        // Hide loading indicator
        hideLoading();

        // Show results
        showSearchResults(searchResults);
    } catch (error) {
        hideLoading();
        alert(`Error: ${error.message}`);
        console.error('Region search error:', error);
    }
}

/**
 * Upload base64 image to Catbox
 */
async function uploadBase64ToCatbox(base64Data, filename, mimeType) {
    const byteString = atob(base64Data.split(',')[1] || base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '1h');
    formData.append('fileToUpload', file);

    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: formData,
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    } else {
        console.error('Upload failed:', response.status, response.statusText);
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
}

/**
 * Perform reverse image search
 */
async function reverseImageSearch(url, apiKey) {
    const params = new URLSearchParams({
        api_key: apiKey,
        url: url,
        country: 'us',
    });

    const response = await fetch(`https://api.scrapingdog.com/google_lens/?${params.toString()}`, {
        method: 'GET',
    });

    if (response.ok) {
        const result = await response.json();
        return result;
    } else {
        console.error('Request failed:', response.status, response.statusText);
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
}

function createGifFromCurrentPosition() {
    const video = document.getElementById('VideoPlayer');
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        // Alert the user or update the status display
        const statusDisplay = document.getElementById('gif-status-display');
        if (statusDisplay) {
            statusDisplay.textContent = 'Error: Please play the video first';
        } else {
            alert('Please play the video before creating a GIF');
        }
        return; // Don't proceed with GIF creation
    }

    // Continue with normal GIF creation
    startRecording();
}

function startRecording() {
    if (gifConfig.isRecording) return;

    const video = document.getElementById('VideoPlayer');
    if (!video) {
        alert('No video found to record');
        return;
    }

    // Save the current time and paused state to restore later
    gifConfig.originalTime = video.currentTime;
    gifConfig.wasVideoPaused = video.paused;

    // Pause the video - we'll advance it manually
    if (!video.paused) {
        video.pause();
    }

    // Reset
    gifConfig.frameCount = 0;
    setupGif();
    gifConfig.isRecording = true;

    const statusDisplay = document.getElementById('gif-status-display');
    if (statusDisplay) {
        statusDisplay.textContent = 'Recording...';
    }

    // Instead of interval, use requestAnimationFrame for better control
    captureNextFrame();
}

// Stop recording
function stopRecording() {
    if (!gifConfig.isRecording) return;

    clearInterval(gifConfig.captureInterval);

    const statusDisplay = document.getElementById('gif-status-display');
    if (statusDisplay) {
        statusDisplay.textContent = 'Processing GIF...';
    }

    // Remove any previous download links
    const gifMenu = document.getElementById('gif-menu');
    if (gifMenu) {
        const links = gifMenu.querySelectorAll('.gif-download-link');
        links.forEach(link => link.remove());
    }

    // Render the GIF
    gifConfig.gif.render();
}
/**
 * Original full-frame capture function
 */
function captureVideoFrame(video) {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        console.error('Invalid video element');
        return null;
    }

    // Create a canvas to draw the video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current frame on the canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64
    try {
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error('Error converting canvas to base64:', e);
        return null;
    }
}

/**
 * Initialize region selection when panel is created
 */
function enhancePanelWithRegionSelect() {
    // Add a small delay to ensure panel is fully rendered
    setTimeout(() => {
        initRegionSelection();
    }, 100);
}

function setupGif() {
    const video = document.getElementById('VideoPlayer');
    if (!video) return;

    // Get scale based on size preset
    const scale = getSizePresetScale(gifConfig.sizePreset);

    gifConfig.gif = new GIF({
        workers: 4,
        quality: gifConfig.quality,
        width: video.videoWidth / scale,
        height: video.videoHeight / scale,
        workerScript: gifConfig.workerURL,
        dither: false
    });

    // Set up canvas dimensions
    gifConfig.canvas.width = video.videoWidth / scale;
    gifConfig.canvas.height = video.videoHeight / scale;

    // Set up progress event
    gifConfig.gif.on('progress', function (p) {
        const statusDisplay = document.getElementById('gif-status-display');
        if (statusDisplay) {
            statusDisplay.textContent = 'Rendering: ' + Math.round(p * 100) + '%';
        }
    });

    // Set up finished event
    gifConfig.gif.on('finished', function (blob) {
        const previewContainer = document.getElementById('gif-preview-container');
        const statusDisplay = document.getElementById('gif-status-display');
        const blobUrl = URL.createObjectURL(blob);

        // Store the blob size
        gifConfig.lastBlobSize = blob.size;

        if (previewContainer) {
            // Clear previous preview content
            previewContainer.innerHTML = '';

            // Create GIF preview
            const previewImg = document.createElement('img');
            previewImg.src = blobUrl;

            // Apply sizing based on aspect ratio
            const isPortrait = gifConfig.canvas.height > gifConfig.canvas.width;

            previewImg.style.maxWidth = isPortrait ? '50%' : '100%';
            previewImg.style.borderRadius = '4px';
            previewImg.style.border = '1px solid rgba(51, 51, 51, 0.9)';
            previewImg.style.cursor = 'pointer';
            previewImg.title = 'Click to view fullscreen';

            // Add click event to show fullscreen
            previewImg.addEventListener('click', function () {
                const fullscreenView = document.createElement('div');
                fullscreenView.style.position = 'fixed';
                fullscreenView.style.top = '0';
                fullscreenView.style.left = '0';
                fullscreenView.style.width = '100%';
                fullscreenView.style.height = '100%';
                fullscreenView.style.backgroundColor = 'rgba(0,0,0,0.9)';
                fullscreenView.style.zIndex = '999999';
                fullscreenView.style.display = 'flex';
                fullscreenView.style.justifyContent = 'center';
                fullscreenView.style.alignItems = 'center';
                fullscreenView.style.cursor = 'pointer';

                const fullImg = document.createElement('img');
                fullImg.src = blobUrl;
                fullImg.style.maxWidth = '90%';
                fullImg.style.maxHeight = '90%';
                fullImg.style.objectFit = 'contain';

                fullscreenView.appendChild(fullImg);
                document.body.appendChild(fullscreenView);

                fullscreenView.addEventListener('click', function () {
                    fullscreenView.remove();
                });
            });

            // Create download button
            const downloadButton = document.createElement('a');
            downloadButton.href = blobUrl;
            downloadButton.download = 'capture_' + new Date().toISOString() + '.gif';
            downloadButton.textContent = 'Download GIF';
            downloadButton.className = 'menu-button download-button';

            // Create a wrapper div for better layout control with portrait images
            const previewWrapper = document.createElement('div');
            previewWrapper.style.display = 'flex';
            previewWrapper.style.justifyContent = isPortrait ? 'center' : 'flex-start';
            previewWrapper.style.width = '100%';
            previewWrapper.appendChild(previewImg);

            // Add everything to preview container
            previewContainer.appendChild(previewWrapper);
            previewContainer.appendChild(downloadButton);
        }

        if (statusDisplay) {
            // Format the size in KB or MB
            let sizeText = '';
            if (gifConfig.lastBlobSize < 1024 * 1024) {
                sizeText = (gifConfig.lastBlobSize / 1024).toFixed(1) + ' KB';
            } else {
                sizeText = (gifConfig.lastBlobSize / (1024 * 1024)).toFixed(1) + ' MB';
            }

            statusDisplay.textContent = `GIF ready! (${sizeText})`;
        }

        gifConfig.isRecording = false;
    });
}

/**************************************
 * 8. QOL FUNCTIONS
 **************************************/
function handleZoomDisable(enable) {
    if (enable) {
        // Disable zooming
        // Prevent double-tap zoom
        document.addEventListener('dblclick', preventDoubleTapZoom, { passive: false });

        // Prevent zoom on touch devices
        document.addEventListener('touchstart', preventMultiTouch, { passive: false });

        // Prevent pinch zoom
        document.addEventListener('touchmove', preventMultiTouch, { passive: false });

        // Modify viewport meta tag to disable user scaling
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
            // If viewport meta tag exists, modify it
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        } else {
            // If no viewport meta tag, create one
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.head.appendChild(meta);
        }
    } else {
        // Re-enable zooming
        document.removeEventListener('dblclick', preventDoubleTapZoom);
        document.removeEventListener('touchstart', preventMultiTouch);
        document.removeEventListener('touchmove', preventMultiTouch);

        // Restore viewport meta
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
        }
    }
}

// Event handlers for preventing zoom
function preventDoubleTapZoom(e) {
    // Stop the default double-tap behavior
    e.preventDefault();
}

function preventMultiTouch(e) {
    // Only prevent multi-touch events (like pinch)
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}
