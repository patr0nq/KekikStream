# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core.Plugin.FlwBasePlugin import FlwBasePlugin

class SFlix(FlwBasePlugin):
    name        = "SFlix"
    language    = "en"
    main_url    = "https://sflix.to"
    favicon     = f"https://www.google.com/s2/favicons?domain={main_url}&sz=64"
    description = "SFlix - Watch HD Movies & TV Shows Online Free"
    main_page   = {
        f"{main_url}/movie?page="    : "Movies",
        f"{main_url}/tv-show?page="  : "TV Shows",
        f"{main_url}/top-imdb?page=" : "Top IMDB",
    }
