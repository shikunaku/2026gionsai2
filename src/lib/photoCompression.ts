const MAX_PHOTO_DIMENSION = 800;
const JPEG_QUALITY = 0.7;

/** カメラ画像を長辺800pxのJPEG Blobへ圧縮する。Base64は生成しない。 */
export async function compressPhotoToJpeg(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('画像を読み込めませんでした'));
      element.src = objectUrl;
    });

    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画像処理を開始できませんでした');
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('JPEG変換に失敗しました'))),
        'image/jpeg',
        JPEG_QUALITY
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
