const key = 'b80c2ba043msh7b64fde2bcd3be2p11957ajsnc63f1efce906';
const url = 'https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=Abuja&locale=en-gb';
(async () => {
  try {
    const res = await fetch(url, { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'booking-com15.p.rapidapi.com' } });
    const text = await res.text();
    console.log('status', res.status);
    console.log('ok', res.ok);
    console.log('body', text.slice(0, 500));
  } catch (e) {
    console.error('error', e.message);
  }
})();
