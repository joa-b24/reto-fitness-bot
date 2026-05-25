const CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD
const PRESET = import.meta.env.VITE_CLOUDINARY_PRESET

export const cloudinaryReady = Boolean(CLOUD && PRESET &&
  CLOUD !== 'TU_CLOUD_NAME')

/**
 * Upload a File to Cloudinary using an unsigned upload preset.
 * Returns the secure_url of the uploaded image.
 */
export async function uploadToCloudinary(file, folder = 'fitquest') {
  if (!cloudinaryReady) {
    throw new Error('Configura VITE_CLOUDINARY_CLOUD y VITE_CLOUDINARY_PRESET en frontend/.env.local')
  }
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', PRESET)
  fd.append('folder', folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,
    { method: 'POST', body: fd }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Cloudinary error ${res.status}`)
  }
  const data = await res.json()
  return data.secure_url
}
