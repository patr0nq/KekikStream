# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from KekikStream.Core import ExtractorBase, ExtractResult, HTMLHelper, Subtitle
from urllib.parse     import quote
import re, contextlib

class MegaCloud(ExtractorBase):
    name     = "MegaCloud"
    main_url = "https://megacloud.blog"

    supported_domains = [
        "megacloud.blog",
        "megacloud.tv",
        "streameeeeee.site",
    ]

    async def extract(self, url: str, referer: str = None) -> ExtractResult:
        v_id    = url.split("?")[0].split("/")[-1]
        headers = {"Referer": self.get_base_url(url), "X-Requested-With": "XMLHttpRequest"}

        resp   = await self.httpx.get(url, headers=headers, follow_redirects=True)
        secici = HTMLHelper(resp.text)

        # Nonce Bulma (meta tag veya regex)
        nonce = secici.select_attr("meta[name='_gg_fb']", "content")
        if not nonce:
            nonce = secici.regex_first(r"\b[a-zA-Z0-9]{48}\b")
        if not nonce:
            m = re.search(r"\b([a-zA-Z0-9]{16})\b.*?\b([a-zA-Z0-9]{16})\b.*?\b([a-zA-Z0-9]{16})\b", resp.text, re.DOTALL)
            if m:
                nonce = m.group(1) + m.group(2) + m.group(3)

        if not nonce:
            raise ValueError(f"Megacloud: Nonce bulunamadı. {url}")

        # Embed path'i URL'den al (embed-1 veya embed-2)
        base_url   = self.get_base_url(url)
        embed_path = re.search(r"(embed-\d+/v\d+/e-\d+)", url)
        path       = embed_path.group(1) if embed_path else "embed-1/v3/e-1"

        api_resp = await self.httpx.get(f"{base_url}/{path}/getSources?id={v_id}&_k={nonce}", headers=headers)
        data = api_resp.json()

        enc_file = data.get("sources", [{}])[0].get("file")
        if not enc_file:
            raise ValueError("Megacloud: Kaynak bulunamadı.")

        m3u8_url = None
        if ".m3u8" in enc_file:
            m3u8_url = enc_file
        else:
            # Decryption Flow (External Keys + Google Apps Script)
            with contextlib.suppress(Exception):
                key_resp = await self.httpx.get("https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json")
                mega_key = key_resp.json().get("mega")
                if mega_key:
                    decode_api = "https://script.google.com/macros/s/AKfycbxHbYHbrGMXYD2-bC-C43D3njIbU-wGiYQuJL61H4vyy6YVXkybMNNEPJNPPuZrD1gRVA/exec"
                    dec_resp   = await self.httpx.get(f"{decode_api}?encrypted_data={quote(enc_file)}&nonce={quote(nonce)}&secret={quote(mega_key)}")
                    m = re.search(r'"file":"(.*?)"', dec_resp.text)
                    if m:
                        m3u8_url = m.group(1).replace("\\/", "/")

        if not m3u8_url:
            raise ValueError(f"Megacloud: Video URL bulunamadı. {url}")

        subtitles = [
            Subtitle(name=t.get("label", "Altyazı"), url=t.get("file"))
            for t in data.get("tracks", []) if t.get("kind") in ["captions", "subtitles"]
        ]

        return ExtractResult(name=self.name, url=m3u8_url, referer=f"{base_url}/", subtitles=subtitles)
