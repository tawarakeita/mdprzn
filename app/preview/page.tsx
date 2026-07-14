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
      <h1 className="mb-8 text-4xl font-bold text-cyan-300" {...props}>
        ▶ {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="mb-7 text-3xl font-bold text-cyan-400" {...props}>
        ├ {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="mt-5 text-2xl font-semibold text-cyan-300" {...props}>
        ├─ {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="mt-6 text-xl font-semibold text-slate-300" {...props}>
        │ {children}
      </h4>
    ),
    h5: ({ children, ...props }: any) => (
      <h5 className="mt-5 text-lg font-semibold text-slate-300" {...props}>
        • {children}
      </h5>
    ),
    h6: ({ children, ...props }: any) => (
      <h6 className="mt-5 text-base font-semibold text-slate-400" {...props}>
        ◦ {children}
      </h6>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="my-6 border-l-2 border-cyan-500/50 bg-slate-900/40 px-4 py-3 text-sm italic text-slate-300" {...props}>{children}</blockquote>
    ),
    p: ({ children, ...props }: any) => (
      <p className="text-lg leading-relaxed text-slate-200" {...props}>{children}</p>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="mt-4 list-none pl-0 text-lg leading-relaxed text-slate-200" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="mt-4 list-none pl-0 text-lg leading-relaxed text-slate-200" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="mt-2 pl-6 text-lg leading-relaxed text-slate-200" {...props}>
        <span className="absolute ml-[-1.5rem] text-cyan-400">›</span>
        {children}
      </li>
    ),
    pre: ({ children, ...props }: any) => (
      <pre className="mt-5 overflow-x-auto rounded border border-slate-700 bg-black/80 p-4 text-sm text-green-300" {...props}>{children}</pre>
    ),
    code: ({ children, ...props }: any) => (
      <code className="rounded bg-slate-800/60 px-2 py-1 text-sm text-green-300" {...props}>{children}</code>
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
    <div className={`relative flex h-screen flex-col bg-slate-100 ${isFullscreen ? 'p-0' : ''}`}>
      {/* Simple header */}
      {!isFullscreen && (
        <>
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div className="text-sm text-slate-600">Presentation Preview</div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">Slide</span>
              <span className="rounded bg-slate-100 px-3 py-1 font-semibold text-slate-800">
                {safeSlideIndex + 1} / {displaySlides.length}
              </span>
            </div>
          </div>

          {/* Navigation bar */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-3">
            <div className="flex gap-2">
              <button
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))}
                type="button"
              >
                ← Prev
              </button>
              <button
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setCurrentSlideIndex((prev) => Math.min(prev + 1, displaySlides.length - 1))}
                type="button"
              >
                Next →
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
                onClick={handleToggleFullscreen}
                type="button"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
              <Link className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" href="/">
                Back
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Content area with terminal-style slide */}
      <div className={`flex-1 overflow-hidden ${isFullscreen ? 'bg-slate-950 p-0' : 'bg-slate-50 px-8 py-8'}`}>
        <div className="flex h-full items-center justify-center overflow-auto">
          <div className={isFullscreen ? 'h-full w-full' : 'w-full max-w-4xl'}>
            {!isFullscreen && !isMarpCompatible && (
              <div className="mb-6 rounded border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">
                ⚠ Marp detected: <span className="font-semibold">marp: true</span> — rendering as standard Markdown
              </div>
            )}

            {/* Terminal-style slide container */}
            <div className={`rounded-lg border-2 border-slate-900 bg-slate-950 p-8 font-mono shadow-2xl ${isFullscreen ? 'h-full border-0 rounded-none p-12' : ''}`}>
              <div className="min-h-[60vh] w-full space-y-6 leading-relaxed text-slate-200 [&_a]:text-cyan-400 [&_a]:underline [&_a]:hover:text-cyan-300 [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded [&_img]:border [&_img]:border-slate-700 [&_img]:shadow-lg [&_img]:shadow-cyan-500/10 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-700 [&_th]:bg-slate-800/80 [&_th]:px-3 [&_th]:py-2 [&_th]:text-cyan-300 [&_td]:border [&_td]:border-slate-700 [&_td]:px-3 [&_td]:py-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-black/60 [&_pre]:p-4 [&_pre]:text-sm">
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>{renderedSlide}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen exit hint */}
      {isFullscreen && (
        <button
          className="absolute bottom-4 right-4 rounded border border-cyan-500/50 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-slate-800"
          onClick={handleToggleFullscreen}
          type="button"
        >
          ESC or Click to Exit
        </button>
      )}
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
