# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import NonceDecryptExtractor

class MegaCloud(NonceDecryptExtractor):
    name     = "MegaCloud"
    main_url = "https://megacloud.blog"
    key_name = "mega"

    supported_domains = [
        "megacloud.blog",
        "megacloud.tv",
        "streameeeeee.site",
    ]
