// 压缩上传的图片；画到canvas上，最长边缩到900px，再转成JPEG的base64；
// localStorage总共才5MB左右，不压缩存不了几张
export function readImageFile(file, max = 900) {
  return new Promise((resolve, reject) => {
    // 先给文件一个临时地址，用完马上释放
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height)) // 只缩不放
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      // 先铺白底；不然透明PNG转JPEG会变黑
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read ${file.name}`))
    }
    img.src = url
  })
}

// 拖进来的是不是电脑里的文件；拖桌面图标不算
export function hasFiles(e) {
  if (!e.dataTransfer) return false
  return Array.from(e.dataTransfer.types).includes('Files')
}
