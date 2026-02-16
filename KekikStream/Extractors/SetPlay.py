# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import VideoPlayerExtractor

class SetPlay(VideoPlayerExtractor):
    name      = "SetPlay"
    main_url  = "https://setplay.shop"
    lower_key = True

    supported_domains = ["setplay.cfd", "setplay.shop", "setplay.site"]
