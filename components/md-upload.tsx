'use client';

import { Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function FileUpload01() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileProgresses, setFileProgresses] = useState<Record<string, number>>(
    {}
  );

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // Simulate upload progress for each file
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
  };

  return (
    <div className="flex items-center justify-center p-10">
      <Card className="mx-auto w-full max-w-lg rounded-lg bg-background p-0 shadow-md">
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
              const imageUrl = URL.createObjectURL(file);

              return (
                <div
                  className="flex flex-col rounded-lg border border-border p-2"
                  key={file.name + index}
                  onLoad={() => {
                    return () => URL.revokeObjectURL(imageUrl);
                  }}
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

          <div className="flex items-center justify-end rounded-b-lg border-border border-t bg-muted px-6 py-3">
            <div className="flex gap-2">
              <Button className="h-9 px-4 font-medium text-sm">プレゼンテーションを表示</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
