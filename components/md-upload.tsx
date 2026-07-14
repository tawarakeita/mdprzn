'use client';

import { Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function PresentationViewer({ content }: { content: string }) {
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();

  if (!normalizedContent) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-sm text-zinc-400">
        まだ表示するMarkdownがありません。ファイルをアップロードしてください。
      </div>
    );
  }

  const frontmatterMatch = normalizedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const hasMarpFrontmatter = Boolean(frontmatterMatch?.[1]?.includes('marp: true'));
  const body = frontmatterMatch
    ? normalizedContent.replace(frontmatterMatch[0], '').trim()
    : normalizedContent;
  const slides = body
    .split(/\n---\s*\n?/g)
    .map((slide) => slide.trim())
    .filter(Boolean);
  const displaySlides = slides.length > 0 ? slides : [body];
  const isFallbackMode = !hasMarpFrontmatter && displaySlides.length <= 1;

  return (
    <div className="space-y-4">
      {displaySlides.map((slide, index) => (
        <div
          className="rounded-2xl border border-zinc-800 bg-black p-6 text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
          key={`${slide.slice(0, 20)}-${index}`}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Slide {index + 1}
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-zinc-400">
              {isFallbackMode ? 'Fallback view' : 'Marp-style preview'}
            </span>
          </div>

          <div className="space-y-4 text-sm leading-7 text-zinc-100 [&_a]:text-cyan-300 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-800 [&_th]:bg-zinc-900 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FileUpload01() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRequestRef = useRef(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileProgresses, setFileProgresses] = useState<Record<string, number>>(
    {}
  );
  const [previewContent, setPreviewContent] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const loadPreviewForFile = async (file: File) => {
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
      setActiveFileName(file.name);
    } catch {
      if (requestId !== previewRequestRef.current) {
        return;
      }
      setPreviewContent('');
      setPreviewError('このファイルの内容を読み込めませんでした。');
      setActiveFileName(file.name);
    } finally {
      if (requestId === previewRequestRef.current) {
        setIsPreviewLoading(false);
      }
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setFileProgresses((prev) => ({
          ...prev,
          [file.name]: Math.min(progress, 100),
        }));
      }, 300);
    });

    const latestFile = newFiles[newFiles.length - 1];
    if (latestFile) {
      void loadPreviewForFile(latestFile);
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
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (filename: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.name !== filename));
    setFileProgresses((prev) => {
      const newProgresses = { ...prev };
      delete newProgresses[filename];
      return newProgresses;
    });

    if (activeFileName === filename) {
      setPreviewContent('');
      setPreviewError(null);
      setActiveFileName(null);
      setIsPreviewLoading(false);
    }
  };

  const showSelectedPresentation = () => {
    const targetFile =
      uploadedFiles.find((file) => file.name === activeFileName) ??
      uploadedFiles[uploadedFiles.length - 1];

    if (targetFile) {
      void loadPreviewForFile(targetFile);
    }
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
                  Marpに対応したMarkdownファイル(.md)をアップロードして、プレゼンテーションを表示します。
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
                Markdownファイルをドラッグ&ドロップしてアップロード
              </p>
              <p className="mt-1 text-pretty text-muted-foreground text-sm">
                または{' '}
                <label
                  className="cursor-pointer font-medium text-primary hover:text-primary/90"
                  htmlFor="fileUpload"
                  onClick={(e) => e.stopPropagation()}
                >
                  クリックしてファイルを選択
                </label>{' '}
              </p>
              <input
                accept=".md"
                className="hidden"
                id="fileUpload"
                onChange={(e) => handleFileSelect(e.target.files)}
                ref={fileInputRef}
                type="file"
              />
            </div>
          </div>

          <div
            className={cn(
              'space-y-3 px-6 pb-5',
              uploadedFiles.length > 0 ? 'mt-4' : ''
            )}
          >
            {uploadedFiles.map((file, index) => {
              return (
                <div
                  className="flex flex-col rounded-lg border border-border p-2"
                  key={file.name + index}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 pr-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="max-w-62.5 truncate text-foreground text-sm">
                            {file.name}
                          </span>
                          <span className="whitespace-nowrap text-muted-foreground text-sm">
                            {Math.round(file.size / 1024)} KB
                          </span>
                        </div>
                        <Button
                          className="bg-transparent! hover:text-red-500"
                          onClick={() => removeFile(file.name)}
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
                              width: `${fileProgresses[file.name] || 0}%`,
                            }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-muted-foreground text-xs">
                          {Math.round(fileProgresses[file.name] || 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {uploadedFiles.length > 0 ? (
            <div className="mx-6 mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-inner">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-100 text-sm">
                    プレゼンテーションプレビュー
                  </p>
                  <p className="text-zinc-500 text-xs">
                    黒基調の端末風表示で、見出し・表・画像をそのまま表示します。
                  </p>
                </div>
                {activeFileName ? (
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400">
                    {activeFileName}
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
                <PresentationViewer content={previewContent} />
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
                  ここにプレゼンテーションが表示されます。
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-end rounded-b-lg border-border border-t bg-muted px-6 py-3">
            <div className="flex gap-2">
              <Button
                className="h-9 px-4 font-medium text-sm"
                disabled={!uploadedFiles.length || isPreviewLoading}
                onClick={showSelectedPresentation}
              >
                {isPreviewLoading ? '読み込み中…' : 'プレゼンテーションを表示'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
