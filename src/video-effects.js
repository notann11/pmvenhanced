     /* Video Region Selection Overlay */
     #selection-overlay {
         position: absolute;
         top: 0;
         left: 0;
         right: 0;
         bottom: 0;
         pointer-events: none;
         display: none;
         z-index: 1000;
     }

     #selection-box {
         position: absolute;
         border: 2px solid #ff3333;
         background-color: rgba(255, 51, 51, 0.2);
         display: none;
     }

     .selection-instructions {
         position: absolute;
         top: 10px;
         left: 50%;
         transform: translateX(-50%);
         background-color: rgba(0, 0, 0, 0.7);
         color: white;
         padding: 8px 12px;
         border-radius: 4px;
         font-size: 14px;
     }

     /* Buttons for selection confirmation */
     #selection-controls {
         position: absolute;
         bottom: 20px;
         left: 50%;
         transform: translateX(-50%);
         display: flex;
         gap: 10px;
         z-index: 1001;
     }

     #selection-controls button {
         padding: 8px 16px;
         border: none;
         border-radius: 4px;
         cursor: pointer;
         font-weight: bold;
         color: white;
     }

     #selection-controls button.confirm {
         background-color: #4CAF50;
     }

     #selection-controls button.reselect {
         background-color: #2196F3;
     }

     #selection-controls button.cancel {
         background-color: #f44336;
     }


     /* Loading Overlay */
     #whois-loading-overlay {
         position: fixed;
         top: 0;
         left: 0;
         width: 100%;
         height: 100%;
         background-color: rgba(0, 0, 0, 0.7);
         z-index: 999999;
         display: flex;
         justify-content: center;
         align-items: center;
     }

     .loading-content {
         display: flex;
         flex-direction: column;
         align-items: center;
     }

     .loading-spinner {
         width: 50px;
         height: 50px;
         border: 4px solid rgba(255, 255, 255, 0.3);
         border-radius: 50%;
         border-top-color: #fff;
         animation: spin 1s ease-in-out infinite;
         margin-bottom: 15px;
     }

     @keyframes spin {
         to {
             transform: rotate(360deg);
         }
     }

     .loading-message {
         color: white;
         font-size: 16px;
         font-family: Arial, sans-serif;
     }

     /* Results Modal */
     #whois-modal-overlay {
         position: fixed;
         top: 0;
         left: 0;
         width: 100%;
         height: 100%;
         background-color: rgba(0, 0, 0, 0.5);
         z-index: 999998;
     }

     #whois-results-modal {
         position: fixed;
         top: 50%;
         left: 50%;
         transform: translate(-50%, -50%);
         background-color: rgba(0, 0, 0);
         border: 1px solid #333;
         border-radius: 6px;
         box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
         z-index: 999999;
         width: 90%;
         max-width: 1000px;
         max-height: 80vh;
         overflow-y: auto;
         padding: 20px;
     }

     .modal-header {
         display: flex;
         justify-content: space-between;
         align-items: center;
         border-bottom: 1px solid #eee;
         padding-bottom: 15px;
         margin-bottom: 20px;
     }

     .modal-header h2 {
         margin: 0;
         font-size: 20px;
         color: #ffffff;
     }

     .close-button {
         background: none;
         border: none;
         font-size: 24px;
         cursor: pointer;
         color: #666;
     }

     .results-grid {
         display: grid;
         grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
         gap: 20px;
     }

     .result-item {
         border: 1px solid #333;
         border-radius: 6px;
         overflow: hidden;
         transition: transform 0.2s, box-shadow 0.2s;
     }

     .result-item:hover {
         transform: translateY(-5px);
         box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
     }

     .result-item a {
         text-decoration: none;
         color: inherit;
     }

     .result-thumbnail {
         width: 100%;
         height: 150px;
         object-fit: cover;
         display: block;
     }

     .result-info {
         padding: 10px;
     }

     .result-title {
         margin: 0 0 5px 0;
         font-size: 14px;
         line-height: 1.3;
         color: #f7f7f7;
         display: -webkit-box;
         -webkit-line-clamp: 2;
         -webkit-box-orient: vertical;
         overflow: hidden;
     }

     .result-source {
         font-size: 12px;
         color: #888;
     }


     /* Video Effects UI Styles */
     #show-video-effects {
         position: fixed;
         bottom: 70px;
         right: 20px;
         width: 40px;
         height: 40px;
         background-color: rgba(50, 50, 50, 0.85);
         color: white;
         border-radius: 50%;
         display: flex;
         align-items: center;
         justify-content: center;
         cursor: pointer;
         z-index: 999998;
         font-size: 20px;
         box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
         transition: background-color 0.2s, transform 0.2s;
     }

     #show-video-effects:hover {
         background-color: rgba(70, 70, 70, 0.9);
         transform: scale(1.1);
     }

     #video-effects-control {
         position: fixed;
         width: 280px;
         background-color: rgba(0, 0, 0, 0.75);
         color: white;
         border-radius: 8px;
         border: 1px solid rgba(20, 20, 20, 0.9);
         box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
         z-index: 999998;
         padding-bottom: 10px;
         transition: opacity 0.3s, transform 0.3s;
         user-select: none;
         font-family: Arial, sans-serif;
         font-size: 14px;
         overflow: hidden;
     }

     .title-bar {
         padding: 10px;
         background-color: rgba(0, 0, 0, 0.75);
         border-top-left-radius: 8px;
         border-top-right-radius: 8px;
         display: flex;
         justify-content: space-between;
         align-items: center;
         cursor: move;
     }

     .controls {
         display: flex;
         justify-content: space-between;
         padding: 12px;
         gap: 8px;
     }

     /* Base button style */
     .controls button {
         flex: 1;
         padding: 6px 0;
         border: none;
         border-radius: 4px;
         background-color: rgba(19, 19, 19, 0.6);
         /* Default state - dark gray */
         color: white;
         cursor: pointer;
         transition: background-color 0.2s;
     }

     /* Hover state - reddish */
     .controls button:hover {
         background-color: rgba(80, 30, 30, 0.7);
         /* Distinct hover color */
     }

     /* Active (pressed) state - darker */
     .controls button:active {
         background-color: rgba(40, 10, 10, 0.8);
         /* Distinct active color */
     }

     /* Focus state (after click) */
     .controls button:focus {
         background-color: rgba(19, 19, 19, 0.6);
         /* Back to default */
         outline: none;
     }

     /* Toggle active state - when feature is enabled */
     .controls button.active {
         background-color: rgba(240, 0, 0, 0.3);
         /* Red when toggled on */
     }

     /* Hover on already active button */
     .controls button.active:hover {
         background-color: rgba(240, 70, 70, 0.5);
         /* Brighter red on hover */
     }

     /* Active press on already active button */
     .controls button.active:active {
         background-color: rgba(180, 0, 0, 0.5);
         /* Darker red when pressed */
     }

     /* For touch devices, prevent hover state from sticking */
     @media (hover: none) {
         .controls button:hover {
             background-color: rgba(19, 19, 19, 0.6);
             /* Same as default */
         }

         .controls button.active:hover {
             background-color: rgba(240, 0, 0, 0.3);
             /* Same as active */
         }
     }

     .menu-button {
         display: block;
         width: calc(100% - 20px);
         margin: 5px 10px;
         padding: 8px 0;
         border: none;
         border-radius: 4px;
         background-color: rgba(19, 19, 19, 0.6);
         color: white;
         cursor: pointer;
         transition: background-color 0.2s;
     }

     .menu-button:hover {
         background-color: rgba(26, 26, 26, 0.658);
     }

     .back-button {
         background-color: rgba(240, 0, 0, 0.3);
         margin-top: 10px;
     }

     .back-button:hover {
         background-color: rgba(218, 22, 22, 0.568);
     }

     .section-title {
         padding: 8px 12px 2px;
         font-weight: bold;
         font-size: 12px;
         color: #aaa;
     }

     .slider-row {
         display: flex;
         align-items: center;
         padding: 5px 12px;
     }

     .slider-label {
         width: 70px;
         font-size: 13px;
     }

     .slider {
         flex: 1;
         margin: 0 8px;
         -webkit-appearance: none;
         appearance: none;
         height: 4px;
         background: #555;
         border-radius: 2px;
     }

     .slider::-webkit-slider-thumb {
         -webkit-appearance: none;
         appearance: none;
         width: 14px;
         height: 14px;
         border-radius: 50%;
         background: #b60000;
         cursor: pointer;
     }

     .slider::-moz-range-thumb {
         width: 14px;
         height: 14px;
         border-radius: 50%;
         background: #b60000;
         cursor: pointer;
         border: none;
     }

     .value {
         width: 30px;
         text-align: right;
         font-size: 13px;
     }

     .pulse-menu {
         display: flex;
         justify-content: space-between;
         padding: 0 12px 10px;
         gap: 8px;
     }

     .pulse-menu button {
         flex: 1;
         padding: 6px 0;
         border: none;
         border-radius: 4px;
         background-color: rgba(60, 60, 60, 0.6);
         color: white;
         cursor: pointer;
         transition: background-color 0.2s;
     }

     .pulse-menu button.active {
         background-color: rgba(0, 120, 215, 0.7);
     }

     .pulse-menu button:hover {
         background-color: rgba(80, 80, 80, 0.8);
     }

     /* Video Animation Styles */
     @keyframes videoPulseScale {
         0% {
             transform: scale(1);
         }

         50% {
             transform: scale(var(--pulse-scale, 1.05));
         }

         100% {
             transform: scale(1);
         }
     }

     @keyframes videoPulseGlow {
         0% {
             filter: brightness(1);
         }

         50% {
             filter: brightness(1.3);
         }

         100% {
             filter: brightness(1);
         }
     }

     @keyframes videoPulseFade {
         0% {
             opacity: 1;
         }

         50% {
             opacity: 0.7;
         }

         100% {
             opacity: 1;
         }
     }

     @keyframes videoPulseBPM {
         0% {
             transform: scale(1);
         }

         50% {
             transform: scale(var(--pulse-bpm-scale, 1.05));
         }

         100% {
             transform: scale(1);
         }
     }

     .video-pulse-scale {
         animation: videoPulseScale var(--pulse-duration, 200ms) cubic-bezier(0.215, 0.610, 0.355, 1.000) !important;
         transform-origin: center center;
     }

     .video-pulse-glow {
         animation: videoPulseGlow var(--pulse-duration, 200ms) ease-in-out !important;
     }

     .video-pulse-fade {
         animation: videoPulseFade var(--pulse-duration, 200ms) ease-in-out !important;
     }

     .video-pulse-both {
         animation:
             videoPulseScale var(--pulse-duration, 200ms) cubic-bezier(0.215, 0.610, 0.355, 1.000),
             videoPulseGlow var(--pulse-duration, 200ms) ease-in-out !important;
         transform-origin: center center;
     }

     .video-pulse-bpm {
         animation: videoPulseBPM var(--pulse-duration, 200ms) cubic-bezier(0.215, 0.610, 0.355, 1.000) !important;
         transform-origin: center center;
     }
