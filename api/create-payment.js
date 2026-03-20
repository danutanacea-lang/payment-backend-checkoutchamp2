export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, amount } = req.body;

    const response = await fetch('https://checkout-live.adyen.com/v68/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ADYEN_API_KEY
      },
      body: JSON.stringify({
        merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
        amount: {
          currency: 'EUR',
          value: amount || 4900
        },
        reference: 'order-' + Date.now(),
        returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/upsell',
        countryCode: 'PT',
        shopperEmail: email || 'test@email.com',
        channel: 'Web',
        paymentMethod: {
          type: 'mbway'
        }
      })
    });

    const text = await response.text();

    return res.status(200).json({
      status: response.status,
      raw: text
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}
