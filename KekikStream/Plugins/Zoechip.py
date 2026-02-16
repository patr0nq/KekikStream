# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core.Plugin.FlwBasePlugin import FlwBasePlugin

class Zoechip(FlwBasePlugin):
    name        = "Zoechip"
    language    = "en"
    main_url    = "https://zoechip.cc"
    favicon     = f"https://www.google.com/s2/favicons?domain={main_url}&sz=64"
    description = "Watch Online Movies for free in HD high quality and Download the latest movies without Registration"

    main_page = {
        f"{main_url}/movie?page="    : "Movies",
        f"{main_url}/tv-show?page="  : "TV Shows",
        f"{main_url}/top-imdb?page=" : "Top IMDB",
        f"{main_url}/trending?page=" : "Trending",
    }
