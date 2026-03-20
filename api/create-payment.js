import https from 'https';

export default function handler(req, res) {
  const data = JSON.stringify({
    merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
    amount: {
      currency: 'EUR',
      value: 4900
    },
    reference: 'order-' + Date.now(),
    paymentMethod: {
      type: 'mbway'
    },
    returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/upsell'
  });

  const options = {
    hostname: 'ca4f1491abb67c33-GlobalBrother-checkout-live.adyenpayments.com',
    path: '/v68/payments',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ADYEN_API_KEY,
      'Content-Length': data.length
    }
  };

  const request = https.request(options, (response) => {
    let body = '';

    response.on('data', chunk => {
      body += chunk;
    });

    response.on('end', () => {
      res.status(response.statusCode).json({
        status: response.statusCode,
        body: body
      });
    });
  });

  request.on('error', (error) => {
    res.status(500).json({
      error: error.message
    });
  });

  request.write(data);
  request.end();
}
