import { useState, useEffect, useRef, useCallback } from 'react';
import { createSignedUrl } from '../../lib/auth';

// ============================================================
// SignedImage — renders images from private Supabase storage
// buckets using signed URLs with lazy regeneration on expiry.
// ============================================================

/** Default signed URL lifetime in seconds (1 hour). */
const DEFAULT_EXPIRES_IN = 3600;

/** How many seconds before expiry to proactively refresh (5 min). */
const REFRESH_BUFFER = 300;

interface SignedImageProps {
  /** Storage bucket name (e.g. 'vehicle-photos', 'defect-photos'). */
  bucket: string;
  /** Storage path within the bucket (e.g. '{orgId}/{submissionId}/front.jpg'). */
  path: string;
  /** Alt text for the image. */
  alt: string;
  /** Optional CSS class name. */
  className?: string;
  /** Image loading strategy. */
  loading?: 'lazy' | 'eager';
  /** Signed URL lifetime in seconds. Default: 3600 (1 hour). */
  expiresIn?: number;
  /** Optional click handler (e.g. to open lightbox). */
  onClick?: () => void;
  /** Optional ARIA role. */
  role?: string;
  /** Optional tabIndex for keyboard navigation. */
  tabIndex?: number;
  /** Optional keyboard handler. */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function SignedImage({
  bucket,
  path,
  alt,
  className,
  loading = 'lazy',
  expiresIn = DEFAULT_EXPIRES_IN,
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: SignedImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSignedUrl = useCallback(async () => {
    setError(false);
    const url = await createSignedUrl(bucket, path, expiresIn);
    if (url) {
      setSignedUrl(url);

      // Schedule proactive refresh before URL expires
      const refreshIn = Math.max((expiresIn - REFRESH_BUFFER) * 1000, 30000);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        fetchSignedUrl();
      }, refreshIn);
    } else {
      setError(true);
    }
  }, [bucket, path, expiresIn]);

  useEffect(() => {
    fetchSignedUrl();
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [fetchSignedUrl]);

  // If the signed URL returns a 403/expired error, try to regenerate once
  const handleImageError = () => {
    if (!error) {
      setError(true);
      fetchSignedUrl();
    }
  };

  if (error && !signedUrl) {
    return (
      <div className={`signed-image-error ${className ?? ''}`}>
        <span>Image unavailable</span>
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className={`signed-image-loading ${className ?? ''}`}>
        <div className="loading-spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleImageError}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    />
  );
}
