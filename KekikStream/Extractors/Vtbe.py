# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import PackedJSExtractor, ExtractResult, SOURCES_REGEX

class Vtbe(PackedJSExtractor):
    name        = "Vtbe"
    main_url    = "https://vtbe.to"
    url_pattern = SOURCES_REGEX

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        istek = await self.httpx.get(url, headers={"Referer": referer or self.main_url})

        file_url = self.unpack_and_find(istek.text)
        if not file_url:
            raise ValueError(f"Vtbe: Video URL bulunamadı. {url}")

        return ExtractResult(
            name       = self.name,
            url        = self.fix_url(file_url),
            referer    = url,
            user_agent = self.httpx.headers.get("User-Agent", "")
        )
