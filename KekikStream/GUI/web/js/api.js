/* ═══════════════════════════════════════════
   KekikStream GUI — Backend API Wrapper
   ═══════════════════════════════════════════ */

const API = {
    _api: null,

    /**
     * pywebview API referansını al
     */
    _get() {
        if (this._api) return this._api;
        if (window.pywebview && window.pywebview.api) {
            this._api = window.pywebview.api;
            return this._api;
        }
        return null;
    },

    /**
     * pywebview bridge'in yüklenmesini bekle
     */
    async _waitForApi(maxWait = 10000) {
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            if (window.pywebview && window.pywebview.api) {
                return true;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        console.warn(`[API] pywebview bridge ${maxWait / 1000}s içinde hazır olamadı!`);
        return false;
    },

    /**
     * Python backend'in hazır olmasını bekle
     */
    async waitReady(maxWait = 120000) {
        const start = Date.now();
        let lastLog = 0;
        window._backendInitError = null;

        // Önce pywebview bridge'in yüklenmesini bekle
        const bridgeReady = await this._waitForApi();
        if (!bridgeReady) return false;

        while (Date.now() - start < maxWait) {
            const api = this._get();
            if (api) {
                try {
                    const ready = await api.is_ready();
                    if (ready) {
                        console.log(`[API] Backend hazır! (${((Date.now() - start) / 1000).toFixed(1)}s)`);
                        return true;
                    }

                    const err = await api.get_init_error();
                    if (err) {
                        console.error(`[API] Backend başlatma hatası: ${err}`);
                        window._backendInitError = err;
                        return false;
                    }
                } catch (e) {
                    // pywebview bridge henüz hazır değil, sessizce devam et
                }
            }
            // Her 5 saniyede bir bilgi ver
            const elapsed = Date.now() - start;
            if (elapsed - lastLog > 5000) {
                console.log(`[API] Backend bekleniyor... (${(elapsed / 1000).toFixed(0)}s)`);
                lastLog = elapsed;
            }
            await new Promise(r => setTimeout(r, 250));
        }
        console.warn(`[API] Backend ${maxWait / 1000}s içinde hazır olamadı!`);
        return false;
    },

    /**
     * Plugin listesini al
     */
    async getPlugins() {
        const api = this._get();
        if (!api) return [];
        try {
            return await api.get_plugins();
        } catch (e) {
            console.error('getPlugins error:', e);
            return [];
        }
    },

    /**
     * Ana sayfa içeriklerini al
     */
    async getMainPage(pluginName, page, url, category) {
        const api = this._get();
        if (!api) return [];
        try {
            return await api.get_main_page(pluginName, page, url, category);
        } catch (e) {
            console.error('getMainPage error:', e);
            return [];
        }
    },

    /**
     * Tek plugin'de ara
     */
    async search(pluginName, query) {
        const api = this._get();
        if (!api) return [];
        try {
            return await api.search(pluginName, query);
        } catch (e) {
            console.error('search error:', e);
            return [];
        }
    },

    /**
     * Tüm pluginlerde ara
     */
    async searchAll(query) {
        const api = this._get();
        if (!api) return [];
        try {
            return await api.search_all(query);
        } catch (e) {
            console.error('searchAll error:', e);
            return [];
        }
    },

    /**
     * Tek bir plugin'de ara (progressive search için böyle bi yapı kurdum)
     */
    async searchPlugin(pluginName, query) {
        const api = this._get();
        if (!api) return { plugin_name: pluginName, results: [] };
        try {
            return await api.search_plugin(pluginName, query);
        } catch (e) {
            console.error(`searchPlugin (${pluginName}) error:`, e);
            return { plugin_name: pluginName, results: [] };
        }
    },

    /**
     * Medya detaylarını yükle
     */
    async loadItem(pluginName, url) {
        const api = this._get();
        if (!api) return null;
        try {
            return await api.load_item(pluginName, url);
        } catch (e) {
            console.error('loadItem error:', e);
            return null;
        }
    },

    /**
     * Oynatma linklerini yükle
     */
    async loadLinks(pluginName, url) {
        const api = this._get();
        if (!api) return [];
        try {
            return await api.load_links(pluginName, url);
        } catch (e) {
            console.error('loadLinks error:', e);
            return [];
        }
    },

    /**
     * Harici oynatıcı ile oynat
     */
    async playExternal(player, url, title, userAgent, referer, subtitles) {
        const api = this._get();
        if (!api) return { success: false, error: 'API hazır değil' };
        try {
            return await api.play_external(player, url, title, userAgent, referer, subtitles || []);
        } catch (e) {
            console.error('playExternal error:', e);
            return { success: false, error: e.toString() };
        }
    },

    /**
     * Ayarları al
     */
    async getSettings() {
        const api = this._get();
        if (!api) return { theme: 'dark', player: 'builtin' };
        try {
            return await api.get_settings();
        } catch (e) {
            return { theme: 'dark', player: 'builtin' };
        }
    },

    /**
     * Ayarları kaydet
     */
    async saveSettings(settings) {
        const api = this._get();
        if (!api) return false;
        try {
            return await api.save_settings(settings);
        } catch (e) {
            return false;
        }
    },

    /**
     * Plugin başlatma hatasını almak için
     */
    async getInitError() {
        const api = this._get();
        if (!api) return null;
        try {
            return await api.get_init_error();
        } catch (e) { return null; }
    }
};
