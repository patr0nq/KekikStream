/* ═══════════════════════════════════════════
   KekikStream GUI — Theme Manager
   ═══════════════════════════════════════════ */

const Theme = {
    current: 'dark',

    init() {
        // Ayarlardan tema yükle (varsayılan: dark)
        const saved = localStorage.getItem('ks-theme');
        this.current = saved || 'dark';
        this.apply();
    },

    apply() {
        document.documentElement.setAttribute('data-theme', this.current);
        const btn = document.getElementById('theme-btn');
        if (btn) {
            btn.textContent = this.current === 'dark' ? '☀️' : '🌙';
        }
    },

    toggle() {
        this.current = this.current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('ks-theme', this.current);
        this.apply();

        // Backend'e de kaydet
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.save_settings({ theme: this.current }).catch(() => { });
        }
    },

    set(theme) {
        this.current = theme;
        localStorage.setItem('ks-theme', this.current);
        this.apply();
    }
};

// Sayfa yüklenirken temayı hemen uygula (FOUC önleme)
Theme.init();
