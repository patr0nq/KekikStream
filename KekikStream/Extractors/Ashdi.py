# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import ExtractorBase, ExtractResult, HTMLHelper

class Ashdi(ExtractorBase):
    name     = "Ashdi"
    main_url = "https://ashdi.vip"

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        resp = await self.httpx.get(
            url     = url,
            headers = {
                "Referer"    : referer or "https://uakino.best/",
                "User-Agent" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        secici = HTMLHelper(resp.text)

        # Ashdi uses PlayerJS
        # Format: file:"..."
        m3u_link = secici.regex_first(r'file\s*:\s*["\']([^"\']+)["\']')

        if not m3u_link:
            # Fallback for different PlayerJS variants
            m3u_link = secici.regex_first(r'["\']file["\']\s*:\s*["\']([^"\']+)["\']')

        if not m3u_link:
            # Check for direct <source> tags if PlayerJS fails
            m3u_link = secici.select_attr("source", "src") or secici.select_attr("video", "src")

        if not m3u_link:
            raise ValueError(f"Ashdi: Video URL bulunamadı. {url}")

        # If it's a relative link (unlikely but possible)
        if m3u_link.startswith("/"):
            m3u_link = f"{self.main_url}{m3u_link}"

        return ExtractResult(
            name       = self.name,
            url        = m3u_link,
            referer    = f"{self.main_url}/",
            user_agent = self.httpx.headers.get("User-Agent")
        )
