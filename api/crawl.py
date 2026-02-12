# api/crawl.py
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler
from typing import List, Tuple
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# 统一请求头 & 可选 Cookie
def _build_headers(cookie_override: str | None = None) -> dict:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.nowcoder.com/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        # requests 默认不解 br，避免乱码
        "Accept-Encoding": "gzip, deflate",
    }
    cookie = (cookie_override or os.getenv("NOWCODER_COOKIE", "")).strip()
    if cookie:
        headers["Cookie"] = cookie
    return headers


def _safe_text(soup: BeautifulSoup, selector: str) -> str:
    element = soup.select_one(selector)
    return element.get_text(strip=True) if element else ""


def _find_in_json(obj, keys: list[str]) -> str:
    """在嵌套 JSON 中深度优先查找第一个非空字符串。"""
    stack = [obj]
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            for k in keys:
                if k in cur and isinstance(cur[k], str) and cur[k].strip():
                    return cur[k].strip()
            stack.extend(cur.values())
        elif isinstance(cur, list):
            stack.extend(cur)
    return ""


def _extract_inline_json(soup: BeautifulSoup) -> list[dict]:
    """从 script 标签中提取可解析的 JSON（兼容 __NEXT_DATA__ / __NUXT__ / __INITIAL_STATE__）。"""
    candidates = []
    for script in soup.find_all("script"):
        text = script.string or script.text
        if not text:
            continue
        # 直接 JSON
        if script.get("type") == "application/json" or script.get("id") == "__NEXT_DATA__":
            try:
                candidates.append(json.loads(text))
                continue
            except Exception:
                pass
        # 处理 window.__NUXT__ = {...} 或 window.__INITIAL_STATE__=...
        match = re.search(r"__NUXT__\\s*=\\s*({.*?})\\s*;?", text, re.S)
        if not match:
            match = re.search(r"__INITIAL_STATE__\\s*=\\s*({.*?})\\s*;?", text, re.S)
        if match:
            try:
                candidates.append(json.loads(match.group(1)))
            except Exception:
                pass
    return candidates


def crawl_nowcoder_detail(
    url: str, cookie_override: str | None = None, debug: bool = False
) -> Tuple[dict, str]:
    """抓取单个牛客帖子详情。"""
    headers = _build_headers(cookie_override)
    resp = requests.get(url, headers=headers, timeout=(5, 10))
    resp.raise_for_status()
    resp.encoding = "utf-8"

    soup = BeautifulSoup(resp.text, "html.parser")

    debug_info = {}

    # 1) DOM 直接选择
    title = _safe_text(soup, "h1.tw-text-size-title-lg-pure")
    if title:
        debug_info["title_from"] = "h1.tw-text-size-title-lg-pure"
    if not title:
        title = _safe_text(soup, "section h1.tw-font-medium") or _safe_text(
            soup, "h1.feed-title, h1.post-title, h1.title"
        )
        if title:
            debug_info["title_from"] = "fallback h1"

    # 内容：优先页面正文，再兜底其它容器
    content_el = soup.select_one("section .feed-content-text") or soup.select_one("div.feed-content-text")
    if content_el:
        content = content_el.get_text(" ", strip=True)
        debug_info["content_from"] = "feed-content-text"
    else:
        content = _safe_text(soup, "div.rich-text, article, div.post-content")
        if content:
            debug_info["content_from"] = "fallback rich/article"

    # 2) 元标签 / JSON 兜底
    if not title:
        og = soup.find("meta", property="og:title")
        if og and og.get("content"):
            title = og["content"].strip()
            debug_info["title_from"] = "meta og:title"

    if not content or len(content) < 10:
        for data_json in _extract_inline_json(soup):
            content_from_json = _find_in_json(
                data_json, ["content", "fullContent", "text", "richText", "description"]
            )
            title_from_json = _find_in_json(data_json, ["title", "seoTitle"])
            if content_from_json and len(content_from_json) > len(content):
                content = content_from_json
                debug_info["content_from"] = "inline JSON"
            if not title and title_from_json:
                title = title_from_json
                debug_info["title_from"] = "inline JSON"
            if title and content:
                break

    img_list = []
    for img in soup.select("section .feed-img img, img.el-image__inner, .feed-img img"):
        src = (
            img.get("src")
            or img.get("data-src")
            or img.get("data-original")
            or (img.get("data-srcset") or "").split(" ")[0]
        )
        if src:
            img_list.append(urljoin(url, src))

    data = {
        "标题": title,
        "完整内容": content,
        "图片列表": img_list,
    }
    if debug:
        data["_debug"] = debug_info
    return data, "爬取成功"


def _parse_list_items(soup: BeautifulSoup, base_url: str) -> List[dict]:
    """解析列表页，提取标题/预览/链接等基础字段。"""
    items = []
    # 1) 新版搜索/列表页外层容器
    nodes = soup.select("div.tw-bg-white.tw-mt-3.tw-rounded-xl div.tw-px-5.tw-relative.tw-pb-5.tw-pt-5")
    # 2) 老版/其他入口容器兜底
    if not nodes:
        nodes = soup.select("div.tw-px-5.tw-relative.tw-pb-5.tw-cursor-pointer")
    if not nodes:
        nodes = soup.select("div.feed-item, div.feed-main, div.feed-card")

    for el in nodes:
        # 标题：优先 a.dy，再退回到粗体标题
        title = _safe_text(el, "a.dy") or _safe_text(el, ".tw-text-lg.tw-font-bold")
        # 列表内容预览
        preview = _safe_text(el, ".feed-text") or _safe_text(el, ".tw-text-gray-800")
        # 链接
        link_el = el.select_one("a.dy[href*='/feed/main/detail/']") or el.select_one(
            "a[href*='/feed/main/detail/']"
        )
        link = urljoin(base_url, link_el["href"]) if link_el and link_el.get("href") else ""
        # 用户名/时间
        username = _safe_text(el, ".user-nickname")
        time_text = _safe_text(el, ".show-time")
        # 图片列表（列表页也带图时）
        img_list = []
        for img in el.select(".feed-img img, .el-image__inner"):
            src = img.get("src") or img.get("data-src")
            if src:
                img_list.append(urljoin(base_url, src))

        if title:
            items.append(
                {
                    "标题": title,
                    "内容预览": preview,
                    "链接": link,
                    "用户名": username,
                    "发布时间": time_text,
                    "完整内容": "",
                    "图片列表": img_list,
                }
            )
    return items


def crawl_nowcoder_list(
    url: str,
    limit: int = 10,
    with_detail: bool = True,
    delay: float = 0.3,
    cookie_override: str | None = None,
    debug: bool = False,
) -> Tuple[dict, str]:
    """抓取列表页（如搜索页），可选抓详情补全内容/图片。"""
    headers = _build_headers(cookie_override)
    resp = requests.get(url, headers=headers, timeout=(5, 10))
    resp.raise_for_status()
    resp.encoding = "utf-8"

    soup = BeautifulSoup(resp.text, "html.parser")
    base_url = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    items = _parse_list_items(soup, base_url)

    if not items:
        return {"列表": []}, "未在列表页找到帖子节点，可能页面需要登录或结构已变更"

    limit = max(1, min(int(limit or 1), 30))  # 限制最多抓 30 条，避免超时
    items = items[:limit]

    if with_detail:
        for idx, item in enumerate(items):
            link = item.get("链接")
            if not link:
                continue
            try:
                detail, _ = crawl_nowcoder_detail(
                    link, cookie_override=cookie_override, debug=debug
                )
                item["完整内容"] = detail.get("完整内容", "")
                item["图片列表"] = detail.get("图片列表", [])
                if debug and detail.get("_debug"):
                    item["_debug"] = detail["_debug"]
            except Exception as e:
                item["完整内容"] = f"详情页爬取失败：{e}"
                item["图片列表"] = []
            if idx < len(items) - 1 and delay > 0:
                time.sleep(delay)

    return {"列表": items, "数量": len(items)}, "爬取成功"


def handle_crawl(
    url: str,
    mode: str,
    limit: int,
    with_detail: bool,
    cookie_override: str | None,
    debug: bool,
) -> dict:
    try:
        if mode == "list":
            data, msg = crawl_nowcoder_list(
                url,
                limit=limit,
                with_detail=with_detail,
                cookie_override=cookie_override,
                debug=debug,
            )
        else:
            data, msg = crawl_nowcoder_detail(url, cookie_override=cookie_override, debug=debug)
        return {"code": 200, "data": data, "msg": msg}
    except Exception as e:
        return {"code": 500, "data": {}, "msg": f"爬取失败：{e}"}


# Vercel Serverless 接口处理逻辑（固定写法）
class handler(BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Nowcoder-Cookie")

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        query = urlparse(self.path).query
        params = parse_qs(query)
        target_url = params.get("url", [""])[0].strip()
        mode = params.get("type", [""])[0] or ("list" if "search" in target_url else "detail")
        with_detail = params.get("detail", ["1"])[0] != "0"
        debug = params.get("debug", ["0"])[0] == "1"
        try:
            limit = int(params.get("limit", ["10"])[0])
        except ValueError:
            limit = 10
        # 允许通过自定义头或 query 传入 Cookie，方便前端 localStorage 管理
        cookie_override = (self.headers.get("X-Nowcoder-Cookie") or params.get("cookie", [""])[0]).strip()

        if not target_url:
            result = {"code": 400, "data": {}, "msg": "请传入爬取链接（?url=牛客帖子/搜索页链接）"}
        elif not target_url.startswith("http"):
            result = {"code": 400, "data": {}, "msg": "url 参数必须以 http/https 开头"}
        else:
            result = handle_crawl(
                target_url,
                mode,
                limit,
                with_detail,
                cookie_override if cookie_override else None,
                debug,
            )

        self.send_response(200)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self._set_cors()
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
