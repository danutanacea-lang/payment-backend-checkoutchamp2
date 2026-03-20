export default async function handler(req, res) {
  try {
    return res.status(200).json({
      message: "Function is alive",
      apiKey: process.env.ADYEN_API_KEY ? "EXISTS" : "MISSING",
      merchant: process.env.ADYEN_MERCHANT_ACCOUNT ? "EXISTS" : "MISSING"
    });
  } catch (error) {
    return res.status(500).json({
      crash: error.message
    });
  }
}
