import https from 'https';

export default function handler(req, res) {
  try {
    const { phone } = req.body;

    const data = JSON.stringify({
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: {
        currency: 'EUR',
        value: 3900
      },
      reference: 'order-' + Date.now(),
      paymentMethod: {
        type: 'mbway',
        telephoneNumber: phone
      },
      returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/upsell'
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
      let body = '';

      response.on('data', chunk => {
        body += chunk.toString();
      });

      response.on('end', () => {
        res.status(200).json({
          status: response.statusCode,
          response: body
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

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
