# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core.Plugin.FlwBasePlugin import FlwBasePlugin

class MoviesJoy(FlwBasePlugin):
    name        = "MoviesJoy"
    language    = "en"
    main_url    = "https://moviesjoy.is"
    favicon     = f"https://www.google.com/s2/favicons?domain={main_url}&sz=64"
    description = "MoviesJoy - Free Movies Streaming"
    main_page   = {
        f"{main_url}/movie?page="    : "Movies",
        f"{main_url}/tv-show?page="  : "TV Shows",
        f"{main_url}/top-imdb?page=" : "Top IMDB",
    }
