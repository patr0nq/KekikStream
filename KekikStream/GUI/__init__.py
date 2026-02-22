# Bu araç @patr0n tarafından | @KekikAkademi için yazılmıştır.

import webview
import os, sys
from .api import GUIApi

def gui_basla():
    """KekikStream GUI'yi başlat"""
    # Frontend dosyalarının yolunu bul
    web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

    if not os.path.exists(web_dir):
        print(f"[HATA] Web dizini bulunamadı: {web_dir}")
        sys.exit(1)

    # API bridge oluştur (plugin'ler HENÜZ yüklenmez — lazy init)
    api = GUIApi()

    # Pywebview penceresi oluştur
    window = webview.create_window(
        title      = "KekikStream",
        url        = os.path.join(web_dir, "index.html"),
        js_api     = api,
        width      = 1280,
        height     = 800,
        min_size   = (900, 600),
        resizable  = True,
        text_select = False,
    )

    api.set_window(window)

    # Pencereyi başlat
    webview.start(debug=False)
