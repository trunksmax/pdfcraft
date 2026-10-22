/**
 * Service Worker for PDFCraft
 */

const CACHE_NAME = 'pdfcraft-cache-v2';

// Large assets to cache (Pyodide WASM and Python wheels)
const PYODIDE_ASSETS = [
    '/pymupdf-wasm/pyodide.js',
    '/pymupdf-wasm/pyodide.asm.js',
    '/pymupdf-wasm/pyodide.asm.wasm',
    '/pymupdf-wasm/pyodide_py.tar',
    '/pymupdf-wasm/numpy-2.2.5-cp313-cp313-pyodide_2025_0_wasm32.whl',
    '/pymupdf-wasm/lxml-5.4.0-cp313-cp313-pyodide_2025_0_wasm32.whl',
    '/pymupdf-wasm/pymupdf-1.26.3-cp313-none-pyodide_2025_0_wasm32.whl',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. 拦截 LibreOffice 超大 WASM .bin 文件，自动拉取 15MB 分块并在内存中拼合
    if (url.pathname.endsWith('soffice.data.bin') || url.pathname.endsWith('soffice.wasm.bin')) {
        event.respondWith(
            (async () => {
                try {
                    const manifestRes = await fetch(`${url.href}.manifest.json`);
                    if (!manifestRes.ok) return await fetch(event.request);

                    const { totalChunks, originalSize } = await manifestRes.json();

                    // 并行下载所有 15MB 分块
                    const chunkPromises = Array.from({ length: totalChunks }, (_, i) =>
                        fetch(`${url.href}.part${i + 1}`).then((r) => {
                            if (!r.ok) throw new Error(`Chunk part ${i + 1} fetch failed`);
                            return r.arrayBuffer();
                        })
                    );

                    const chunks = await Promise.all(chunkPromises);

                    // 快速拼接 Buffer
                    const combined = new Uint8Array(originalSize);
                    let offset = 0;
                    for (const chunk of chunks) {
                        combined.set(new Uint8Array(chunk), offset);
                        offset += chunk.byteLength;
                    }

                    return new Response(combined, {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/octet-stream',
                            'Content-Length': originalSize.toString(),
                        },
                    });
                } catch (err) {
                    console.warn('[SW Chunking] Failed to reassemble chunked file, falling back:', err);
                    return await fetch(event.request);
                }
            })()
        );
        return;
    }

    // 2. 保持原有的 Cache Pyodide assets 逻辑 (WASM, wheels)
    const isPyodideAsset = url.pathname.startsWith('/pymupdf-wasm/') &&
        (url.pathname.endsWith('.wasm') ||
            url.pathname.endsWith('.whl') ||
            url.pathname.endsWith('.tar') ||
            url.pathname.endsWith('.js'));

    if (isPyodideAsset) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Pass through all other requests
});
