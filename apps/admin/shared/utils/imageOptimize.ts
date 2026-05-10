const MAX_SIDE = 1200
const WEBP_QUALITY = 0.85

export const optimizeImage = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
  const img = new Image()
  const url = URL.createObjectURL(file)

  img.onload = () => {
    URL.revokeObjectURL(url)

    let { width, height } = img

    if (width > MAX_SIDE) {
      height = Math.round((height * MAX_SIDE) / width)
      width = MAX_SIDE
    }
    if (height > MAX_SIDE) {
      width = Math.round((width * MAX_SIDE) / height)
      height = MAX_SIDE
    }

    const canvas = document.createElement('canvas')

    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/webp',
      WEBP_QUALITY,
    )
  }

  img.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('Image load failed'))
  }
  img.src = url
})
