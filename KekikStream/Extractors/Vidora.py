# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import ExtractorBase, ExtractResult, HTMLHelper
from Kekik.Sifreleme  import Packer
from contextlib       import suppress

class Vidora(ExtractorBase):
    name     = "Vidora"
    main_url = "https://vidora.stream"

    supported_domains = [
        "vidora.stream",
        "vidora.su",
    ]

    def can_handle_url(self, url: str) -> bool:
        return any(domain in url for domain in self.supported_domains)

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        embed_url = url.replace("/download/", "/e/")
        headers   = {
            "Referer"          : referer or self.main_url,
            "Accept-Language"  : "en-US,en;q=0.5",
            "Sec-Fetch-Dest"   : "iframe",
        }

        istek  = await self.httpx.get(embed_url, headers=headers, follow_redirects=True)
        secici = HTMLHelper(istek.text)

        # Eğer iframe varsa, iframe'e git (Kotlin: iframeElement check)
        iframe_src = secici.select_attr("iframe", "src")
        if iframe_src:
            istek  = await self.httpx.get(self.fix_url(iframe_src), headers=headers, follow_redirects=True)
            secici = HTMLHelper(istek.text)

        # Packed script'ten m3u8 çıkar (Kotlin: getAndUnpack)
        m3u8_url = None
        if packed := secici.regex_first(r"(eval\(function\(p,a,c,k,e,d\).+?)\s*</script>"):
            with suppress(Exception):
                unpacked = Packer.unpack(packed)
                m3u8_url = HTMLHelper(unpacked).regex_first(r'file:\s*"(.*?m3u8.*?)"')

        # Fallback: sources script'ten
        if not m3u8_url:
            m3u8_url = secici.regex_first(r'file:\s*"(.*?m3u8.*?)"')

        if not m3u8_url:
            raise ValueError(f"Vidora: Video URL bulunamadı. {url}")

        return ExtractResult(
            name    = self.name,
            url     = self.fix_url(m3u8_url),
            referer = f"{self.main_url}/"
        )
