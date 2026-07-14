'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ImgHTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function parsePayload(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function PreviewPageContent() {
  const searchParams = useSearchParams();
  const previewParam = searchParams.get('preview');
  const [parsed, setParsed] = useState<null | Record<string, unknown>>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedPayload = window.sessionStorage.getItem('presentation-preview-payload');
    const parsedStoredPayload = parsePayload(storedPayload);

    if (parsedStoredPayload) {
      setParsed(parsedStoredPayload);
      return;
    }

    if (previewParam) {
      const legacyPayload = window.location.search.match(/[?&]payload=([^&]+)/);
      if (legacyPayload?.[1]) {
        setParsed(parsePayload(decodeURIComponent(legacyPayload[1])));
      }
    }
  }, [previewParam]);

  if (!parsed) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-200">
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8">
          <h1 className="text-2xl font-semibold">表示するプレゼンテーションがありません</h1>
          <p className="mt-3 text-sm text-zinc-400">
            アップロード画面からプレゼンテーションを送信してください。
          </p>
          <Link className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="/">
            アップロードへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const { content, assets = {}, sourcePath } = parsed as {
    content: string;
    assets?: Record<string, string>;
    sourcePath?: string;
  };

  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const frontmatterContent = frontmatterMatch?.[1] ?? '';
  const isMarpCompatible = /^\s*marp\s*:\s*true\s*$/im.test(frontmatterContent);
  const body = frontmatterMatch
    ? content.replace(frontmatterMatch[0], '').trim()
    : content;
  const slides = body
    .split(/\n---\s*\n?/g)
    .map((slide) => slide.trim())
    .filter(Boolean);
  const displaySlides = slides.length > 0 ? slides : [body];
  const safeSlideIndex = Math.min(currentSlideIndex, Math.max(displaySlides.length - 1, 0));
  const activeSlide = displaySlides[safeSlideIndex] ?? displaySlides[0] ?? '';

  useEffect(() => {
    setCurrentSlideIndex(0);
  }, [parsed]);

  useEffect(() => {
    if (!parsed || displaySlides.length <= 1) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') {
        event.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(prev + 1, displaySlides.length - 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displaySlides.length, parsed]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const resolveAssetUrl = (src?: string | Blob) => {
    if (!src || typeof src !== 'string') {
      return undefined;
    }

    if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) {
      return src;
    }

    const normalizedSrc = src.replace(/\\/g, '/');
    const sourceDir = sourcePath?.split('/').slice(0, -1).join('/') ?? '';
    const candidates = [normalizedSrc];

    if (sourceDir) {
      candidates.push(`${sourceDir}/${normalizedSrc}`);
    }

    return candidates.find((candidate) => Boolean(assets[candidate])) ?? src;
  };

  const renderImage = ({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) => {
    const resolvedSrc = resolveAssetUrl(src);
    const isLocalAsset =
      typeof src === 'string' &&
      !src.startsWith('http://') &&
      !src.startsWith('https://') &&
      !src.startsWith('data:') &&
      !src.startsWith('blob:') &&
      !src.startsWith('/');

    if (isLocalAsset && !resolvedSrc) {
      return (
        <div className="my-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/70 p-4 text-sm text-zinc-400">
          画像ファイルが見つかりません: {src}
        </div>
      );
    }

    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={alt ?? ''} src={resolvedSrc ?? src} />;
  };

  const handleToggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
      return;
    }

    await document.exitFullscreen?.();
    setIsFullscreen(false);
  };

  return (
    <div className={`min-h-screen bg-zinc-950 px-6 py-6 text-zinc-100 ${isFullscreen ? 'p-0' : ''}`}>
      <div className={isFullscreen ? 'flex h-screen flex-col' : 'mx-auto max-w-6xl'}>
        <div className={`flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/85 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] ${isFullscreen ? 'rounded-none border-x-0 border-t-0' : 'mb-6'}`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">Presentation Preview</p>
            <h1 className="text-lg font-semibold text-zinc-100">プレゼンテーション表示</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              onClick={() => setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))}
              type="button"
            >
              ← 前へ
            </button>
            <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
              {safeSlideIndex + 1} / {displaySlides.length}
            </span>
            <button
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              onClick={() => setCurrentSlideIndex((prev) => Math.min(prev + 1, displaySlides.length - 1))}
              type="button"
            >
              次へ →
            </button>
            <button
              className="rounded-lg border border-cyan-700/60 bg-cyan-950/70 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-900"
              onClick={handleToggleFullscreen}
              type="button"
            >
              {isFullscreen ? '全画面終了' : '全画面で開始'}
            </button>
            <Link className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800" href="/">
              アップロードに戻る
            </Link>
          </div>
        </div>

        <div className={`flex-1 ${isFullscreen ? 'p-3' : ''}`}>
          <div className={`flex h-full items-center justify-center rounded-2xl border border-zinc-800 bg-black p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] ${isFullscreen ? 'rounded-none border-none p-8' : ''}`}>
            <div className="w-full max-w-5xl overflow-auto">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                {!isMarpCompatible ? (
                  <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
                    Marp対応の判定は <span className="font-semibold">marp: true</span> を見るようにしています。今の内容は Marp 非対応として、通常の Markdown 表示で表示します。
                  </div>
                ) : null}

                <div className="space-y-4 text-sm leading-8 text-zinc-100 [&_a]:text-cyan-300 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-800 [&_th]:bg-zinc-900 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-4">
                  <ReactMarkdown components={{ img: renderImage }} remarkPlugins={[remarkGfm]}>{activeSlide}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-200">読み込み中...</div>}>
      <PreviewPageContent />
    </Suspense>
  );
}
