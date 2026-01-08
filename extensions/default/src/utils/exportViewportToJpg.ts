import html2canvas from 'html2canvas';

// ============================================================================
// Types
// ============================================================================

export interface ImagePayload {
  arrayBuffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

export type ImageFormat = 'image/png' | 'image/jpeg';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Finds the viewport DOM element by its ID.
 */
const findViewportElement = (viewportId: string): HTMLElement => {
  if (!viewportId) {
    throw new Error('Viewport ID is required');
  }

  const viewportElement = document.querySelector(
    `div[data-viewport-uid="${viewportId}"]`
  ) as HTMLElement;

  if (!viewportElement) {
    throw new Error(`Viewport element not found for ID: ${viewportId}`);
  }

  return viewportElement;
};

/**
 * Captures the viewport element as a canvas using html2canvas.
 */
const captureViewportAsCanvas = async (viewportElement: HTMLElement): Promise<HTMLCanvasElement> => {
  return html2canvas(viewportElement, {
    backgroundColor: '#000000',
    logging: false,
    scale: 1,
  });
};

/**
 * Converts a canvas to a Blob with the specified format and quality.
 */
const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: ImageFormat,
  quality: number = 0.9
): Promise<Blob> => {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      mimeType,
      quality
    );
  });
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Exports a viewport as a JPG file (legacy function for backwards compatibility).
 *
 * @param viewportId - The ID of the viewport to export
 * @returns Promise<File> - The exported JPG file
 */
export async function exportViewportToJpg(viewportId: string): Promise<File> {
  const viewportElement = findViewportElement(viewportId);
  const canvas = await captureViewportAsCanvas(viewportElement);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);

  const timestamp = Date.now();
  const filename = `viewport-${viewportId}-${timestamp}.jpg`;
  const file = new File([blob], filename, { type: 'image/jpeg' });

  return file;
}

/**
 * Exports a viewport as an ImagePayload suitable for postMessage transfer.
 * Returns an ArrayBuffer that can be sent as a transferable object.
 *
 * @param viewportId - The ID of the viewport to export
 * @param format - Image format: 'image/png' or 'image/jpeg' (default: 'image/png')
 * @param quality - JPEG quality 0-1 (default: 0.9, only applies to JPEG)
 * @returns Promise<ImagePayload> - The image data ready for postMessage
 */
export async function exportViewportToImagePayload(
  viewportId: string,
  format: ImageFormat = 'image/png',
  quality: number = 0.9
): Promise<ImagePayload> {
  const viewportElement = findViewportElement(viewportId);
  const canvas = await captureViewportAsCanvas(viewportElement);
  const blob = await canvasToBlob(canvas, format, quality);

  // Convert blob to ArrayBuffer for postMessage transfer
  const arrayBuffer = await blob.arrayBuffer();

  // Generate filename with appropriate extension
  const timestamp = Date.now();
  const extension = format === 'image/png' ? 'png' : 'jpg';
  const fileName = `viewport_${timestamp}.${extension}`;

  return {
    arrayBuffer,
    fileName,
    mimeType: format,
  };
}
