import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { ConsolaInstance } from 'consola'

// 设置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

export const transcodeMovToMp4 = async (
  inputBuffer: Buffer,
  logger: ConsolaInstance,
): Promise<Buffer> => {
  // 创建临时工作目录
  const tempDir = await mkdtemp(path.join(tmpdir(), 'pinpoint-transcode-'))
  const inputPath = path.join(tempDir, 'input.mov')
  const outputPath = path.join(tempDir, 'output.mp4')

  try {
    await writeFile(inputPath, inputBuffer)

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-preset ultrafast',     // 牺牲少量压缩率换取极速转码
          '-crf 23',               // 保持较好画质
          '-pix_fmt yuv420p',      // 保证网页端极速渲染的硬兼容，杜绝黑屏透明色
          '-movflags +faststart',  // 将 moov atom 移动到文件头部，便于流媒体播放
          '-c:a aac',              // 音频转为 AAC
          '-b:a 128k',             // 压缩独立处理音轨
        ])
        .save(outputPath)
        .on('end', () => {
          logger.success('LivePhoto transcoding to MP4 finished successfully')
          resolve()
        })
        .on('error', (err) => {
          logger.error('Error during ffmpeg transcoding:', err)
          reject(err)
        })
    })

    const mp4Buffer = await readFile(outputPath)
    return mp4Buffer
  } finally {
    // 强制清理产生的临时垃圾文件，确保硬盘零泄露
    await rm(tempDir, { recursive: true, force: true }).catch((err) => {
      logger.warn('Failed to cleanup transcode temp directory:', err)
    })
  }
}
