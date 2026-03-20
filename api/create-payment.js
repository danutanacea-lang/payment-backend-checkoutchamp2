import https from 'https';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = JSON.stringify({
    merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
    amount: {
      currency: 'EUR',
      value: 4900
    },
    reference: 'order-' + Date.now(),
    returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/upsell',
    countryCode: 'PT',
    shopperEmail: 'test@email.com',
    channel: 'Web',
    paymentMethod: {
      type: 'mbway'
    }
  });

  const options = {
    hostname: 'checkout-live.adyen.com',
    path: '/v68/sessions',
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
}    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
