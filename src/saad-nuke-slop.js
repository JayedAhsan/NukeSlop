(function () {
    'use strict';

    if (window.__uiFeedCleanup) {
        window.__uiFeedCleanup();
        return;
    }

    const STYLE_ID = 'ui-feed-filter-style';
    const TOAST_ID = 'ui-status-pill';
    const css = `
        [data-uifilter="1"] > *,
        [data-uifilter="ai"] > * { display: none !important; }
        [data-uifilter="1"]::before,
        [data-uifilter="ai"]::before {
            display: block;
            padding: 6px 12px;
            font-size: 12px;
            color: #8a8d91;
            text-align: center;
        }
        [data-uifilter="1"]::before { content: "Nuked sponsored post"; }
        [data-uifilter="ai"]::before { content: "Nuked AI content"; }
        [data-uifilter="rhc"],
        [role="complementary"] div[data-visualcompletion="ignore-late-mutation"]:has(a[attributionsrc], a[href*="/ads/about"]) {
            display: none !important;
        }
    `;

    function ensureStyle() {
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        }
    }

    function showToast(msg, isOnline) {
        const existing = document.getElementById(TOAST_ID);
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = TOAST_ID;
        const dotColor = isOnline ? '#0765ff' : '#ff453a';

        toast.innerHTML = `
            <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 8px ${dotColor};flex-shrink:0;"></span>
            <span>${msg}</span>
        `;

        toast.style.cssText = [
            'position:fixed',
            'bottom:24px',
            'right:24px',
            'transform:translateY(20px) scale(0.92)',
            'opacity:0',
            'display:flex',
            'align-items:center',
            'gap:10px',
            'padding:10px 18px',
            'background:#000000',
            'border:1px solid rgba(255, 255, 255, 0.18)',
            'border-radius:9999px',
            'box-shadow:0 12px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            'color:#f5f5f7',
            'font-family:-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
            'font-size:13.5px',
            'font-weight:500',
            'letter-spacing:-0.01em',
            'z-index:2147483647',
            'pointer-events:none',
            'transition:transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease'
        ].join(';');

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateY(0) scale(1)';
                toast.style.opacity = '1';
            });
        });

        setTimeout(() => {
            toast.style.transform = 'translateY(16px) scale(0.95)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 2200);
    }

    function decodeLabel(outerB) {
        let text = '';
        for (const child of outerB.children) {
            if (child.tagName === 'B' && child.style.display !== 'none') {
                text += child.textContent;
            }
        }
        return text.replace(/\u00a0/g, ' ').trim();
    }

    function collapsePostContaining(el, type) {
        if (el.closest('[data-uifilter]')) return;

        let node = el;
        let fallbackNode = null;

        while (node && node !== document.body) {
            const parent = node.parentElement;
            if (parent && parent.getAttribute('role') === 'feed') {
                if (!node.querySelector('[role="feed"]')) {
                    node.setAttribute('data-uifilter', type);
                }
                return;
            }
            if (
                !fallbackNode &&
                node.tagName === 'DIV' &&
                node.querySelector(':scope > div > div[aria-hidden="true"][data-0] > blockquote')
            ) {
                fallbackNode = node;
            }
            node = parent;
        }

        if (fallbackNode && !fallbackNode.querySelector('[role="feed"]')) {
            fallbackNode.setAttribute('data-uifilter', type);
        }
    }

    function scanFeed() {
        ensureStyle();

        document.querySelectorAll(
            'a[href^="/ads/about"]:not([data-uiscan]), a[href^="https://www.facebook.com/ads/about"]:not([data-uiscan])'
        ).forEach(link => {
            link.setAttribute('data-uiscan', '1');
            if (!link.closest('[role="complementary"]')) {
                collapsePostContaining(link, '1');
            }
        });

        document.querySelectorAll('b:not([data-uiscan]):has(> b)').forEach(label => {
            label.setAttribute('data-uiscan', '1');
            if (!label.closest('[role="complementary"]') && /^(ad|sponsored)$/i.test(decodeLabel(label))) {
                collapsePostContaining(label, '1');
            }
        });

        document.querySelectorAll('div[role="button"]:not([data-uiscan])').forEach(btn => {
            if (btn.childElementCount === 0) {
                btn.setAttribute('data-uiscan', '1');
                if (btn.textContent.trim() === 'AI content') {
                    collapsePostContaining(btn, 'ai');
                }
            }
        });

        const rail = document.querySelector('[role="complementary"]');
        if (rail) {
            rail.querySelectorAll('div[data-visualcompletion="ignore-late-mutation"]:not([data-uiscan])').forEach(box => {
                box.setAttribute('data-uiscan', '1');
                if (box.textContent.includes('Sponsored')) {
                    box.setAttribute('data-uifilter', 'rhc');
                }
            });
        }
    }

    let pending = false;
    const schedule = window.requestIdleCallback || (cb => setTimeout(cb, 250));

    const observer = new MutationObserver(mutations => {
        if (pending) return;
        let hasAddedNodes = false;
        for (let i = 0; i < mutations.length; i++) {
            if (mutations[i].addedNodes.length > 0) {
                hasAddedNodes = true;
                break;
            }
        }
        if (!hasAddedNodes) return;

        pending = true;
        schedule(() => {
            pending = false;
            scanFeed();
        });
    });

    window.__uiFeedCleanup = function () {
        observer.disconnect();
        document.getElementById(STYLE_ID)?.remove();
        document.querySelectorAll('[data-uifilter]').forEach(el => el.removeAttribute('data-uifilter'));
        document.querySelectorAll('[data-uiscan]').forEach(el => el.removeAttribute('data-uiscan'));
        delete window.__uiFeedCleanup;
        showToast('NukeSlop: Off', false);
    };

    scanFeed();
    observer.observe(document.body, { childList: true, subtree: true });
    showToast('NukeSlop: Active', true);
})();