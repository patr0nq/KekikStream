/* ═══════════════════════════════════════════
   KekikStream GUI — Video Player
   VLC - MPV veya HTML 5 tabanlı oynatıcı imkanı.
   ═══════════════════════════════════════════ */

const Player = {
    _hls: null,
    _plyr: null,
    _currentUrl: '',
    _currentTitle: '',
    _currentData: null,
    _controlsTimeout: null,
    _isPlayerOpen: false,

    /**
     * Plyr instance oluştur (ilk kullanımda)
     */
    _initPlyr() {
        if (this._plyr) return;

        const video = document.getElementById('video-player');
        this._plyr = new Plyr(video, {
            controls: [
                'play-large', 'play', 'progress', 'current-time', 'duration',
                'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
            ],
            settings: ['captions', 'quality', 'speed'],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
            captions: { active: false, language: 'tr', update: true },
            fullscreen: { enabled: true, fallback: true, iosNative: false },
            i18n: {
                play: 'Oynat',
                pause: 'Duraklat',
                mute: 'Sessiz',
                unmute: 'Sesi Aç',
                enterFullscreen: 'Tam Ekran',
                exitFullscreen: 'Tam Ekrandan Çık',
                settings: 'Ayarlar',
                speed: 'Hız',
                quality: 'Kalite',
                captions: 'Altyazı',
                currentTime: 'Şu anki zaman',
                duration: 'Süre',
            }
        });

        // Plyr tam ekran <-> Pywebview pencere tam ekran senkronizasyonu
        this._plyr.on('enterfullscreen', () => {
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.toggle_fullscreen(true);
            }
        });

        this._plyr.on('exitfullscreen', () => {
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.toggle_fullscreen(false);
            }
        });
    },

    /**
     * Video oynat (gömülü player)
     */
    play(url, title, data) {
        this._currentUrl = url;
        this._currentTitle = title || 'KekikStream';
        this._currentData = data || {};
        this._isPlayerOpen = true;

        const overlay = document.getElementById('player-overlay');
        const video = document.getElementById('video-player');
        const titleEl = document.getElementById('player-title');

        overlay.classList.remove('hidden');
        titleEl.textContent = this._currentTitle;

        // Plyr'ı başlat
        this._initPlyr();

        // Önceki HLS instance'ı temizle
        this._destroyHls();

        // URL tipine göre oynatma
        if (this._isHls(url)) {
            this._playHls(video, url);
        } else {
            if (this._plyr) {
                this._plyr.source = {
                    type: 'video',
                    sources: [{ src: url, type: 'video/mp4' }]
                };
                this._plyr.play().catch(() => { });
            } else {
                video.src = url;
                video.play().catch(() => { });
            }
        }

        // Kontrol gizleme
        this._setupControlsAutoHide();
    },

    /**
     * HLS stream oynat
     */
    _playHls(video, url) {
        if (Hls.isSupported()) {
            const hlsConfig = {
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                startLevel: -1,
                fragLoadingMaxRetry: 3,
                manifestLoadingMaxRetry: 3,
                levelLoadingMaxRetry: 3,
            };

            // Referer/User-Agent header'ları ekle (CORS izin verdiği kadar)
            const data = this._currentData || {};
            if (data.referer || data.user_agent) {
                hlsConfig.xhrSetup = (xhr, xhrUrl) => {
                    // Not: Tarayıcı kısıtlamaları nedeniyle bazı header'lar çalışmayabilir
                    try {
                        if (data.user_agent) {
                            xhr.setRequestHeader('User-Agent', data.user_agent);
                        }
                    } catch (e) { /* Tarayıcı kısıtlaması */ }
                };
            }

            this._hls = new Hls(hlsConfig);
            this._hls.loadSource(url);
            this._hls.attachMedia(video);

            // Kalite seçeneklerini Plyr'a aktar
            this._hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                if (this._plyr && data.levels && data.levels.length > 1) {
                    const qualities = data.levels.map((l, i) => l.height || i);
                    qualities.unshift(0); // Auto
                    this._plyr.options.quality = {
                        default: 0,
                        options: qualities,
                        forced: true,
                        onChange: (quality) => {
                            if (this._hls) {
                                this._hls.currentLevel = quality === 0 ? -1 :
                                    data.levels.findIndex(l => l.height === quality);
                            }
                        }
                    };
                }
                video.play().catch(() => { });
            });

            let networkRetryCount = 0;
            this._hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error('HLS fatal error:', data);
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        networkRetryCount++;
                        if (networkRetryCount <= 2) {
                            Toast.show('Ağ hatası, yeniden deneniyor...', 'warning');
                            this._hls.startLoad();
                        } else {
                            // 2 denemeden sonra harici oynatıcı öner
                            Toast.show('Stream tarayıcıda açılamıyor. MPV veya VLC ile açmayı deneyin.', 'error', 5000);
                            this._showExternalPlayerSuggestion();
                        }
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        Toast.show('Medya hatası, kurtarılıyor...', 'warning');
                        this._hls.recoverMediaError();
                    } else {
                        Toast.show('Stream yüklenemedi. MPV veya VLC ile açmayı deneyin.', 'error');
                        this._showExternalPlayerSuggestion();
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.play().catch(() => { });
        } else {
            Toast.show('Bu tarayıcı HLS desteklemiyor. Harici oynatıcı kullanın.', 'error');
        }
    },

    /**
     * Ağ hatası sonrası harici oynatıcı önerisi göster
     */
    _showExternalPlayerSuggestion() {
        const header = document.getElementById('player-header');
        if (!header) return;

        // Mevcut suggestion varsa ekleme
        if (document.getElementById('external-player-suggestion')) return;

        const suggestion = document.createElement('div');
        suggestion.id = 'external-player-suggestion';
        suggestion.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:12px;z-index:100;';
        suggestion.innerHTML = `
            <button onclick="Player.openExternal('mpv')" 
                style="background:rgba(0,0,0,0.85);color:#fff;padding:10px 24px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);font-size:14px;cursor:pointer;backdrop-filter:blur(10px)">
                🎥 MPV ile Aç
            </button>
            <button onclick="Player.openExternal('vlc')" 
                style="background:rgba(0,0,0,0.85);color:#fff;padding:10px 24px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);font-size:14px;cursor:pointer;backdrop-filter:blur(10px)">
                📺 VLC ile Aç
            </button>
        `;
        document.getElementById('player-overlay').appendChild(suggestion);
    },

    /**
     * URL HLS mi kontrol et
     */
    _isHls(url) {
        return url && (url.includes('.m3u8') || url.includes('m3u8'));
    },

    /**
     * HLS instance'ı temizle
     */
    _destroyHls() {
        if (this._hls) {
            this._hls.destroy();
            this._hls = null;
        }
    },

    /**
     * Player'ı kapat
     */
    close() {
        this._isPlayerOpen = false;

        // Cursor timeout'unu temizle
        clearTimeout(this._controlsTimeout);
        this._controlsTimeout = null;

        const overlay = document.getElementById('player-overlay');

        // Tam ekrandaysa çık
        if (this._plyr && this._plyr.fullscreen.active) {
            this._plyr.fullscreen.exit();
        }

        if (this._plyr) {
            this._plyr.pause();
        }

        this._destroyHls();

        // Plyr source temizle
        if (this._plyr) {
            this._plyr.source = { type: 'video', sources: [] };
        }

        overlay.classList.add('hidden');

        // Harici oynatıcı önerisini kaldır
        const suggestion = document.getElementById('external-player-suggestion');
        if (suggestion) suggestion.remove();

        // Cursor'u kesinlikle geri getir
        document.body.style.cursor = '';
        overlay.style.cursor = '';

        this._currentUrl = '';
        this._currentTitle = '';
        this._currentData = null;
    },

    /**
     * Harici oynatıcı ile aç
     */
    async openExternal(player) {
        if (!this._currentUrl) {
            Toast.show('Önce bir video seçin.', 'error');
            return;
        }

        const data = this._currentData || {};

        Toast.show(`${player.toUpperCase()} ile açılıyor...`, 'info');

        const result = await API.playExternal(
            player,
            this._currentUrl,
            this._currentTitle,
            data.user_agent || '',
            data.referer || '',
            data.subtitles || []
        );

        if (result && result.success) {
            Toast.show(`${player.toUpperCase()} başarıyla açıldı.`, 'success');
        } else {
            Toast.show(result?.error || `${player.toUpperCase()} açılamadı.`, 'error');
        }
    },

    /**
     * Kontrolleri otomatik gizle (sadece player overlay içinde)
     */
    _setupControlsAutoHide() {
        const overlay = document.getElementById('player-overlay');
        const header = document.getElementById('player-header');

        const show = () => {
            if (!this._isPlayerOpen) return;
            header.style.opacity = '1';
            overlay.style.cursor = 'default';
            clearTimeout(this._controlsTimeout);
            this._controlsTimeout = setTimeout(hide, 3500);
        };

        const hide = () => {
            if (!this._isPlayerOpen) return;
            header.style.opacity = '0';
            // Sadece overlay'in cursor'ını gizle, body'nin değil
            overlay.style.cursor = 'none';
        };

        overlay.onmousemove = show;
        overlay.onclick = show;
        show();
    }
};
