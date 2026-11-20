/**
 * Cloudinary Receipt Upload Service (React Native / Expo)
 * Uploads receipt images to Cloudinary via Unsigned Upload Preset.
 * Returns the secure HTTPS URL to be stored in the transaction record.
 */

export const CLOUDINARY_CONFIG = {
  cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dib2hgavs',
  uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'Speendwise',
  folder: 'spendwise/receipts'
};

/**
 * Configure Cloudinary runtime credentials if needed
 */
export const configureCloudinary = (cloudName, uploadPreset) => {
  if (cloudName) CLOUDINARY_CONFIG.cloudName = cloudName;
  if (uploadPreset) CLOUDINARY_CONFIG.uploadPreset = uploadPreset;
};

/**
 * Upload receipt image to Cloudinary from mobile
 * @param {string} fileUriOrBase64 - Image file URI or base64 data string
 * @returns {Promise<{ success: boolean, url?: string, publicId?: string, error?: string }>}
 */
export const uploadReceiptToCloudinary = async (fileUriOrBase64) => {
  if (!fileUriOrBase64) {
    return { success: false, error: 'No image provided for upload.' };
  }

  try {
    const formData = new FormData();

    if (fileUriOrBase64.startsWith('data:') || fileUriOrBase64.length > 500) {
      // Base64 data string
      const formatted = fileUriOrBase64.startsWith('data:') 
        ? fileUriOrBase64 
        : `data:image/jpeg;base64,${fileUriOrBase64}`;
      formData.append('file', formatted);
    } else {
      // Local file / content URI
      const filename = fileUriOrBase64.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: fileUriOrBase64,
        name: filename,
        type: type,
      });
    }

    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    if (CLOUDINARY_CONFIG.folder) {
      formData.append('folder', CLOUDINARY_CONFIG.folder);
    }
    formData.append('tags', 'spendwise,receipt');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    const data = await response.json();

    if (response.ok && data.secure_url) {
      console.log('[Cloudinary Mobile] Upload success:', data.secure_url);
      return {
        success: true,
        url: data.secure_url,
        publicId: data.public_id,
        format: data.format
      };
    } else {
      const errorMsg = data.error?.message || `Cloudinary upload failed (HTTP ${response.status})`;
      console.warn('[Cloudinary Mobile] Upload notice:', errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    console.warn('[Cloudinary Mobile] Upload exception:', err);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Upload timed out' : (err.message || 'Network error')
    };
  }
};

