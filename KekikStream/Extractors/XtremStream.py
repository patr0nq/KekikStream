# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import ExtractorBase, ExtractResult, HTMLHelper

class XtremStream(ExtractorBase):
    name     = "XtremStream"
    main_url = "https://xtremestream.xyz"

    supported_domains = [
        "xtremestream.xyz", "xtremestream.to", "xtremestream.cc", "xtremestream.net",
        "lecteur1.xtremestream.xyz", "emmmmbed.com", "lecteurvideo.com", "vidonly.org",
        "stream1.xtremestream.xyz", "stream2.xtremestream.xyz"
    ]

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        resp = await self.httpx.get(
            url     = url,
            headers = {
                "Referer"    : referer or self.main_url,
                "User-Agent" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            }
        )
        secici = HTMLHelper(resp.text)

        # Regex search for file or src
        video_url = secici.regex_first(r"file\s*:\s*['\"]([^'\"]+)['\"]")
        if not video_url:
            video_url = secici.regex_first(r"src\s*:\s*['\"]([^'\"]+)['\"]")

        if not video_url:
            raise ValueError(f"XtremStream: Video URL bulunamadı. {url}")

        return ExtractResult(
            name       = self.name,
            url        = self.fix_url(video_url),
            referer    = url,
            user_agent = self.httpx.headers.get("User-Agent")
        )
