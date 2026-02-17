# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import PackedJSExtractor, ExtractResult, Subtitle, HTMLHelper, PACKED_REGEX
from Kekik.Sifreleme  import Packer
import re, base64

class EmbedLoad(PackedJSExtractor):
    name              = "EmbedLoad"
    main_url          = "https://embedload.cfd"
    supported_domains = ["embedload.cfd", "asianload.cfd"]

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        self.httpx.headers.update({
            "Referer" : referer or self.main_url,
            "Origin"  : self.main_url,
        })

        resp = await self.httpx.get(url, follow_redirects=True)
        html = resp.text

        # Packed JS unpack et
        sel    = HTMLHelper(html)
        packed = sel.regex_first(PACKED_REGEX)
        if not packed:
            raise ValueError(f"EmbedLoad: Packed JS bulunamadı. {url}")

        unpacked = Packer.unpack(packed)

        # base64 encode edilmiş URL'leri bul ve decode et
        b64_strings = re.findall(r'atob\(["\']([A-Za-z0-9+/=]+)["\']\)', unpacked)
        if not b64_strings:
            # Packed sözlük'ten base64 pattern'ları çek
            b64_strings = re.findall(r'[A-Za-z0-9+/]{40,}={0,2}', html)

        m3u8_url = None
        mp4_url  = None
        sub_urls = []

        for b64 in b64_strings:
            try:
                decoded = base64.b64decode(b64 + "==").decode("utf-8", errors="ignore").strip()
            except Exception:
                continue

            if not decoded.startswith("http"):
                continue

            if ".m3u8" in decoded:
                m3u8_url = decoded
            elif ".mp4" in decoded:
                mp4_url = decoded
            elif ".srt" in decoded or ".vtt" in decoded:
                sub_urls.append(decoded)

        video_url = m3u8_url or mp4_url
        if not video_url:
            raise ValueError(f"EmbedLoad: Video URL bulunamadı. {url}")

        # Altyazıları JWPlayer tracks'ten de çek (unpacked JS)
        subtitles = []
        for sub_url in sub_urls:
            subtitles.append(Subtitle(
                name = "Altyazı",
                url  = sub_url,
            ))

        # Tracks pattern: label + file eşleşmesi (unpacked'den)
        for track in re.finditer(
            r'"label"\s*:\s*"([^"]+)"[^}]*"file"\s*:\s*"([^"]+)"',
            unpacked,
        ):
            label   = track.group(1)
            sub_url = track.group(2)
            if sub_url.startswith("http") and (".srt" in sub_url or ".vtt" in sub_url):
                if not any(s.url == sub_url for s in subtitles):
                    subtitles.append(Subtitle(name=label, url=sub_url))

        return ExtractResult(
            name      = self.name,
            url       = video_url,
            referer   = self.main_url,
            subtitles = subtitles,
        )
