import { markConfirmed } from './payment-status.js';

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

    for (const item of items) {
      const event = item.NotificationRequestItem;

      if (event.eventCode === 'AUTHORISATION' && event.success === 'true') {
        const orderId = event.merchantReference;
        const recurringRef = event.additionalData?.['recurring.recurringDetailReference'];
        const shopperRef = event.additionalData?.['recurring.shopperReference'];

        // Mark phone as confirmed for frontend polling
        if (shopperRef) {
          markConfirmed(shopperRef);
        }

        // Mark order complete in CheckoutChamp
        await fetch('https://api.checkoutchamp.com/order/update/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loginId: process.env.CC_API_LOGIN,
            password: process.env.CC_API_PASSWORD,
            orderId: orderId,
            orderStatus: 'complete'
          })
        });

        if (recurringRef) {
          console.log(`TOKEN for ${shopperRef}: ${recurringRef}`);
        }
      }
    }

    res.status(200).send('[accepted]');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('[accepted]');
  }
}
