'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';

interface FilePreview {
  file: File;
  url: string;
  type: 'pdf' | 'image';
}

interface MultiFileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  isUploading: boolean;
  error: string;
  onError: (error: string) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

export default function MultiFileUpload({
  files,
  onFilesChange,
  isUploading,
  error,
  onError,
  maxSizeMB = 10,
  acceptedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
}: MultiFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return 'Please upload PDF, PNG, or JPEG files only';
    }
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File "${file.name}" exceeds ${maxSizeMB}MB limit`;
    }
    return null;
  };

  const createPreview = (file: File): FilePreview => {
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('image/') ? 'image' : 'pdf';
    return { file, url, type };
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || isUploading) return;

    onError('');
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(newFiles).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      onError(errors[0]);
      return;
    }

    const updatedFiles = [...files, ...validFiles];
    const newPreviews = validFiles.map(createPreview);

    onFilesChange(updatedFiles);
    setPreviews([...previews, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    if (isUploading) return;

    // Revoke object URL to free memory
    if (previews[index]) {
      URL.revokeObjectURL(previews[index].url);
    }

    const updatedFiles = files.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);

    onFilesChange(updatedFiles);
    setPreviews(updatedPreviews);
    onError('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleUploadClick = () => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Clean up object URLs on unmount
  React.useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, []);

  return (
    <div className="multi-file-upload-container">
      <div
        className={`upload-box ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleUploadClick}
        style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          multiple
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="upload-content">
            <div className="upload-icon analyzing">⏳</div>
            <p className="upload-text">Analyzing your lab results...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="upload-content">
            <div className="upload-icon success">✓</div>
            <p className="upload-text">
              <strong>{files.length}</strong> file{files.length > 1 ? 's' : ''} uploaded
            </p>
            <p className="upload-subtext">Click or drag to add more</p>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📄</div>
            <p className="upload-text">Click to upload or drag and drop</p>
            <p className="upload-subtext">PDF, PNG, or JPEG (max {maxSizeMB}MB each)</p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message" style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c33',
          fontSize: 'clamp(13px, 3.5vw, 15px)',
        }}>
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="file-preview-grid">
          {previews.map((preview, index) => (
            <div key={index} className="file-preview-item">
              <div className="file-preview-content">
                {preview.type === 'image' ? (
                  <div className="file-preview-image">
                    <Image
                      src={preview.url}
                      alt={preview.file.name}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div className="file-preview-pdf">
                    <div className="pdf-icon">📄</div>
                    <span className="pdf-label">PDF</span>
                  </div>
                )}
              </div>

              <div className="file-preview-info">
                <p className="file-name" title={preview.file.name}>
                  {preview.file.name.length > 20
                    ? `${preview.file.name.substring(0, 17)}...`
                    : preview.file.name}
                </p>
                <p className="file-size">
                  {(preview.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {!isUploading && (
                <button
                  className="file-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  aria-label="Remove file"
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
