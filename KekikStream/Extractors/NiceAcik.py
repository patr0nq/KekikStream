# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import ExtractorBase, ExtractResult, Subtitle
import re, json

class NiceAcik(ExtractorBase):
    name              = "NiceAcik"
    main_url          = "https://niceacik.com"
    supported_domains = ["niceacik.com"]

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        base_url = f"{url.split('?')[0].rsplit('/', 1)[0]}" if "/" in url.split("//", 1)[-1] else url.rstrip("/")
        # base_url → https://f0004.niceacik.com

        self.httpx.headers.update({
            "Referer" : referer or "https://jetfilmizle.net/",
            "Origin"  : referer or "https://jetfilmizle.net",
        })

        resp = await self.httpx.get(url)
        html = resp.text

        # masterUrl → "master.php?id=...&season=...&episode=..."
        master_match = re.search(r'var\s+masterUrl\s*=\s*"([^"]+)"', html)
        if not master_match:
            raise ValueError(f"NiceAcik: masterUrl bulunamadı. {url}")

        master_path = master_match.group(1)
        origin      = f"{resp.url.scheme}://{resp.url.host}"
        master_url  = f"{origin}/{master_path}" if not master_path.startswith("http") else master_path

        # master.php → m3u8 playlist
        self.httpx.headers.update({"Referer": str(resp.url)})
        m3u8_resp = await self.httpx.get(master_url)

        if "#EXTM3U" not in m3u8_resp.text:
            raise ValueError(f"NiceAcik: m3u8 içerik alınamadı. {url}")

        # Altyazılar → var subtitles = [...] JSON
        subtitles = []
        sub_match = re.search(r"var\s+subtitles\s*=\s*(\[.*?\]);", html, re.DOTALL)
        if sub_match:
            try:
                subs = json.loads(sub_match.group(1))
                for s in subs:
                    if s.get("file") and s.get("label"):
                        subtitles.append(Subtitle(name=s["label"], url=s["file"]))
            except Exception:
                pass

        return ExtractResult(
            name      = self.name,
            url       = str(m3u8_resp.url),
            referer   = origin,
            subtitles = subtitles,
        )
