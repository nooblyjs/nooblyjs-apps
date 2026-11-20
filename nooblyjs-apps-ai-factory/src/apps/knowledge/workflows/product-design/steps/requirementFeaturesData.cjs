/**
 * @fileoverview Step: retrieve the Target Process Requirement → Feature mappings
 * (RequirementFeatures) and cache them.
 * @author NooblyJS Team
 * @version 1.0.0
 */

'use strict';

const { productSettings } = require('../utilities/settings.cjs');
const RequirementFeaturesService = require('../services/requirementFeaturesService.cjs');

/**
 * @param {object} [data] - Workflow context (unused).
 * @returns {Promise<object>}
 */
async function run(data = {}) {
    const service = new RequirementFeaturesService(productSettings());
    const mappings = await service.retrieve();
    return {
        response: { count: mappings.length },
        receivedData: data,
        processedAt: new Date().toISOString(),
    };
}

module.exports = { run };
