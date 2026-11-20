'use strict';

const fs = require('fs');
const path = require('path');
const { API_BASE_PATH } = require('./shared/helpers');

/**
 * Serves the docs listed in docs/published.json for the landing page.
 *
 * @param {Object} app Express app
 * @param {Object} ctx Shared context: log, docsDir
 */
module.exports = (app, ctx) => {
  const { log, docsDir } = ctx;

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

  // List the docs named in docs/published.json
  app.get(`${API_BASE_PATH}/documentation/list`, (req, res) => {
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
  app.get(`${API_BASE_PATH}/documentation/:docId`, (req, res) => {
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
};
