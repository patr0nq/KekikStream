# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core  import ExtractorBase, ExtractResult, Subtitle, HTMLHelper

class MolyStream(ExtractorBase):
    name     = "MolyStream"
    main_url = "https://dbx.molystream.org"

    # Birden fazla domain destekle
    supported_domains = [
        "dbx.molystream.org", "ydx.molystream.org",
        "yd.sheila.stream", "ydf.popcornvakti.net",
    ]

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        self.httpx.headers.update({"Referer": referer or self.main_url})

        try:
            istek = await self.httpx.get(url, follow_redirects=True)
            istek.raise_for_status()
            html_content = istek.text
        except Exception:
            html_content = ""

        v_url = url
        subtitles = []

        if html_content:
            sel = HTMLHelper(html_content)
            
            # sheplayer veya normal video tag araması
            found_url = sel.select_attr("video#sheplayer source", "src") or sel.select_attr("video source", "src")
            if found_url:
                v_url = found_url

            for s_url, s_name in sel.regex_all(r"addSrtFile\(['\"]([^'\"]+\.srt)['\"]\s*,\s*['\"][a-z]{2}['\"]\s*,\s*['\"]([^'\"]+)['\"]"):
                subtitles.append(Subtitle(name=s_name, url=self.fix_url(s_url)))

        return ExtractResult(
            name      = self.name,
            url       = self.fix_url(v_url),
            referer   = url.replace("/sheila", "") if url else None,
            user_agent = "Mozilla/5.0 (X11; Linux x86_64; rv:101.0) Gecko/20100101 Firefox/101.0",
            subtitles = subtitles
        )
