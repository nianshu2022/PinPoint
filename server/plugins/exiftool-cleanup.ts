import { exiftool } from 'exiftool-vendored'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    try {
      console.log('Shutting down exiftool globally...')
      await exiftool.end()
      console.log('exiftool shut down successfully.')
    } catch (e) {
      console.error('Failed to end exiftool', e)
    }
  })
})
