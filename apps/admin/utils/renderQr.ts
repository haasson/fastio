import QRCode from 'qrcode'

export const renderQrToDataUrl = async (url: string, size: number): Promise<string> => QRCode.toDataURL(url, { width: size, margin: 1 })
