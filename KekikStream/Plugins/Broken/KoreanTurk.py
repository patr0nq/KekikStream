# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import PluginBase, MainPageResult, SearchResult, SeriesInfo, Episode, ExtractResult, HTMLHelper
import re

class KoreanTurk(PluginBase):
    name        = "KoreanTurk"
    language    = "tr"
    main_url    = "https://www.koreanturk.net"
    favicon     = f"https://www.google.com/s2/favicons?domain={main_url}&sz=64"
    description = "Güney Kore sevdalılarının vazgeçemediği ve Türkiye'nin en çok ziyaret edilen Güney Kore Portalı; Koreantürk'e hoşgeldiniz!"

    main_page   = {
        f"{main_url}/bolumler/page/" : "Son Eklenenler",
        f"{main_url}/Konu-Aile"     : "Aile",
        f"{main_url}/Konu-Aksiyon"  : "Aksiyon",
        f"{main_url}/Konu-Dram"     : "Dram",
        f"{main_url}/Konu-Fantastik": "Fantastik",
        f"{main_url}/Konu-Genclik"  : "Gençlik",
        f"{main_url}/Konu-Gerilim"  : "Gerilim",
        f"{main_url}/Konu-Gizem"    : "Gizem",
        f"{main_url}/Konu-Komedi"   : "Komedi",
        f"{main_url}/Konu-Korku"    : "Korku",
        f"{main_url}/Konu-Romantik" : "Romantik",
        f"{main_url}/Konu-Suc"      : "Suç",
    }

    def _strip_episode(self, url: str) -> str:
        """Bölüm URL'sinden bölüm kısmını sil"""
        return re.sub(r"-[0-9]+(-final)?-bolum-izle\.html", "", url)

    async def get_main_page(self, page: int, url: str, category: str) -> list[MainPageResult]:
        if "Konu-" in url:
            istek  = await self.httpx.get(url)
            secici = HTMLHelper(istek.text)

            results = []
            for img in secici.select("img[onload*='NcodeImageResizer']"):
                prev_a = img.select_first_parent("a") if hasattr(img, "select_first_parent") else None

                title_el = img.previous_sibling_tag("a") if hasattr(img, "previous_sibling_tag") else None

                # XPath benzeri: preceding-sibling::a[1]
                parent = img.parent
                if parent:
                    links = parent.select("a")
                    prev_link = None
                    for a_tag in links:
                        img_node = a_tag.select_first("img[onload*='NcodeImageResizer']") if hasattr(a_tag, "select_first") else None
                        if img_node:
                            break
                        prev_link = a_tag

                # Basit fallback: sayfadaki tüm konu kartlarını bul
                pass

            # Basit yaklaşım: standartbox kullan
            for veri in secici.select("div.standartbox"):
                dizi  = veri.select_text("h2 span")
                href  = veri.select_attr("a", "href")
                poster = veri.select_attr("div.resimcik img", "src")

                if dizi and href:
                    if "izle.html" in href:
                        href = self._strip_episode(href)
                    results.append(MainPageResult(
                        category = category,
                        title    = dizi.strip(),
                        url      = self.fix_url(href),
                        poster   = self.fix_url(poster),
                    ))

            return results

        istek  = await self.httpx.get(f"{url}{page}")
        secici = HTMLHelper(istek.text)

        results = []
        for veri in secici.select("div.standartbox"):
            dizi  = veri.select_text("h2 span")
            bolum = veri.select_text("h2")
            if bolum and dizi:
                bolum = bolum.replace(dizi, "").strip()
            title = f"{dizi} | {bolum}" if dizi and bolum else (dizi or "")

            href   = veri.select_attr("a", "href")
            poster = veri.select_attr("div.resimcik img", "src")

            if title and href:
                if "izle.html" in href:
                    href = self._strip_episode(href)
                results.append(MainPageResult(
                    category = category,
                    title    = title.strip(),
                    url      = self.fix_url(href),
                    poster   = self.fix_url(poster),
                ))

        return results

    async def search(self, query: str) -> list[SearchResult]:
        istek  = await self.httpx.get(f"{self.main_url}/")
        secici = HTMLHelper(istek.text)

        results = []
        for item in secici.select(".cat-item"):
            title   = item.select_text(None) or ""
            first_a = item.select_first("a")
            href    = first_a.select_attr(None, "href") if first_a else None

            if title and href and query.lower() in title.lower():
                results.append(SearchResult(
                    title  = title.strip(),
                    url    = self.fix_url(href),
                    poster = "",
                ))

        return results

    async def load_item(self, url: str) -> SeriesInfo:
        istek  = await self.httpx.get(url)
        secici = HTMLHelper(istek.text)

        title       = secici.select_text("h3") or ""
        poster      = secici.select_attr("div.resimcik img", "src")
        description = secici.select_attr("[property=\"og:description\"]", "content")

        episodes = []
        for veri in secici.select("div.standartbox a"):
            ep_name = veri.select_text("h2")
            ep_href = veri.select_attr(None, "href")
            if not ep_name or not ep_href:
                continue

            ep_episode = None
            ep_season  = 1
            ep_match = re.search(r"(\d+)\.Bölüm", ep_name)
            if ep_match:
                ep_episode = int(ep_match.group(1))
            szn_match = re.search(r"(\d+)\.Sezon", ep_name)
            if szn_match:
                ep_season = int(szn_match.group(1))

            episodes.append(Episode(
                season  = ep_season,
                episode = ep_episode,
                title   = ep_name.strip(),
                url     = self.fix_url(ep_href),
            ))

        return SeriesInfo(
            url         = url,
            poster      = self.fix_url(poster),
            title       = title,
            description = description,
            episodes    = episodes,
        )

    async def load_links(self, url: str) -> list[ExtractResult]:
        istek  = await self.httpx.get(url)
        secici = HTMLHelper(istek.text)

        response = []

        # iframe tab-pane'lerden
        for iframe in secici.select("div.filmcik div.tab-pane iframe"):
            src = iframe.select_attr(None, "src")
            if not src:
                continue
            src = self.fix_url(src)
            data = await self.extract(src, referer=f"{self.main_url}/")
            self.collect_results(response, data)

        # a tag href'lerden
        for a_tag in secici.select("div.filmcik div.tab-pane a"):
            href = a_tag.select_attr(None, "href")
            if not href:
                continue
            href = self.fix_url(href)
            data = await self.extract(href, referer=f"{self.main_url}/")
            self.collect_results(response, data)

        return self.deduplicate(response)
