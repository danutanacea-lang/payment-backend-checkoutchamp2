export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, amount } = req.body;

    const response = await fetch('https://checkout-live.adyen.com/v69/sessions', {
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
        shopperEmail: email,
        channel: 'Web',
        allowedPaymentMethods: ['mbway']
      })
    });

    const data = await response.json();

    return res.status(response.ok ? 200 : 500).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
