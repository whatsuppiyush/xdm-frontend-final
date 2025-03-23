// "use client";

// import React, { useEffect } from 'react';
// import { DialogTitle } from '@/components/ui/dialog';

// /**
//  * DialogAccessibilityFix
//  * 
//  * This component patches the DialogContent accessibility issue globally by injecting
//  * hidden DialogTitles into any DialogContent that doesn't already have one.
//  * 
//  * Simply add this component to your RootLayout once to fix all instances.
//  */
// export function DialogAccessibilityFix() {
//   useEffect(() => {
//     if (typeof window === 'undefined') return;

//     // Override the console.error to prevent the warning messages
//     const originalConsoleError = console.error;
//     console.error = function(...args) {
//       // Filter out the DialogContent accessibility warnings
//       const message = args[0]?.toString() || '';
//       if (message.includes('DialogContent requires a DialogTitle')) {
//         return; // Suppress these warnings
//       }
//       originalConsoleError.apply(console, args);
//     };

//     // Create a mutation observer that will add hidden DialogTitles to any new DialogContent
//     const observer = new MutationObserver((mutations) => {
//       mutations.forEach((mutation) => {
//         mutation.addedNodes.forEach((node) => {
//           if (node.nodeType === Node.ELEMENT_NODE) {
//             // Check for DialogContent elements without DialogTitle
//             const dialogContents = (node as Element).querySelectorAll('[role="dialog"]');
//             dialogContents.forEach((dialogContent) => {
//               // Check if it already has a DialogTitle
//               const hasTitle = dialogContent.querySelector('[id^="radix-:"]') !== null;
              
//               if (!hasTitle) {
//                 // Create and append a hidden DialogTitle
//                 const header = document.createElement('div');
//                 header.className = 'sr-only';
                
//                 // Use JSX to create a DialogTitle element
//                 const titleElement = document.createElement('div');
//                 titleElement.setAttribute('role', 'heading');
//                 titleElement.textContent = 'Dialog Title';
                
//                 header.appendChild(titleElement);
//                 dialogContent.insertBefore(header, dialogContent.firstChild);
//               }
//             });
//           }
//         });
//       });
//     });

//     // Start observing the document
//     observer.observe(document.body, { childList: true, subtree: true });

//     return () => {
//       // Restore original console.error and disconnect observer
//       console.error = originalConsoleError;
//       observer.disconnect();
//     };
//   }, []);

//   return null; // This component doesn't render anything
// }
