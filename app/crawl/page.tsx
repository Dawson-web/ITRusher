"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

type CrawlResponse = {
  code: number;
  msg: string;
  data: {
    标题?: string;
    完整内容?: string;
    图片列表?: string[];
  };
};

export default function CrawlPage() {
  const [url, setUrl] = useState("");
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrawlResponse | null>(null);

  // 读取本地存储的 Cookie，避免每次输入
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nowcoderCookie") || "";
      setCookie(saved);
    }
  }, []);

  const handleCrawl = async () => {
    if (!url.trim()) {
      setError("请先输入牛客帖子链接");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (cookie.trim()) {
        localStorage.setItem("nowcoderCookie", cookie.trim());
      } else {
        localStorage.removeItem("nowcoderCookie");
      }

      const res = await fetch(`/api/crawl?url=${encodeURIComponent(url)}`, {
        headers: cookie.trim()
          ? {
              "X-Nowcoder-Cookie": cookie.trim(),
            }
          : undefined,
      });
      const data = (await res.json()) as CrawlResponse;
      setResult(data);
      if (data.code !== 200) {
        setError(data.msg || "爬取失败");
      }
    } catch (err: any) {
      setError(err?.message || "请求失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>牛客帖子爬取 Demo（调用 Vercel /api/crawl）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Input
              placeholder="请输入牛客帖子或搜索页链接，如 https://www.nowcoder.com/feed/main/detail/123"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleCrawl();
              }}
            />
            <Input
              placeholder="可选：粘贴你的牛客 Cookie，便于访问需登录的帖子（仅保存在本地）"
              value={cookie}
              onChange={e => setCookie(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleCrawl} disabled={loading}>
                {loading ? "爬取中..." : "开始爬取"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Cookie 会存到 localStorage，并通过请求头 X-Nowcoder-Cookie 发送到 /api/crawl
              </p>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={result.code === 200 ? "default" : "destructive"}>
                  {result.code === 200 ? "成功" : "失败"}
                </Badge>
                <span className="text-sm text-muted-foreground">{result.msg}</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">
                  {result.data?.标题 || "未解析到标题"}
                </h2>
                <p className="text-sm leading-6 whitespace-pre-wrap">
                  {result.data?.完整内容 || "未解析到正文"}
                </p>
              </div>
              {result.data?.图片列表?.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {result.data.图片列表.map(src => (
                    <div
                      key={src}
                      className="relative h-32 rounded-md overflow-hidden border bg-muted/30"
                    >
                      <img
                        src={src}
                        alt="帖子图片"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">暂无图片</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground leading-6">
          <p>1. 前端通过 <code>/api/crawl?url=...</code> 直接调用 Vercel Python 无服务器函数。</p>
          <p>2. 服务器端用 <code>requests</code> 抓取页面并用 <code>BeautifulSoup</code> 解析标题、正文、图片。</p>
          <p>3. 如果帖子需要登录，可在 Vercel 环境变量里配置 <code>NOWCODER_COOKIE</code>。</p>
          <p>4. 返回 JSON 结构包含 <code>code</code>、<code>msg</code>、<code>data</code>，前端按需展示。</p>
        </CardContent>
      </Card>
    </main>
  );
}
