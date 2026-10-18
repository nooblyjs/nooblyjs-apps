/**
 * @fileoverview CMS Application
 * Factory module for creating a CMS application instance.
 *
 * @author NooblyJS Team
 * @version 0.0.0
 * @since  0.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Creates the CMS service
 * Automatically configures routes and views for the cms service.
 * Integrates with noobly-core services for data persistence, file storage, caching, etc.
 * @param {Object} app - The Express application instance
 * @param {Object} server - The HTTP server instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @param {Object} serviceRegistry - NooblyJS Core service registry
 * @param {Object} options - Configuration options
 * @return {void}
 */
module.exports = (app, server, eventEmitter, serviceRegistry, options) => {

  // Launch the app service
  const appService = serviceRegistry.appservice();
  const log = serviceRegistry.logger('file');

  const docsDir = path.join(__dirname, 'docs');

  // Read a markdown doc and pull its title from the first heading
  const readDoc = (filename) => {
    const content = fs.readFileSync(path.join(docsDir, filename), 'utf-8');
    const headingMatch = content.match(/^#\s+(.+)$/m);
    return {
      id: filename.replace(/\.md$/, ''),
      title: headingMatch ? headingMatch[1] : filename.replace(/\.md$/, ''),
      content: content
    };
  };

  // Serve README.md from root directory
  app.get('/applications/cms/README.md', (req, res) => {
    res.sendFile(path.join(__dirname, 'README.md'));
  });

  // List the docs named in docs/published.json
  app.get('/applications/cms/api/documentation/list', (req, res) => {
    try {
      const published = JSON.parse(fs.readFileSync(path.join(docsDir, 'published.json'), 'utf-8'));
      const docs = published
        .map(entry => (typeof entry === 'string' ? { file: entry } : entry))
        .map(entry => ({ ...entry, file: path.basename(entry.file.endsWith('.md') ? entry.file : entry.file + '.md') }))
        .filter(entry => fs.existsSync(path.join(docsDir, entry.file)))
        .map(entry => {
          const doc = readDoc(entry.file);
          return { id: doc.id, title: doc.title, filename: entry.file, description: entry.description || '' };
        });
      res.json({ success: true, docs: docs });
    } catch (error) {
      log.error(`Error listing documentation: ${error.message}`);
      res.status(500).json({ success: false, docs: [] });
    }
  });

  // Return the markdown for a single doc. docId is a flat name, never a path.
  app.get('/applications/cms/api/documentation/:docId', (req, res) => {
    const filename = path.basename(String(req.params.docId)) + '.md';
    if (!fs.existsSync(path.join(docsDir, filename))) {
      return res.status(404).json({ success: false, error: 'Documentation not found' });
    }
    try {
      res.json({ success: true, ...readDoc(filename) });
    } catch (error) {
      log.error(`Error reading documentation: ${error.message}`);
      res.status(500).json({ success: false, error: 'Error reading documentation' });
    }
  });

}
