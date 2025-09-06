// netlify/functions/identity-login.js
exports.handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || "{}");
    const user = payload && payload.user;
    const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
    // Jeśli role już są — nic nie rób
    if (Array.isArray(roles) && roles.length > 0) {
      return { statusCode: 200, body: "{}" };
    }
    // Brak ról → doszczep "pending"
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_metadata: { roles: ["pending"] } })
    };
  } catch {
    return { statusCode: 200, body: "{}" };
  }
};
