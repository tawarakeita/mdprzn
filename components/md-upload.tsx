'use client';

import { Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ImgHTMLAttributes, type InputHTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type UploadedBundle = {
  id: string;
  label: string;
  files: File[];
};

type PresentationViewerProps = {
  content: string;
  assetUrlMap: Record<string, string>;
  sourcePath: string | null;
};

function normalizePipeQuoteSyntax(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (/^\|\s[^|]*$/.test(line)) {
        return line.replace(/^\|\s?/, '> ');
      }
      return line;
    })
    .join('\n');
}

function PresentationViewer({
  content,
  assetUrlMap,
  sourcePath,
}: PresentationViewerProps) {
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();
  const renderableContent = normalizePipeQuoteSyntax(normalizedContent);

  if (!normalizedContent) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-sm text-zinc-400">
        まだ表示するMarkdownがありません。ファイルをアップロードしてください。
      </div>
    );
  }

  const frontmatterMatch = renderableContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const frontmatterContent = frontmatterMatch?.[1] ?? '';
  const isMarpCompatible = /^\s*marp\s*:\s*true\s*$/im.test(frontmatterContent);
  const body = frontmatterMatch
    ? renderableContent.replace(frontmatterMatch[0], '').trim()
    : renderableContent;
  const slides = body
    .split(/\n---\s*\n?/g)
    .map((slide) => slide.trim())
    .filter(Boolean);
  const displaySlides = slides.length > 0 ? slides : [body];
  const isFallbackMode = !isMarpCompatible;

  const resolveAssetUrl = (src?: string | Blob) => {
    if (!src || typeof src !== 'string') {
      return undefined;
    }

    if (
      /^https?:\/\//i.test(src) ||
      src.startsWith('data:') ||
      src.startsWith('blob:') ||
      src.startsWith('/')
    ) {
      return src;
    }

    const normalizedSrc = src.replace(/\\/g, '/');
    const sourceDir = sourcePath?.split('/').slice(0, -1).join('/') ?? '';
    const candidates = [normalizedSrc];

    if (sourceDir) {
      candidates.push(`${sourceDir}/${normalizedSrc}`);
    }

    return candidates.find((candidate) => Boolean(assetUrlMap[candidate])) ?? src;
  };

  const renderImage = ({
    src,
    alt,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement>) => {
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
    <div className="space-y-4">
      {!isMarpCompatible ? (
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          Marp対応の判定は <span className="font-semibold">marp: true</span> を見るようにしています。今の内容は Marp 非対応として、通常の Markdown 表示で表示します。
        </div>
      ) : null}

      {displaySlides.map((slide, index) => (
        <div
          className="rounded-2xl border border-zinc-800 bg-black p-6 text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
          key={`${slide.slice(0, 20)}-${index}`}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Slide {index + 1}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] ${isFallbackMode ? 'border-amber-800 bg-amber-950/70 text-amber-200' : 'border-zinc-800 bg-zinc-950/80 text-zinc-400'}`}>
              {isFallbackMode ? 'Marp non-compatible' : 'Marp-compatible preview'}
            </span>
          </div>

          <div className="space-y-4 text-sm leading-7 text-zinc-100 [&_a]:text-cyan-300 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-800 [&_th]:bg-zinc-900 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-4">
            <ReactMarkdown
              components={{ img: renderImage }}
              remarkPlugins={[remarkGfm]}
            >
              {slide}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FileUpload01() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRequestRef = useRef(0);
  const [uploadedBundles, setUploadedBundles] = useState<UploadedBundle[]>([]);
  const [fileProgresses, setFileProgresses] = useState<Record<string, number>>(
    {}
  );
  const [assetUrlMap, setAssetUrlMap] = useState<Record<string, string>>({});
  const [previewContent, setPreviewContent] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null);
  const [activeSourcePath, setActiveSourcePath] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const folderUploadProps = {
    directory: '',
    webkitdirectory: '',
  } as InputHTMLAttributes<HTMLInputElement>;

  const getRelativePath = (file: File) => {
    const webkitRelativePath = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath;
    return webkitRelativePath ? webkitRelativePath.replace(/\\/g, '/') : file.name;
  };

  const getBundleLabel = (files: File[]) => {
    const firstRelativePath = getRelativePath(files[0]);
    const firstSegment = firstRelativePath.split('/')[0];
    return firstSegment && files.length > 1 ? firstSegment : files[0]?.name ?? 'uploaded';
  };

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to read file'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const loadPreviewForFile = async (file: File, sourcePath?: string) => {
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const content = await file.text();
      if (requestId !== previewRequestRef.current) {
        return;
      }
      setPreviewContent(content);
      setActiveSourcePath(sourcePath ?? getRelativePath(file));
    } catch {
      if (requestId !== previewRequestRef.current) {
        return;
      }
      setPreviewContent('');
      setPreviewError('このファイルの内容を読み込めませんでした。');
      setActiveSourcePath(sourcePath ?? getRelativePath(file));
    } finally {
      if (requestId === previewRequestRef.current) {
        setIsPreviewLoading(false);
      }
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const uploadedFiles = Array.from(files);
    const groupedFiles = new Map<string, File[]>();

    uploadedFiles.forEach((file) => {
      const relativePath = getRelativePath(file);
      const groupKey = relativePath.includes('/') ? relativePath.split('/')[0] : file.name;
      const existingGroup = groupedFiles.get(groupKey) ?? [];
      existingGroup.push(file);
      groupedFiles.set(groupKey, existingGroup);
    });

    const nextBundles = Array.from(groupedFiles.entries()).map(([groupKey, bundleFiles], index) => ({
      id: `${groupKey}-${Date.now()}-${index}`,
      label: getBundleLabel(bundleFiles),
      files: bundleFiles,
    }));

    setUploadedBundles((prev) => [...prev, ...nextBundles]);

    const imageEntries = await Promise.all(
      uploadedFiles.map(async (file) => {
        const relativePath = getRelativePath(file);
        const isImageFile =
          file.type.startsWith('image/') ||
          /\.(png|jpe?g|gif|svg|webp|bmp|avif|ico)$/i.test(file.name);

        if (!isImageFile) {
          return null;
        }

        try {
          const dataUrl = await readAsDataUrl(file);
          return [relativePath, dataUrl] as const;
        } catch {
          return null;
        }
      })
    );

    const nextAssetMap = Object.fromEntries(
      imageEntries.filter(Boolean) as Array<[string, string]>
    );

    setAssetUrlMap((prev) => ({ ...prev, ...nextAssetMap }));

    nextBundles.forEach((bundle) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setFileProgresses((prev) => ({
          ...prev,
          [bundle.id]: Math.min(progress, 100),
        }));
      }, 300);
    });

    const latestBundle = nextBundles[nextBundles.length - 1];
    const markdownFile = latestBundle?.files.find((file) =>
      file.name.toLowerCase().endsWith('.md')
    );
    const previewFile = markdownFile ?? latestBundle?.files[0];

    if (latestBundle && previewFile) {
      setActiveBundleId(latestBundle.id);
      void loadPreviewForFile(previewFile, getRelativePath(previewFile));
    }
  };

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    void handleFileSelect(e.dataTransfer.files);
  };

  const removeBundle = (bundleId: string) => {
    setUploadedBundles((prev) => prev.filter((bundle) => bundle.id !== bundleId));
    setFileProgresses((prev) => {
      const newProgresses = { ...prev };
      delete newProgresses[bundleId];
      return newProgresses;
    });

    if (activeBundleId === bundleId) {
      setPreviewContent('');
      setPreviewError(null);
      setActiveBundleId(null);
      setActiveSourcePath(null);
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!uploadedBundles.length) {
      return;
    }

    const targetBundle =
      uploadedBundles.find((bundle) => bundle.id === activeBundleId) ??
      uploadedBundles[uploadedBundles.length - 1];

    const markdownFile = targetBundle?.files.find((file) =>
      file.name.toLowerCase().endsWith('.md')
    );
    const previewFile = markdownFile ?? targetBundle?.files[0];

    if (!previewFile) {
      return;
    }

    const payload = {
      content: previewContent || '',
      assets: assetUrlMap,
      sourcePath: activeSourcePath ?? getRelativePath(previewFile),
      bundleLabel: targetBundle?.label ?? previewFile.name,
    };

    window.sessionStorage.setItem('presentation-preview-payload', JSON.stringify(payload));
    router.push('/preview?preview=1');
  };

  const getDisplayLabel = (relativePath: string) => {
    return relativePath.split('/').pop() ?? relativePath;
  };

  return (
    <div className="flex items-center justify-center p-10">
      <Card className="mx-auto w-full max-w-5xl rounded-lg bg-background p-0 shadow-md">
        <CardContent className="p-0">
          <div className="p-6 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-balance font-medium text-foreground text-lg">
                  Markdownファイルをアップロード
                </h2>
                <p className="mt-1 text-pretty text-muted-foreground text-sm">
                  Markdownと画像を含むフォルダをアップロードすると、画像付きのプレゼンテーションをそのまま表示できます。
                </p>
              </div>
            </div>
          </div>

          <div className="px-6">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-border border-dashed p-8 text-center"
              onClick={handleBoxClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="mb-2 rounded-full bg-muted p-3">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-pretty font-medium text-foreground text-sm">
                Markdownファイルまたはフォルダをドラッグ&ドロップしてアップロード
              </p>
              <p className="mt-1 text-pretty text-muted-foreground text-sm">
                または{' '}
                <label
                  className="cursor-pointer font-medium text-primary hover:text-primary/90"
                  htmlFor="fileUpload"
                  onClick={(e) => e.stopPropagation()}
                >
                  クリックしてファイルまたはフォルダを選択
                </label>{' '}
              </p>
              <input
                {...folderUploadProps}
                className="hidden"
                id="fileUpload"
                multiple
                onChange={(e) => void handleFileSelect(e.target.files)}
                ref={fileInputRef}
                type="file"
              />
            </div>
          </div>

          <div
            className={cn(
              'space-y-3 px-6 pb-5',
              uploadedBundles.length > 0 ? 'mt-4' : ''
            )}
          >
            {uploadedBundles.map((bundle, index) => {
              const totalSize = bundle.files.reduce((sum, file) => sum + file.size, 0);
              return (
                <div
                  className="flex flex-col rounded-lg border border-border p-2"
                  key={bundle.id + index}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 pr-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="max-w-62.5 truncate text-foreground text-sm">
                            {bundle.label}
                          </span>
                          <span className="whitespace-nowrap text-muted-foreground text-sm">
                            {bundle.files.length} files · {Math.round(totalSize / 1024)} KB
                          </span>
                        </div>
                        <Button
                          className="bg-transparent! hover:text-red-500"
                          onClick={() => removeBundle(bundle.id)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${fileProgresses[bundle.id] || 0}%`,
                            }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-muted-foreground text-xs">
                          {Math.round(fileProgresses[bundle.id] || 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {uploadedBundles.length > 0 ? (
            <div className="mx-6 mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-inner">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-100 text-sm">
                    プレゼンテーションプレビュー
                  </p>
                  <p className="text-zinc-500 text-xs">
                    フォルダ内の画像も相対パスで読み込み、黒基調の端末風表示に反映します。
                  </p>
                </div>
                {activeSourcePath ? (
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400">
                    {getDisplayLabel(activeSourcePath)}
                  </span>
                ) : null}
              </div>

              {isPreviewLoading ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
                  Markdownを読み込んでいます...
                </div>
              ) : previewError ? (
                <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-6 text-sm text-amber-200">
                  {previewError}
                </div>
              ) : previewContent ? (
                <PresentationViewer
                  assetUrlMap={assetUrlMap}
                  content={previewContent}
                  sourcePath={activeSourcePath}
                />
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
                  ここにプレゼンテーションが表示されます。
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-end rounded-b-lg border-border border-t bg-muted px-6 py-3">
            <div className="flex gap-2">
              <button
                className="h-9 rounded-lg border border-transparent bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
                disabled={!uploadedBundles.length}
                onClick={handlePreviewButtonClick}
                type="button"
              >
                {isPreviewLoading ? '読み込み中…' : 'プレゼンテーションを表示'}
              </button>
              <Link className="flex h-9 items-center rounded-lg border border-zinc-700 bg-background px-4 text-sm font-medium text-foreground" href="/preview">
                別ページで確認
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
