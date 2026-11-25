/* Trusted same-origin, blocking theme selection before first paint. No user HTML. */
(()=>{try{document.documentElement.dataset.theme=localStorage.getItem('trading-journal-theme')==='light'?'light':'dark';}catch{document.documentElement.dataset.theme='dark';}})();
