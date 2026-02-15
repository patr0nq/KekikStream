# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import ExtractorBase, ExtractResult, HTMLHelper
import base64
import json

class Voe(ExtractorBase):
    name     = "Voe"
    main_url = "https://voe.sx"

    supported_domains = ["voe.sx", "yip.su", "metagnathtuggers.com", "graceaddresscommunity.com", "sethniceletter.com", "maxfinishseveral.com"]

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        try:
            # Voe often uses protection (DDG, etc.), use cloudscraper via PluginBase
            resp    = self.cloudscraper.get(url, headers={"Referer": referer or self.main_url})
            content = resp.text
        except:
            resp    = await self.httpx.get(url, headers={"Referer": referer or self.main_url})
            content = resp.text

        secici = HTMLHelper(content)

        # Method 1: wc0 base64 encoded JSON
        script_val = secici.regex_first(r"wc0\s*=\s*'([^']+)'")
        if script_val:
            try:
                decoded   = base64.b64decode(script_val).decode()
                js_data   = json.loads(decoded)
                video_url = js_data.get("file")
                if video_url:
                    return ExtractResult(
                        name    = self.name,
                        url     = video_url,
                        referer = url
                    )
            except:
                pass

        # Method 2: Sources regex
        video_url = secici.regex_first(r"sources\s*:\s*\[\s*\{\s*src\s*:\s*['\"]([^'\"]+)['\"]")
        if not video_url:
            video_url = secici.regex_first(r"['\"]?file['\"]?\s*:\s*['\"]([^'\"]+\.m3u8[^'\"]*)['\"]")

        if not video_url:
            video_url = secici.regex_first(r"hls\s*:\s*['\"]([^'\"]+)['\"]")

        if not video_url:
             raise ValueError(f"Voe: Video URL bulunamadı. {url}")

        return ExtractResult(
            name    = self.name,
            url     = video_url,
            referer = url
        )
