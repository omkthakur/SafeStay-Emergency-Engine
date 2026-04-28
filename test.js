async function run() {
    const res = await fetch('http://127.0.0.1:8080/api/scan-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Return a JSON object with bottlenecks and suggestions.' })
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);
}
run();
