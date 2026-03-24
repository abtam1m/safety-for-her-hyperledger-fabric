'use strict';

const axios = require('axios');
const FormData = require('form-data');

const PINATA_JWT = process.env.PINATA_JWT;
const GATEWAY_URL = process.env.GATEWAY_URL ;
// Upload file buffer to Pinata
async function uploadToPinata(fileBuffer, fileName, metadata = {}) {
  try {
    const formData = new FormData();

    // 1. Append the file
    formData.append('file', fileBuffer, { filename: fileName });

    // 2. Append Metadata
    const pinataMetadata = JSON.stringify({
      name: fileName,
      keyvalues: metadata
    });
    formData.append('pinataMetadata', pinataMetadata);

    // 3. Append Options
    const pinataOptions = JSON.stringify({ cidVersion: 1 });
    formData.append('pinataOptions', pinataOptions);

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS', // Updated Endpoint
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${PINATA_JWT}`
        }
      }
    );

    return {
      cid: response.data.IpfsHash,
      size: response.data.PinSize,
      createdAt: response.data.Timestamp
    };
  } catch (error) {
    // This will tell you exactly WHY it's failing (e.g., "Invalid API Key")
    console.error('Pinata Upload Error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Retrieve file from IPFS via Pinata gateway
async function getFromIPFS(cid) {
  const url = `https://${GATEWAY_URL}/ipfs/${cid}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return {
    data: response.data,
    contentType: response.headers['content-type'],
    url
  };
}

// List all pinned files
async function listPins() {
  const response = await axios.get(
    'https://api.pinata.cloud/data/pinList?status=pinned',
    { headers: { Authorization: `Bearer ${PINATA_JWT}` } }
  );
  return response.data;
}

module.exports = { uploadToPinata, getFromIPFS, listPins };