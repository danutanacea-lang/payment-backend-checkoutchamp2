import https from 'https';

const ALLOWED_ORIGIN = 'https://www.remedios-caseiros-de-antigamente.com';
const ADYEN_HOSTNAME = 'ca4f1491abb67c33-GlobalBrother-checkout-live.adyenpayments.com';
const ADYEN_PATH = '/checkout/v68/payments';
const FIXED_AMOUNT = 3900;
const RETURN_URL = 'https://www.remedios-caseiros-de-antigamente.com/upsell';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function normalizePhone(input) {
  let phone = String(input || '').trim();

  phone = phone.replace(/[^\d+]/g, '');

  if (!phone) return '';

  if (phone.startsWith('+351')) return phone;

  if (phone.startsWith('351')) return '+' + phone;

  if (/^9\d{8}$/.test(phone)) return '+351' + phone;

  return phone;
}

function isValidPortugueseMobile(phone) {
  return /^\+3519\d{8}$/.test(phone);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function callAdyen(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: ADYEN_HOSTNAME,
      path: ADYEN_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ADYEN_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const request = https.request(options, response => {
      let responseData = '';

      response.on('data', chunk => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        resolve({
          statusCode: response.statusCode || 500,
          body: responseData
        });
      });
    });

    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const contentType = req.headers['content-type'] || '';

  if (origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  if (referer && !referer.startsWith(ALLOWED_ORIGIN)) {
    return res.status(403).json({ error: 'Invalid referer' });
  }

  if (!contentType.includes('application/json')) {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }

  if (!process.env.ADYEN_API_KEY || !process.env.ADYEN_MERCHANT_ACCOUNT) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  try {
    const rawBody = await readRequestBody(req);

    let parsed;
    try {
      parsed = JSON.parse(rawBody || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const phone = normalizePhone(parsed.phone);

    if (!isValidPortugueseMobile(phone)) {
      return res.status(400).json({ error: 'Invalid Portuguese mobile number' });
    }

    const payload = {
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: {
        currency: 'EUR',
        value: FIXED_AMOUNT
      },
      reference: 'order-' + Date.now(),
      paymentMethod: {
        type: 'mbway',
        telephoneNumber: phone
      },
      returnUrl: RETURN_URL
    };

    const adyenResponse = await callAdyen(payload);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(adyenResponse.body);
    } catch {
      return res.status(502).json({ error: 'Invalid Adyen response' });
    }

    if (adyenResponse.statusCode >= 400) {
      return res.status(adyenResponse.statusCode).json({
        error: parsedResponse.message || 'Adyen error',
        errorCode: parsedResponse.errorCode || null
      });
    }

    return res.status(200).json({
      resultCode: parsedResponse.resultCode,
      pspReference: parsedResponse.pspReference
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
