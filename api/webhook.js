import crypto from 'crypto';

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
    return hmac.digest('base64') === hmacSignature;
  } catch (e) {
    console.error('HMAC error:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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

      if (hmacKey && !verifyHmac(item, hmacKey)) {
        console.warn('Invalid HMAC — ignoring:', event.pspReference);
        continue;
      }

      const pspReference  = event.pspReference;
      const orderId       = event.merchantReference;
      const paymentMethod = event.paymentMethod;
      const eventCode     = event.eventCode;
      const success       = event.success === 'true';

      if (paymentMethod !== 'multibanco') continue;

      const eventKey = `${pspReference}-${eventCode}`;
      if (processedPayments.has(eventKey)) {
        console.log(`Duplicate ignored: ${eventKey}`);
        continue;
      }
      processedPayments.add(eventKey);

      if (eventCode === 'AUTHORISATION' && success) {
        console.log(`MULTIBANCO PAID — updating to complete, order: ${orderId}`);

        // Retrieve CC orderId from Adyen payment additionalData
        const ccOrderId = event.additionalData?.['metadata.ccOrderId'] || null;
        console.log('CC orderId from metadata:', ccOrderId);

        // Build update payload — prefer native CC orderId, fallback to externalOrderId
        const updatePayload = {
          loginId:      process.env.CC_API_LOGIN,
          password:     process.env.CC_API_PASSWORD,
          orderStatus:  'complete',
          paymentStatus: 'paid'
        };
        if (ccOrderId) {
          updatePayload.orderId = ccOrderId;
        } else {
          updatePayload.externalOrderId = orderId;
        }

        const updateRes = await fetch('https://api.checkoutchamp.com/order/update/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });

        const updateData = await updateRes.json();
        console.log('CC order/update response:', JSON.stringify(updateData));
      }
    }

    res.status(200).send('[accepted]');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('[accepted]');
  }
}
