/**
 * Utility to upload an image to Cloudinary using an unsigned upload preset.
 * Uses the client-side Cloudinary Upload API.
 */
export async function uploadImage(file: File): Promise<string> {
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) {
    throw new Error("Cloudinary configuration error: VITE_CLOUDINARY_CLOUD_NAME environment variable is not defined.");
  }
  if (!uploadPreset) {
    throw new Error("Cloudinary configuration error: VITE_CLOUDINARY_UPLOAD_PRESET environment variable is not defined.");
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText || "Unknown upload error";
      throw new Error(`Cloudinary upload failed: ${errorMessage} (Status: ${response.status})`);
    }

    const data = await response.json();
    if (data && data.secure_url) {
      return data.secure_url;
    } else {
      throw new Error("Cloudinary upload response was missing secure_url.");
    }
  } catch (err: any) {
    console.error("Cloudinary upload request failed:", err);
    throw new Error(err.message || "Network error occurred during image upload.");
  }
}
