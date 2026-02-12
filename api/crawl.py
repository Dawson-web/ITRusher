# api/crawl.py
import json
import os
import re
import time
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler
from typing import List, Tuple
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

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


def _set_page_param(raw_url: str, page: int) -> str:
    """在 URL 中注入或替换分页参数，适配常见键 page/pageNum/pn/curPage。"""
    if page <= 0:
        return raw_url
    parsed = urlparse(raw_url)
    q = parse_qs(parsed.query)
    for key in ["page", "pageNum", "pn", "curPage"]:
        q[key] = [str(page)]
    new_query = urlencode(q, doseq=True)
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        )
    )


def _extract_keyword_from_url(raw_url: str) -> str:
    """从搜索页 URL 中提取 query 关键词。"""
    parsed = urlparse(raw_url)
    qs = parse_qs(parsed.query)
    return qs.get("query", [""])[0].strip()


def _fmt_time(ts_ms: int | None) -> str:
    """时间戳毫秒转 MM-DD HH:MM（北京时区），缺失则空字符串。"""
    if not ts_ms:
        return ""
    try:
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone(timedelta(hours=8)))
        return dt.strftime("%m-%d %H:%M")
    except Exception:
        return ""


def _extract_text_nodes(node: dict | list | None) -> str:
    """解析 newTitle/newContent 的 data 节点数组为纯文本。"""
    if not node:
        return ""
    if isinstance(node, dict):
        arr = node.get("data", [])
    else:
        arr = node
    parts = []
    for item in arr:
        if isinstance(item, dict) and item.get("text"):
            parts.append(str(item["text"]))
    return " ".join(parts).strip()


def _fetch_search_api(keyword: str, page: int, size: int, cookie_override: str | None = None) -> dict:
    """直接调用牛客官方搜索接口，返回原始 JSON。"""
    api_url = "https://gw-c.nowcoder.com/api/sparta/pc/search"
    headers = _build_headers(cookie_override)
    headers.update(
        {
            "Origin": "https://www.nowcoder.com",
            "Referer": "https://www.nowcoder.com/",
            "Content-Type": "application/json;charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        }
    )
    payload = {
        "type": "all",
        "query": keyword,
        "page": page,
        "size": size,
        "tag": [],
        "order": "",
        # gioParams 非必填，接口容忍缺失；如需可透传
    }
    resp = requests.post(api_url, headers=headers, json=payload, timeout=(5, 10))
    resp.raise_for_status()
    return resp.json()


def _normalize_record(rec: dict) -> dict:
    """将接口 record 统一映射到前端使用的字段结构。"""
    data = rec.get("data", {}) if isinstance(rec, dict) else {}
    user = data.get("userBrief", {}) or {}
    moment = data.get("momentData") or {}
    content_data = data.get("contentData") or {}

    # 标题
    title = (
        _extract_text_nodes(moment.get("newTitle"))
        or moment.get("title")
        or _extract_text_nodes(content_data.get("newTitle"))
        or content_data.get("title")
        or rec.get("title")
        or ""
    )
    # 预览内容
    preview = (
        _extract_text_nodes(moment.get("newContent"))
        or moment.get("content")
        or _extract_text_nodes(content_data.get("newContent"))
        or content_data.get("content")
        or ""
    )

    # 链接：动态/面经用 uuid，帖子用 contentId
    link = ""
    uuid = moment.get("uuid")
    content_id = content_data.get("id") or moment.get("id") or moment.get("contentId")
    if uuid:
        link = f"https://www.nowcoder.com/feed/main/detail/{uuid}?source=search"
    elif content_id:
        # 讨论帖路径
        link = f"https://www.nowcoder.com/discuss/{content_id}?source=search"

    # 图片（仅取封面列表）
    imgs = []
    for img_block in (moment.get("imgMoment") or content_data.get("contentImageUrls") or []):
        if isinstance(img_block, dict):
            src = img_block.get("src") or img_block.get("url")
            if src:
                imgs.append(src)

    pub_ts = moment.get("showTime") or moment.get("createdAt") or content_data.get("showTime") or content_data.get(
        "createTime"
    )

    return {
        "标题": title.strip(),
        "内容预览": preview.strip(),
        "链接": link,
        "用户名": user.get("nickname") or "",
        "发布时间": _fmt_time(pub_ts),
        "完整内容": "",  # 如需详情可再抓
        "图片列表": imgs,
    }


def crawl_nowcoder_search_api(
    keyword: str,
    page: int = 1,
    pages: int = 1,
    size: int = 20,
    with_detail: bool = False,
    cookie_override: str | None = None,
    debug: bool = False,
) -> Tuple[dict, str]:
    """通过官方搜索接口跨页抓取。"""
    all_items: list[dict] = []
    cur = max(1, page)
    pages = max(1, pages)
    last_msg = ""
    for p in range(cur, cur + pages):
        raw = _fetch_search_api(keyword, p, size, cookie_override)
        if not raw.get("success", False):
            return {"列表": all_items}, raw.get("msg", "接口返回错误")
        data = raw.get("data", {}) or {}
        records = data.get("records") or []
        normalized = [_normalize_record(r) for r in records]
        all_items.extend(normalized)
        last_msg = raw.get("msg", "爬取成功")
        # 是否还有下一页
        total_page = data.get("totalPage") or 0
        if p >= total_page:
            break
        # 若本页空也提前结束
        if not records:
            break
    # 可选补详情
    if with_detail:
        for idx, item in enumerate(all_items):
            link = item.get("链接")
            if not link:
                continue
            try:
                detail, _ = crawl_nowcoder_detail(link, cookie_override=cookie_override, debug=debug)
                item["完整内容"] = detail.get("完整内容", "")
                item["图片列表"] = detail.get("图片列表", item.get("图片列表", []))
                if debug and detail.get("_debug"):
                    item["_debug"] = detail["_debug"]
            except Exception as e:
                item["完整内容"] = f"详情页爬取失败：{e}"
            if idx < len(all_items) - 1:
                time.sleep(0.2)

    return {"列表": all_items, "数量": len(all_items)}, last_msg or "爬取成功"


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
    page: int | None = None,
) -> Tuple[dict, str]:
    """抓取列表页（如搜索页），可选抓详情补全内容/图片。基于 HTML 解析。"""
    headers = _build_headers(cookie_override)
    target_url = _set_page_param(url, page) if page else url
    resp = requests.get(target_url, headers=headers, timeout=(5, 10))
    resp.raise_for_status()
    resp.encoding = "utf-8"

    soup = BeautifulSoup(resp.text, "html.parser")
    base_url = f"{urlparse(target_url).scheme}://{urlparse(target_url).netloc}"
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
    start_page: int,
    pages: int,
    keyword: str = "",
) -> dict:
    try:
        if mode == "list":
            keyword = keyword.strip()
            use_api = (
                ("gw-c.nowcoder.com/api/sparta/pc/search" in url) if url else False
            ) or bool(keyword) or (url and url.endswith("/api/sparta/pc/search"))

            if use_api:
                data, msg = crawl_nowcoder_search_api(
                    keyword=keyword or _extract_keyword_from_url(url) or "",
                    page=start_page,
                    pages=pages,
                    size=max(1, min(limit, 50)),
                    with_detail=with_detail,
                    cookie_override=cookie_override,
                    debug=debug,
                )
            else:
                all_items: list[dict] = []
                current_page = max(1, start_page)
                total_pages = max(1, pages)
                last_msg = ""
                for i in range(current_page, current_page + total_pages):
                    data_page, msg = crawl_nowcoder_list(
                        url,
                        limit=limit,
                        with_detail=with_detail,
                        cookie_override=cookie_override,
                        debug=debug,
                        page=i,
                    )
                    last_msg = msg
                    items = data_page.get("列表", [])
                    all_items.extend(items)
                    if not items:
                        break
                    if len(all_items) >= limit * total_pages:
                        break
                data = {"列表": all_items, "数量": len(all_items)}
                msg = last_msg or "爬取成功"
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
        keyword = params.get("query", [""])[0].strip() or params.get("q", [""])[0].strip()
        mode = params.get("type", [""])[0] or ("list" if (keyword or "search" in target_url) else "detail")
        with_detail = params.get("detail", ["1"])[0] != "0"
        debug = params.get("debug", ["0"])[0] == "1"
        try:
            start_page = int(params.get("page", ["1"])[0])
        except ValueError:
            start_page = 1
        try:
            pages = int(params.get("pages", ["1"])[0])
        except ValueError:
            pages = 1
        try:
            limit = int(params.get("limit", ["10"])[0])
        except ValueError:
            limit = 10
        # 允许通过自定义头或 query 传入 Cookie，方便前端 localStorage 管理
        cookie_override = (self.headers.get("X-Nowcoder-Cookie") or params.get("cookie", [""])[0]).strip()

        if not target_url and not keyword:
            result = {"code": 400, "data": {}, "msg": "请传入关键词(query=) 或 链接(url=)"}
        elif target_url and not target_url.startswith("http"):
            result = {"code": 400, "data": {}, "msg": "url 参数必须以 http/https 开头"}
        else:
            result = handle_crawl(
                target_url,
                mode,
                limit,
                with_detail,
                cookie_override if cookie_override else None,
                debug,
                start_page,
                pages,
                keyword,
            )

        self.send_response(200)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self._set_cors()
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
