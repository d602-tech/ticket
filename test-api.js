fetch('https://script.google.com/macros/s/AKfycbzLmt5zmH3YPIUnBzoeyrT9nrGJZzw28wzPBqhPtplhEKzqt2jc35PnwgBMaTxepeuH/exec', {
    method: 'POST',
    body: JSON.stringify({ action: 'getData' }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
})
    .then(r => r.json())
    .then(d => console.log('Violations fetched:', d.violations.length))
    .catch(console.error);
