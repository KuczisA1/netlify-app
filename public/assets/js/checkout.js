// Tworzenie sesji Stripe Checkout przez funkcję Netlify
(function(){
async function startCheckout(plan) {
const res = await fetch('/.netlify/functions/create-checkout', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ plan })
});
if (!res.ok) {
const txt = await res.text();
alert('Błąd tworzenia płatności: ' + txt);
return;
}
const data = await res.json();
if (data.url) window.location.href = data.url;
}


document.addEventListener('click', (e) => {
const btn = e.target.closest('button[data-plan]');
if (!btn) return;
startCheckout(btn.getAttribute('data-plan'));
});
})();