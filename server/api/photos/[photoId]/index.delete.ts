export default eventHandler(async (event) => {
  await requireUserSession(event)
  const photoId = getRouterParam(event, 'photoId')

  if (!photoId) {
    return createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
    })
  }

  const photo = await useDB()
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  if (!photo) {
    return createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  logger.image.info(`Deleting photo ${photo.title || photo.id || photoId}`)

  if (photo.storageKey) {
    logger.image.info(`Queueing storage cleanup for photo ${photoId}`)
    
    // Dispatch asynchronous cleanup job to guarantee deletion success even if network fails
    useDB().insert(tables.pipelineQueue).values({
      payload: {
        type: 'cleanup-storage',
        storageKey: photo.storageKey,
        thumbnailKey: photo.thumbnailKey,
        livePhotoVideoKey: photo.livePhotoVideoKey,
      },
      status: 'pending',
    }).run()
  }

  useDB().delete(tables.photos).where(eq(tables.photos.id, photoId)).run()

  logger.image.success(`Photo ${photoId} deleted`)

  return {
    statusCode: 200,
    statusMessage: 'Photo deleted successfully',
  }
})
