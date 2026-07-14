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

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Presentation Preview</p>
            <h1 className="text-2xl font-semibold">プレゼンテーション表示</h1>
          </div>
          <Link className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200" href="/">
            アップロードに戻る
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
          {!isMarpCompatible ? (
            <div className="mb-4 rounded-xl border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
              Marp対応の判定は <span className="font-semibold">marp: true</span> を見るようにしています。今の内容は Marp 非対応として、通常の Markdown 表示で表示します。
            </div>
          ) : null}

          <div className="space-y-5">
            {displaySlides.map((slide, index) => (
              <div
                className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6"
                key={`${slide.slice(0, 20)}-${index}`}
              >
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                  Slide {index + 1}
                </div>
                <div className="space-y-4 text-sm leading-7 text-zinc-100 [&_a]:text-cyan-300 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-800 [&_th]:bg-zinc-900 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-4">
                  <ReactMarkdown components={{ img: renderImage }} remarkPlugins={[remarkGfm]}>{slide}</ReactMarkdown>
                </div>
              </div>
            ))}
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
