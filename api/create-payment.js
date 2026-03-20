import https from 'https';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, amount } = req.body;

    const payload = JSON.stringify({
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: {
        currency: 'EUR',
        value: amount || 4900
      },
      reference: 'order-' + Date.now(),
      returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/upsell',
      countryCode: 'PT',
      shopperEmail: email,
      channel: 'Web',
      allowedPaymentMethods: ['mbway']
    });

    const options = {
      hostname: 'checkout-live.adyen.com',
      path: '/v69/sessions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ADYEN_API_KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const adyenResponse = await new Promise((resolve, reject) => {
      const reqAdyen = https.request(options, (resAdyen) => {
        let data = '';

        resAdyen.on('data', (chunk) => {
          data += chunk;
        });

        resAdyen.on('end', () => {
          resolve({
            status: resAdyen.statusCode,
            body: data
          });
        });
      });

      reqAdyen.on('error', (err) => {
        reject(err);
      });

      reqAdyen.write(payload);
      reqAdyen.end();
    });

    const parsed = JSON.parse(adyenResponse.body);

    return res.status(adyenResponse.status === 200 ? 200 : 500).json(parsed);

  } catch (error) {
    console.error('FULL ERROR:', error);

    return res.status(500).json({
      error: error.message,
      details: error.toString()
    });
  }
}
