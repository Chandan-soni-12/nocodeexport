// ============================================================
// netlify.ts — Netlify deployment helper
// ============================================================

import * as fs from 'fs/promises';
import axios from 'axios';

interface DeployResult {
  siteId: string;
  deployId: string;
  url: string;
}

/**
 * Deploy a ZIP file to Netlify
 */
export async function deployToNetlify(
  zipPath: string,
  siteName: string
): Promise<DeployResult> {
  const apiToken = process.env.NETLIFY_API_TOKEN;
  if (!apiToken) {
    throw new Error('NETLIFY_API_TOKEN not configured');
  }

  const apiBase = 'https://api.netlify.com/api/v1';
  const headers = {
    Authorization: `Bearer ${apiToken}`,
  };

  // Step 1: Create site (or find existing)
  let siteId: string;
  try {
    const createResponse = await axios.post(
      `${apiBase}/sites`,
      { name: siteName },
      { headers }
    );
    siteId = createResponse.data.id;
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: { errors?: Record<string, { 0: string }> } } };
    // If site name already exists, try to find it
    if (error.response?.status === 422) {
      const listResponse = await axios.get(`${apiBase}/sites?name=${siteName}`, {
        headers,
      });
      if (listResponse.data.length > 0) {
        siteId = listResponse.data[0].id;
      } else {
        throw new Error(`Site name "${siteName}" is not available`);
      }
    } else {
      throw err;
    }
  }

  // Step 2: Deploy ZIP
  const zipBuffer = await fs.readFile(zipPath);

  const deployResponse = await axios.post(
    `${apiBase}/sites/${siteId}/deploys`,
    zipBuffer,
    {
      headers: {
        ...headers,
        'Content-Type': 'application/zip',
      },
      maxContentLength: 100 * 1024 * 1024, // 100MB max
      timeout: 120000, // 2 minute timeout
    }
  );

  const deployData = deployResponse.data;

  return {
    siteId,
    deployId: deployData.id,
    url: deployData.ssl_url || deployData.url || `https://${siteName}.netlify.app`,
  };
}

/**
 * Check the status of a Netlify deployment
 */
export async function getDeployStatus(
  deployId: string
): Promise<{ status: string; url: string }> {
  const apiToken = process.env.NETLIFY_API_TOKEN;
  if (!apiToken) throw new Error('NETLIFY_API_TOKEN not configured');

  const response = await axios.get(
    `https://api.netlify.com/api/v1/deploys/${deployId}`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );

  return {
    status: response.data.state,
    url: response.data.ssl_url || response.data.url,
  };
}
