// Nadaj rolę "pending" podczas rejestracji (Identity-triggered function)
export async function handler(event) {
  try {
    const payload = JSON.parse(event.body || "{}"); // { user: {...}, ... }
    if (!payload || !payload.user) {
      return { statusCode: 400, body: "No user in payload" };
    }

    // Zwracając app_metadata ustawiamy role tuż przy tworzeniu konta
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_metadata: {
          roles: ["pending"]
        }
      })
    };
  } catch {
    // Nie blokuj rejestracji, jeśli coś nie tak – user powstanie bez roli
    return { statusCode: 200, body: "{}" };
  }
}
