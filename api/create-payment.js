import https from 'https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', resolve);
    });

    let parsed = {};
    try { parsed = JSON.parse(body); } catch (e) {}

    let phone = parsed.phone || '';
    let orderId = parsed.orderId || ('order-' + Date.now());
    let shopperEmail = parsed.email || '';
    let shopperName = parsed.name || '';

    if (!phone.startsWith('+')) {
      if (phone.startsWith('351')) {
        phone = '+' + phone;
      } else {
        phone = '+351' + phone;
      }
    }

    const data = JSON.stringify({
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: { currency: 'EUR', value: 4900 },
      reference: orderId,
      paymentMethod: { type: 'mbway', telephoneNumber: phone },
      returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/upsell',
      shopperEmail: shopperEmail,
      shopperName: { firstName: shopperName },
      shopperReference: phone,
      storePaymentMethod: true,
      recurringProcessingModel: 'UnscheduledCardOnFile'
    });

    const options = {
      hostname: 'ca4f1491abb67c33-GlobalBrother-checkout-live.adyenpayments.com',
      path: '/checkout/v68/payments',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ADYEN_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const request = https.request(options, (response) => {
      let responseData = '';
      response.on('data', chunk => { responseData += chunk; });
      response.on('end', () => {
        try {
          const parsedResponse = JSON.parse(responseData);
          res.status(200).json(parsedResponse);
        } catch {
          res.status(200).json({ raw: responseData });
        }
      });
    });

    request.on('error', (error) => {
      res.status(500).json({ error: error.message });
    });

    request.write(data);
    request.end();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
