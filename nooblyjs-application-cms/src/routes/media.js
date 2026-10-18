'use strict';

const multer = require('multer');
const {
  API_BASE_PATH,
  MEDIA_BASE_PATH,
  CONTAINERS,
  MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  route,
  badRequest,
  notFound
} = require('./shared/helpers');

/**
 * Works out the real file type from its first bytes, so a renamed file can't pass as an image.
 * @param {Buffer} buffer
 * @return {?string} MIME type, or null when it is not an allowed type
 */
function sniffMimeType(buffer) {
  const starts = (...bytes) => bytes.every((b, i) => buffer[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (buffer.slice(0, 4).toString('latin1') === 'GIF8') return 'image/gif';
  if (buffer.slice(0, 4).toString('latin1') === 'RIFF' && buffer.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buffer.slice(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

const mediaUrl = (media) => `${MEDIA_BASE_PATH}/${media.id}`;

/**
 * Registers the media library routes and the public media file route.
 *
 * @param {Object} app Express app
 * @param {Object} ctx Shared context: store, log, requireUser, filing
 */
module.exports = (app, ctx) => {
  const { store, log, requireUser, filing } = ctx;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MEDIA_BYTES, files: 1 }
  }).single('file');

  // Run multer and turn its errors into our JSON errors.
  const receiveFile = (req, res) => new Promise((resolve, reject) => {
    upload(req, res, (error) => {
      if (!error) return resolve(req.file);
      if (error.code === 'LIMIT_FILE_SIZE') return reject(badRequest('Files must be 10 MB or smaller.'));
      return reject(badRequest(`Upload failed: ${error.message}`));
    });
  });

  ctx.deleteMediaFile = async (media) => {
    try {
      await filing.delete(media.filename);
    } catch (error) {
      log.warn(`CMS media file already missing: ${media.filename}`);
    }
  };

  app.get(`${API_BASE_PATH}/sites/:siteId/media`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const media = await store.list(CONTAINERS.MEDIA, (m) => m.siteId === site.id && m.filename);
    media.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    res.json({ media: media.map((m) => ({ ...m, url: mediaUrl(m) })) });
  }));

  app.post(`${API_BASE_PATH}/sites/:siteId/media`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const file = await receiveFile(req, res);
    if (!file) throw badRequest('Choose a file to upload.');

    const mimeType = sniffMimeType(file.buffer);
    if (!mimeType || !MEDIA_TYPES[mimeType]) {
      throw badRequest('Only PNG, JPEG, GIF, WebP and PDF files can be uploaded.');
    }

    const media = await store.insert(CONTAINERS.MEDIA, {
      siteId: site.id,
      filename: null,
      originalName: String(file.originalname || 'upload').slice(0, 200),
      mimeType,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.cmsUser.email
    });
    const filename = `${site.id}/${media.id}${MEDIA_TYPES[mimeType]}`;
    try {
      await filing.create(filename, file.buffer);
    } catch (error) {
      await store.remove(CONTAINERS.MEDIA, media.id);
      throw error;
    }
    media.filename = filename;
    await store.save(CONTAINERS.MEDIA, media);
    res.status(201).json({ media: { ...media, url: mediaUrl(media) } });
  }));

  app.delete(`${API_BASE_PATH}/sites/:siteId/media/:mediaId`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const media = await store.get(CONTAINERS.MEDIA, req.params.mediaId);
    if (!media || media.siteId !== site.id) throw notFound('Media not found.');

    await ctx.deleteMediaFile(media);
    await store.remove(CONTAINERS.MEDIA, media.id);
    if (site.settings.logoMediaId === media.id) {
      site.settings.logoMediaId = null;
      await store.save(CONTAINERS.SITES, site);
    }
    res.status(204).end();
  }));

  // Public: media IDs are random UUIDs, so files are reachable only by link.
  app.get(`${MEDIA_BASE_PATH}/:mediaId`, route(log, async (req, res) => {
    const media = await store.get(CONTAINERS.MEDIA, String(req.params.mediaId));
    if (!media || !media.filename || !MEDIA_TYPES[media.mimeType]) throw notFound('Media not found.');
    let content;
    try {
      content = await filing.read(media.filename);
    } catch (error) {
      throw notFound('Media not found.');
    }
    res.set({
      'Content-Type': media.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': `inline; filename="${media.originalName.replace(/[^\w.\- ]/g, '_')}"`
    });
    res.send(Buffer.isBuffer(content) ? content : Buffer.from(content));
  }));
};

module.exports.sniffMimeType = sniffMimeType;
module.exports.mediaUrl = mediaUrl;
