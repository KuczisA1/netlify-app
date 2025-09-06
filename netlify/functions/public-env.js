// netlify/functions/public-env.js
exports.handler = async () => {
  try {
    const out = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith("YT_") && typeof v === "string" && v.trim()) {
        out[k] = v.trim(); // zakłada: wartość = ID filmu z YouTube
      }
    }
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify(out)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "env_failed" }) };
  }
};
