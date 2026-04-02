import https from 'https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', resolve);
    });

    let parsed = {};
    try { parsed = JSON.parse(body); } catch (e) {}

    const orderId    = parsed.orderId || ('order-' + Date.now());
    const email      = parsed.email || '';
    const firstName  = parsed.firstName || '';
    const lastName   = parsed.lastName || '';
    const phone      = parsed.phone || '';
    const address1   = parsed.address1 || '';
    const city       = parsed.city || '';
    const zip        = parsed.zip || '';
    const country    = parsed.country || 'PT';
    const amount     = parsed.amount || 3900;
    const quantity   = parsed.quantity || 1;

    // ── Step 1: Call Adyen to generate Multibanco voucher ──
    const adyenData = JSON.stringify({
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      amount: { currency: 'EUR', value: amount },
      reference: orderId,
      paymentMethod: { type: 'multibanco' },
      returnUrl: 'https://www.remedios-caseiros-de-antigamente.com/typagemulti',
      shopperEmail: email,
      shopperName: { firstName, lastName },
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
        'metadata.lastName':  lastName,
        'metadata.email':     email,
        'metadata.phone':     phone,
        'metadata.address1':  address1,
        'metadata.city':      city,
        'metadata.zip':       zip,
        'metadata.country':   country,
        'metadata.quantity':  String(quantity),
        'metadata.ccOrderId': '' // populated below after CC call
      },
      countryCode: 'PT',
      shopperLocale: 'pt-PT'
    });

    const adyenResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'ca4f1491abb67c33-GlobalBrother-checkout-live.adyenpayments.com',
        path: '/checkout/v68/payments',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.ADYEN_API_KEY,
          'Content-Length': Buffer.byteLength(adyenData)
        }
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Failed to parse Adyen response')); }
        });
      });
      request.on('error', reject);
      request.write(adyenData);
      request.end();
    });

    console.log('ADYEN RESPONSE:', JSON.stringify(adyenResponse));

    // ── Step 2: If voucher generated, create Partial order in CC ──
    if (adyenResponse.resultCode === 'PresentToShopper' && adyenResponse.action?.type === 'voucher') {
      const ccData = JSON.stringify({
        loginId:        process.env.CC_API_LOGIN,
        password:       process.env.CC_API_PASSWORD,
        campaignId:     process.env.CC_CAMPAIGN_ID,
        orderStatus:    'partial',
        paymentStatus:  'partial',
        firstName, lastName, email,
        address1:       address1 || 'N/A',
        city:           city || 'N/A',
        state:          'N/A',
        zip:            zip || '0000-000',
        country,
        phone:          phone || '000000000',
        productId:      process.env.CC_PRODUCT_ID,
        productQty:     quantity,
        transactionId:  adyenResponse.pspReference,
        externalOrderId: orderId
      });

      const ccResponse = await fetch('https://api.checkoutchamp.com/order/import/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ccData
      });

      const ccResult = await ccResponse.json();
      console.log('CC order/import response:', JSON.stringify(ccResult));

      const ccOrderId = ccResult.message?.orderId || null;
      adyenResponse._ccOrderId = ccOrderId;
      console.log('CC orderId:', ccOrderId);

      // ── Step 3: Patch Adyen payment metadata with CC orderId ──
      // So the webhook can retrieve it without a DB
      if (ccOrderId && adyenResponse.pspReference) {
        const patchData = JSON.stringify({
          applicationInfo: {
            externalPlatform: {
              name: 'custom',
              version: '1.0'
            }
          },
          metadata: { ccOrderId: String(ccOrderId) }
        });
        const pspRef = encodeURIComponent(adyenResponse.pspReference);
        const patchOptions = {
          hostname: 'ca4f1491abb67c33-GlobalBrother-checkout-live.adyenpayments.com',
          path: `/checkout/v68/payments/${pspRef}/details`,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.ADYEN_API_KEY,
            'Content-Length': Buffer.byteLength(patchData)
          }
        };
        try {
          await new Promise((resolve, reject) => {
            const r = https.request(patchOptions, (response) => {
              response.on('data', () => {});
              response.on('end', resolve);
            });
            r.on('error', reject);
            r.write(patchData);
            r.end();
          });
          console.log('Patched Adyen metadata with ccOrderId:', ccOrderId);
        } catch (e) {
          console.warn('Could not patch Adyen metadata:', e.message);
        }
      }
    }

    res.status(200).json(adyenResponse);

  } catch (error) {
    console.log('ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
}
