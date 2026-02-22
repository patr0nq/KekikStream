# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import BePlayerExtractor, ExtractResult, HTMLHelper

class CizgiPass(BePlayerExtractor):
    name     = "CizgiPass"
    main_url = "https://cizgipass100.online"

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        self.cloudscraper.headers.update({"Referer": referer or url})

        resp = await self.async_cf_get(url)
        sel  = HTMLHelper(resp.text)

        m3u8_url, subtitles, _ = self.decrypt_beplayer(resp.text)

        if not m3u8_url:
            m3u8_url = sel.regex_first(r'file\s*:\s*"([^"]+)"')

        if not m3u8_url:
            raise ValueError(f"{self.name}: Video linki bulunamadı. {url}")

        return ExtractResult(
            name      = self.name,
            url       = self.fix_url(m3u8_url),
            referer   = url,
            subtitles = subtitles
        )
