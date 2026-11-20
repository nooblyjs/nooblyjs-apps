/**
 * @fileoverview Step: retrieve Target Process Requests and cache them.
 * @author NooblyJS Team
 * @version 1.0.0
 */

'use strict';

const { productSettings } = require('../utilities/settings.cjs');
const RequestsService = require('../services/requestsService.cjs');

/**
 * @param {object} [data] - Workflow context (unused).
 * @returns {Promise<object>}
 */
async function run(data = {}) {
    const service = new RequestsService(productSettings());
    const requests = await service.retrieve();
    return {
        response: { count: requests.length },
        receivedData: data,
        processedAt: new Date().toISOString(),
    };
}

module.exports = { run };
