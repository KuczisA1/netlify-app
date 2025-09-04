// Webhook Stripe – po udanej płatności nadaje rolę `active` użytkownikowi Identity


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


export async function handler(event, context) {
if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };


const signature = event.headers['stripe-signature'];
let body = event.body;
if (event.isBase64Encoded) body = Buffer.from(event.body, 'base64').toString('utf8');


let stripeEvent;
try {
stripeEvent = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
} catch (err) {
console.error('Webhook signature verification failed', err.message);
return { statusCode: 400, body: `Webhook Error: ${err.message}` };
}


if (stripeEvent.type === 'checkout.session.completed') {
const session = stripeEvent.data.object;
const userId = session.client_reference_id; // ustawione w create-checkout


if (userId) {
try {
// Z kontekstu funkcji pobieramy tymczasowy token admina Identity i URL GoTrue
const raw = context.clientContext && context.clientContext.custom && context.clientContext.custom.netlify;
const netlifyContext = raw ? JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) : null;
const identityUrl = netlifyContext?.identity?.url;
const adminToken = netlifyContext?.identity?.token; // krótkotrwały token admina


if (!identityUrl || !adminToken) throw new Error('Missing Identity admin context');


// Pobierz istniejące role, dodaj `active`
const userRes = await fetch(`${identityUrl}/admin/users/${userId}`, {
headers: { Authorization: `Bearer ${adminToken}` }
});
const userJson = await userRes.json();
const existing = new Set((userJson.app_metadata && userJson.app_metadata.roles) || []);
existing.add('active');


await fetch(`${identityUrl}/admin/users/${userId}`, {
method: 'PUT',
headers: {
Authorization: `Bearer ${adminToken}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({ app_metadata: { roles: Array.from(existing) } })
});


console.log(`User ${userId} promoted to role: active`);
} catch (e) {
console.error('Identity role update failed', e);
// zwróć 200, aby Stripe nie ponawiał w nieskończoność jeśli błąd po naszej stronie wymaga ręcznej interwencji
}
}
}


return { statusCode: 200, body: 'ok' };
}