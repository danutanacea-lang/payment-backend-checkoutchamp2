import crypto from 'crypto';

// In-memory set to prevent duplicate order creation
const processedPayments = new Set();

function verifyHmac(notification, hmacKey) {
  try {
    const data = notification.NotificationRequestItem;
    const hmacSignature = data.additionalData?.hmacSignature;
    if (!hmacSignature) return false;

    const signedData = [
      data.pspReference,
      data.originalReference || '',
      data.merchantAccountCode,
      data.merchantReference,
      data.amount.value,
      data.amount.currency,
      data.eventCode,
      data.success
    ].join(':');

    const keyBytes = Buffer.from(hmacKey, 'hex');
    const hmac = crypto.createHmac('sha256', keyBytes);
    hmac.update(signedData, 'utf8');
    const computed = hmac.digest('base64');

    return computed === hmacSignature;
  } catch (e) {
    console.error('HMAC verification error:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', resolve);
    });

    const notification = JSON.parse(body);
    const items = notification?.notificationItems || [];
    const hmacKey = process.env.ADYEN_HMAC_KEY;

    for (const item of items) {
      const event = item.NotificationRequestItem;

      // --- HMAC verification ---
      if (hmacKey) {
        const valid = verifyHmac(item, hmacKey);
        if (!valid) {
          console.warn('Invalid HMAC signature — ignoring event:', event.pspReference);
          continue;
        }
      }

      if (event.eventCode === 'AUTHORISATION' && event.success === 'true') {
        const pspReference = event.pspReference;
        const orderId = event.merchantReference;
        const paymentMethod = event.paymentMethod;

        // --- Duplicate protection ---
        if (processedPayments.has(pspReference)) {
          console.log(`Duplicate event ignored: ${pspReference}`);
          continue;
        }
        processedPayments.add(pspReference);

        // --- MULTIBANCO only ---
        if (paymentMethod === 'multibanco') {
          console.log(`MULTIBANCO AUTHORISATION received — order: ${orderId}, psp: ${pspReference}`);

          const meta = event.additionalData || {};
          const firstName = meta['metadata.firstName'] || 'Multibanco';
          const lastName  = meta['metadata.lastName']  || 'Customer';
          const email     = meta['metadata.email']     || '';
          const phone     = meta['metadata.phone']     || '000000000';
          const address1  = meta['metadata.address1']  || 'N/A';
          const city      = meta['metadata.city']      || 'N/A';
          const zip       = meta['metadata.zip']       || '0000-000';
          const country   = meta['metadata.country']   || 'PT';
          const quantity  = parseInt(meta['metadata.quantity'] || '1');

          const ccResponse = await fetch('https://api.checkoutchamp.com/order/import/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              loginId:        process.env.CC_API_LOGIN,
              password:       process.env.CC_API_PASSWORD,
              campaignId:     process.env.CC_CAMPAIGN_ID,
              orderStatus:    'complete',
              paymentStatus:  'complete',
              firstName:      firstName,
              lastName:       lastName,
              email:          email,
              address1:       address1,
              city:           city,
              state:          'N/A',
              zip:            zip,
              country:        country,
              phone:          phone,
              productId:      process.env.CC_PRODUCT_ID,
              productQty:     quantity,
              transactionId:  pspReference,
              externalOrderId: orderId
            })
          });

          const ccData = await ccResponse.json();
          console.log('CC order/import response:', JSON.stringify(ccData));
        }
      }
    }

    res.status(200).send('[accepted]');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('[accepted]');
  }
}
