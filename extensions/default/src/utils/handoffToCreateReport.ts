/**
 * Handoff utility for CreateReport integration
 * Handles postMessage communication between OHIF Viewer and CreateReport
 */

export interface HandoffResult {
  success: boolean;
  report?: string;
  error?: string;
}

interface CreateReportResponse {
  success: boolean;
  report?: string;
  conversations?: Array<{
    step: string;
    prompt: string;
    response: string;
  }>;
  error?: string;
}

/**
 * Waits for the CR_READY message from CreateReport
 * @param baseUrl - CreateReport base URL (used for origin validation)
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise that resolves when CR_READY is received
 */
const waitForReady = (baseUrl: string, timeoutMs: number = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const origin = new URL(baseUrl).origin;

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('CreateReport Handoff Timeout - CR_READY not received'));
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      // Validate origin
      if (event.origin !== origin) {
        return;
      }

      if (event.data?.type === 'CR_READY') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    window.addEventListener('message', handler);
  });
};

/**
 * Uploads images to CreateReport API and retrieves the generated report
 * @param files - Array of image files to upload
 * @param baseUrl - CreateReport base URL
 * @param selectedLanguage - Language code (e.g., 'en', 'de')
 * @param apiKey - API key for authentication
 * @returns Promise with the API response
 */
const uploadAndGenerateReport = async (
  files: File[],
  baseUrl: string,
  selectedLanguage: string,
  apiKey: string
): Promise<CreateReportResponse> => {
  const formData = new FormData();

  files.forEach(file => {
    formData.append('images[]', file);
  });

  if (selectedLanguage) {
    formData.append('selectedLanguage', selectedLanguage);
  }

  const headers: HeadersInit = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout (AI report generation takes time)

  try {
    const response = await fetch(`${baseUrl}/api/generate-report`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timed out after 5 minutes');
    }

    throw error;
  }
};

/**
 * Sends the generated report to the CreateReport tab via postMessage
 * @param targetWindow - The CreateReport window/tab
 * @param baseUrl - CreateReport base URL (used for targetOrigin)
 * @param report - The generated report text
 * @param conversations - Optional conversation history
 * @param selectedLanguage - Optional language code
 */
const sendReportToCreateReport = (
  targetWindow: Window,
  baseUrl: string,
  report: string,
  conversations?: CreateReportResponse['conversations'],
  selectedLanguage?: string
): void => {
  const origin = new URL(baseUrl).origin;

  targetWindow.postMessage(
    {
      type: 'CR_HANDOFF_REPORT',
      report,
      conversations,
      selectedLanguage,
    },
    origin
  );
};

/**
 * Performs the complete handoff flow to CreateReport
 *
 * This function:
 * 1. Uploads images to CreateReport API
 * 2. Waits for CR_READY message (with timeout fallback)
 * 3. Sends the report to CreateReport via postMessage
 *
 * @param imageFiles - Array of image files (viewport exports)
 * @param baseUrl - CreateReport base URL
 * @param selectedLanguage - Language code (e.g., 'en', 'de')
 * @param apiKey - API key for authentication
 * @param targetWindow - The opened CreateReport window/tab
 * @returns Promise with the handoff result
 */
export async function handoffToCreateReport(
  imageFiles: File[],
  baseUrl: string,
  selectedLanguage: string,
  apiKey: string,
  targetWindow: Window
): Promise<HandoffResult> {
  if (!imageFiles || imageFiles.length === 0) {
    return { success: false, error: 'No images provided' };
  }

  if (!baseUrl) {
    return { success: false, error: 'CreateReport base URL is not configured' };
  }

  if (!targetWindow || targetWindow.closed) {
    return { success: false, error: 'CreateReport window is not available' };
  }

  try {
    // Start waiting for CR_READY (don't await yet)
    const readyPromise = waitForReady(baseUrl, 10000).catch(e => {
      console.warn('CR_READY timeout, will send report anyway:', e.message);
    });

    // Upload images and get the report
    console.log('Handoff: Uploading images to CreateReport API...');
    const apiResponse = await uploadAndGenerateReport(
      imageFiles,
      baseUrl,
      selectedLanguage,
      apiKey
    );

    if (!apiResponse.success) {
      return {
        success: false,
        error: apiResponse.error || 'API returned unsuccessful response',
      };
    }

    if (!apiResponse.report) {
      return {
        success: false,
        error: 'API did not return a report',
      };
    }

    // Wait for CR_READY (or timeout)
    console.log('Handoff: Waiting for CreateReport to be ready...');
    await readyPromise;

    // Small delay to ensure the page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send the report to CreateReport
    console.log('Handoff: Sending report to CreateReport...');
    sendReportToCreateReport(
      targetWindow,
      baseUrl,
      apiResponse.report,
      apiResponse.conversations,
      selectedLanguage
    );

    return {
      success: true,
      report: apiResponse.report,
    };
  } catch (error) {
    console.error('Handoff error:', error);
    return {
      success: false,
      error: (error as Error).message || 'Unknown error during handoff',
    };
  }
}

export default handoffToCreateReport;
