// Nadajemy domyślną rolę "pending" każdemu nowemu użytkownikowi
export async function handler(event, context) {
  try {
    const payload = JSON.parse(event.body || "{}"); // { user: {...}, identity: {...} }
    const user = payload && payload.user;
    if (!user) return { statusCode: 400, body: "No user in payload" };

    // Zwracając app_metadata modyfikujemy użytkownika przy tworzeniu
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_metadata: {
          roles: ["pending"] // default
        }
      })
    };
  } catch (e) {
    return { statusCode: 200, body: "{}" }; // nie blokuj rejestracji, w razie czego
  }
}
