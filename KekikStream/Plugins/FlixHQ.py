# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core.Plugin.FlwBasePlugin import FlwBasePlugin

class FlixHQ(FlwBasePlugin):
    name        = "FlixHQ"
    language    = "en"
    main_url    = "https://flixhq.to"
    favicon     = f"https://www.google.com/s2/favicons?domain={main_url}&sz=64"
    description = "FlixHQ - Watch Movies and TV Shows for Free"
    main_page   = {
        f"{main_url}/movie?page="    : "Movies",
        f"{main_url}/tv-show?page="  : "TV Shows",
        f"{main_url}/top-imdb?page=" : "Top IMDB",
    }
