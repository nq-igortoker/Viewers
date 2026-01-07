import html2canvas from 'html2canvas';

/**
 * Exports a viewport as a JPG file
 * @param viewportId - The ID of the viewport to export
 * @returns Promise<File> - The exported JPG file
 */
export async function exportViewportToJpg(viewportId: string): Promise<File> {
  if (!viewportId) {
    throw new Error('Viewport ID is required');
  }

  // Find the viewport DOM element
  const viewportElement = document.querySelector(
    `div[data-viewport-uid="${viewportId}"]`
  ) as HTMLElement;

  if (!viewportElement) {
    throw new Error(`Viewport element not found for ID: ${viewportId}`);
  }

  // Capture the viewport as a canvas using html2canvas
  const canvas = await html2canvas(viewportElement, {
    backgroundColor: '#000000',
    logging: false,
    scale: 1,
  });

  // Convert canvas to blob with JPG format (quality 0.9)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/jpeg',
      0.9
    );
  });

  // Create a File object from the blob
  const timestamp = Date.now();
  const filename = `viewport-${viewportId}-${timestamp}.jpg`;
  const file = new File([blob], filename, { type: 'image/jpeg' });

  return file;
}
