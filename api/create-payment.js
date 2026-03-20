export default async function handler(req, res) {
  return res.status(200).json({
    apiKey: process.env.ADYEN_API_KEY || 'MISSING',
    merchant: process.env.ADYEN_MERCHANT_ACCOUNT || 'MISSING'
  });
}
