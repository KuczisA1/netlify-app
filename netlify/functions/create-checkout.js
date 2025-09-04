// Tworzy sesję Stripe Checkout (subskrypcja) dla zalogowanego użytkownika
import Stripe from 'stripe';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


export async function handler(event, context) {
if (event.httpMethod !== 'POST') {
return { statusCode: 405, body: 'Method Not Allowed' };
}


// Wymagamy zalogowania: token JWT musi być obecny
const user = context.clientContext && context.clientContext.user;
if (!user) return { statusCode: 401, body: 'Unauthorized' };


const { plan } = JSON.parse(event.body || '{}');
const priceId = plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
if (!priceId) return { statusCode: 400, body: 'Missing price id' };


const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;


try {
const session = await stripe.checkout.sessions.create({
mode: 'subscription',
line_items: [{ price: priceId, quantity: 1 }],
success_url: `${siteUrl}/dashboard.html?paid=1&session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `${siteUrl}/dashboard.html?canceled=1`,
customer_email: user.email,
client_reference_id: user.sub, // ID użytkownika z Netlify Identity
metadata: { netlify_user_id: user.sub, email: user.email }
});


return {
statusCode: 200,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: session.url })
};
} catch (err) {
console.error(err);
return { statusCode: 500, body: err.message };
}
}