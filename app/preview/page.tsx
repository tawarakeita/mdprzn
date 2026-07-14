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

  const payload = parsed as {
    content?: string;
    assets?: Record<string, string>;
    sourcePath?: string;
  } | null;

  const content = payload?.content ?? '';
  const assets = payload?.assets ?? {};
  const sourcePath = payload?.sourcePath ?? null;

  const normalizePath = (path: string) =>
    path
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/\/+/g, '/');

  const normalizePipeQuoteSyntax = (markdown: string) =>
    markdown
      .split(/\r?\n/)
      .map((line) => {
        if (/^\|\s[^|]*$/.test(line)) {
          return line.replace(/^\|\s?/, '> ');
        }
        return line;
      })
      .join('\n');

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
  const renderedSlide = normalizePipeQuoteSyntax(activeSlide);

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

  const resolveRelativePath = (base: string, relative: string) => {
    const baseSegments = base.split('/').filter(Boolean);
    const relativeSegments = relative.split('/').filter(Boolean);
    const stack = [...baseSegments];

    relativeSegments.forEach((segment) => {
      if (segment === '..') {
        stack.pop();
      } else if (segment !== '.') {
        stack.push(segment);
      }
    });

    return stack.join('/');
  };

  const resolveAssetUrl = (src?: string | Blob) => {
    if (!src || typeof src !== 'string') {
      return undefined;
    }

    if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) {
      return src;
    }

    const normalizedSrc = normalizePath(src);
    const sourceDir = normalizePath(sourcePath?.split('/').slice(0, -1).join('/') ?? '');
    const candidates = [normalizedSrc];

    if (sourceDir) {
      candidates.push(`${sourceDir}/${normalizedSrc}`);
      if (normalizedSrc.startsWith('..')) {
        candidates.push(resolveRelativePath(sourceDir, normalizedSrc));
      }
    }

    const match = candidates.find((candidate) => Boolean(assets[candidate]));
    return match ? assets[match] : undefined;
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

  const markdownComponents: Record<string, any> = {
    h1: ({ children, ...props }: any) => (
      <h1 className="mb-8 text-4xl font-semibold text-slate-100" {...props}># {children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="mb-7 text-3xl font-semibold text-slate-100" {...props}>## {children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="mt-5 text-2xl font-semibold text-slate-100" {...props}>### {children}</h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="mt-6 text-xl font-semibold text-slate-100" {...props}>#### {children}</h4>
    ),
    h5: ({ children, ...props }: any) => (
      <h5 className="mt-5 text-lg font-semibold text-slate-200" {...props}>##### {children}</h5>
    ),
    h6: ({ children, ...props }: any) => (
      <h6 className="mt-5 text-base font-semibold text-slate-200" {...props}>###### {children}</h6>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="my-6 border-l-4 border-zinc-600 bg-transparent px-4 text-xl italic leading-[1.7] text-zinc-300" {...props}>{children}</blockquote>
    ),
    p: ({ children, ...props }: any) => (
      <p className="text-xl leading-[1.7] text-white" {...props}>{children}</p>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="mt-4 list-disc pl-8 text-xl leading-[1.7] text-white" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="mt-4 list-decimal pl-6 text-base leading-8 text-zinc-100" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="mt-2 text-base leading-8 text-zinc-100" {...props}>{children}</li>
    ),
    pre: ({ children, ...props }: any) => (
      <pre className="mt-5 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-200" {...props}>{children}</pre>
    ),
    code: ({ children, ...props }: any) => (
      <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-sm text-cyan-200" {...props}>{children}</code>
    ),
    img: renderImage,
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
    <div className={`relative flex h-screen flex-col bg-black text-white ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-black/70 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-500">Presentation Preview</p>
          <h1 className="text-base font-semibold uppercase tracking-[0.15em] text-white">プレゼンテーション表示</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-xs text-white transition hover:bg-zinc-800"
            onClick={() => setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))}
            type="button"
          >
            ← 前へ
          </button>
          <span className="rounded border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
            {safeSlideIndex + 1} / {displaySlides.length}
          </span>
          <button
            className="rounded border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-xs text-white transition hover:bg-zinc-800"
            onClick={() => setCurrentSlideIndex((prev) => Math.min(prev + 1, displaySlides.length - 1))}
            type="button"
          >
            次へ →
          </button>
          <button
            className="rounded border border-cyan-500 bg-cyan-950/70 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-900"
            onClick={handleToggleFullscreen}
            type="button"
          >
            {isFullscreen ? '全画面終了' : '全画面で開始'}
          </button>
          <Link className="rounded border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-xs text-white transition hover:bg-zinc-800" href="/">
            アップロードへ戻る
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-24">
        <div className="flex h-full items-center justify-center overflow-auto">
          <div className="w-full max-w-5xl">
            {!isMarpCompatible ? (
              <div className="mb-8 text-sm text-amber-200">
                Marp対応の判定は <span className="font-semibold">marp: true</span> を見るようにしています。今の内容は Marp 非対応として、通常の Markdown 表示で表示します。
              </div>
            ) : null}

            <div className="min-h-[70vh] w-full space-y-8 text-xl leading-[1.4] text-white [&_a]:text-cyan-300 [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-lg [&_img]:shadow-black/40 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-700 [&_th]:bg-zinc-950 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-zinc-700 [&_td]:px-3 [&_td]:py-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950/95 [&_pre]:p-4">
              <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>{renderedSlide}</ReactMarkdown>
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
