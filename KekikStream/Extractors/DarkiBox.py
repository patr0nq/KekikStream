# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import ExtractorBase, ExtractResult, HTMLHelper

class DarkiBox(ExtractorBase):
    name     = "DarkiBox"
    main_url = "https://darkibox.com"

    supported_domains = ["darkibox.com", "darkibox.io"]

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        resp   = await self.httpx.get(url)
        secici = HTMLHelper(resp.text)

        # Regex for sources: [{src: "(.*?)"
        video_url = secici.regex_first(r'sources:\s*\[\s*\{\s*src:\s*"([^"]+)"')

        if not video_url:
            raise ValueError(f"Darkibox: Video URL bulunamadı. {url}")

        return ExtractResult(
            name    = self.name,
            url     = video_url,
            referer = url
        )
