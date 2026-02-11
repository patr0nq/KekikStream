# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import PluginBase, MainPageResult, SearchResult, MovieInfo, SeriesInfo, Episode, ExtractResult, HTMLHelper

class Zoechip(PluginBase):
    name        = "Zoechip"
    language    = "en"
    main_url    = "https://zoechip.cc"
    favicon     = f"https://www.google.com/s2/favicons?domain={main_url}&sz=64"
    description = "Watch Online Movies for free in HD high quality and Download the latest movies without Registration"

    main_page = {
        f"{main_url}/movie?page="          : "Movies",
        f"{main_url}/tv-show?page="        : "TV Shows",
        f"{main_url}/top-imdb?page="       : "Top IMDB",
        f"{main_url}/trending?page="       : "Trending",
    }

    async def get_main_page(self, page: int, url: str, category: str) -> list[MainPageResult]:
        istek  = await self.httpx.get(f"{url}{page}")
        secici = HTMLHelper(istek.text)

        return [
            MainPageResult(
                category = category,
                title    = secici.select_attr("h2.film-name a", "title", veri),
                url      = self.fix_url(secici.select_attr("h2.film-name a", "href", veri)),
                poster   = secici.select_attr("img.film-poster-img", "data-src", veri)
            )
                for veri in secici.select("div.flw-item")
        ]

    async def search(self, query: str) -> list[SearchResult]:
        istek  = await self.httpx.get(f"{self.main_url}/search/{query.replace(' ', '-')}")
        secici = HTMLHelper(istek.text)

        return [
            SearchResult(
                title  = secici.select_attr("h2.film-name a", "title", veri),
                url    = self.fix_url(secici.select_attr("h2.film-name a", "href", veri)),
                poster = secici.select_attr("img.film-poster-img", "data-src", veri)
            )
                for veri in secici.select("div.flw-item")
        ]

    async def load_item(self, url: str) -> MovieInfo | SeriesInfo:
        istek  = await self.httpx.get(url)
        secici = HTMLHelper(istek.text)

        content_id  = secici.select_attr("div.detail_page-watch", "data-id")
        details     = secici.select_first("div.detail_page-infor")
        name        = secici.select_text("h2.heading-name > a", details)
        poster      = secici.select_poster("div.film-poster > img", details)
        description = secici.select_text("div.description", details)
        year        = str(secici.extract_year())
        tags        = secici.meta_list("Genre", container_selector="div.row-line")
        rating      = secici.select_text("button.btn-imdb")
        rating      = rating.replace("N/A", "").split(":")[-1].strip() if rating else None
        actors      = secici.meta_list("Casts", container_selector="div.row-line")

        common_info = {
            "url"         : url,
            "poster"      : self.fix_url(poster),
            "title"       : name,
            "description" : description,
            "tags"        : tags,
            "rating"      : rating,
            "year"        : year,
            "actors"      : actors
        }

        if "movie" in url:
            return MovieInfo(**common_info)

        episodes = []
        seasons_resp = await self.httpx.get(f"{self.main_url}/ajax/season/list/{content_id}")
        sh = HTMLHelper(seasons_resp.text)

        for season in sh.select("a.dropdown-item"):
            season_id = season.attrs.get("data-id")
            s_val, _  = sh.extract_season_episode(season.text())

            e_resp = await self.httpx.get(f"{self.main_url}/ajax/season/episodes/{season_id}")
            eh     = HTMLHelper(e_resp.text)

            for ep in eh.select("a.eps-item"):
                ep_id    = ep.attrs.get("data-id")
                ep_title = ep.attrs.get("title", "")
                _, e_val = eh.extract_season_episode(ep_title)

                episodes.append(Episode(
                    season  = s_val or 1,
                    episode = e_val or 1,
                    title   = ep_title,
                    url     = f"servers/{ep_id}"
                ))

        return SeriesInfo(**common_info, episodes=episodes)

    async def load_links(self, url: str) -> list[ExtractResult]:
        if "servers/" in url:
            data = url.split("/")[-1]
            servers_url = f"servers/{data}"
        elif "list/" in url:
            data = url.split("/")[-1]
            servers_url = f"list/{data}"
        else:
            istek      = await self.httpx.get(url)
            secici     = HTMLHelper(istek.text)
            content_id = secici.select_attr("div.detail_page-watch", "data-id")
            if not content_id:
                return []
            servers_url = f"list/{content_id}"

        servers_resp = await self.httpx.get(f"{self.main_url}/ajax/episode/{servers_url}")
        sh           = HTMLHelper(servers_resp.text)
        servers      = sh.select("a.link-item")

        results = []
        for server in servers:
            server_name = server.text(strip=True)
            link_id     = server.attrs.get("data-linkid") or server.attrs.get("data-id")
            source_resp = await self.httpx.get(f"{self.main_url}/ajax/episode/sources/{link_id}")
            source_data = source_resp.json()
            video_url   = source_data.get("link")

            if video_url:
                extract_result = await self.extract(video_url, name_override=server_name)
                if extract_result:
                    results.extend(extract_result if isinstance(extract_result, list) else [extract_result])
                else:
                    results.append(ExtractResult(
                        url  = video_url,
                        name = f"{self.name} | {server_name}"
                    ))

        return results
