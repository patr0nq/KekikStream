/* ═══════════════════════════════════════════
   KekikStream GUI — Main Application
   SPA Router + Page Renderers
   ═══════════════════════════════════════════ */

// ─── Toast System ─────────────────────────

const Toast = {
    show(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// ─── App State ────────────────────────────

const State = {
    plugins: [],
    currentPlugin: null,
    currentItem: null,
    searchQuery: '',
    playerPreference: 'builtin', // 'builtin', 'mpv', 'vlc'
};

// ─── Main App ─────────────────────────────

const App = {
    async init() {
        const loadingText = document.getElementById('loading-text');

        // Ayarları yükle (pywebview hazır olur olmaz)
        loadingText.textContent = 'Bağlanıyor...';
        const apiReady = await this._waitForApi();

        if (apiReady) {
            // Ayarları hemen yükle
            try {
                const settings = await API.getSettings();
                if (settings) {
                    if (settings.theme) Theme.set(settings.theme);
                    if (settings.player) State.playerPreference = settings.player;
                }
            } catch (e) { }
        }

        // Backend eklentileri arka planda yüklüyor — bekle
        loadingText.textContent = 'Eklentiler yükleniyor...';

        // Yükleme süresince animasyonlu durum göster
        let dotCount = 0;
        const loadingAnim = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            loadingText.textContent = 'Eklentiler yükleniyor' + '.'.repeat(dotCount);
        }, 500);

        const ready = await API.waitReady(120000);
        clearInterval(loadingAnim);

        if (!ready) {
            let errMsg = 'Backend bağlantısı kurulamadı!';
            if (window._backendInitError) {
                errMsg = 'Başlatma Hatası: ' + window._backendInitError;
            }
            loadingText.textContent = errMsg;
            Toast.show(errMsg + ' Uygulamayı yeniden başlatın.', 'error');
            return;
        }

        // Plugin'leri al
        State.plugins = await API.getPlugins();

        if (!State.plugins || State.plugins.length === 0) {
            loadingText.textContent = 'Eklenti bulunamadı!';
            return;
        }

        loadingText.textContent = `${State.plugins.length} eklenti hazır!`;

        // Loading ekranını kaldır
        setTimeout(() => {
            document.getElementById('loading-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
            }, 400);
        }, 300);

        // Ana sayfayı göster
        this.navigate('home');
    },

    /**
     * pywebview API bridge'inin hazır olmasını bekle (plugin init'den ayrı)
     */
    async _waitForApi(maxWait = 5000) {
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            if (window.pywebview && window.pywebview.api) return true;
            await new Promise(r => setTimeout(r, 50));
        }
        return false;
    },

    // ─── Router ─────────────────────────────

    navigate(page, params = {}) {
        const main = document.getElementById('main-content');
        main.innerHTML = '';

        switch (page) {
            case 'home':
                this.renderHome(main);
                break;
            case 'plugin':
                this.renderPlugin(main, params);
                break;
            case 'search':
                this.renderSearchResults(main, params);
                break;
            case 'detail':
                this.renderDetail(main, params);
                break;
            case 'links':
                this.renderLinks(main, params);
                break;
            case 'settings':
                this.renderSettings(main);
                break;
            default:
                this.renderHome(main);
        }
    },

    // ─── Search ────────────────────────────

    async doSearch() {
        const input = document.getElementById('search-input');
        const query = input.value.trim();
        if (!query) return;

        State.searchQuery = query;
        this.navigate('search', { query });
    },

    // ─── Home Page ─────────────────────────

    renderHome(container) {
        container.innerHTML = `
            <div class="page-enter px-6 pb-12">
                <!-- Hero Section -->
                <div class="relative overflow-hidden rounded-2xl mb-10 mt-4" style="background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 50%, #2563eb 100%);">
                    <div class="px-10 py-14 relative z-10">
                        <h2 class="text-4xl font-extrabold text-white mb-3">Hoş Geldiniz 🎬</h2>
                        <p class="text-white/80 text-lg max-w-xl mb-6">
                            ${State.plugins.length} kaynaktan film, dizi ve anime arayın. Netflix ve YouTube kalitesinde izleme deneyimi.
                        </p>
                        <div class="flex gap-3">
                            <button onclick="document.getElementById('search-input').focus()"
                                class="px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-all shadow-lg">
                                🔍 Hemen Ara
                            </button>
                            <button onclick="App.navigate('settings')"
                                class="px-6 py-3 rounded-xl bg-white/20 text-white font-semibold text-sm hover:bg-white/30 transition-all backdrop-blur">
                                ⚙️ Ayarlar
                            </button>
                        </div>
                    </div>
                    <!-- Decorative circles -->
                    <div class="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full"></div>
                    <div class="absolute -bottom-32 -left-16 w-80 h-80 bg-white/5 rounded-full"></div>
                </div>

                <!-- Plugin Grid -->
                <div class="mb-8">
                    <h3 class="text-xl font-bold mb-5" style="color: var(--text-primary)">
                        📺 Kaynaklar <span class="text-sm font-normal" style="color: var(--text-muted)">(${State.plugins.length} eklenti)</span>
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="plugin-grid">
                        ${State.plugins.map(p => this._pluginCard(p)).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    _pluginCard(plugin) {
        const catCount = plugin.categories ? plugin.categories.length : 0;
        return `
            <div class="plugin-card" onclick="App.navigate('plugin', { name: '${plugin.name}' })">
                <img class="plugin-icon" src="${plugin.favicon}" alt="${plugin.display_name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>📺</text></svg>'">
                <div class="plugin-info flex-1 min-w-0">
                    <h3>${plugin.display_name}</h3>
                    <p>${plugin.description || 'Açıklama yok'}</p>
                    ${catCount > 0 ? `<span class="text-xs mt-1 inline-block" style="color: var(--accent)">${catCount} kategori</span>` : ''}
                </div>
            </div>
        `;
    },

    // ─── Plugin Page ────────────────────────

    async renderPlugin(container, params) {
        const plugin = State.plugins.find(p => p.name === params.name);
        if (!plugin) {
            Toast.show('Eklenti bulunamadı!', 'error');
            return this.navigate('home');
        }

        State.currentPlugin = plugin;

        container.innerHTML = `
            <div class="page-enter px-6 pb-12">
                <!-- Plugin Header -->
                <div class="flex items-center gap-4 mt-4 mb-8">
                    <button onclick="App.navigate('home')" class="p-2 rounded-lg hover:bg-white/10 transition" style="color: var(--text-primary)">
                        ← Geri
                    </button>
                    <img class="w-10 h-10 rounded-xl" src="${plugin.favicon}" alt="${plugin.display_name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>📺</text></svg>'">
                    <div>
                        <h2 class="text-2xl font-bold" style="color: var(--text-primary)">${plugin.display_name}</h2>
                        <p class="text-sm" style="color: var(--text-muted)">${plugin.description || ''}</p>
                    </div>
                </div>

                <!-- Categories -->
                <div id="plugin-categories">
                    ${this._renderSkeletonRows(3)}
                </div>
            </div>
        `;

        // Kategorileri paralel yükle
        await this._loadPluginCategories(plugin);
    },

    async _loadPluginCategories(plugin) {
        const catContainer = document.getElementById('plugin-categories');
        if (!catContainer) return;

        if (!plugin.categories || plugin.categories.length === 0) {
            catContainer.innerHTML = `<p class="text-center py-12" style="color: var(--text-muted)">Bu eklentide kategori bulunamadı.</p>`;
            return;
        }

        // İlk 6 kategoriyi paralel yükle
        const categoriesToLoad = plugin.categories.slice(0, 6);
        const categoryResults = [];

        // Paralel yükleme — Promise.allSettled ile hepsi aynı anda
        const promises = categoriesToLoad.map(async (cat, idx) => {
            try {
                const items = await API.getMainPage(plugin.name, 1, cat.url, cat.name);
                return { idx, name: cat.name, items: items || [] };
            } catch (e) {
                console.error(`Category error (${cat.name}):`, e);
                return { idx, name: cat.name, items: [] };
            }
        });

        // Her biri bittiğinde progressive güncelle
        let completed = 0;
        for (const promise of promises) {
            const result = await promise;
            categoryResults[result.idx] = result;
            completed++;

            // Progressive render
            let html = '';
            for (const cr of categoryResults) {
                if (cr && cr.items.length > 0) {
                    html += this._categoryRow(cr.name, cr.items, plugin.name);
                }
            }
            if (catContainer) {
                catContainer.innerHTML = html || `<p class="text-center py-8" style="color: var(--text-muted)">İçerik yükleniyor... (${completed}/${categoriesToLoad.length})</p>`;
                this._initScrollArrows();
            }
        }

        // Final check
        const finalHtml = catContainer?.innerHTML || '';
        if (!finalHtml || finalHtml.includes('İçerik yükleniyor')) {
            if (catContainer) catContainer.innerHTML = `<p class="text-center py-12" style="color: var(--text-muted)">İçerik bulunamadı.</p>`;
        }
    },

    _categoryRow(title, items, pluginName) {
        const rowId = 'row-' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="category-section">
                <div class="category-header">
                    <h3 class="category-title">${title}</h3>
                </div>
                <div class="scroll-row">
                    <button class="scroll-arrow scroll-arrow-left" data-row="${rowId}" onclick="App._scrollRow('${rowId}', -1)">◀</button>
                    <div class="scroll-row-inner" id="${rowId}">
                        ${items.map(item => this._contentCard(item, pluginName)).join('')}
                    </div>
                    <button class="scroll-arrow scroll-arrow-right" data-row="${rowId}" onclick="App._scrollRow('${rowId}', 1)">▶</button>
                </div>
            </div>
        `;
    },

    _scrollRow(rowId, direction) {
        const row = document.getElementById(rowId);
        if (!row) return;
        const scrollAmount = row.clientWidth * 0.75;
        row.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    },

    _initScrollArrows() {
        // Scroll durumuna göre okları gizle/göster
        document.querySelectorAll('.scroll-row-inner').forEach(row => {
            const parent = row.closest('.scroll-row');
            if (!parent) return;
            const leftBtn = parent.querySelector('.scroll-arrow-left');
            const rightBtn = parent.querySelector('.scroll-arrow-right');
            if (!leftBtn || !rightBtn) return;

            const update = () => {
                leftBtn.style.display = row.scrollLeft <= 10 ? 'none' : 'flex';
                rightBtn.style.display = row.scrollLeft >= row.scrollWidth - row.clientWidth - 10 ? 'none' : 'flex';
            };
            row.addEventListener('scroll', update);
            update();
        });
    },

    _contentCard(item, pluginName) {
        const posterUrl = item.poster || '';
        const safeTitle = (item.title || 'Bilinmiyor').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeUrl = (item.url || '').replace(/'/g, "\\'");

        return `
            <div class="scroll-item">
                <div class="content-card" onclick="App.navigate('detail', { plugin: '${pluginName}', url: '${safeUrl}', title: '${safeTitle}' })">
                    <div class="poster-container">
                        ${posterUrl
                ? `<img src="${posterUrl}" alt="${safeTitle}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-4xl\\'>🎬</div>'">`
                : `<div class="flex items-center justify-center h-full text-4xl">🎬</div>`
            }
                        <div class="poster-overlay">
                            <div class="play-icon">
                                <span class="text-white text-xl">▶</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-info">
                        <div class="card-title" title="${safeTitle}">${item.title || 'Bilinmiyor'}</div>
                        ${item.plugin_display ? `<div class="card-meta">${item.plugin_display}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    // ─── Search Results (Progressive) ──────────────────────

    async renderSearchResults(container, params) {
        const query = params.query || State.searchQuery;
        if (!query) return this.navigate('home');

        container.innerHTML = `
            <div class="page-enter px-6 pb-12">
                <div class="flex items-center gap-4 mt-4 mb-6">
                    <button onclick="App.navigate('home')" class="p-2 rounded-lg hover:bg-white/10 transition" style="color: var(--text-primary)">
                        ← Geri
                    </button>
                    <h2 class="text-2xl font-bold" style="color: var(--text-primary)">
                        🔍 "${query}" araması
                    </h2>
                </div>
                <div id="search-status" class="flex items-center gap-3 mb-4">
                    <div class="w-5 h-5 rounded-full border-3 border-surface-700 border-t-primary-500 animate-spin"></div>
                    <span class="text-sm" style="color: var(--text-muted)" id="search-counter">
                        ${State.plugins.length} kaynakta aranıyor...
                    </span>
                </div>
                <div id="search-results"></div>
            </div>
        `;

        const resultsContainer = document.getElementById('search-results');
        const counterEl = document.getElementById('search-counter');
        const statusEl = document.getElementById('search-status');
        if (!resultsContainer) return;

        let totalFound = 0;
        let completed = 0;
        const total = State.plugins.length;

        // Her plugin için paralel arama başlat
        const promises = State.plugins.map(async (plugin) => {
            try {
                const result = await API.searchPlugin(plugin.name, query);
                completed++;

                // Boş sonuçları atla
                if (!result || !result.results || result.results.length === 0) {
                    if (counterEl) counterEl.textContent = `${completed}/${total} kaynak tarandı • ${totalFound} sonuç`;
                    return;
                }

                totalFound += result.results.length;
                if (counterEl) counterEl.textContent = `${completed}/${total} kaynak tarandı • ${totalFound} sonuç`;

                // Sonuçları anında DOM'a ekle
                const section = document.createElement('div');
                section.className = 'category-section';
                section.innerHTML = `
                    <div class="category-header">
                        <h3 class="category-title">
                            ${result.plugin_display || plugin.display_name}
                            <span class="text-sm font-normal" style="color: var(--text-muted)">(${result.results.length})</span>
                        </h3>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        ${result.results.map(item => `
                            <div class="content-card" onclick="App.navigate('detail', { plugin: '${item.plugin_name}', url: '${(item.url || '').replace(/'/g, "\\'")}', title: '${(item.title || '').replace(/'/g, "\\'")}' })">
                                <div class="poster-container">
                                    ${item.poster
                        ? `<img src="${item.poster}" alt="${item.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-4xl\\'>🎬</div>'">`
                        : `<div class="flex items-center justify-center h-full text-4xl">🎬</div>`
                    }
                                    <div class="poster-overlay">
                                        <div class="play-icon"><span class="text-white text-xl">▶</span></div>
                                    </div>
                                </div>
                                <div class="card-info">
                                    <div class="card-title">${item.title || 'Bilinmiyor'}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                resultsContainer.appendChild(section);

            } catch (e) {
                completed++;
                if (counterEl) counterEl.textContent = `${completed}/${total} kaynak tarandı • ${totalFound} sonuç`;
            }
        });

        // Tüm promise'leri bekle
        await Promise.allSettled(promises);

        // Spinner'ı kaldır ve son durumu göster
        if (statusEl) {
            if (totalFound === 0) {
                statusEl.innerHTML = '';
                resultsContainer.innerHTML = `
                    <div class="text-center py-20">
                        <span class="text-6xl mb-4 block">😔</span>
                        <p class="text-xl font-semibold mb-2" style="color: var(--text-primary)">Sonuç bulunamadı</p>
                        <p style="color: var(--text-muted)">Farklı anahtar kelimelerle tekrar deneyin.</p>
                    </div>
                `;
            } else {
                statusEl.innerHTML = `
                    <span class="text-sm" style="color: var(--text-muted)">
                        ✅ ${total} kaynak tarandı • ${totalFound} sonuç bulundu
                    </span>
                `;
            }
        }
    },

    // ─── Detail Page ─────────────────────────

    async renderDetail(container, params) {
        const { plugin, url, title } = params;
        if (!plugin || !url) return this.navigate('home');

        container.innerHTML = `
            <div class="page-enter px-6 pb-12">
                <div class="flex items-center gap-4 mt-4 mb-6">
                    <button onclick="history.back() || App.navigate('home')" class="p-2 rounded-lg hover:bg-white/10 transition" style="color: var(--text-primary)">
                        ← Geri
                    </button>
                    <h2 class="text-xl font-bold" style="color: var(--text-primary)">${title || 'Yükleniyor...'}</h2>
                </div>
                <div id="detail-content">
                    <div class="flex items-center justify-center py-20">
                        <div class="w-12 h-12 rounded-full border-4 border-surface-700 border-t-primary-500 animate-spin"></div>
                    </div>
                </div>
            </div>
        `;

        const item = await API.loadItem(plugin, url);
        const detailEl = document.getElementById('detail-content');
        if (!detailEl) return;

        if (!item) {
            detailEl.innerHTML = `
                <div class="text-center py-20">
                    <span class="text-5xl mb-4 block">❌</span>
                    <p style="color: var(--text-primary)" class="text-lg font-semibold">İçerik yüklenemedi</p>
                </div>
            `;
            return;
        }

        State.currentItem = { ...item, plugin_name: plugin };

        const isSeries = item.is_series && item.episodes && item.episodes.length > 0;

        detailEl.innerHTML = `
            <div class="flex flex-col lg:flex-row gap-8">
                <!-- Poster -->
                <div class="flex-shrink-0">
                    ${item.poster
                ? `<img src="${item.poster}" alt="${item.title}" class="w-64 rounded-2xl shadow-2xl" onerror="this.outerHTML='<div class=\\'w-64 h-96 rounded-2xl flex items-center justify-center text-6xl\\' style=\\'background: var(--bg-card)\\'>🎬</div>'">`
                : `<div class="w-64 h-96 rounded-2xl flex items-center justify-center text-6xl" style="background: var(--bg-card)">🎬</div>`
            }
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                    <h1 class="text-3xl font-extrabold mb-3" style="color: var(--text-primary)">${item.title || 'Bilinmiyor'}</h1>

                    <!-- Meta info -->
                    <div class="flex flex-wrap gap-3 mb-5">
                        ${item.year ? `<span class="badge">📅 ${item.year}</span>` : ''}
                        ${item.rating ? `<span class="badge">⭐ ${item.rating}</span>` : ''}
                        ${item.duration ? `<span class="badge">⏱ ${item.duration} dk</span>` : ''}
                    </div>

                    ${item.description ? `<p class="text-sm leading-relaxed mb-5" style="color: var(--text-secondary)">${item.description}</p>` : ''}

                    ${item.tags ? `
                        <div class="mb-4">
                            <span class="text-sm font-semibold" style="color: var(--text-muted)">Türler:</span>
                            <span class="text-sm ml-2" style="color: var(--text-secondary)">${item.tags}</span>
                        </div>
                    ` : ''}

                    ${item.actors ? `
                        <div class="mb-5">
                            <span class="text-sm font-semibold" style="color: var(--text-muted)">Oyuncular:</span>
                            <span class="text-sm ml-2" style="color: var(--text-secondary)">${item.actors}</span>
                        </div>
                    ` : ''}

                    <!-- Action Buttons -->
                    ${!isSeries ? `
                        <button onclick="App._loadAndShowLinks('${plugin}', '${url.replace(/'/g, "\\'")}')"
                            class="px-8 py-3 rounded-xl font-semibold text-white text-sm transition-all shadow-lg hover:shadow-xl hover:scale-105"
                            style="background: var(--accent)">
                            ▶ İzle
                        </button>
                    ` : ''}
                </div>
            </div>

            ${isSeries ? `
                <!-- Episode List -->
                <div class="mt-10">
                    <h3 class="text-xl font-bold mb-4" style="color: var(--text-primary)">
                        📺 Bölümler <span class="text-sm font-normal" style="color: var(--text-muted)">(${item.episodes.length} bölüm)</span>
                    </h3>
                    <div class="flex flex-col gap-3" id="episodes-list">
                        ${item.episodes.map((ep, idx) => `
                            <div class="episode-item" onclick="App._loadAndShowLinks('${plugin}', '${(ep.url || '').replace(/'/g, "\\'")}')">
                                <span class="episode-number">${ep.episode || (idx + 1)}</span>
                                <div class="flex-1 min-w-0">
                                    <div class="font-semibold text-sm" style="color: var(--text-primary)">
                                        ${ep.season ? `${ep.season}. Sezon ` : ''}${ep.episode ? `${ep.episode}. Bölüm` : `Bölüm ${idx + 1}`}
                                    </div>
                                    ${ep.title ? `<div class="text-xs mt-1" style="color: var(--text-muted)">${ep.title}</div>` : ''}
                                </div>
                                <span style="color: var(--accent)">▶</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    },

    // ─── Links Page ──────────────────────────

    async _loadAndShowLinks(pluginName, url) {
        this.navigate('links', { plugin: pluginName, url });
    },

    async renderLinks(container, params) {
        const { plugin, url } = params;

        container.innerHTML = `
            <div class="page-enter px-6 pb-12">
                <div class="flex items-center gap-4 mt-4 mb-6">
                    <button onclick="history.back() || App.navigate('home')" class="p-2 rounded-lg hover:bg-white/10 transition" style="color: var(--text-primary)">
                        ← Geri
                    </button>
                    <h2 class="text-xl font-bold" style="color: var(--text-primary)">🔗 Oynatma Kaynakları</h2>
                </div>
                <div id="links-content">
                    <div class="py-10">
                        <div class="flex items-center gap-4 mb-4">
                            <div class="w-10 h-10 rounded-full border-4 border-surface-700 border-t-primary-500 animate-spin flex-shrink-0"></div>
                            <div class="flex-1">
                                <p class="text-sm font-semibold mb-2" style="color: var(--text-primary)">Linkler çözümleniyor...</p>
                                <div class="progress-container">
                                    <div class="progress-bar" id="link-progress" style="width: 5%"></div>
                                </div>
                                <p class="text-xs mt-2" style="color: var(--text-muted)" id="link-status">Extractorlar çalışıyor...</p>
                            </div>
                        </div>
                        <div id="links-live-list" class="flex flex-col gap-2 mt-4"></div>
                    </div>
                </div>
            </div>
        `;

        // Animasyonlu progress bar
        const progressBar = document.getElementById('link-progress');
        const statusText = document.getElementById('link-status');
        let progressInterval = null;
        let progressValue = 5;

        progressInterval = setInterval(() => {
            if (progressValue < 90) {
                progressValue += Math.random() * 5;
                if (progressBar) progressBar.style.width = Math.min(progressValue, 90) + '%';
            }
        }, 600);

        // Timeout yok — backend bitene kadar bekle
        const links = await API.loadLinks(plugin, url);

        clearInterval(progressInterval);
        if (progressBar) progressBar.style.width = '100%';

        const linksEl = document.getElementById('links-content');
        if (!linksEl) return;

        if (!links || links.length === 0) {
            linksEl.innerHTML = `
                <div class="text-center py-20">
                    <span class="text-5xl mb-4 block">😔</span>
                    <p class="text-lg font-semibold mb-2" style="color: var(--text-primary)">Link bulunamadı</p>
                    <p style="color: var(--text-muted)">Bu içerik için oynatılabilir kaynak bulunamadı.</p>
                </div>
            `;
            return;
        }

        linksEl.innerHTML = `
            <p class="text-sm mb-4" style="color: var(--text-muted)">${links.length} kaynak bulundu. Oynatmak için birini seçin:</p>
            <div class="flex flex-col gap-3">
                ${links.map((link, idx) => {
            const isWebPlayerCompatible = !link.referer; // Eğer referer varsa CORS %99 yasaklıdır
            return `
                    <div class="link-card" onclick="App._playLink(${idx})">
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <span class="text-2xl flex-shrink-0">🎬</span>
                            <div class="min-w-0">
                                <div class="font-semibold text-sm truncate" style="color: var(--text-primary)">${link.name || `Kaynak ${idx + 1}`}</div>
                                <div class="text-xs mt-1" style="color: var(--text-muted)">${this._extractDomain(link.url)}</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            ${isWebPlayerCompatible ? `
                            <button onclick="event.stopPropagation(); App._playLinkWith(${idx}, 'builtin')"
                                class="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                                style="background: var(--accent); color: white"
                                title="Tarayıcıda Oynat">
                                ▶ Oynat
                            </button>
                            ` : ''}
                            <button onclick="event.stopPropagation(); App._playLinkWith(${idx}, 'mpv')"
                                class="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                                style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color)"
                                title="MPV ile Aç">
                                🎥 MPV
                            </button>
                            <button onclick="event.stopPropagation(); App._playLinkWith(${idx}, 'vlc')"
                                class="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                                style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color)"
                                title="VLC ile Aç">
                                📺 VLC
                            </button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;

        // Linkleri state'e kaydet
        State._currentLinks = links;
    },

    async _playLink(index) {
        const link = State._currentLinks?.[index];
        if (!link) return;

        // Kullanıcı tercihine göre oynat
        if (State.playerPreference === 'builtin') {
            const isWebPlayerCompatible = !link.referer;
            if (isWebPlayerCompatible) {
                this._playLinkWith(index, 'builtin');
            } else {
                Toast.show('Bu kaynak tarayıcı korumalı. MPV ile açılıyor...', 'info');
                this._playLinkWith(index, 'mpv');
            }
        } else {
            this._playLinkWith(index, State.playerPreference);
        }
    },

    async _playLinkWith(index, playerType) {
        const link = State._currentLinks?.[index];
        if (!link) return;

        const title = State.currentItem?.title || 'KekikStream';

        if (playerType === 'builtin') {
            Player.play(link.url, title, link);
        } else {
            Toast.show(`${playerType.toUpperCase()} ile açılıyor...`, 'info');
            const result = await API.playExternal(
                playerType,
                link.url,
                title,
                link.user_agent || '',
                link.referer || '',
                link.subtitles || []
            );
            if (result && result.success) {
                Toast.show(`${playerType.toUpperCase()} başarıyla açıldı!`, 'success');
            } else {
                Toast.show(result?.error || 'Oynatıcı açılamadı.', 'error');
            }
        }
    },

    _extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url?.substring(0, 50) || '';
        }
    },

    // ─── Settings Page ──────────────────────

    renderSettings(container) {
        container.innerHTML = `
            <div class="page-enter px-6 pb-12 max-w-2xl mx-auto">
                <div class="flex items-center gap-4 mt-4 mb-8">
                    <button onclick="App.navigate('home')" class="p-2 rounded-lg hover:bg-white/10 transition" style="color: var(--text-primary)">
                        ← Geri
                    </button>
                    <h2 class="text-2xl font-bold" style="color: var(--text-primary)">⚙️ Ayarlar</h2>
                </div>

                <!-- Theme -->
                <div class="settings-card mb-6">
                    <h3 class="text-lg font-bold mb-4" style="color: var(--text-primary)">🎨 Görünüm</h3>
                    <div class="settings-option">
                        <div>
                            <div class="font-semibold text-sm" style="color: var(--text-primary)">Karanlık Tema</div>
                            <div class="text-xs" style="color: var(--text-muted)">Netflix tarzı koyu arayüz</div>
                        </div>
                        <div class="toggle-switch ${Theme.current === 'dark' ? 'active' : ''}" onclick="Theme.toggle(); this.classList.toggle('active')"></div>
                    </div>
                </div>

                <!-- Player -->
                <div class="settings-card mb-6">
                    <h3 class="text-lg font-bold mb-4" style="color: var(--text-primary)">▶ Video Oynatıcı</h3>
                    <p class="text-xs mb-4" style="color: var(--text-muted)">Varsayılan oynatıcıyı seçin (her link için ayrıca değiştirebilirsiniz)</p>
                    <div class="flex flex-col gap-2">
                        ${this._playerOption('builtin', '🌐 Gömülü Player (HTML5)', 'Tarayıcı içinde oynatma — hls.js ile M3U8 desteği')}
                        ${this._playerOption('mpv', '🎥 MPV', 'Harici MPV oynatıcı — en iyi codec desteği')}
                        ${this._playerOption('vlc', '📺 VLC', 'Harici VLC oynatıcı — en popüler medya oynatıcı')}
                    </div>
                </div>

                <!-- Info -->
                <div class="settings-card">
                    <h3 class="text-lg font-bold mb-4" style="color: var(--text-primary)">ℹ️ Hakkında</h3>
                    <div class="text-sm" style="color: var(--text-secondary)">
                        <p class="mb-2"><strong>KekikStream GUI</strong> — Netflix/YouTube tarzı arayüz</p>
                        <p class="mb-2">Eklenti sayısı: <strong>${State.plugins.length}</strong></p>
                        <p>Pywebview + HTML + Tailwind CSS + JavaScript</p>
                    </div>
                </div>
            </div>
        `;
    },

    _playerOption(value, label, desc) {
        const isActive = State.playerPreference === value;
        return `
            <div class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                        ${isActive ? '' : 'hover:opacity-80'}"
                 style="background: ${isActive ? 'var(--accent-glow)' : 'var(--bg-secondary)'}; border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}"
                 onclick="App._setPlayer('${value}')">
                <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                     style="border-color: ${isActive ? 'var(--accent)' : 'var(--text-muted)'}">
                    ${isActive ? `<div class="w-2.5 h-2.5 rounded-full" style="background: var(--accent)"></div>` : ''}
                </div>
                <div>
                    <div class="text-sm font-semibold" style="color: var(--text-primary)">${label}</div>
                    <div class="text-xs" style="color: var(--text-muted)">${desc}</div>
                </div>
            </div>
        `;
    },

    _setPlayer(value) {
        State.playerPreference = value;
        API.saveSettings({ theme: Theme.current, player: value });
        // Re-render settings
        this.renderSettings(document.getElementById('main-content'));
        Toast.show(`Varsayılan oynatıcı: ${value === 'builtin' ? 'Gömülü Player' : value.toUpperCase()}`, 'success');
    },

    // ─── Skeleton Helpers ────────────────────

    _renderSkeletonRows(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="category-section">
                    <div class="skeleton h-6 w-48 mb-4"></div>
                    <div class="flex gap-4">
                        ${Array(6).fill('').map(() => `
                            <div class="flex-shrink-0 w-[200px]">
                                <div class="skeleton" style="aspect-ratio: 2/3"></div>
                                <div class="skeleton h-4 mt-3 w-3/4"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        return html;
    }
};

// ─── Initialize ──────────────────────────

window.addEventListener('pywebviewready', () => {
    App.init();
});

// Fallback: pywebview event tetiklenmezse
setTimeout(() => {
    if (!State.plugins || State.plugins.length === 0) {
        App.init();
    }
}, 3000);
