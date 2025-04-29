// amoled.js
// Store theme variables
const theme = {
    backgroundRgb: '0, 0, 0',
    backgroundHeader: '#000000'
};

// Apply static CSS once
GM_addStyle(`
        .v-theme--dark { --v-theme-background: ${theme.backgroundRgb} !important; }
        #subheader[data-v-7da94932] { background-color: ${theme.backgroundHeader} !important; }
        div[data-v-7da94932].v-container { background: ${theme.backgroundHeader} !important; }
        .v-overlay__scrim { background: #000000 !important; opacity: var(--v-overlay-opacity,.700) !important; }
        img[class*="thumbnail"], .thumbnail, [class*="thumb"], img[src*="thumb"], img[alt*="thumbnail"], .avatar, .profile-pic { border-radius: 12px !important; }
        div#header { z-index: 2000; border-bottom: 1px solid rgb(0, 0, 0); background-color: rgb(0, 0, 0); opacity: 0.85; }

        /* Resolution text styling */
        p.pb-0.mb-0.pl-1.pr-1.resolution-styled {
            z-index: 3 !important;
            position: absolute !important;
            right: 5px !important;
            top: 3px !important;
            border-radius: 5px !important;
            text-align: center !important;
            color: #fdfdfd !important;
            font-size: 0.9rem !important;
            font-weight: lighter !important;
            text-shadow: 1px 1px 1px black !important;
        }

        /* Timestamp text styling */
        p.timestamp-styled {
            z-index: 3 !important;
            position: absolute !important;
            right: 5px !important;
            bottom: 3px !important;
            background-color: transparent !important;
            border-radius: 5px !important;
            text-align: center !important;
            color: white !important;
            font-size: 0.9rem !important;
            font-weight: 500 !important;
            text-shadow: 1px 1px 1px black !important;
        }

        /* Rating text styling base */
        p.pb-0.mb-0.pl-1.pr-1.rating-styled {
            z-index: 3 !important;
            position: absolute !important;
            left: 5px !important;
            bottom: 3px !important;
            background-color: rgb(0,0,0, 0.4) !important;
            border-radius: 5px !important;
            text-align: center !important;
            font-size: 0.95rem !important;
            font-weight: bold !important;
            display: flex !important;
            align-items: center !important;
            text-shadow: 1px 1px 1px black !important;
        }

        /* Card text styling */
        div.v-card-text.ma-0.pr-1.pt-1.pl-1.pb-0 {
            color: white !important;
            z-index: 2 !important;
            white-space: nowrap !important;
            text-overflow: ellipsis !important;
            overflow: hidden !important;
            word-break: normal !important;
        }
    `);

// Elements to remove
const elementsToRemove = [
    'a[href="/contribute"]',
    'a[href="https://discord.gg/S28CrmYqAc"]',
    '.v-badge__badge.v-theme--dark.bg-red.v-badge--rounded',
    '.v-col.hidden-xs-only',
    '.ad-card-title'
];

// RGB values to replace with black
const rgbToReplace = [
    'rgb(20, 20, 20)',
    'rgb(33, 33, 33)',
    'rgb(34, 34, 34)',
    'rgb(29, 29, 29)',
    'rgb(18, 18, 18)',
    'rgb(15, 15, 15)',
];

// Rating color mapping - from red (0) to green (5)
// Creates a smooth gradient with many color steps
const ratingColors = [
    { value: 0.0, color: '#FF0000' }, // Pure red for 0
    { value: 0.5, color: '#FF1A00' },
    { value: 1.0, color: '#FF3300' },
    { value: 1.5, color: '#FF4D00' },
    { value: 2.0, color: '#FF6600' }, // Orange-red for 2
    { value: 2.5, color: '#FF8000' },
    { value: 3.0, color: '#FFA500' }, // Orange for 3
    { value: 3.5, color: '#CCCC00' }, // Yellow-orange
    { value: 4.0, color: '#99CC00' }, // Yellow-green
    { value: 4.5, color: '#66CC00' }, // Lighter green
    { value: 5.0, color: '#33CC00' }  // Full green for 5
];

// Function to remove seizure warnings
function removeSeizureWarnings() {
    const elements = document.querySelectorAll('p.pb-0.mb-0.pl-1.pr-1, p.pb-0.mb-0.pl-1.pr-1.timestamp-styled');

    elements.forEach(element => {
        if (element.textContent.trim().toLowerCase().includes('seizure warning')) {
            element.remove();
        }
    });
}

// Function to process card text elements
function processCardTextElements() {
    // Find all div elements with the specific class
    const cardTextElements = document.querySelectorAll('div.v-card-text.ma-0.pr-1.pt-1.pl-1.pb-0');

    cardTextElements.forEach(element => {
        // Apply inline styles to ensure they take effect
        Object.assign(element.style, {
            color: 'white',
            zIndex: '2',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            wordBreak: 'normal'
        });
    });
}

// Function to get color based on rating
function getColorForRating(rating) {
    // Ensure the rating is within bounds
    const numericRating = parseFloat(rating);

    if (isNaN(numericRating)) {
        return '#FFFFFF'; // Default to white if not a number
    }

    // Find the color for this rating
    // Default to the last color if rating is above our max
    if (numericRating >= 4.5) {
        return '#33CC00'; // Max green at 4.5+
    }

    // Find the color stops that bound this rating
    let lowerStop = ratingColors[0];
    let upperStop = ratingColors[ratingColors.length - 1];

    for (let i = 0; i < ratingColors.length - 1; i++) {
        if (numericRating >= ratingColors[i].value && numericRating <= ratingColors[i + 1].value) {
            lowerStop = ratingColors[i];
            upperStop = ratingColors[i + 1];
            break;
        }
    }

    // Calculate the exact color using linear interpolation
    return lowerStop.color;
}

// Function to process resolution elements
function processResolutionElements() {
    // Find all p elements with the specific class
    const targetPElements = document.querySelectorAll('p.pb-0.mb-0.pl-1.pr-1');

    // Array of resolution patterns to look for
    const resolutionPatterns = ['720p', '1080p', '2k', '4k'];

    targetPElements.forEach(pElement => {
        // Check if the text content includes any of the resolution patterns
        const textContent = pElement.textContent.trim().toLowerCase();
        const matchesResolution = resolutionPatterns.some(pattern =>
            textContent.includes(pattern.toLowerCase())
        );

        if (matchesResolution) {
            // Apply the class for styling
            pElement.classList.add('resolution-styled');

            // Apply inline styles as well to ensure they take effect
            Object.assign(pElement.style, {
                zIndex: '3',
                position: 'absolute',
                right: '5px',
                top: '3px',
                'background-color': 'transparent',
                borderRadius: '5px',
                textAlign: 'center',
                color: '#fdfdfd',
                fontSize: '0.9rem',
                fontWeight: 'lighter',
                textShadow: '1px 1px 1px black'
            });
        }
    });
}

// Function to process timestamp elements
function processTimestampElements() {
    // Find all p elements
    const allPElements = document.querySelectorAll('p');

    // Regex to match timestamp format (00:00)
    const timestampRegex = /^\s*\d{1,2}:\d{2}\s*$/;

    allPElements.forEach(pElement => {
        // Skip elements containing seizure warning
        if (pElement.textContent.trim().toLowerCase().includes('seizure warning')) {
            return;
        }

        // Check if the text content is a timestamp
        const textContent = pElement.textContent.trim();
        if (timestampRegex.test(textContent)) {
            // Apply the class for styling
            pElement.classList.add('timestamp-styled');

            // Apply inline styles to ensure they take effect
            Object.assign(pElement.style, {
                zIndex: '3',
                position: 'absolute',
                right: '5px',
                bottom: '3px',
                backgroundColor: 'transparent',
                borderRadius: '5px',
                textAlign: 'center',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '500',
                textShadow: '1px 1px 1px black'
            });
        }
    });
}

// Function to process rating elements
function processRatingElements() {
    // Find all p elements with the specific class
    const targetPElements = document.querySelectorAll('p.pb-0.mb-0.pl-1.pr-1');

    // Regex to match rating format (e.g., 4.5, 3.0)
    const ratingRegex = /^\s*([0-4](\.\d)?|5(\.0)?)\s*$/;

    targetPElements.forEach(pElement => {
        // Check if the text content is a rating
        const textContent = pElement.textContent.trim();

        if (ratingRegex.test(textContent)) {
            // Get the rating value
            const ratingValue = parseFloat(textContent);

            // Get the color for this rating
            const ratingColor = getColorForRating(ratingValue);

            // Apply the class for styling
            pElement.classList.add('rating-styled');

            // Apply inline styles to ensure they take effect
            Object.assign(pElement.style, {
                zIndex: '3',
                position: 'absolute',
                left: '5px',
                bottom: '3px',
                backgroundColor: 'transparent',
                borderRadius: '5px',
                textAlign: 'center',
                color: ratingColor,
                fontSize: '0.95rem',
                fontWeight: 'lighter',
                display: 'flex',
                alignItems: 'center',
                textShadow: '1px 1px 1px black'
            });
        }
    });
}

// Function to remove ads - looks for ins.eas6a97888e10 and removes its parent container
function removeAds() {
    // Find all ins elements with the specified class
    const adElements = document.querySelectorAll('ins.eas6a97888e10');

    adElements.forEach(adElement => {
        // Find parent container - go up 2 levels to remove the entire ad container
        let parentContainer = adElement.parentNode;
        if (parentContainer) {
            // Go up one more level to get the actual container
            parentContainer = parentContainer.parentNode;
            if (parentContainer) {
                parentContainer.remove();
            } else {
                // Fallback if we can't find the grandparent
                adElement.parentNode.remove();
            }
        } else {
            // Fallback if we can't find the parent
            adElement.remove();
        }
    });

    // Find the second type of ads and remove only direct parent and grandparent
    const secondAdElements = document.querySelectorAll('ins.eas6a97888e2');

    secondAdElements.forEach(adElement => {
        // Go up exactly 2 levels for the parent div (similar to first ad type)
        let parentNode = adElement.parentNode;
        if (parentNode) {
            let grandparentNode = parentNode.parentNode;
            if (grandparentNode) {
                grandparentNode.remove();
            } else {
                // Fallback to just removing the parent
                parentNode.remove();
            }
        } else {
            // Fallback to just removing the ad element
            adElement.remove();
        }
    });
}

// For large-scale operations, process in batches
let pendingElements = [];
let processingBatch = false;

// Function to process elements in batches
function processBatch() {
    if (processingBatch || pendingElements.length === 0) return;

    processingBatch = true;

    const BATCH_SIZE = 100;
    const elementsToProcess = pendingElements.splice(0, BATCH_SIZE);

    elementsToProcess.forEach(el => {
        const style = window.getComputedStyle(el);
        // Check background color
        const bgColor = style.backgroundColor;
        if (rgbToReplace.includes(bgColor)) {
            // Special case for rgb(33, 33, 33)
            if (bgColor === 'rgb(34, 34, 34)') {
                el.style.backgroundColor = '#000000';
            } else {
                el.style.backgroundColor = '#000000';
            }
        }
        // Check text color
        const textColor = style.color;
        if (rgbToReplace.includes(textColor)) {
            el.style.color = '#000000';
        }
        // Check border color
        const borderColor = style.borderColor;
        if (rgbToReplace.includes(borderColor)) {
            el.style.borderColor = '#000000';
        }
    });

    processingBatch = false;

    // If more elements are queued, process next batch in next animation frame
    if (pendingElements.length > 0) {
        window.requestAnimationFrame(processBatch);
    }
}

// More thorough function to process colors
function processColors() {
    // Query all visible elements (more thorough than before)
    const elements = document.querySelectorAll('*');

    // Add elements to pending queue
    pendingElements = Array.from(elements);

    // Start batch processing
    if (!processingBatch) {
        window.requestAnimationFrame(processBatch);
    }
}

// Function to remove unwanted elements
function removeElements() {
    elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Also remove ads
    removeAds();

    // Remove seizure warnings
    removeSeizureWarnings();
}

// Function to handle star ratings format (e.g., "4.5/5")
function processRatings() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        // Skip video player duration elements
        if (node.parentNode &&
            (node.parentNode.className && node.parentNode.className.includes('fluid_control_duration'))) {
            continue;
        }

        if (node.nodeValue && node.nodeValue.match(/\d+(\.\d+)?\s*\/\s*\d+/)) {
            textNodes.push(node);
        }
    }

    textNodes.forEach(textNode => {
        textNode.nodeValue = textNode.nodeValue.replace(/(\d+(\.\d+)?)\s*\/\s*\d+/, '$1');
    });
}

// Debounce function to limit how often processing runs
function debounce(func, wait) {
    let timeout;
    return function () {
        clearTimeout(timeout);
        timeout = setTimeout(func, wait);
    };
}

// Debounced versions of our processing functions
const debouncedProcessColors = debounce(processColors, 50);
const debouncedProcessRatings = debounce(processRatings, 100);
const debouncedProcessResolution = debounce(processResolutionElements, 100);
const debouncedProcessTimestamp = debounce(processTimestampElements, 100);
const debouncedProcessRatingElements = debounce(processRatingElements, 100);
const debouncedProcessCardText = debounce(processCardTextElements, 100);
const debouncedRemoveSeizureWarnings = debounce(removeSeizureWarnings, 100);

// Initial processing
removeElements();
processColors();
processRatings();
processResolutionElements();
processTimestampElements();
processRatingElements();
processCardTextElements();

// Use a single MutationObserver for all dynamic changes
const observer = new MutationObserver((mutations) => {
    // Always remove unwanted elements immediately
    removeElements();

    // Check if any nodes were added
    const hasAddedNodes = mutations.some(mutation =>
        mutation.type === 'childList' && mutation.addedNodes.length > 0
    );

    // Only run heavy processes if relevant mutations occurred
    const needsColorProcessing = mutations.some(mutation =>
        mutation.type === 'attributes' &&
        (mutation.attributeName === 'style' || mutation.attributeName === 'class') ||
        hasAddedNodes
    );

    if (needsColorProcessing) {
        debouncedProcessColors();
        debouncedProcessRatings();
    }

    // Process specialized elements when DOM changes
    if (hasAddedNodes) {
        debouncedProcessResolution();
        debouncedProcessTimestamp();
        debouncedProcessRatingElements();
        debouncedProcessCardText();
        debouncedRemoveSeizureWarnings();
    }
});

// Observe document
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
});
