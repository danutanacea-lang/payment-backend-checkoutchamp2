if (paymentMethod === 'multibanco') {
  console.log(`MULTIBANCO AUTHORISATION received for order: ${orderId}`);

  const meta = event.additionalData || {};
  const firstName = meta['metadata.firstName'] || 'Multibanco';
  const lastName = meta['metadata.lastName'] || 'Customer';
  const email = meta['metadata.email'] || shopperEmail;
  const phone = meta['metadata.phone'] || '000000000';
  const address1 = meta['metadata.address1'] || 'N/A';
  const city = meta['metadata.city'] || 'N/A';
  const zip = meta['metadata.zip'] || '0000-000';
  const country = meta['metadata.country'] || 'PT';
  const quantity = parseInt(meta['metadata.quantity'] || '1');

  const ccResponse = await fetch('https://api.checkoutchamp.com/order/import/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: process.env.CC_API_LOGIN,
      password: process.env.CC_API_PASSWORD,
      campaignId: process.env.CC_CAMPAIGN_ID,
      orderStatus: 'complete',
      paymentStatus: 'complete',
      firstName: firstName,
      lastName: lastName,
      email: email,
      address1: address1,
      city: city,
      state: 'N/A',
      zip: zip,
      country: country,
      phone: phone,
      productId: process.env.CC_PRODUCT_ID,
      productQty: quantity,
      transactionId: event.pspReference,
      externalOrderId: orderId
    })
  });

  const ccData = await ccResponse.json();
  console.log('CC order/import response:', JSON.stringify(ccData));
}
