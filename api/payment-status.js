const confirmed = new Set();

export function markConfirmed(phone) {
  confirmed.add(phone);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { ref } = req.query;
  if (!ref) return res.status(400).json({ error: 'missing ref' });
  res.status(200).json({ paid: confirmed.has(ref) });
}
