import { readFileSync, writeFileSync } from 'node:fs'
import { processMotionPhotoFromXmp } from './server/services/video/motion-photo'

const buf = readFileSync('D:/project/PinPoint/MVIMG_20260410_021859.jpg')
processMotionPhotoFromXmp({
  photoId: 'test1',
  storageKey: 'test.jpg',
  rawImageBuffer: buf,
  exifData: {},
  storageProvider: {
    create: async (key, buffer) => {
      writeFileSync(`D:/project/PinPoint/${key.split('/').pop()}`, buffer)
      return { key, size: buffer.length }
    },
    getPublicUrl: () => 'test_url'
  } as any,
  logger: console as any
}).then(res => console.log('Motion photo extract success:', res)).catch(console.error)
