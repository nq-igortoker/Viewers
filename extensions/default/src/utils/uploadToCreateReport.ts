/**
 * Uploads viewport images to CreateReport API
 * @param files - Array of image files to upload
 * @param baseUrl - CreateReport base URL
 * @param selectedLanguage - Optional language code (e.g., 'en', 'de')
 * @returns Promise<Response> - The fetch response
 */
export async function uploadToCreateReport(
  files: File[],
  baseUrl: string,
  selectedLanguage?: string
): Promise<Response> {
  if (!files || files.length === 0) {
    throw new Error('At least one file is required');
  }

  if (!baseUrl) {
    throw new Error('CreateReport base URL is not configured');
  }

  // Build FormData
  const formData = new FormData();

  // Add each file to the FormData
  files.forEach(file => {
    formData.append('images[]', file);
  });

  // Add optional language parameter
  if (selectedLanguage) {
    formData.append('selectedLanguage', selectedLanguage);
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(`${baseUrl}/api/generate-report`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Upload timed out after 60 seconds');
    }

    throw error;
  }
}
