import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeStatic from 'ffprobe-static'

// Configure ffmpeg to use the statically linked binaries
ffmpeg.setFfmpegPath(ffmpegInstaller.path)
ffmpeg.setFfprobePath(ffprobeStatic.path)

export interface TranscodeResult {
  buffer: Buffer
  transcoded: boolean
  originalCodec?: string
}

export const ensureH264Mp4 = async (
  videoBuffer: Buffer,
): Promise<TranscodeResult> => {
  const tmpDir = os.tmpdir()
  const inputId = randomUUID()
  const inputPath = path.join(tmpDir, `${inputId}_input.mp4`)
  const outputPath = path.join(tmpDir, `${inputId}_output.mp4`)

  try {
    // Write buffer to temp file
    await fs.promises.writeFile(inputPath, videoBuffer)

    // Probe the file to check its video codec
    const probeData = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })

    const videoStream = probeData.streams.find(s => s.codec_type === 'video')
    const codec = videoStream?.codec_name?.toLowerCase()

    // If it's already h264, no need to transcode
    if (codec === 'h264' || codec === 'avc1') {
      return {
        buffer: videoBuffer,
        transcoded: false,
        originalCodec: codec,
      }
    }

    // Otherwise, we must transcode to h264
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        // Try to copy the audio to save processing time
        .audioCodec('copy')
        // Output format
        .format('mp4')
        // Useful faststart flag for web streaming
        .outputOptions(['-movflags faststart'])
        .on('end', () => resolve())
        .on('error', (err, stdout, stderr) => {
          console.error('[transcode] FFmpeg error stdout:', stdout)
          console.error('[transcode] FFmpeg error stderr:', stderr)
          reject(err)
        })
        .save(outputPath)
    })

    const transcodedBuffer = await fs.promises.readFile(outputPath)

    return {
      buffer: transcodedBuffer,
      transcoded: true,
      originalCodec: codec,
    }
  } catch (error) {
    console.error('[transcode] Failed to process video:', error)
    // In case of any transcode error, fall back to the original buffer
    return {
      buffer: videoBuffer,
      transcoded: false,
      originalCodec: 'unknown-error',
    }
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath)
      if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath)
    } catch (cleanupError) {
      console.error('[transcode] Failed to clean up temp files:', cleanupError)
    }
  }
}
