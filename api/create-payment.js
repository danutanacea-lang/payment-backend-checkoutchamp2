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

    const orderId = parsed.orderId || ('order-' + Date.now());
    const shopperEmail = parsed.email || '';
    const firstName = parsed.firstName || '';
    const lastName = parsed.lastName || '';
    const phone = parsed.phone || '';
    const address1 = parsed.address1 || '';
    const city = parsed.city || '';
    const zip = parsed.zip || '';
    const country = parsed.country || 'PT';
    const amount = parsed.amount || 3900;
    const quantity = parsed.quantity || 1;

    const data = JSON.stringify({
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: { currency: 'EUR', value: amount },
      reference: orderId,
      paymentMethod: { type: 'multibanco' },
      returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/typagemulti',
      shopperEmail: shopperEmail,
      shopperName: { firstName: firstName, lastName: lastName },
      shopperReference: orderId,
      telephoneNumber: phone,
      billingAddress: {
        street: address1 || 'N/A',
        city: city || 'N/A',
        postalCode: zip || '0000-000',
        country: country,
        stateOrProvince: 'N/A'
      },
      additionalData: {
        'metadata.firstName': firstName,
        'metadata.lastName': lastName,
        'metadata.email': shopperEmail,
        'metadata.phone': phone,
        'metadata.address1': address1,
        'metadata.city': city,
        'metadata.zip': zip,
        'metadata.country': country,
        'metadata.quantity': String(quantity)
      },
      countryCode: 'PT',
      shopperLocale: 'pt-PT'
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
          console.log('ADYEN RESPONSE:', JSON.stringify(parsedResponse));
          res.status(200).json(parsedResponse);
        } catch {
          res.status(200).json({ raw: responseData });
        }
      });
    });

    request.on('error', (error) => {
      console.log('REQUEST ERROR:', error.message, error.code);
      res.status(500).json({ error: error.message, code: error.code });
    });

    request.write(data);
    request.end();

  } catch (error) {
    console.log('CATCH ERROR:', error.message, error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
