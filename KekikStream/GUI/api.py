# Bu araç @patr0n tarafından | @KekikAkademi için yazılmıştır.

import asyncio, json, os, subprocess, sys, threading, base64, urllib.parse
from contextlib import suppress
import httpx

class GUIApi:
    """
    Pywebview JS↔Python köprüsü.
    Frontend'den window.pywebview.api.metod_adi() ile çağrılır.
    """

    def __init__(self):
        self._window        = None
        self._plugin_mgr    = None
        self._extractor_mgr = None
        self._plugins       = {}
        self._loop          = None
        self._thread        = None
        self._ready         = False
        self._initializing  = False
        self._init_error    = None

        # Async event loop'u ayrı thread'de başlat
        self._start_async_loop()

        # Plugin'leri arka planda yükle (GUI'yi bloklamaz)
        self._bg_init_thread = threading.Thread(target=self._init_plugins, daemon=True)
        self._bg_init_thread.start()

    def set_window(self, window):
        self._window = window

    # ─── Async Loop Yönetimi ────────────────────────────────

    def _start_async_loop(self):
        """Ayrı thread'de asyncio event loop başlat"""
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def _run_async(self, coro, timeout=None):
        """Async bir coroutine'i senkron olarak çalıştır"""
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=timeout)

    # ─── Plugin Başlatma (Arka Plan) ────────────────────────

    def _init_plugins(self):
        """KekikStream plugin ve extractor sistemini arka planda başlat"""
        if self._ready or self._initializing:
            return
        self._initializing = True
        try:
            from ..Core import PluginManager, ExtractorManager

            base_dir      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            extractor_dir = os.path.join(base_dir, "Extractors")
            plugin_dir    = os.path.join(base_dir, "Plugins")

            self._extractor_mgr = ExtractorManager(extractor_dir=extractor_dir)
            self._plugin_mgr    = PluginManager(plugin_dir=plugin_dir, ex_manager=self._extractor_mgr)
            self._plugins       = self._plugin_mgr.plugins
            self._ready         = True
            print(f"[OK] {len(self._plugins)} eklenti yüklendi.")
        except Exception as e:
            print(f"[HATA] Plugin başlatma hatası: {e}")
            import traceback
            traceback.print_exc()
            self._init_error = str(e)
            self._ready = False
        finally:
            self._initializing = False

    # ─── Frontend API Metotları ─────────────────────────────

    def is_ready(self):
        """Backend hazır mı?"""
        return self._ready

    def get_init_error(self):
        """Plugin başlatma hatasını döndürür"""
        return self._init_error

    def get_plugins(self):
        """Tüm plugin'lerin listesini döndür"""
        if not self._ready:
            return []

        result = []
        for name, plugin in self._plugins.items():
            result.append({
                "name"        : name,
                "display_name": plugin.name,
                "language"    : plugin.language,
                "main_url"    : plugin.main_url,
                "favicon"     : plugin.favicon,
                "description" : plugin.description,
                "categories"  : [
                    {"url": url, "name": cat}
                    for url, cat in plugin.main_page.items()
                ] if plugin.main_page else []
            })

        return result

    def get_main_page(self, plugin_name, page, url, category):
        """Bir plugin'in ana sayfa içeriklerini döndür"""
        if not self._ready or plugin_name not in self._plugins:
            return []

        plugin = self._plugins[plugin_name]
        try:
            results = self._run_async(plugin.get_main_page(page, url, category))
            return [r.model_dump() for r in results] if results else []
        except Exception as e:
            print(f"[HATA] get_main_page: {e}")
            return []

    def search(self, plugin_name, query):
        """Tek bir plugin'de ara"""
        if not self._ready or plugin_name not in self._plugins:
            return []

        plugin = self._plugins[plugin_name]
        try:
            results = self._run_async(plugin.search(query))
            return [r.model_dump() for r in results] if results else []
        except Exception as e:
            print(f"[HATA] search: {e}")
            return []

    def search_all(self, query):
        """Tüm plugin'lerde paralel ara"""
        if not self._ready:
            return []

        async def _search_all():
            all_results = []
            sem = asyncio.Semaphore(5)

            async def _search_one(name, plugin):
                async with sem:
                    try:
                        results = await asyncio.wait_for(plugin.search(query), timeout=15)
                        if results:
                            for r in results:
                                d = r.model_dump()
                                d["plugin_name"]    = name
                                d["plugin_display"] = plugin.name
                                d["plugin_favicon"] = plugin.favicon
                                all_results.append(d)
                    except asyncio.TimeoutError:
                        print(f"[UYARI] search timeout: {name}")
                    except Exception:
                        pass

            tasks = [_search_one(n, p) for n, p in self._plugins.items()]
            await asyncio.gather(*tasks)
            return all_results

        try:
            return self._run_async(_search_all(), timeout=60)
        except Exception as e:
            print(f"[HATA] search_all: {e}")
            return []

    def search_plugin(self, plugin_name, query):
        """Tek bir plugin'de ara ve sonucu plugin meta bilgisiyle döndür (progressive search için)"""
        if not self._ready or plugin_name not in self._plugins:
            return {"plugin_name": plugin_name, "plugin_display": plugin_name, "results": []}

        plugin = self._plugins[plugin_name]
        try:
            results = self._run_async(
                asyncio.wait_for(plugin.search(query), timeout=15),
                timeout=20
            )
            items = []
            if results:
                for r in results:
                    d = r.model_dump()
                    d["plugin_name"]    = plugin_name
                    d["plugin_display"] = plugin.name
                    d["plugin_favicon"] = plugin.favicon
                    items.append(d)
            return {
                "plugin_name"   : plugin_name,
                "plugin_display": plugin.name,
                "results"       : items
            }
        except Exception as e:
            print(f"[HATA] search_plugin ({plugin_name}): {e}")
            return {
                "plugin_name"   : plugin_name,
                "plugin_display": getattr(plugin, 'name', plugin_name),
                "results"       : []
            }

    def load_item(self, plugin_name, url):
        """Medya detaylarını yükle"""
        if not self._ready or plugin_name not in self._plugins:
            return None

        plugin = self._plugins[plugin_name]
        try:
            result = self._run_async(plugin.load_item(url))
            if result:
                data = result.model_dump()
                from ..Core import SeriesInfo
                data["is_series"] = isinstance(result, SeriesInfo)
                return data
            return None
        except Exception as e:
            print(f"[HATA] load_item: {e}")
            return None

    def load_links(self, plugin_name, url):
        """Oynatma linklerini yükle — timeout yok, extractor bitene kadar bekler"""
        if not self._ready or plugin_name not in self._plugins:
            return []

        plugin = self._plugins[plugin_name]
        try:
            from ..Core.Plugin.PluginBase import PluginBase
            results = self._run_async(plugin.load_links(url))
            results = PluginBase.sync_subtitles(results)
            return [r.model_dump() for r in results] if results else []
        except Exception as e:
            print(f"[HATA] load_links: {e}")
            return []

    def toggle_fullscreen(self, enter):
        """Pencereyi tam ekran yap/çık"""
        if self._window:
            self._window.toggle_fullscreen()
        return True

    def play_external(self, player, url, title, user_agent, referer, subtitles):
        """Harici oynatıcı ile oynat (VLC veya MPV)"""
        try:
            if player == "mpv":
                cmd = ["mpv"]
                if title:
                    cmd.append(f"--force-media-title={title}")
                headers = []
                if user_agent:
                    headers.append(f"User-Agent: {user_agent}")
                if referer:
                    headers.append(f"Referer: {referer}")
                if headers:
                    cmd.append(f"--http-header-fields={','.join(headers)}")
                if subtitles:
                    for sub in subtitles:
                        sub_url = sub.get("url", "") if isinstance(sub, dict) else sub
                        if sub_url:
                            cmd.append(f"--sub-file={sub_url}")
                cmd.append(url)

            elif player == "vlc":
                vlc_path = "vlc"
                if sys.platform == "win32":
                    vlc_paths = [
                        r"C:\Program Files\VideoLAN\VLC\vlc.exe",
                        r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"
                    ]
                    for p in vlc_paths:
                        if os.path.exists(p):
                            vlc_path = p
                            break

                cmd = [vlc_path, "--quiet"]
                if title:
                    cmd.extend([f"--meta-title={title}", f"--input-title-format={title}"])
                if user_agent:
                    cmd.append(f"--http-user-agent={user_agent}")
                if referer:
                    cmd.append(f"--http-referrer={referer}")
                if subtitles:
                    for sub in subtitles:
                        sub_url = sub.get("url", "") if isinstance(sub, dict) else sub
                        if sub_url:
                            cmd.append(f"--sub-file={sub_url}")
                cmd.append(url)
            else:
                return {"success": False, "error": "Bilinmeyen oynatıcı"}

            devnull = open(os.devnull, "w")
            subprocess.Popen(cmd, stdout=devnull, stderr=devnull)
            return {"success": True}

        except FileNotFoundError:
            return {"success": False, "error": f"{player} bulunamadı! Kurulu olduğundan emin olun."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_settings(self):
        """Kayıtlı ayarları döndür"""
        settings_path = self._settings_path()
        if os.path.exists(settings_path):
            with open(settings_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "theme"  : "dark",
            "player" : "builtin"
        }

    def save_settings(self, settings):
        """Ayarları kaydet"""
        settings_path = self._settings_path()
        os.makedirs(os.path.dirname(settings_path), exist_ok=True)
        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True

    def _settings_path(self):
        """Ayar dosyası yolu"""
        if sys.platform == "win32":
            base = os.environ.get("APPDATA", os.path.expanduser("~"))
        else:
            base = os.environ.get("XDG_CONFIG_HOME", os.path.join(os.path.expanduser("~"), ".config"))
        return os.path.join(base, "KekikStream", "gui_settings.json")
