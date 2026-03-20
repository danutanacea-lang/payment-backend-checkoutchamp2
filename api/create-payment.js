import https from 'https';

export default function handler(req, res) {
  try {
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
        // ALWAYS return something, never crash
        return res.status(200).json({
          adyenStatus: response.statusCode,
          raw: body || 'EMPTY RESPONSE'
        });
      });
    });

    request.on('error', (error) => {
      return res.status(500).json({
        step: 'request_error',
        message: error.message
      });
    });

    request.write(data);
    request.end();

  } catch (error) {
    return res.status(500).json({
      step: 'outer_crash',
      message: error.message
    });
  }
}
