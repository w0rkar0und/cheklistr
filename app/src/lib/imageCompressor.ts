/**
 * Client-side image compression using Canvas.
 * Converts any image (HEIC, WebP, PNG, etc.) to JPEG
 * and resizes to fit within maxDimension while maintaining aspect ratio.
 */

const MAX_DIMENSION = 1920; // Max width or height in pixels
const JPEG_QUALITY = 0.75; // 75% quality — good balance of size vs quality

/**
 * Compress an image File to a JPEG Blob.
 * Returns a new File object with content type image/jpeg.
 */
export async function compressImage(
  file: File,
  maxDimension: number = MAX_DIMENSION,
  quality: number = JPEG_QUALITY,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      // Draw to canvas and export as JPEG
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }

          // Create a new File from the blob
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' },
          );

          console.log(
            `Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${width}×${height})`,
          );

          resolve(compressedFile);
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If we can't load the image (e.g. unsupported format), return original
      console.warn('Could not load image for compression, using original');
      resolve(file);
    };

    img.src = objectUrl;
  });
}
